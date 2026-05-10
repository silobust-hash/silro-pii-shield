import * as XLSX from 'xlsx';
import type { FileHandler, ReconstructedFile } from './base';
import { ParseError } from './base';
import type { Mapping, ReconstructionMode } from '@/shared/types';

export class XlsxHandler implements FileHandler {
  readonly defaultMode: ReconstructionMode = 'preserve';

  canHandle(file: { mimeType: string; magicBytes: Uint8Array }): boolean {
    return file.mimeType ===
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }

  async extractText(arrayBuffer: ArrayBuffer): Promise<string> {
    try {
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const lines: string[] = [];

      for (const sheetName of workbook.SheetNames) {
        lines.push(`=== ${sheetName} ===`);
        const sheet = workbook.Sheets[sheetName];
        // sheet_to_csv: 셀 값을 CSV(콤마 구분)로 변환
        const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
        lines.push(csv);
      }

      return lines.join('\n');
    } catch (err) {
      throw new ParseError(`XLSX 텍스트 추출 실패: ${String(err)}`, err);
    }
  }

  async reconstruct(
    originalBuffer: ArrayBuffer,
    mappings: Mapping[],
    mode: ReconstructionMode
  ): Promise<ReconstructedFile> {
    if (mode === 'txt') {
      const rawText = await this.extractText(originalBuffer);
      const maskedText = applyMappings(rawText, mappings);
      const encoder = new TextEncoder();
      return {
        buffer: encoder.encode(maskedText).buffer as ArrayBuffer,
        fileName: 'spreadsheet_masked.txt',
        mimeType: 'text/plain;charset=utf-8',
      };
    }

    try {
      const workbook = XLSX.read(originalBuffer, { type: 'array' });

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        // 모든 셀을 순회하며 문자열 타입 셀만 가명화
        for (const cellAddress of Object.keys(sheet)) {
          if (cellAddress.startsWith('!')) continue;  // 메타 키 제외
          const cell = sheet[cellAddress] as XLSX.CellObject;
          if (cell.t === 's' && typeof cell.v === 'string') {
            cell.v = applyMappings(cell.v, mappings);
            cell.w = cell.v;  // formatted text도 업데이트
          }
        }
      }

      const outBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
      const arrayBuffer = outBuffer instanceof ArrayBuffer
        ? outBuffer
        : (outBuffer as Uint8Array).buffer as ArrayBuffer;

      return {
        buffer: arrayBuffer,
        fileName: 'spreadsheet_masked.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    } catch (err) {
      throw new ParseError(`XLSX 재생성 실패: ${String(err)}`, err);
    }
  }
}

function applyMappings(text: string, mappings: Mapping[]): string {
  const sorted = [...mappings].sort((a, b) => b.original.length - a.original.length);
  let result = text;
  for (const { original, alias } of sorted) {
    result = result.replaceAll(original, alias);
  }
  return result;
}
