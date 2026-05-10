import { describe, it, expect } from 'vitest';
import { detectRrn } from '@/background/pii-detector/regex/rrn';

describe('detectRrn', () => {
  it('하이픈 포함 주민등록번호를 감지한다', () => {
    const text = '홍길동(900101-1234567)이 신청서를 제출했다';
    const matches = detectRrn(text);
    expect(matches).toHaveLength(1);
    expect(matches[0].original).toBe('900101-1234567');
    expect(matches[0].category).toBe('rrn');
    expect(matches[0].start).toBe(4);
    expect(matches[0].end).toBe(18);
  });

  it('하이픈 없는 주민등록번호를 감지한다', () => {
    const matches = detectRrn('주민번호 9001011234567');
    expect(matches).toHaveLength(1);
    expect(matches[0].original).toBe('9001011234567');
  });

  it('잘못된 월/일은 감지하지 않는다', () => {
    expect(detectRrn('991399-1234567')).toHaveLength(0);
    expect(detectRrn('990230-1234567')).toHaveLength(0);
  });

  it('성별코드 1~8 외 값은 감지하지 않는다', () => {
    expect(detectRrn('900101-9234567')).toHaveLength(0);
    expect(detectRrn('900101-0234567')).toHaveLength(0);
  });

  it('일반 숫자는 감지하지 않는다', () => {
    expect(detectRrn('전화 010-1234-5678')).toHaveLength(0);
    expect(detectRrn('금액 1,234,567원')).toHaveLength(0);
  });

  it('한 텍스트에서 여러 개를 감지한다', () => {
    const text = '신청인 900101-1234567, 배우자 920202-2345678';
    const matches = detectRrn(text);
    expect(matches).toHaveLength(2);
  });
});
