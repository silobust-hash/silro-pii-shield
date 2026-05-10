/**
 * ImageHandler 단위 테스트.
 * OCR Worker를 mock해 신뢰도 임계값 로직만 검증한다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// OCR Bridge mock — 실제 Worker / Tesseract.js 호출 없이 결과 제어
vi.mock('@/background/file-handlers/ocr-bridge', () => ({
  runOcr: vi.fn(),
  terminateOcrWorker: vi.fn(),
}));

import { ImageHandler, CONFIDENCE_THRESHOLD } from '@/background/file-handlers/image-handler';
import { runOcr } from '@/background/file-handlers/ocr-bridge';

const mockRunOcr = vi.mocked(runOcr);

describe('ImageHandler', () => {
  const handler = new ImageHandler();

  it('canHandle: image/jpeg MIME → true', () => {
    expect(handler.canHandle({ mimeType: 'image/jpeg', magicBytes: new Uint8Array(12) })).toBe(true);
  });

  it('canHandle: image/png MIME → true', () => {
    expect(handler.canHandle({ mimeType: 'image/png', magicBytes: new Uint8Array(12) })).toBe(true);
  });

  it('canHandle: image/webp MIME → true', () => {
    expect(handler.canHandle({ mimeType: 'image/webp', magicBytes: new Uint8Array(12) })).toBe(true);
  });

  it('canHandle: JPEG magic bytes (FF D8 FF) → true', () => {
    const jpegMagic = new Uint8Array(12);
    jpegMagic[0] = 0xff; jpegMagic[1] = 0xd8; jpegMagic[2] = 0xff;
    expect(handler.canHandle({ mimeType: 'application/octet-stream', magicBytes: jpegMagic })).toBe(true);
  });

  it('canHandle: PNG magic bytes → true', () => {
    const pngMagic = new Uint8Array(12);
    pngMagic[0] = 0x89; pngMagic[1] = 0x50; pngMagic[2] = 0x4e; pngMagic[3] = 0x47;
    expect(handler.canHandle({ mimeType: 'application/octet-stream', magicBytes: pngMagic })).toBe(true);
  });

  it('canHandle: application/pdf → false', () => {
    expect(handler.canHandle({ mimeType: 'application/pdf', magicBytes: new Uint8Array(12) })).toBe(false);
  });

  it('defaultMode는 txt', () => {
    expect(handler.defaultMode).toBe('txt');
  });
});

describe('ImageHandler.extractImageResult', () => {
  const handler = new ImageHandler();
  const fakeBuf = new ArrayBuffer(16);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('신뢰도 >= 0.6이면 requiresConfirm = false', async () => {
    mockRunOcr.mockResolvedValueOnce({ text: '홍길동', confidence: 0.8 });
    const result = await handler.extractImageResult(fakeBuf, 'image/jpeg');
    expect(result.requiresConfirm).toBe(false);
    expect(result.ocrConfidence).toBe(0.8);
    expect(result.text).toBe('홍길동');
  });

  it('신뢰도 < 0.6이면 requiresConfirm = true', async () => {
    mockRunOcr.mockResolvedValueOnce({ text: '흐릿한 텍스트', confidence: 0.4 });
    const result = await handler.extractImageResult(fakeBuf, 'image/png');
    expect(result.requiresConfirm).toBe(true);
    expect(result.ocrConfidence).toBe(0.4);
  });

  it('신뢰도 정확히 0.6이면 requiresConfirm = false (임계값 경계)', async () => {
    mockRunOcr.mockResolvedValueOnce({ text: '경계값', confidence: CONFIDENCE_THRESHOLD });
    const result = await handler.extractImageResult(fakeBuf, 'image/webp');
    expect(result.requiresConfirm).toBe(false);
  });

  it('OCR 실패 시 ParseError를 던진다', async () => {
    mockRunOcr.mockRejectedValueOnce(new Error('Tesseract worker crashed'));
    await expect(handler.extractImageResult(fakeBuf, 'image/jpeg')).rejects.toThrow(
      '이미지 OCR 실패'
    );
  });

  it('텍스트 앞뒤 공백이 trim된다', async () => {
    mockRunOcr.mockResolvedValueOnce({ text: '  김철수  ', confidence: 0.9 });
    const result = await handler.extractImageResult(fakeBuf, 'image/jpeg');
    expect(result.text).toBe('김철수');
  });
});

describe('ImageHandler.reconstruct', () => {
  const handler = new ImageHandler();
  const fakeBuf = new ArrayBuffer(16);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('항상 txt MIME 반환', async () => {
    mockRunOcr.mockResolvedValueOnce({ text: '홍길동', confidence: 0.9 });
    const result = await handler.reconstruct(fakeBuf, [], 'preserve');
    expect(result.mimeType).toBe('text/plain;charset=utf-8');
  });

  it('매핑 적용 후 가명화된 텍스트 반환', async () => {
    mockRunOcr.mockResolvedValueOnce({ text: '홍길동 연락처 010-1234-5678', confidence: 0.85 });
    const result = await handler.reconstruct(
      fakeBuf,
      [{ original: '홍길동', alias: 'A씨', category: 'person' }],
      'txt'
    );
    const text = new TextDecoder().decode(result.buffer);
    expect(text).toContain('A씨');
    expect(text).not.toContain('홍길동');
  });
});
