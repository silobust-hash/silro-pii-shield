import { describe, it, expect } from 'vitest';
import { detectFormat, detectFormatSync } from '@/background/file-handlers/format-detector';

// Magic bytes
const DOCX_MAGIC = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
const HWP_OLE2_MAGIC = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const JPEG_MAGIC = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Helper: make a minimal ArrayBuffer with given header bytes
function makeBuffer(header: Uint8Array, size = 16): ArrayBuffer {
  const buf = new ArrayBuffer(size);
  new Uint8Array(buf).set(header);
  return buf;
}

// ── detectFormatSync (sync, magic+MIME only) ──────────────────────────────────
describe('detectFormatSync', () => {
  it('DOCX MIME + magic → docx', () => {
    expect(detectFormatSync(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      DOCX_MAGIC
    )).toBe('docx');
  });

  it('XLSX MIME + magic → xlsx', () => {
    expect(detectFormatSync(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      DOCX_MAGIC
    )).toBe('xlsx');
  });

  it('PPTX MIME + magic → pptx', () => {
    expect(detectFormatSync(
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      DOCX_MAGIC
    )).toBe('pptx');
  });

  it('PDF MIME + magic → pdf', () => {
    expect(detectFormatSync('application/pdf', PDF_MAGIC)).toBe('pdf');
  });

  it('magic bytes만으로 PDF 감지 (MIME 없거나 octet-stream)', () => {
    expect(detectFormatSync('application/octet-stream', PDF_MAGIC)).toBe('pdf');
  });

  it('HWP OLE2 magic → hwp', () => {
    expect(detectFormatSync('application/octet-stream', HWP_OLE2_MAGIC)).toBe('hwp');
  });

  it('JPEG magic → jpeg', () => {
    expect(detectFormatSync('image/jpeg', JPEG_MAGIC)).toBe('jpeg');
  });

  it('PNG magic → png', () => {
    expect(detectFormatSync('image/png', PNG_MAGIC)).toBe('png');
  });

  it('미지원 포맷 → null', () => {
    expect(detectFormatSync('application/zip', new Uint8Array([0x00, 0x01]))).toBeNull();
  });
});

// ── detectFormat (async, inspects ZIP internals) ──────────────────────────────
describe('detectFormat (async)', () => {
  it('PDF buffer → pdf', async () => {
    const buf = makeBuffer(PDF_MAGIC);
    expect(await detectFormat('application/pdf', buf)).toBe('pdf');
  });

  it('HWP OLE2 buffer → hwp', async () => {
    const buf = makeBuffer(HWP_OLE2_MAGIC);
    expect(await detectFormat('application/octet-stream', buf)).toBe('hwp');
  });

  it('JPEG buffer → jpeg', async () => {
    const buf = makeBuffer(JPEG_MAGIC);
    expect(await detectFormat('image/jpeg', buf)).toBe('jpeg');
  });

  it('PNG buffer → png', async () => {
    const buf = makeBuffer(PNG_MAGIC);
    expect(await detectFormat('image/png', buf)).toBe('png');
  });

  it('미지원 포맷 → null', async () => {
    const buf = makeBuffer(new Uint8Array([0x00, 0x01]));
    expect(await detectFormat('application/unknown', buf)).toBeNull();
  });

  // PPTX/HWPX/DOCX/XLSX 구분은 실제 ZIP 파일 필요 → fixture 기반 테스트 (Task 7)에서 검증
});
