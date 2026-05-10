import type { ExtendedPiiMatch, PiiMatch } from '@/shared/types';
import { detectRrn } from './regex/rrn';
import { detectPhone } from './regex/phone';
import { detectEmail } from './regex/email';
import { detectBusinessNo } from './regex/business-no';
import { detectCaseNo } from './regex/case-no';
import type { DictionaryDetector } from './dictionary-detector';

/** Layer 1 정규식 결과를 ExtendedPiiMatch로 변환 */
function toExtended(m: PiiMatch): ExtendedPiiMatch {
  return { ...m, source: 'regex' };
}

export class PIIDetector {
  constructor(private dictDetector?: DictionaryDetector) {}

  detect(text: string): ExtendedPiiMatch[] {
    const regexMatches: ExtendedPiiMatch[] = [
      ...detectRrn(text),
      ...detectBusinessNo(text),
      ...detectPhone(text),
      ...detectEmail(text),
      ...detectCaseNo(text),
    ].map(toExtended);

    const dictMatches: ExtendedPiiMatch[] = this.dictDetector
      ? this.dictDetector.detect(text)
      : [];

    // dict를 먼저 넣어 같은 위치에서 dict 우선 처리
    const all = [...dictMatches, ...regexMatches];
    return this.resolveOverlaps(all);
  }

  private resolveOverlaps(matches: ExtendedPiiMatch[]): ExtendedPiiMatch[] {
    matches.sort(
      (a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start),
    );
    const result: ExtendedPiiMatch[] = [];
    let lastEnd = -1;
    for (const m of matches) {
      if (m.start >= lastEnd) {
        result.push(m);
        lastEnd = m.end;
      }
    }
    return result;
  }

  /** 사전 업데이트 후 detector 재주입 */
  setDictDetector(dictDetector: DictionaryDetector): void {
    this.dictDetector = dictDetector;
  }
}
