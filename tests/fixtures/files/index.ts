// 각 핸들러 테스트에서 공통으로 사용하는 픽스처 헬퍼 재export

export { FAKE_DOCX_TEXT, makeMockMammothResult } from './make-docx';
export { makeMinimalXlsx, SAMPLE_XLSX_ROWS } from './make-xlsx';
export { FAKE_PDF_TEXT_PAGES, makeMockPdfDocument } from './make-pdf';

/**
 * 픽스처 정책:
 * - 모든 픽스처는 런타임 생성 (바이너리 파일 git 커밋 금지)
 * - make-*.ts는 실제 라이브러리 (SheetJS 등)를 사용해 생성 또는 mock 반환
 * - PII 샘플 데이터는 모두 가명 데이터 사용 (실제 PII 금지)
 */
