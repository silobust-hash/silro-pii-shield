import type { UserDictEntry, ExtendedPiiMatch } from '@/shared/types';

type RawMatch = {
  start: number;
  end: number;
  original: string;
  entry: UserDictEntry;
};

export class DictionaryDetector {
  constructor(private entries: UserDictEntry[]) {}

  detect(text: string): ExtendedPiiMatch[] {
    const raw: RawMatch[] = [];

    for (const entry of this.entries) {
      for (const pattern of entry.patterns) {
        const flags = entry.caseInsensitive ? 'gi' : 'g';
        // Escape special regex chars in pattern string
        const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // matchAll requires global flag — already set via flags variable above
        const re = new RegExp(escaped, flags);
        for (const m of text.matchAll(re)) {
          raw.push({
            start: m.index!,
            end: m.index! + m[0].length,
            original: m[0],
            entry,
          });
        }
      }
    }

    // Sort: start ASC, then length DESC (longer match wins on same start)
    raw.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

    // Resolve overlaps: greedy, pick first (longest at position)
    const resolved: RawMatch[] = [];
    let lastEnd = -1;
    for (const r of raw) {
      if (r.start >= lastEnd) {
        resolved.push(r);
        lastEnd = r.end;
      }
    }

    return resolved.map((r) => ({
      category: r.entry.category,
      original: r.original,
      start: r.start,
      end: r.end,
      source: 'dict' as const,
      dictId: r.entry.id,
      aliasOverride: r.entry.alias,
    }));
  }

  /** 사전 교체 (store 갱신 후 detector 재초기화 시 사용) */
  update(entries: UserDictEntry[]): void {
    this.entries = entries;
  }
}
