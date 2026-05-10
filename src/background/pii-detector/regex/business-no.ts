import type { PiiMatch } from '@/shared/types';

const BUSINESS_NO_REGEX = /(?<![\d-])\d{3}-\d{2}-\d{5}(?![\d-])/g;

export function detectBusinessNo(text: string): PiiMatch[] {
  const matches: PiiMatch[] = [];
  for (const m of text.matchAll(BUSINESS_NO_REGEX)) {
    if (m.index === undefined) continue;
    matches.push({
      category: 'business_no',
      original: m[0],
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  return matches;
}
