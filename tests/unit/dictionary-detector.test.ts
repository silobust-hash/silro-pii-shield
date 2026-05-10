import { describe, it, expect } from 'vitest';
import { DictionaryDetector } from '@/background/pii-detector/dictionary-detector';
import { HONG_ENTRY, COMPANY_ENTRY, HOSPITAL_ENTRY } from '@tests/fixtures/dict-samples';

describe('DictionaryDetector', () => {
  it('단일 패턴 감지', () => {
    const det = new DictionaryDetector([HONG_ENTRY]);
    const matches = det.detect('홍길동이 제출한 서류');
    expect(matches).toHaveLength(1);
    expect(matches[0].original).toBe('홍길동');
    expect(matches[0].aliasOverride).toBe('A씨');
    expect(matches[0].source).toBe('dict');
    expect(matches[0].dictId).toBe('entry-1');
  });

  it('별칭(패턴) 복수 감지 — 같은 entry의 다른 패턴', () => {
    const det = new DictionaryDetector([HONG_ENTRY]);
    const matches = det.detect('홍 대표가 홍길동 명의로');
    expect(matches).toHaveLength(2);
    expect(matches.every((m) => m.aliasOverride === 'A씨')).toBe(true);
  });

  it('복수 entry 감지', () => {
    const det = new DictionaryDetector([HONG_ENTRY, COMPANY_ENTRY]);
    const matches = det.detect('홍길동이 한동노무법인 소속으로');
    expect(matches).toHaveLength(2);
    const categories = matches.map((m) => m.category);
    expect(categories).toContain('person');
    expect(categories).toContain('company');
  });

  it('caseInsensitive 옵션 적용', () => {
    const det = new DictionaryDetector([HOSPITAL_ENTRY]);
    const matches = det.detect('서울대학교병원 진료기록');
    expect(matches).toHaveLength(1);
    expect(matches[0].aliasOverride).toBe('병원1');
  });

  it('겹치는 매치 중 긴 것 우선 선택', () => {
    const det = new DictionaryDetector([HOSPITAL_ENTRY]);
    const text = '서울대학교병원 방문';
    const matches = det.detect(text);
    expect(matches).toHaveLength(1);
    expect(matches[0].original).toBe('서울대학교병원');
  });

  it('빈 사전이면 빈 배열', () => {
    const det = new DictionaryDetector([]);
    expect(det.detect('홍길동 010-1234-5678')).toHaveLength(0);
  });

  it('텍스트에 패턴 없으면 빈 배열', () => {
    const det = new DictionaryDetector([HONG_ENTRY]);
    expect(det.detect('오늘 날씨가 맑습니다')).toHaveLength(0);
  });

  it('패턴이 다른 패턴의 부분 문자열일 때 긴 것 우선', () => {
    const det = new DictionaryDetector([COMPANY_ENTRY]);
    // "한동노무법인" > "한동"
    const matches = det.detect('한동노무법인 대표이사');
    expect(matches).toHaveLength(1);
    expect(matches[0].original).toBe('한동노무법인');
  });
});
