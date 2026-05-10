import type { Mapping, ReconstructionMode } from '@/shared/types';

/**
 * 파일 핸들러 공통 인터페이스.
 * 모든 처리는 브라우저 내 Web API + 번들된 라이브러리로만 수행한다.
 * 외부 서버 요청 절대 금지.
 */
export interface FileHandler {
  /** 이 핸들러가 처리 가능한 포맷인지 확인 */
  canHandle(file: { mimeType: string; magicBytes: Uint8Array }): boolean;

  /**
   * 파일에서 텍스트를 추출한다.
   * XLSX는 셀 내용을 TSV 형태로 반환 (시트명 헤더 포함).
   * @throws ParseError — 파싱 실패 시
   */
  extractText(arrayBuffer: ArrayBuffer): Promise<string>;

  /**
   * 가명화된 텍스트로 파일을 재생성한다.
   * mode='txt' → 가명화 텍스트를 Blob으로 반환 (.txt)
   * mode='preserve' → 원본 포맷 유지 + PII 교체 (DOCX/XLSX만)
   */
  reconstruct(
    originalBuffer: ArrayBuffer,
    mappings: Mapping[],
    mode: ReconstructionMode
  ): Promise<ReconstructedFile>;

  /** 기본 재생성 모드 (PDF는 항상 'txt') */
  readonly defaultMode: ReconstructionMode;
}

export interface ReconstructedFile {
  buffer: ArrayBuffer;
  fileName: string;   // 원본 파일명 기반, 예: report_masked.docx / report_masked.txt
  mimeType: string;
}

/** 파싱 실패 시 throw */
export class ParseError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'ParseError';
  }
}
