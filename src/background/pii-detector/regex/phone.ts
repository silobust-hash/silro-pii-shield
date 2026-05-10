import type { PiiMatch } from '@/shared/types';

const PHONE_REGEX = new RegExp(
  [
    '01[016-9][\\s.-]?\\d{3,4}[\\s.-]?\\d{4}',
    '0(?:70|303)[\\s.-]?\\d{3,4}[\\s.-]?\\d{4}',
    '02[\\s.-]?\\d{3,4}[\\s.-]?\\d{4}',
    '0(?:3[1-3]|4[1-4]|5[1-5]|6[1-4])[\\s.-]?\\d{3,4}[\\s.-]?\\d{4}',
  ].map((p) => `(?:${p})`).join('|'),
  'g'
);

export function detectPhone(text: string): PiiMatch[] {
  const matches: PiiMatch[] = [];
  for (const m of text.matchAll(PHONE_REGEX)) {
    if (m.index === undefined) continue;
    const original = m[0];
    if (/^\d{6}-\d{7}$/.test(original)) continue;
    matches.push({
      category: 'phone',
      original,
      start: m.index,
      end: m.index + original.length,
    });
  }
  return matches;
}
