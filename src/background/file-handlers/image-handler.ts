/**
 * 이미지 파일 핸들러 (JPG / PNG / WEBP).
 *
 * 이미지를 OCR Worker로 처리해 텍스트를 추출한다.
 * 항상 .txt 출력만 지원 (이미지 원본 재생성 불가).
 * 신뢰도(confidence)가 0.6 미만이면 requiresConfirm = true를 포함한 결과를 반환한다.
 *
 * 외부 OCR API 호출 0. innerHTML 0.
 */
import { runOcr } from './ocr-bridge';
import type { FileHandler, ReconstructedFile } from './base';
import { ParseError } from './base';
import type { Mapping, ReconstructionMode } from '@/shared/types';

/** OCR 신뢰도 임계값 — 이 값 미만이면 사용자 confirm 필요 */
export const CONFIDENCE_THRESHOLD = 0.6;

/** 이미지 핸들러가 지원하는 MIME 타입 목록 */
const SUPPORTED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

/**
 * OCR 결과를 포함한 추출 결과.
 * FileHandler.extractText()는 string만 반환하므로
 * OCR 부가 정보는 별도 메서드(extractImageResult)로 접근한다.
 */
export interface ImageExtractionResult {
  text: string;
  ocrConfidence: number;    // 0.0 - 1.0
  requiresConfirm: boolean; // true → Preflight에서 사용자 confirm 필요
}

export class ImageHandler implements FileHandler {
  /** 이미지는 원본 포맷 재생성 불가 — 항상 txt */
  readonly defaultMode: ReconstructionMode = 'txt';

  canHandle(file: { mimeType: string; magicBytes: Uint8Array }): boolean {
    const mime = file.mimeType.toLowerCase().split(';')[0].trim();
    if (SUPPORTED_IMAGE_MIMES.has(mime)) return true;

    // MIME이 octet-stream이거나 없는 경우: magic bytes로 판별
    const mb = file.magicBytes;
    // JPEG: FF D8 FF
    if (mb[0] === 0xff && mb[1] === 0xd8 && mb[2] === 0xff) return true;
    // PNG: 89 50 4E 47
    if (mb[0] === 0x89 && mb[1] === 0x50 && mb[2] === 0x4e && mb[3] === 0x47) return true;
    // WEBP: RIFF....WEBP
    if (mb[0] === 0x52 && mb[1] === 0x49 && mb[2] === 0x46 && mb[3] === 0x46 &&
        mb[8] === 0x57 && mb[9] === 0x45 && mb[10] === 0x42 && mb[11] === 0x50) return true;

    return false;
  }

  async extractText(arrayBuffer: ArrayBuffer): Promise<string> {
    const result = await this.extractImageResult(arrayBuffer, 'image/jpeg');
    return result.text;
  }

  /**
   * OCR 상세 결과 반환 (신뢰도 + requiresConfirm 포함).
   * Dispatcher는 이 메서드를 직접 사용해 FileProcessResult에 추가 정보를 포함한다.
   */
  async extractImageResult(
    arrayBuffer: ArrayBuffer,
    mimeType: string
  ): Promise<ImageExtractionResult> {
    const mime = normalizeMime(mimeType);
    // transferable: 복사본 생성 후 전달 (원본 buffer는 dispatcher가 재사용할 수 있음)
    const copy = arrayBuffer.slice(0);
    let ocrResult: { text: string; confidence: number };
    try {
      ocrResult = await runOcr(copy, mime);
    } catch (err) {
      throw new ParseError(`이미지 OCR 실패: ${String(err)}`, err);
    }

    return {
      text: ocrResult.text.trim(),
      ocrConfidence: ocrResult.confidence,
      requiresConfirm: ocrResult.confidence < CONFIDENCE_THRESHOLD,
    };
  }

  async reconstruct(
    originalBuffer: ArrayBuffer,
    mappings: Mapping[],
    _mode: ReconstructionMode
  ): Promise<ReconstructedFile> {
    // 이미지는 항상 txt 변환만 지원
    const rawText = await this.extractText(originalBuffer);
    const maskedText = applyMappings(rawText, mappings);
    const encoder = new TextEncoder();
    return {
      buffer: encoder.encode(maskedText).buffer as ArrayBuffer,
      fileName: 'image_masked.txt',
      mimeType: 'text/plain;charset=utf-8',
    };
  }
}

/** Mapping[]을 평문 텍스트에 적용 (긴 원본 먼저) */
function applyMappings(text: string, mappings: Mapping[]): string {
  const sorted = [...mappings].sort((a, b) => b.original.length - a.original.length);
  let result = text;
  for (const { original, alias } of sorted) {
    result = result.replaceAll(original, alias);
  }
  return result;
}

/** MIME 타입을 OCR Worker가 수용하는 형태로 정규화 */
function normalizeMime(mime: string): 'image/jpeg' | 'image/png' | 'image/webp' {
  const m = mime.toLowerCase().split(';')[0].trim();
  if (m === 'image/jpg' || m === 'image/jpeg') return 'image/jpeg';
  if (m === 'image/png') return 'image/png';
  if (m === 'image/webp') return 'image/webp';
  return 'image/jpeg'; // default fallback
}
