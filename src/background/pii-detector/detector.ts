import type { PiiMatch } from '@/shared/types';
import { detectRrn } from './regex/rrn';
import { detectPhone } from './regex/phone';
import { detectEmail } from './regex/email';
import { detectBusinessNo } from './regex/business-no';
import { detectCaseNo } from './regex/case-no';

export class PIIDetector {
  detect(text: string): PiiMatch[] {
    const all: PiiMatch[] = [
      ...detectRrn(text),
      ...detectBusinessNo(text),
      ...detectPhone(text),
      ...detectEmail(text),
      ...detectCaseNo(text),
    ];
    return this.resolveOverlaps(all);
  }

  private resolveOverlaps(matches: PiiMatch[]): PiiMatch[] {
    matches.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
    const result: PiiMatch[] = [];
    let lastEnd = -1;
    for (const m of matches) {
      if (m.start >= lastEnd) {
        result.push(m);
        lastEnd = m.end;
      }
    }
    return result;
  }
}
