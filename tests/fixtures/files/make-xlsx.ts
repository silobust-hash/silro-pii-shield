import * as XLSX from 'xlsx';

/**
 * 테스트용 최소 XLSX를 ArrayBuffer로 생성한다.
 * SheetJS utils로 런타임 생성 — 바이너리 파일 git 커밋 불필요.
 */
export function makeMinimalXlsx(rows: string[][]): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return buffer instanceof ArrayBuffer ? buffer : (buffer as Uint8Array).buffer as ArrayBuffer;
}

export const SAMPLE_XLSX_ROWS = [
  ['이름', '주민번호', '전화번호'],
  ['홍길동', '900101-1234567', '010-1234-5678'],
  ['김철수', '850315-2345678', '010-9876-5432'],
];
