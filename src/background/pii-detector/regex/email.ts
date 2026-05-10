import type { PiiMatch } from '@/shared/types';

const EMAIL_REGEX =
  /[a-zA-Z0-9._+-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+/g;

export function detectEmail(text: string): PiiMatch[] {
  const matches: PiiMatch[] = [];
  for (const m of text.matchAll(EMAIL_REGEX)) {
    if (m.index === undefined) continue;
    matches.push({
      category: 'email',
      original: m[0],
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  return matches;
}
