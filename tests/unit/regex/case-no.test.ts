import { describe, it, expect } from 'vitest';
import { detectCaseNo } from '@/background/pii-detector/regex/case-no';

describe('detectCaseNo', () => {
  it('법원 사건번호 가합을 감지한다', () => {
    const matches = detectCaseNo('서울중앙지방법원 2024가합1234');
    expect(matches).toHaveLength(1);
    expect(matches[0].original).toBe('2024가합1234');
  });
  it('법원 사건번호 가단/나/다를 감지한다', () => {
    expect(detectCaseNo('2024가단567')).toHaveLength(1);
    expect(detectCaseNo('2024나890')).toHaveLength(1);
    expect(detectCaseNo('2024다1111')).toHaveLength(1);
  });
  it('중앙노동위원회 사건번호를 감지한다', () => {
    expect(detectCaseNo('중앙2024부해123')).toHaveLength(1);
    expect(detectCaseNo('중앙2024부노456')).toHaveLength(1);
  });
  it('지방노동위원회 사건번호를 감지한다', () => {
    expect(detectCaseNo('서울2024부해789')).toHaveLength(1);
    expect(detectCaseNo('부산2024부해100')).toHaveLength(1);
  });
  it('일반 숫자는 감지하지 않는다', () => {
    expect(detectCaseNo('2024년 1월 1일')).toHaveLength(0);
  });
});
