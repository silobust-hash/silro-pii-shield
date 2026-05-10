import type { SupportedFormat } from '@/shared/types';

/** MIME → 포맷 직접 매핑 (신뢰도 높음) */
const MIME_MAP: Record<string, SupportedFormat> = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/pdf': 'pdf',
};

/** Magic bytes 시그니처 */
const MAGIC_SIGNATURES: Array<{ bytes: Uint8Array; format: SupportedFormat }> = [
  // PDF: %PDF
  { bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]), format: 'pdf' },
  // ZIP (DOCX/XLSX 공통): PK\x03\x04 — MIME으로 구분
  { bytes: new Uint8Array([0x50, 0x4B, 0x03, 0x04]), format: 'docx' }, // fallback
];

function matchesMagic(header: Uint8Array, signature: Uint8Array): boolean {
  if (header.length < signature.length) return false;
  return signature.every((byte, i) => header[i] === byte);
}

/**
 * MIME 타입과 magic bytes(첫 8바이트)로 지원 포맷을 감지한다.
 * MIME가 명확하면 MIME 우선, 불명확하면 magic bytes로 폴백.
 * @returns 지원 포맷 또는 null (미지원)
 */
export function detectFormat(
  mimeType: string,
  magicBytes: Uint8Array
): SupportedFormat | null {
  // 1. MIME 직접 매핑 (가장 신뢰)
  const fromMime = MIME_MAP[mimeType.toLowerCase().split(';')[0].trim()];
  if (fromMime) return fromMime;

  // 2. Magic bytes 폴백 (PDF는 magic으로 확실히 구분)
  for (const sig of MAGIC_SIGNATURES) {
    if (matchesMagic(magicBytes, sig.bytes)) {
      // ZIP magic → MIME 없이는 DOCX/XLSX 구분 불가 → null
      if (sig.format === 'docx' && !fromMime) return null;
      return sig.format;
    }
  }

  return null;
}

/** ArrayBuffer에서 magic bytes(첫 8바이트) 추출 */
export function extractMagicBytes(buffer: ArrayBuffer): Uint8Array {
  return new Uint8Array(buffer, 0, Math.min(8, buffer.byteLength));
}
