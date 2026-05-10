import { describe, it, expect, beforeEach } from 'vitest';
import * as XLSX from 'xlsx';
import { XlsxHandler } from '@/background/file-handlers/xlsx-handler';
import { makeMinimalXlsx, SAMPLE_XLSX_ROWS } from '../../fixtures/files/make-xlsx';
import type { Mapping } from '@/shared/types';

describe('XlsxHandler', () => {
  let handler: XlsxHandler;
  let xlsxBuffer: ArrayBuffer;

  beforeEach(() => {
    handler = new XlsxHandler();
    xlsxBuffer = makeMinimalXlsx(SAMPLE_XLSX_ROWS);
  });

  it('canHandle: XLSX MIME → true', () => {
    expect(handler.canHandle({
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      magicBytes: new Uint8Array([0x50, 0x4B, 0x03, 0x04]),
    })).toBe(true);
  });

  it('extractText: 셀 값을 TSV 형태로 반환', async () => {
    const text = await handler.extractText(xlsxBuffer);
    expect(text).toContain('홍길동');
    expect(text).toContain('900101-1234567');
    expect(text).toContain('Sheet1');  // 시트명 헤더 포함
  });

  it('extractText: 다중 시트 모두 포함', async () => {
    // TODO: 다중 시트 픽스처 테스트 (현재는 단일 시트만)
    const text = await handler.extractText(xlsxBuffer);
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
  });

  it('defaultMode는 preserve', () => {
    expect(handler.defaultMode).toBe('preserve');
  });

  it('reconstruct preserve: 셀 값이 가명으로 교체됨', async () => {
    const mappings: Mapping[] = [
      { original: '홍길동', alias: 'A씨', category: 'person' },
      { original: '900101-1234567', alias: '[주민번호-1]', category: 'rrn' },
    ];
    const result = await handler.reconstruct(xlsxBuffer, mappings, 'preserve');
    // 재생성된 XLSX를 다시 파싱해서 셀 값 확인
    const roundTripped = XLSX.read(result.buffer, { type: 'array' });
    const sheet = roundTripped.Sheets[roundTripped.SheetNames[0]];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    expect(csv).toContain('A씨');
    expect(csv).not.toContain('홍길동');
    expect(csv).toContain('[주민번호-1]');
  });

  it('reconstruct txt: CSV 형태 텍스트 반환', async () => {
    const mappings: Mapping[] = [{ original: '홍길동', alias: 'A씨', category: 'person' }];
    const result = await handler.reconstruct(xlsxBuffer, mappings, 'txt');
    const text = new TextDecoder().decode(result.buffer);
    expect(text).toContain('A씨');
    expect(result.mimeType).toBe('text/plain;charset=utf-8');
  });
});
