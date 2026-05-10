import { describe, it, expect } from 'vitest';
import { detectPhone } from '@/background/pii-detector/regex/phone';

describe('detectPhone', () => {
  it('휴대폰 010 번호를 감지한다 (하이픈)', () => {
    const matches = detectPhone('연락처 010-1234-5678');
    expect(matches).toHaveLength(1);
    expect(matches[0].original).toBe('010-1234-5678');
  });
  it('휴대폰 010 번호를 감지한다 (점)', () => {
    expect(detectPhone('010.1234.5678')).toHaveLength(1);
  });
  it('휴대폰 010 번호를 감지한다 (공백)', () => {
    expect(detectPhone('010 1234 5678')).toHaveLength(1);
  });
  it('일반전화 02 번호를 감지한다', () => {
    expect(detectPhone('서울 02-123-4567')).toHaveLength(1);
    expect(detectPhone('02-1234-5678')).toHaveLength(1);
  });
  it('지역번호 031~064을 감지한다', () => {
    expect(detectPhone('031-123-4567')).toHaveLength(1);
    expect(detectPhone('064-123-4567')).toHaveLength(1);
  });
  it('070 인터넷전화를 감지한다', () => {
    expect(detectPhone('070-1234-5678')).toHaveLength(1);
  });
  it('0303 안심번호를 감지한다', () => {
    expect(detectPhone('0303-1234-5678')).toHaveLength(1);
  });
  it('주민등록번호와 헷갈리는 패턴 제외', () => {
    expect(detectPhone('900101-1234567')).toHaveLength(0);
  });
  it('일반 숫자는 감지하지 않는다', () => {
    expect(detectPhone('금액 1,234,567원')).toHaveLength(0);
  });
});
