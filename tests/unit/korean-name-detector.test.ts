import { describe, it, expect } from 'vitest';
import { detectKoreanNames } from
  '@/background/pii-detector/korean-name/korean-name-detector';

describe('detectKoreanNames — positives', () => {
  it('detects "홍길동씨" with confidence ≥ 0.7', () => {
    const matches = detectKoreanNames('홍길동씨가 어제 방문했습니다');
    expect(matches).toHaveLength(1);
    expect(matches[0].original).toBe('홍길동');
    expect(matches[0].confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('detects "김철수님" with confidence ≥ 0.65', () => {
    const matches = detectKoreanNames('김철수님의 진단서를 검토했습니다');
    expect(matches).toHaveLength(1);
    expect(matches[0].original).toBe('김철수');
    expect(matches[0].confidence).toBeGreaterThanOrEqual(0.65);
  });

  it('detects compound surname "남궁민준씨"', () => {
    const matches = detectKoreanNames('남궁민준씨는 2024년에 해고되었습니다');
    expect(matches[0].original).toBe('남궁민준');
    expect(matches[0].confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('detects name in quoted context', () => {
    const matches = detectKoreanNames('"이민수"가 신청인입니다');
    expect(matches[0].confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('single-character name body: "박건씨"', () => {
    const matches = detectKoreanNames('박건씨가 제출한 서류');
    expect(matches[0].original).toBe('박건');
  });

  it('assigns correct start/end offsets', () => {
    const text = '신청인 홍길동씨는 2024년';
    const matches = detectKoreanNames(text);
    const m = matches.find((x) => x.original === '홍길동');
    expect(m).toBeDefined();
    expect(text.slice(m!.start, m!.end)).toBe('홍길동');
  });
});

describe('detectKoreanNames — negatives (no match expected)', () => {
  it('does NOT match 박정희 (whitelist)', () => {
    const matches = detectKoreanNames('박정희 대통령이 재임 중에');
    expect(matches).toHaveLength(0);
  });

  it('does NOT match 김치국 (whitelist)', () => {
    const matches = detectKoreanNames('김치국물이 맛있었다');
    expect(matches).toHaveLength(0);
  });

  it('does NOT match 강남구 (whitelist prefix)', () => {
    const matches = detectKoreanNames('강남구에 위치한 사무소');
    expect(matches).toHaveLength(0);
  });

  it('does NOT match plain surname with no name body: "김 대표"', () => {
    // "김" 뒤 공백이면 name body 없음 → 매치 X
    const matches = detectKoreanNames('김 대표가 발언했습니다');
    expect(matches).toHaveLength(0);
  });

  it('does NOT match 2자 이상 name body: "홍길동동"', () => {
    const matches = detectKoreanNames('홍길동동이라는 지명');
    // 3자 body는 NAME_BODY_PATTERN 불통과
    const three = matches.filter((m) => m.original === '홍길동동');
    expect(three).toHaveLength(0);
  });

  it('does NOT match when confidence < 0.7 without context boost', () => {
    // "최소" — '최' 성씨 + '소' 이름 but 컨텍스트 없음 → confidence 0.4
    const matches = detectKoreanNames('최소 요건을 충족해야 한다');
    const lowConf = matches.filter((m) => m.confidence >= 0.7);
    expect(lowConf).toHaveLength(0);
  });
});

describe('detectKoreanNames — overlap with Layer 1/2', () => {
  it('skips ranges covered by existing matches', () => {
    // 주민번호 감지기가 이미 0..14 를 커버한다고 가정
    const text = '홍길동씨 900101-1234567';
    const existingRanges = [{ start: 4, end: 20 }];
    const matches = detectKoreanNames(text, existingRanges);
    // 홍길동(0..3)은 existingRange와 겹치지 않으므로 감지됨
    expect(matches.find((m) => m.original === '홍길동')).toBeDefined();
  });

  it('skips name that directly overlaps existing range', () => {
    const text = '김철수씨';
    // 전체 구간이 커버된 경우
    const existingRanges = [{ start: 0, end: 4 }];
    const matches = detectKoreanNames(text, existingRanges);
    expect(matches).toHaveLength(0);
  });
});
