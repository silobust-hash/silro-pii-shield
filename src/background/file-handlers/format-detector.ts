import JSZip from 'jszip';
import type { SupportedFormat } from '@/shared/types';

// ── MIME map ──────────────────────────────────────────────────────────────────

const MIME_MAP: Record<string, SupportedFormat> = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/pdf': 'pdf',
  'application/x-hwp': 'hwp',
  'application/haansofthwp': 'hwp',
  'application/hwp': 'hwp',
  'application/hwpx': 'hwpx',
  'application/vnd.hancom.hwp': 'hwp',
  'application/vnd.hancom.hwpx': 'hwpx',
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
};

// ── Magic bytes ───────────────────────────────────────────────────────────────

/** PK\x03\x04 (ZIP family: DOCX, XLSX, PPTX, HWPX) */
const ZIP_MAGIC = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
/** %PDF */
const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
/** OLE2 compound document (HWP legacy binary) */
const HWP_OLE2_MAGIC = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
/** JPEG: FF D8 FF */
const JPEG_MAGIC = new Uint8Array([0xff, 0xd8, 0xff]);
/** PNG: 89 50 4E 47 0D 0A 1A 0A */
const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/** WEBP: RIFF....WEBP (bytes 0-3 = RIFF, bytes 8-11 = WEBP) */
const RIFF_MAGIC = new Uint8Array([0x52, 0x49, 0x46, 0x46]);
const WEBP_SIG = new Uint8Array([0x57, 0x45, 0x42, 0x50]);

function startsWith(header: Uint8Array, sig: Uint8Array): boolean {
  if (header.length < sig.length) return false;
  return sig.every((b, i) => header[i] === b);
}

function isWebp(header: Uint8Array): boolean {
  if (header.length < 12) return false;
  return startsWith(header, RIFF_MAGIC) && WEBP_SIG.every((b, i) => header[8 + i] === b);
}

// ── ZIP content inspection ────────────────────────────────────────────────────

/**
 * ZIP 아카이브 내부를 열어 PPTX / HWPX / DOCX / XLSX 를 구별한다.
 * - HWPX: mimetype 파일 내용이 'application/hwp+zip'
 * - PPTX: [Content_Types].xml 에 'ppt/' 경로 포함
 * - XLSX: [Content_Types].xml 에 'xl/' 경로 포함
 * - DOCX: [Content_Types].xml 에 'word/' 경로 포함
 */
async function detectZipSubformat(
  buffer: ArrayBuffer
): Promise<SupportedFormat | null> {
  try {
    const zip = await JSZip.loadAsync(buffer);

    // 1. HWPX: mimetype 파일 확인
    const mimetypeFile = zip.files['mimetype'];
    if (mimetypeFile) {
      const mimetype = (await mimetypeFile.async('string')).trim();
      if (mimetype === 'application/hwp+zip') return 'hwpx';
    }

    // 2. [Content_Types].xml 분석
    const ctFile = zip.files['[Content_Types].xml'];
    if (!ctFile) return null;
    const ct = await ctFile.async('string');

    if (ct.includes('ppt/')) return 'pptx';
    if (ct.includes('xl/')) return 'xlsx';
    if (ct.includes('word/')) return 'docx';

    return null;
  } catch {
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/** ArrayBuffer에서 magic bytes(첫 12바이트) 추출 */
export function extractMagicBytes(buffer: ArrayBuffer): Uint8Array {
  return new Uint8Array(buffer, 0, Math.min(12, buffer.byteLength));
}

/**
 * MIME 타입 + magic bytes + (ZIP의 경우) 내부 content 검사로 포맷을 감지한다.
 *
 * @param mimeType  파일의 MIME 타입 문자열
 * @param buffer    파일의 전체 ArrayBuffer (ZIP 내부 검사에 필요)
 * @returns SupportedFormat 또는 null(미지원)
 */
export async function detectFormat(
  mimeType: string,
  buffer: ArrayBuffer
): Promise<SupportedFormat | null> {
  const mime = mimeType.toLowerCase().split(';')[0].trim();
  const header = extractMagicBytes(buffer);

  // 1. MIME 직접 매핑 (가장 신뢰) — 단, ZIP 계열은 내부 검사 필요
  const fromMime = MIME_MAP[mime];

  // ZIP 계열 MIME (docx/xlsx/pptx/hwpx) → 내부 검사로 정확히 구분
  const isZipMime = fromMime === 'docx' || fromMime === 'xlsx' ||
                    fromMime === 'pptx' || fromMime === 'hwpx';

  if (fromMime && !isZipMime) return fromMime;

  // 2. Magic bytes 기반 1차 분류
  if (startsWith(header, PDF_MAGIC)) return 'pdf';

  // HWP OLE2 binary
  if (startsWith(header, HWP_OLE2_MAGIC)) return 'hwp';

  // JPEG magic
  if (startsWith(header, JPEG_MAGIC)) {
    // MIME 스푸핑 방어: MIME이 명시된 경우 일치 검증
    if (mime && mime !== 'image/jpeg' && mime !== 'image/jpg' &&
        mime !== 'application/octet-stream' && mime !== '') {
      return null;
    }
    return 'jpeg';
  }

  // PNG magic
  if (startsWith(header, PNG_MAGIC)) {
    if (mime && mime !== 'image/png' &&
        mime !== 'application/octet-stream' && mime !== '') {
      return null;
    }
    return 'png';
  }

  // WEBP magic
  if (isWebp(header)) {
    if (mime && mime !== 'image/webp' &&
        mime !== 'application/octet-stream' && mime !== '') {
      return null;
    }
    return 'webp';
  }

  // ZIP magic → 내부 검사
  if (startsWith(header, ZIP_MAGIC)) {
    const subformat = await detectZipSubformat(buffer);
    if (subformat) return subformat;
    // ZIP이지만 내부 검사 실패 → MIME fallback
    if (fromMime) return fromMime;
    return null;
  }

  // 3. MIME만으로 판별 (magic 없이)
  if (fromMime) return fromMime;

  return null;
}

/**
 * 동기 버전 — magic bytes + MIME만으로 판별 (ZIP 내부 검사 불가).
 * 테스트에서 간단한 케이스 검증 시 사용.
 * ZIP 계열(docx/xlsx/pptx/hwpx)은 MIME이 명확해야만 동작.
 */
export function detectFormatSync(
  mimeType: string,
  magicBytes: Uint8Array
): SupportedFormat | null {
  const mime = mimeType.toLowerCase().split(';')[0].trim();

  // MIME 직접 매핑
  const fromMime = MIME_MAP[mime];
  if (fromMime) {
    // ZIP 계열이지만 MIME 신뢰 → 반환
    const isZipMime = fromMime === 'docx' || fromMime === 'xlsx' ||
                      fromMime === 'pptx' || fromMime === 'hwpx';
    if (fromMime && !isZipMime) return fromMime;
    if (isZipMime && startsWith(magicBytes, ZIP_MAGIC)) return fromMime;
  }

  // Magic bytes 폴백
  if (startsWith(magicBytes, PDF_MAGIC)) return 'pdf';
  if (startsWith(magicBytes, HWP_OLE2_MAGIC)) return 'hwp';
  if (startsWith(magicBytes, JPEG_MAGIC)) return 'jpeg';
  if (startsWith(magicBytes, PNG_MAGIC)) return 'png';
  if (isWebp(magicBytes)) return 'webp';

  return null;
}
