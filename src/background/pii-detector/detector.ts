import type { ExtendedPiiMatch, PiiMatch, PendingKoreanNameMatch } from '@/shared/types';
import { detectRrn } from './regex/rrn';
import { detectPhone } from './regex/phone';
import { detectEmail } from './regex/email';
import { detectBusinessNo } from './regex/business-no';
import { detectCaseNo } from './regex/case-no';
import type { DictionaryDetector } from './dictionary-detector';
import { detectKoreanNames } from './korean-name/korean-name-detector';

export const KOREAN_NAME_CONFIDENCE_THRESHOLD = 0.7;

/** Layer 1 정규식 결과를 ExtendedPiiMatch로 변환 */
function toExtended(m: PiiMatch): ExtendedPiiMatch {
  return { ...m, source: 'regex' };
}

export class PIIDetector {
  constructor(private dictDetector?: DictionaryDetector) {}

  detect(text: string): {
    confirmed: ExtendedPiiMatch[];
    pending: PendingKoreanNameMatch[];
  } {
    // Layer 1: 정규식
    const regexMatches: ExtendedPiiMatch[] = [
      ...detectRrn(text),
      ...detectBusinessNo(text),
      ...detectPhone(text),
      ...detectEmail(text),
      ...detectCaseNo(text),
    ].map(toExtended);

    // Layer 2: 사용자 사전
    const dictMatches: ExtendedPiiMatch[] = this.dictDetector
      ? this.dictDetector.detect(text)
      : [];

    // dict를 먼저 넣어 같은 위치에서 dict 우선 처리
    const confirmed = this.resolveOverlaps([...dictMatches, ...regexMatches]);

    // Layer 3: 한글 이름 휴리스틱 (Layer 1/2 범위 전달)
    const existingRanges = confirmed.map((m) => ({
      start: m.start,
      end: m.end,
    }));
    const nameMatches = detectKoreanNames(text, existingRanges);

    // confidence 게이팅
    const pending: PendingKoreanNameMatch[] = nameMatches
      .filter((m) => m.confidence >= KOREAN_NAME_CONFIDENCE_THRESHOLD)
      .map((m) => ({
        original: m.original,
        start: m.start,
        end: m.end,
        confidence: m.confidence,
        contextSnippet: m.contextSnippet,
      }));

    return { confirmed, pending };
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
