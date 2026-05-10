import { detectFormat, extractMagicBytes } from './format-detector';
// detectFormat is now async (inspects ZIP internals for PPTX/HWPX/DOCX/XLSX distinction)
import { DocxHandler } from './docx-handler';
import { XlsxHandler } from './xlsx-handler';
import { PdfHandler } from './pdf-handler';
import { PptxHandler } from './pptx-handler';
import { HwpHandler, HwpUnsupportedError } from './hwp-handler';
import type { FileHandler, ReconstructedFile } from './base';
import { ParseError } from './base';
import type { Mapping, ReconstructionMode, FileInterceptEvent, FileProcessResult } from '@/shared/types';

const HANDLERS: FileHandler[] = [
  new DocxHandler(),
  new XlsxHandler(),
  new PdfHandler(),
  new PptxHandler(),
  new HwpHandler(),
];

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

/**
 * 파일 인터셉트 이벤트를 받아 전체 파이프라인을 실행한다:
 * 1. 크기 검사
 * 2. 포맷 감지
 * 3. 핸들러 선택
 * 4. 텍스트 추출
 * 5. PII 감지 + 가명화 (외부 PIIDetector + MappingManager 호출)
 * 6. 재생성
 *
 * 모든 처리는 브라우저 내에서 완결 — 외부 서버 송신 0.
 */
export async function dispatchFileProcessing(
  event: FileInterceptEvent,
  maskText: (text: string, conversationId: string) => Promise<{ masked: string; mappings: Mapping[] }>,
  reconstructionMode: ReconstructionMode
): Promise<FileProcessResult> {
  const { requestId, arrayBuffer, fileName: _fileName, mimeType, sizeBytes } = event;

  // 크기 검사
  if (sizeBytes > MAX_FILE_SIZE) {
    return {
      requestId,
      status: 'size_exceeded',
      errorMessage: `파일 크기 ${Math.round(sizeBytes / 1024 / 1024)}MB 초과 (최대 100MB)`,
    };
  }

  // 포맷 감지 (async: ZIP 내부 content 검사 포함)
  const magicBytes = extractMagicBytes(arrayBuffer);
  void magicBytes; // kept for legacy handler.canHandle calls
  const format = await detectFormat(mimeType, arrayBuffer);

  if (!format) {
    return {
      requestId,
      status: 'unsupported',
      errorMessage: `지원하지 않는 파일 형식: ${mimeType}`,
    };
  }

  // 핸들러 선택
  const handler = HANDLERS.find(h => h.canHandle({ mimeType, magicBytes }));
  if (!handler) {
    return { requestId, status: 'unsupported', errorMessage: '핸들러 없음' };
  }

  // 텍스트 추출
  let rawText: string;
  try {
    rawText = await handler.extractText(arrayBuffer);
  } catch (err) {
    // HWP 미지원 에러는 'unsupported' 상태로 반환 (parse_error 아님)
    if (err instanceof HwpUnsupportedError) {
      return {
        requestId,
        status: 'unsupported',
        errorMessage: err.message,
      };
    }
    return {
      requestId,
      status: 'parse_error',
      errorMessage: err instanceof ParseError ? err.message : String(err),
    };
  }

  // 빈 파일 (PII 없음) → 정상 업로드 허용
  if (!rawText.trim()) {
    return { requestId, status: 'ok', extractedText: '', piiSummary: [] };
  }

  // PII 감지 + 가명화
  const { masked, mappings } = await maskText(rawText, event.conversationId);

  // PII 없으면 그대로 업로드
  if (mappings.length === 0) {
    return { requestId, status: 'ok', extractedText: rawText.slice(0, 500), piiSummary: [] };
  }

  // 재생성
  let reconstructed: ReconstructedFile;
  try {
    const mode = handler.defaultMode === 'txt' ? 'txt' : reconstructionMode;
    reconstructed = await handler.reconstruct(arrayBuffer, mappings, mode);
  } catch (err) {
    return {
      requestId,
      status: 'parse_error',
      errorMessage: `파일 재생성 실패: ${String(err)}`,
    };
  }

  return {
    requestId,
    status: 'ok',
    extractedText: masked.slice(0, 500),
    piiSummary: mappings as any,  // Mapping[]을 PiiMatch[]로 — types에서 정렬됨
    reconstructedBuffer: reconstructed.buffer,
    reconstructedFileName: reconstructed.fileName,
    reconstructedMimeType: reconstructed.mimeType,
  };
}
