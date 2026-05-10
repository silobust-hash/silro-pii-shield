import { describe, it, expect } from 'vitest';
import { KOREAN_SURNAMES, SURNAME_SET, COMPOUND_SURNAMES } from
  '@/background/pii-detector/korean-name/surname-pool';

describe('surname-pool', () => {
  it('has ≥ 180 entries', () => {
    expect(KOREAN_SURNAMES.length).toBeGreaterThanOrEqual(180);
  });
  it('has no duplicates', () => {
    expect(new Set(KOREAN_SURNAMES).size).toBe(KOREAN_SURNAMES.length);
  });
  it('contains top 3 Korean surnames', () => {
    expect(SURNAME_SET.has('김')).toBe(true);
    expect(SURNAME_SET.has('이')).toBe(true);
    expect(SURNAME_SET.has('박')).toBe(true);
  });
  it('contains compound surname 남궁', () => {
    expect(COMPOUND_SURNAMES).toContain('남궁');
  });
});
