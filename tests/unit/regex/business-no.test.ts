import { describe, it, expect } from 'vitest';
import { detectBusinessNo } from '@/background/pii-detector/regex/business-no';

describe('detectBusinessNo', () => {
  it('하이픈 포함 사업자등록번호를 감지한다 (XXX-XX-XXXXX)', () => {
    const matches = detectBusinessNo('한동노무법인 123-45-67890');
    expect(matches).toHaveLength(1);
    expect(matches[0].original).toBe('123-45-67890');
  });
  it('일반 10자리 숫자는 감지하지 않는다', () => {
    expect(detectBusinessNo('1234567890')).toHaveLength(0);
  });
  it('주민등록번호 패턴은 제외한다', () => {
    expect(detectBusinessNo('900101-1234567')).toHaveLength(0);
  });
  it('잘못된 자릿수는 감지하지 않는다', () => {
    expect(detectBusinessNo('12-34-56789')).toHaveLength(0);
    expect(detectBusinessNo('1234-56-78901')).toHaveLength(0);
  });
});
