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
    } catch (err) {
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

function applyMappings(text: string, mappings: Mapping[]): string {
  const sorted = [...mappings].sort((a, b) => b.original.length - a.original.length);
  let result = text;
  for (const { original, alias } of sorted) {
    result = result.replaceAll(original, alias);
  }
  return result;
}
