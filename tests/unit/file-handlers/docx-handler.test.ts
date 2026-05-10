import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocxHandler } from '@/background/file-handlers/docx-handler';
import { FAKE_DOCX_TEXT, makeMockMammothResult } from '../../fixtures/files/make-docx';
import type { Mapping } from '@/shared/types';

// mammoth 전체 mock — 브라우저 환경에서 실제 ZIP 파싱 없이 테스트
vi.mock('mammoth', () => ({
  default: {
    extractRawText: vi.fn(),
  },
}));

// JSZip mock
vi.mock('jszip', () => {
  const mockGenerateAsync = vi.fn().mockResolvedValue(new ArrayBuffer(0));
  const mockLoadAsync = vi.fn().mockResolvedValue({
    file: vi.fn().mockImplementation((name: string) => {
      if (name === 'word/document.xml') {
        return { async: vi.fn().mockResolvedValue('<w:t>홍길동</w:t>') };
      }
      return null;
    }),
    generateAsync: mockGenerateAsync,
  });
  return { default: { loadAsync: mockLoadAsync } };
});

import mammoth from 'mammoth';

describe('DocxHandler', () => {
  let handler: DocxHandler;
  const fakeBuffer = new ArrayBuffer(8);

  beforeEach(() => {
    handler = new DocxHandler();
    vi.mocked(mammoth.extractRawText).mockResolvedValue(makeMockMammothResult(FAKE_DOCX_TEXT));
  });

  it('canHandle: docx MIME + ZIP magic → true', () => {
    expect(handler.canHandle({
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      magicBytes: new Uint8Array([0x50, 0x4B, 0x03, 0x04]),
    })).toBe(true);
  });

  it('canHandle: PDF MIME → false', () => {
    expect(handler.canHandle({
      mimeType: 'application/pdf',
      magicBytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    })).toBe(false);
  });

  it('extractText: mammoth 결과를 그대로 반환', async () => {
    const text = await handler.extractText(fakeBuffer);
    expect(text).toBe(FAKE_DOCX_TEXT);
    expect(mammoth.extractRawText).toHaveBeenCalledWith({ arrayBuffer: fakeBuffer });
  });

  it('extractText: mammoth 실패 → ParseError throw', async () => {
    vi.mocked(mammoth.extractRawText).mockRejectedValue(new Error('corrupt zip'));
    await expect(handler.extractText(fakeBuffer)).rejects.toMatchObject({ name: 'ParseError' });
  });

  it('defaultMode는 preserve', () => {
    expect(handler.defaultMode).toBe('preserve');
  });

  it('reconstruct preserve: XML 텍스트 노드 교체', async () => {
    const mappings: Mapping[] = [{ original: '홍길동', alias: 'A씨', category: 'person' }];
    const result = await handler.reconstruct(fakeBuffer, mappings, 'preserve');
    expect(result.mimeType).toContain('wordprocessingml');
    expect(result.fileName).toMatch(/_masked\.docx$/);
  });

  it('reconstruct txt: 텍스트 파일 반환', async () => {
    const mappings: Mapping[] = [{ original: '홍길동', alias: 'A씨', category: 'person' }];
    const result = await handler.reconstruct(fakeBuffer, mappings, 'txt');
    expect(result.mimeType).toBe('text/plain;charset=utf-8');
    expect(result.fileName).toMatch(/_masked\.txt$/);
  });
});
