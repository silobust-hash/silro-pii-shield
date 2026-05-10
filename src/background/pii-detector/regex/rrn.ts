import type { PiiMatch } from '@/shared/types';

const RRN_REGEX =
  /(?<![\d-])(\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])-?([1-8])\d{6}(?![\d])/g;

function isValidDate(yy: string, mm: string, dd: string): boolean {
  const month = parseInt(mm, 10);
  const day = parseInt(dd, 10);
  // February: max 29 (allow leap year births; yy alone is ambiguous for century)
  if (month === 2 && day > 29) return false;
  // Months with 30 days: April(4), June(6), September(9), November(11)
  if ([4, 6, 9, 11].includes(month) && day > 30) return false;
  return true;
}

export function detectRrn(text: string): PiiMatch[] {
  const matches: PiiMatch[] = [];
  for (const m of text.matchAll(RRN_REGEX)) {
    if (m.index === undefined) continue;
    const [, yy, mm, dd] = m;
    if (!isValidDate(yy, mm, dd)) continue;
    matches.push({
      category: 'rrn',
      original: m[0],
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  return matches;
}
