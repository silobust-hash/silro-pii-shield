import { describe, it, expect } from 'vitest';
import { PptxHandler, extractPptx } from '@/background/file-handlers/pptx-handler';
import { ParseError } from '@/background/file-handlers/base';
import { makeMinimalPptx, SLIDE1_TEXTS, SLIDE2_TEXTS, NOTE1_TEXT } from '../../fixtures/files/make-pptx';
import type { Mapping } from '@/shared/types';

describe('PptxHandler', () => {
  it('canHandle: PPTX MIME → true', () => {
    const handler = new PptxHandler();
    expect(
      handler.canHandle({
        mimeType:
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        magicBytes: new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
      })
    ).toBe(true);
  });

  it('canHandle: 다른 MIME → false', () => {
    const handler = new PptxHandler();
    expect(
      handler.canHandle({
        mimeType: 'application/pdf',
        magicBytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      })
    ).toBe(false);
  });

  it('defaultMode는 preserve', () => {
    expect(new PptxHandler().defaultMode).toBe('preserve');
  });
});

describe('extractPptx', () => {
  it('슬라이드 텍스트를 순서대로 추출한다', async () => {
    const buf = await makeMinimalPptx();
    const result = await extractPptx(buf);

    // 슬라이드 1 텍스트 포함 확인
    for (const t of SLIDE1_TEXTS) {
      expect(result.text).toContain(t);
    }
    // 슬라이드 2 텍스트 포함 확인
    for (const t of SLIDE2_TEXTS) {
      expect(result.text).toContain(t);
    }
  });

  it('slideCount가 2를 반환한다', async () => {
    const buf = await makeMinimalPptx();
    const result = await extractPptx(buf);
    expect(result.slideCount).toBe(2);
  });

  it('슬라이드 노트도 추출한다 ([노트] 접두사 포함)', async () => {
    const buf = await makeMinimalPptx();
    const result = await extractPptx(buf);
    expect(result.text).toContain('[노트]');
    expect(result.text).toContain(NOTE1_TEXT);
  });

  it('손상된 파일은 ParseError를 던진다', async () => {
    const badBuf = new Uint8Array([0, 1, 2, 3]).buffer;
    await expect(extractPptx(badBuf)).rejects.toThrow('PPTX 파싱 실패');
  });

  it('손상된 파일 에러 타입은 ParseError이다', async () => {
    const badBuf = new Uint8Array([0, 1, 2, 3]).buffer;
    await expect(extractPptx(badBuf)).rejects.toBeInstanceOf(ParseError);
  });
});

describe('PptxHandler.extractText', () => {
  it('extractText가 텍스트를 반환한다', async () => {
    const handler = new PptxHandler();
    const buf = await makeMinimalPptx();
    const text = await handler.extractText(buf);
    expect(text).toContain('A씨');
  });
});

describe('PptxHandler.reconstruct', () => {
  it('txt 모드: 가명화된 .txt Blob 반환', async () => {
    const handler = new PptxHandler();
    const buf = await makeMinimalPptx();
    const mappings: Mapping[] = [
      { original: 'A씨', alias: '[인물-1]', category: 'person' },
    ];
    const result = await handler.reconstruct(buf, mappings, 'txt');
    expect(result.mimeType).toBe('text/plain;charset=utf-8');
    expect(result.fileName).toContain('.txt');
    const text = new TextDecoder().decode(result.buffer);
    expect(text).toContain('[인물-1]');
    expect(text).not.toContain('A씨');
  });

  it('preserve 모드: 새 PPTX Blob 반환 (PPTX MIME)', async () => {
    const handler = new PptxHandler();
    const buf = await makeMinimalPptx();
    const mappings: Mapping[] = [
      { original: 'A씨', alias: '[인물-1]', category: 'person' },
    ];
    const result = await handler.reconstruct(buf, mappings, 'preserve');
    expect(result.mimeType).toBe(
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );
    expect(result.fileName).toContain('.pptx');
    // 재생성된 ZIP이 유효한지 확인 (PK magic)
    const magic = new Uint8Array(result.buffer, 0, 4);
    expect(magic[0]).toBe(0x50); // P
    expect(magic[1]).toBe(0x4b); // K
  });
});
