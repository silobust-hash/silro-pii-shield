import type { PiiMatch } from '@/shared/types';
import { COMPOUND_SURNAMES, SINGLE_SURNAMES } from './surname-pool';
import { NAME_WHITELIST, WHITELIST_PREFIXES } from './whitelist';

export type KoreanNameMatch = PiiMatch & {
  confidence: number;
  contextSnippet: string;
};

/**
 * Context suffixes that indicate a person's name precedes.
 */
const CONTEXT_SUFFIXES: readonly { pattern: RegExp; boost: number }[] = [
  { pattern: /^씨가|^씨는|^씨를|^씨와|^씨도|^씨만|^씨께|^씨한테/u, boost: 0.35 },
  { pattern: /^씨/u, boost: 0.3 },
  { pattern: /^님이|^님은|^님을|^님과|^님의/u, boost: 0.3 },
  { pattern: /^님/u, boost: 0.25 },
  { pattern: /^[이은는을를과와의도만]/u, boost: 0.15 },
];

/**
 * Minimum confidence to include in results.
 * This prevents low-signal false positives from common syllable combinations.
 */
const MIN_RETURN_CONFIDENCE = 0.5;

const HANGUL_CHAR_RE = /^[가-힣]$/u;
const HANGUL_STR_RE = /^[가-힣]+$/u;

function isHangul(ch: string | undefined): boolean {
  return ch !== undefined && HANGUL_CHAR_RE.test(ch);
}

function isHangulStr(s: string): boolean {
  return s.length > 0 && HANGUL_STR_RE.test(s);
}

/**
 * Find surname at position i. Tries compound surnames first (longest first).
 */
function matchSurnameAt(text: string, i: number): { surname: string; bodyStart: number } | null {
  for (const cs of COMPOUND_SURNAMES) {
    if (text.startsWith(cs, i)) {
      return { surname: cs, bodyStart: i + cs.length };
    }
  }
  if (isHangul(text[i]) && SINGLE_SURNAMES.includes(text[i])) {
    return { surname: text[i], bodyStart: i + 1 };
  }
  return null;
}

/**
 * Returns true if candidate (or any extension) is in the whitelist.
 */
function isWhitelisted(candidate: string, nextChar: string | undefined): boolean {
  if (NAME_WHITELIST.has(candidate)) return true;
  if (WHITELIST_PREFIXES.some((p) => candidate.startsWith(p) || p === candidate)) return true;
  // Check extended candidate (surname+body+nextChar)
  if (nextChar !== undefined && isHangul(nextChar)) {
    const extended = candidate + nextChar;
    if (NAME_WHITELIST.has(extended)) return true;
    if (WHITELIST_PREFIXES.some((p) => extended.startsWith(p))) return true;
  }
  return false;
}

/**
 * Scans text for Korean name candidates using surname pool + context boost.
 * Only returns candidates with confidence >= MIN_RETURN_CONFIDENCE.
 * Skips ranges already covered by Layer 1/2.
 */
export function detectKoreanNames(
  text: string,
  existingMatchRanges: Array<{ start: number; end: number }> = [],
): KoreanNameMatch[] {
  const results: KoreanNameMatch[] = [];
  const len = text.length;
  let i = 0;

  while (i < len) {
    if (!isHangul(text[i])) {
      i++;
      continue;
    }

    const surnameResult = matchSurnameAt(text, i);
    if (!surnameResult) {
      i++;
      continue;
    }

    const { surname, bodyStart } = surnameResult;
    const nameStart = i;

    // Body must start with Hangul
    if (!isHangul(text[bodyStart])) {
      i++;
      continue;
    }

    // Collect contiguous Hangul run starting at bodyStart
    let runEnd = bodyStart;
    while (runEnd < len && isHangul(text[runEnd])) runEnd++;

    let foundMatch = false;
    let advanceTo = i + 1;

    // Try body lengths 2 then 1 (greedy: longest first)
    for (let bodyLen = 2; bodyLen >= 1; bodyLen--) {
      if (runEnd - bodyStart < bodyLen) continue;

      const nameBody = text.slice(bodyStart, bodyStart + bodyLen);
      if (!isHangulStr(nameBody)) continue;

      const candidate = surname + nameBody;
      const nameEnd = bodyStart + bodyLen;
      const nextChar = text[nameEnd]; // char immediately after the candidate

      // Whitelist check (also checks extended forms)
      if (isWhitelisted(candidate, nextChar)) {
        // Skip past this candidate to avoid re-matching its chars
        advanceTo = nameEnd;
        break;
      }

      // If next char is Hangul and NOT a name suffix marker, this is a longer word
      if (isHangul(nextChar) && nextChar !== '씨' && nextChar !== '님') {
        // The name body is embedded in a longer Hangul word → try shorter body
        continue;
      }

      // Layer 1/2 overlap check
      const overlaps = existingMatchRanges.some(
        (r) => nameStart < r.end && nameEnd > r.start,
      );
      if (overlaps) {
        advanceTo = nameEnd;
        break;
      }

      // Compute confidence
      let confidence = surname.length > 1 ? 0.5 : 0.4;

      // Context suffix boost
      const suffix = text.slice(nameEnd, nameEnd + 20);
      for (const ctx of CONTEXT_SUFFIXES) {
        if (ctx.pattern.test(suffix)) {
          confidence = Math.min(1.0, confidence + ctx.boost);
          break;
        }
      }

      // Quoted context boost
      const prefix = text.slice(Math.max(0, nameStart - 3), nameStart);
      if (/["'「『【（(]$/u.test(prefix)) {
        confidence = Math.min(1.0, confidence + 0.1);
      }

      // Only emit if confidence meets minimum threshold
      if (confidence >= MIN_RETURN_CONFIDENCE) {
        results.push({
          category: 'korean_name',
          original: candidate,
          start: nameStart,
          end: nameEnd,
          confidence,
          contextSnippet: text.slice(
            Math.max(0, nameStart - 5),
            Math.min(len, nameEnd + 10),
          ),
        });
        foundMatch = true;
        advanceTo = nameEnd;
      } else {
        // Low confidence — skip this position entirely
        advanceTo = i + 1;
      }
      break;
    }

    i = advanceTo;
    if (foundMatch) {
      // Already advanced past the name
    }
  }

  return results;
}
