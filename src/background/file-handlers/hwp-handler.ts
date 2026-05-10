/**
 * HWP / HWPX 파일 핸들러 — Path B (명시적 미지원 폴백)
 *
 * hwp.js 스파이크 결과(docs/hwp-spike-report.md) 요약:
 * - hwp.js v0.0.3은 Node.js fs 모듈 의존 → 브라우저/Service Worker 에서 동작 불가
 * - CFB 파서가 Node.js Buffer 의존 → 대체 불가
 * - 결론: 브라우저 내 HWP 파싱 현재 불가능
 *
 * 대응: HwpUnsupportedError throw + LibreOffice DOCX 변환 안내
 * 외부 변환 API 호출 0건 (URL 안내만)
 */
import type { FileHandler, ReconstructedFile } from './base';
import type { Mapping, ReconstructionMode } from '@/shared/types';

/** LibreOffice 다운로드 URL — 무료 오픈소스 변환 도구 */
export const LIBREOFFICE_URL = 'https://www.libreoffice.org/download/download/';

/**
 * HWP/HWPX 파일이 업로드될 때 throw되는 에러.
 * Preflight Modal / Dispatcher가 catch해 안내 UI를 표시한다.
 */
export class HwpUnsupportedError extends Error {
  /** LibreOffice 다운로드 페이지 URL (UI에서 링크로 표시) */
  readonly converterUrl: string;

  constructor(message?: string) {
    super(
      message ??
        'HWP/HWPX 파일은 현재 브라우저 내 자동 처리가 불가능합니다. ' +
        `LibreOffice(${LIBREOFFICE_URL})로 DOCX 변환 후 다시 업로드해 주세요.`
    );
    this.name = 'HwpUnsupportedError';
    this.converterUrl = LIBREOFFICE_URL;
  }
}

/**
 * HWP/HWPX 핸들러.
 * extractText / reconstruct 모두 즉시 HwpUnsupportedError를 throw한다.
 */
export class HwpHandler implements FileHandler {
  /** HWP는 txt 변환조차 현재 지원 불가 — 항상 unsupported */
  readonly defaultMode: ReconstructionMode = 'txt';

  canHandle(file: { mimeType: string; magicBytes: Uint8Array }): boolean {
    const mime = file.mimeType.toLowerCase();
    // HWP OLE2 binary: magic bytes D0 CF 11 E0 ...
    const isHwpMagic =
      file.magicBytes[0] === 0xd0 &&
      file.magicBytes[1] === 0xcf &&
      file.magicBytes[2] === 0x11 &&
      file.magicBytes[3] === 0xe0;

    return (
      mime === 'application/x-hwp' ||
      mime === 'application/haansofthwp' ||
      mime === 'application/hwp' ||
      mime === 'application/hwpx' ||
      mime === 'application/vnd.hancom.hwp' ||
      mime === 'application/vnd.hancom.hwpx' ||
      isHwpMagic
    );
  }

  async extractText(_arrayBuffer: ArrayBuffer): Promise<string> {
    throw new HwpUnsupportedError();
  }

  async reconstruct(
    _originalBuffer: ArrayBuffer,
    _mappings: Mapping[],
    _mode: ReconstructionMode
  ): Promise<ReconstructedFile> {
    throw new HwpUnsupportedError();
  }
}
