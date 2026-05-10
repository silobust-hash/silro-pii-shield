import { describe, it, expect } from 'vitest';
import { NAME_WHITELIST, WHITELIST_PREFIXES } from
  '@/background/pii-detector/korean-name/whitelist';

describe('whitelist', () => {
  it('contains 박정희', () => expect(NAME_WHITELIST.has('박정희')).toBe(true));
  it('contains 김치국', () => expect(NAME_WHITELIST.has('김치국')).toBe(true));
  it('does NOT contain 홍길동 (common test name that IS a name)', () => {
    expect(NAME_WHITELIST.has('홍길동')).toBe(false);
  });
  it('WHITELIST_PREFIXES is non-empty', () => {
    expect(WHITELIST_PREFIXES.length).toBeGreaterThan(0);
  });
});
