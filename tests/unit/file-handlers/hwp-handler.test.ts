import { describe, it, expect } from 'vitest';
import { HwpHandler, HwpUnsupportedError, LIBREOFFICE_URL } from '@/background/file-handlers/hwp-handler';

describe('HwpHandler', () => {
  const handler = new HwpHandler();
  const fakeHwpBuf = new ArrayBuffer(16); // 빈 버퍼 (실제 파싱 안 함)

  it('canHandle: HWP MIME → true', () => {
    expect(
      handler.canHandle({
        mimeType: 'application/x-hwp',
        magicBytes: new Uint8Array(8),
      })
    ).toBe(true);
  });

  it('canHandle: haansofthwp MIME → true', () => {
    expect(
      handler.canHandle({
        mimeType: 'application/haansofthwp',
        magicBytes: new Uint8Array(8),
      })
    ).toBe(true);
  });

  it('canHandle: vnd.hancom.hwp MIME → true', () => {
    expect(
      handler.canHandle({
        mimeType: 'application/vnd.hancom.hwp',
        magicBytes: new Uint8Array(8),
      })
    ).toBe(true);
  });

  it('canHandle: vnd.hancom.hwpx MIME → true', () => {
    expect(
      handler.canHandle({
        mimeType: 'application/vnd.hancom.hwpx',
        magicBytes: new Uint8Array(8),
      })
    ).toBe(true);
  });

  it('canHandle: HWP OLE2 magic bytes → true (MIME 무관)', () => {
    const hwpMagic = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    expect(
      handler.canHandle({
        mimeType: 'application/octet-stream',
        magicBytes: hwpMagic,
      })
    ).toBe(true);
  });

  it('canHandle: PDF MIME → false', () => {
    expect(
      handler.canHandle({
        mimeType: 'application/pdf',
        magicBytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      })
    ).toBe(false);
  });

  it('defaultMode는 txt', () => {
    expect(handler.defaultMode).toBe('txt');
  });

  it('extractText → HwpUnsupportedError를 던진다', async () => {
    await expect(handler.extractText(fakeHwpBuf)).rejects.toBeInstanceOf(
      HwpUnsupportedError
    );
  });

  it('reconstruct → HwpUnsupportedError를 던진다', async () => {
    await expect(
      handler.reconstruct(fakeHwpBuf, [], 'txt')
    ).rejects.toBeInstanceOf(HwpUnsupportedError);
  });

  it('HwpUnsupportedError.name은 "HwpUnsupportedError"', async () => {
    let caught: unknown;
    try {
      await handler.extractText(fakeHwpBuf);
    } catch (e) {
      caught = e;
    }
    expect((caught as HwpUnsupportedError).name).toBe('HwpUnsupportedError');
  });

  it('HwpUnsupportedError.converterUrl이 LibreOffice URL을 가리킨다', async () => {
    let caught: unknown;
    try {
      await handler.extractText(fakeHwpBuf);
    } catch (e) {
      caught = e;
    }
    expect((caught as HwpUnsupportedError).converterUrl).toBe(LIBREOFFICE_URL);
  });

  it('에러 메시지에 LibreOffice 안내가 포함된다', async () => {
    let caught: unknown;
    try {
      await handler.extractText(fakeHwpBuf);
    } catch (e) {
      caught = e;
    }
    expect((caught as HwpUnsupportedError).message).toContain('LibreOffice');
  });
});
