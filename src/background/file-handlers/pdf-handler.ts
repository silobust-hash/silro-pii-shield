import * as pdfjsLib from 'pdfjs-dist';
import type { FileHandler, ReconstructedFile } from './base';
import { ParseError } from './base';
import type { Mapping, ReconstructionMode } from '@/shared/types';

// pdf.js worker 경로 설정
// chrome.runtime.getURL은 실제 확장에서만 사용 가능 — 테스트 환경에서는 빈 문자열 허용
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = (
    typeof chrome !== 'undefined' && chrome.runtime?.getURL
      ? chrome.runtime.getURL('pdf.worker.min.mjs')
      : ''
  );
} catch {
  // 테스트 환경 또는 비 확장 컨텍스트에서는 mock이 처리
}

/** 스캔 PDF 판별 기준: 추출 텍스트가 이 글자수 미만이면 스캔 PDF로 간주 */
const SCAN_TEXT_THRESHOLD = 50;

/** 스캔 PDF 최대 처리 페이지 수 (메모리 보호) */
export const MAX_SCAN_PAGES = 20;

/**
 * PDF 핸들러.
 * - 텍스트형 PDF: pdf.js로 텍스트 직접 추출
 * - 스캔 PDF: 텍스트 추출량이 적으면 ScannedPdfError throw
 *   → Dispatcher / Offscreen Document가 캔버스 렌더링 + OCR 처리
 *
 * MV3 제약: Service Worker는 Canvas API를 사용할 수 없다.
 * 스캔 PDF OCR 파이프라인은 Offscreen Document(chrome.offscreen)에서 실행해야 한다.
 * 현재 구현: 텍스트형/스캔형 자동 판별 + 스캔형에서 ScannedPdfError 전파.
 */
export class PdfHandler implements FileHandler {
  /** PDF는 원본 포맷 재생성 불가 — 항상 txt */
  readonly defaultMode: ReconstructionMode = 'txt';

  canHandle(file: { mimeType: string; magicBytes: Uint8Array }): boolean {
    return (
      file.mimeType === 'application/pdf' ||
      (file.magicBytes[0] === 0x25 &&  // %
       file.magicBytes[1] === 0x50 &&  // P
       file.magicBytes[2] === 0x44 &&  // D
       file.magicBytes[3] === 0x46)    // F
    );
  }

  async extractText(arrayBuffer: ArrayBuffer): Promise<string> {
    try {
      const text = await extractPdfTextContent(arrayBuffer);
      // 스캔 PDF 자동 판별
      if (text.trim().length < SCAN_TEXT_THRESHOLD) {
        const pageCount = await getPdfPageCount(arrayBuffer);
        throw new ScannedPdfError(pageCount);
      }
      return text;
    } catch (err) {
      if (err instanceof ScannedPdfError) throw err;
      throw new ParseError(`PDF 텍스트 추출 실패: ${String(err)}`, err);
    }
  }

  async reconstruct(
    originalBuffer: ArrayBuffer,
    mappings: Mapping[],
    _mode: ReconstructionMode  // PDF는 mode 무관 항상 txt
  ): Promise<ReconstructedFile> {
    const rawText = await this.extractText(originalBuffer);
    const maskedText = applyMappings(rawText, mappings);
    const encoder = new TextEncoder();
    return {
      buffer: encoder.encode(maskedText).buffer as ArrayBuffer,
      fileName: 'document_masked.txt',
      mimeType: 'text/plain;charset=utf-8',
    };
  }
}

// ── 스캔 PDF 에러 ─────────────────────────────────────────────────────────────

/**
 * 스캔 PDF 감지 시 throw되는 에러.
 * Dispatcher가 catch해 Offscreen Document로 OCR 처리를 위임한다.
 */
export class ScannedPdfError extends Error {
  readonly pageCount: number;
  readonly requiresUserConfirm: boolean; // 페이지 수 > MAX_SCAN_PAGES

  constructor(pageCount: number) {
    const exceedsLimit = pageCount > MAX_SCAN_PAGES;
    super(
      exceedsLimit
        ? `스캔 PDF ${pageCount}페이지 — ${MAX_SCAN_PAGES}페이지 초과로 사용자 확인이 필요합니다.`
        : `스캔 PDF 감지 (${pageCount}페이지) — Canvas 렌더링 후 OCR 처리가 필요합니다.`
    );
    this.name = 'ScannedPdfError';
    this.pageCount = pageCount;
    this.requiresUserConfirm = exceedsLimit;
  }
}

// ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────

/** PDF에서 텍스트 내용을 추출한다 (텍스트형 PDF 전용) */
async function extractPdfTextContent(arrayBuffer: ArrayBuffer): Promise<string> {
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const pageTexts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => ('str' in item ? item.str : ''))
      .join(' ');
    pageTexts.push(pageText);
  }

  return pageTexts.join('\n\n');
}

/** PDF 페이지 수만 반환 (스캔 PDF 판별용) */
async function getPdfPageCount(arrayBuffer: ArrayBuffer): Promise<number> {
  try {
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    return pdf.numPages;
  } catch {
    return 1; // 파싱 실패 시 기본값
  }
}

function applyMappings(text: string, mappings: Mapping[]): string {
  const sorted = [...mappings].sort((a, b) => b.original.length - a.original.length);
  let result = text;
  for (const { original, alias } of sorted) {
    result = result.replaceAll(original, alias);
  }
  return result;
}
