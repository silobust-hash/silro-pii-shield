import { describe, it, expect } from 'vitest';
import { PIIDetector } from '@/background/pii-detector/detector';

describe('PIIDetector', () => {
  const detector = new PIIDetector();

  it('여러 카테고리의 PII를 한 번에 감지한다', () => {
    const text =
      '홍길동(900101-1234567) 010-1234-5678 hong@silro.co.kr 한동 123-45-67890 사건 2024가합1234';
    const matches = detector.detect(text);
    const categories = matches.map((m) => m.category).sort();
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
    const matches = detector.detect(text);
    expect(matches.map((m) => m.start)).toEqual(
      [...matches.map((m) => m.start)].sort((a, b) => a - b)
    );
  });

  it('PII가 없으면 빈 배열을 반환한다', () => {
    expect(detector.detect('일반 텍스트입니다')).toEqual([]);
  });

  it('겹치는 매치는 더 긴 것을 우선한다', () => {
    const text = '900101-1234567';
    const matches = detector.detect(text);
    expect(matches).toHaveLength(1);
    expect(matches[0].category).toBe('rrn');
  });
});
