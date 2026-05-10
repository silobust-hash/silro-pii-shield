import { describe, it, expect } from 'vitest';
import { PIIDetector } from '@/background/pii-detector/detector';
import { DictionaryDetector } from '@/background/pii-detector/dictionary-detector';
import { HONG_ENTRY } from '@tests/fixtures/dict-samples';

describe('PIIDetector', () => {
  const detector = new PIIDetector();

  it('여러 카테고리의 PII를 한 번에 감지한다', () => {
    const text =
      '홍길동(900101-1234567) 010-1234-5678 hong@silro.co.kr 한동 123-45-67890 사건 2024가합1234';
    const { confirmed } = detector.detect(text);
    const categories = confirmed.map((m) => m.category).sort();
    expect(categories).toEqual([
      'business_no',
      'case_no',
      'email',
      'phone',
      'rrn',
    ]);
  });

  it('매치는 시작 위치 순으로 정렬된다', () => {
    const text = 'A 010-1234-5678 B hong@a.com C 900101-1234567';
    const { confirmed } = detector.detect(text);
    expect(confirmed.map((m) => m.start)).toEqual(
      [...confirmed.map((m) => m.start)].sort((a, b) => a - b)
    );
  });

  it('PII가 없으면 confirmed 빈 배열을 반환한다', () => {
    const { confirmed } = detector.detect('일반 텍스트입니다');
    expect(confirmed).toEqual([]);
  });

  it('겹치는 매치는 더 긴 것을 우선한다', () => {
    const text = '900101-1234567';
    const { confirmed } = detector.detect(text);
    expect(confirmed).toHaveLength(1);
    expect(confirmed[0].category).toBe('rrn');
  });
});

describe('PIIDetector — Layer 2 통합', () => {
  it('dict 매치와 regex 매치가 함께 반환됨', () => {
    const dictDet = new DictionaryDetector([HONG_ENTRY]);
    const det = new PIIDetector(dictDet);
    const { confirmed } = det.detect('홍길동의 번호는 010-1234-5678');
    expect(confirmed).toHaveLength(2);
    const sources = confirmed.map((m) => m.source);
    expect(sources).toContain('dict');
    expect(sources).toContain('regex');
  });

  it('dict alias가 ExtendedPiiMatch.aliasOverride에 설정됨', () => {
    const dictDet = new DictionaryDetector([HONG_ENTRY]);
    const det = new PIIDetector(dictDet);
    const { confirmed } = det.detect('홍길동');
    expect(confirmed[0].aliasOverride).toBe('A씨');
  });

  it('dict 없이 생성하면 v0.1과 동일하게 regex만 동작', () => {
    const det = new PIIDetector();
    const { confirmed } = det.detect('010-1234-5678');
    expect(confirmed).toHaveLength(1);
    expect(confirmed[0].source).toBe('regex');
  });
});

describe('PIIDetector — Layer 3 integration', () => {
  const detector = new PIIDetector();

  it('returns pending match for "홍길동씨"', () => {
    const { pending } = detector.detect('홍길동씨가 신청했습니다');
    expect(pending.some((m) => m.original === '홍길동')).toBe(true);
    expect(pending[0].confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('Layer 3 does NOT overlap Layer 1 range', () => {
    const text = '홍길동씨 주민번호 900101-1234567';
    const { confirmed, pending } = detector.detect(text);
    const rrnMatch = confirmed.find((m) => m.category === 'rrn');
    const nameMatch = pending.find((m) => m.original === '홍길동');
    // 두 매치가 겹치지 않아야 함
    if (rrnMatch && nameMatch) {
      expect(
        nameMatch.end <= rrnMatch.start || nameMatch.start >= rrnMatch.end,
      ).toBe(true);
    }
  });

  it('does NOT return low-confidence match as pending', () => {
    // 컨텍스트 없는 "최소" → confidence 0.4 < 0.7 → pending에 없어야 함
    const { pending } = detector.detect('최소 요건을 충족해야 한다');
    expect(pending.some((m) => m.original === '최소')).toBe(false);
  });
});
