import type { PiiMatch } from '@/shared/types';

const COURT_CASE_REGEX =
  /\b(19|20)\d{2}(?:가합|가단|가소|나|다|드|머|카|타|허|구|르|로|모)\d{1,6}\b/g;

const LABOR_COMMISSION_REGEX = new RegExp(
  '(?:중앙|서울|경기|부산|대구|인천|광주|대전|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)' +
    '(?:19|20)\\d{2}' +
    '(?:부해|부노|부심|차별|복심)' +
    '\\d{1,6}',
  'g'
);

export function detectCaseNo(text: string): PiiMatch[] {
  const matches: PiiMatch[] = [];
  for (const m of text.matchAll(COURT_CASE_REGEX)) {
    if (m.index === undefined) continue;
    matches.push({
      category: 'case_no',
      original: m[0],
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  for (const m of text.matchAll(LABOR_COMMISSION_REGEX)) {
    if (m.index === undefined) continue;
    matches.push({
      category: 'case_no',
      original: m[0],
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  return matches.sort((a, b) => a.start - b.start);
}
