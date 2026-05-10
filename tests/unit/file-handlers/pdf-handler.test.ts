import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PdfHandler } from '@/background/file-handlers/pdf-handler';
import { FAKE_PDF_TEXT_PAGES, makeMockPdfDocument } from '../../fixtures/files/make-pdf';
import type { Mapping } from '@/shared/types';

vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn(),
  GlobalWorkerOptions: { workerSrc: '' },
}));

import * as pdfjsLib from 'pdfjs-dist';

describe('PdfHandler', () => {
  let handler: PdfHandler;
  const fakeBuffer = new ArrayBuffer(8);
  const mockDoc = makeMockPdfDocument(FAKE_PDF_TEXT_PAGES);

  beforeEach(() => {
    handler = new PdfHandler();
    vi.mocked(pdfjsLib.getDocument).mockReturnValue({
      promise: Promise.resolve(mockDoc),
    } as any);
  });

  it('canHandle: PDF MIME → true', () => {
    expect(handler.canHandle({
      mimeType: 'application/pdf',
      magicBytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    })).toBe(true);
  });

  it('extractText: 모든 페이지 텍스트 수집', async () => {
    const text = await handler.extractText(fakeBuffer);
    expect(text).toContain('홍길동');
    expect(text).toContain('900101-1234567');
    expect(text).toContain('1페이지');
    expect(text).toContain('2페이지');
  });

  it('defaultMode는 txt (PDF 재생성 불가)', () => {
    expect(handler.defaultMode).toBe('txt');
  });

  it('reconstruct: 항상 txt 모드로 반환', async () => {
    const mappings: Mapping[] = [{ original: '홍길동', alias: 'A씨', category: 'person' }];
    const result = await handler.reconstruct(fakeBuffer, mappings, 'preserve'); // preserve 요청해도
    expect(result.mimeType).toBe('text/plain;charset=utf-8');  // 항상 txt
  });
});
