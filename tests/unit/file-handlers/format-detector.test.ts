import { describe, it, expect } from 'vitest';
import { detectFormat } from '@/background/file-handlers/format-detector';

// DOCX magic bytes: PK\x03\x04 (ZIP) — 첫 4바이트
const DOCX_MAGIC = new Uint8Array([0x50, 0x4B, 0x03, 0x04]);
// PDF magic bytes: %PDF
const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

describe('detectFormat', () => {
  it('DOCX MIME + magic → docx', () => {
    expect(detectFormat('application/vnd.openxmlformats-officedocument.wordprocessingml.document', DOCX_MAGIC))
      .toBe('docx');
  });

  it('XLSX MIME + magic → xlsx', () => {
    expect(detectFormat('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', DOCX_MAGIC))
      .toBe('xlsx');
  });

  it('PDF MIME + magic → pdf', () => {
    expect(detectFormat('application/pdf', PDF_MAGIC))
      .toBe('pdf');
  });

  it('magic bytes만으로도 감지 (MIME 없거나 잘못됨)', () => {
    // application/octet-stream이지만 PDF magic
    expect(detectFormat('application/octet-stream', PDF_MAGIC))
      .toBe('pdf');
  });

  it('DOCX magic (ZIP)이지만 XLSX MIME → xlsx 우선', () => {
    // DOCX/XLSX 모두 ZIP 기반 → MIME으로 구분
    expect(detectFormat('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', DOCX_MAGIC))
      .toBe('xlsx');
  });

  it('미지원 포맷 → null', () => {
    expect(detectFormat('image/png', new Uint8Array([0x89, 0x50, 0x4E, 0x47])))
      .toBeNull();
  });
});
