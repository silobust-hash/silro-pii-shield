import type {
  PiiCategory,
  AnyCategory,
  ExtendedPiiMatch,
  Mapping,
  MaskResult,
  ConversationMappings,
  PendingKoreanNameMatch,
} from '@/shared/types';
import { PIIDetector } from './pii-detector/detector';

const ALIAS_PREFIX: Record<PiiCategory, string> = {
  rrn: '주민번호',
  phone: '전화',
  email: '이메일',
  business_no: '사업자번호',
  case_no: '사건',
  korean_name: 'A',   // 이름은 A씨, B씨 형태 (스펙 3.2)
};

/** 0→A, 1→B, ..., 25→Z, 26→AA, 27→AB ... */
function indexToAlias(n: number): string {
  let result = '';
  let i = n;
  do {
    result = String.fromCharCode(65 + (i % 26)) + result;
    i = Math.floor(i / 26) - 1;
  } while (i >= 0);
  return result;
}

export class MappingManager {
  private forward = new Map<string, string>();
  private reverse = new Map<string, string>();
  private counters: Partial<Record<PiiCategory, number>> = {};

  constructor(
    public readonly conversationId: string,
    private detector: PIIDetector,
  ) {}

  mask(text: string): MaskResult {
    const { confirmed, pending } = this.detector.detect(text);
    const seen = new Map<string, Mapping>();
    let result = '';
    let cursor = 0;
    for (const match of confirmed) {
      result += text.slice(cursor, match.start);
      const alias = this.assignAlias(match);
      result += alias;
      cursor = match.end;
      if (!seen.has(match.original)) {
        seen.set(match.original, {
          category: match.category,
          original: match.original,
          alias,
        });
      }
    }
    result += text.slice(cursor);
    return {
      masked: result,
      mappings: [...seen.values()],
      pendingNames: pending,
    };
  }

  /**
   * Masks specific name strings in text, assigning 'korean_name' category aliases.
   * Called after user confirms Layer 3 pending matches.
   */
  maskNames(text: string, names: string[]): MaskResult {
    let result = text;
    const mappings: Mapping[] = [];
    // 긴 이름 먼저 처리 (부분 일치 방지)
    const sorted = [...names].sort((a, b) => b.length - a.length);
    for (const name of sorted) {
      if (!name) continue;
      const alias = this.assignAlias({
        category: 'korean_name',
        original: name,
        start: 0,
        end: 0,
        source: 'regex',
      });
      result = result.replaceAll(name, alias);
      mappings.push({ category: 'korean_name', original: name, alias });
    }
    return { masked: result, mappings, pendingNames: [] };
  }

  unmask(text: string): string {
    if (this.reverse.size === 0) return text;
    const keys = [...this.reverse.keys()].map(
      (k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    );
    if (keys.length === 0) return text;
    const pattern = new RegExp(keys.join('|'), 'g');
    return text.replace(pattern, (alias) => this.reverse.get(alias) ?? alias);
  }

  toJSON(): ConversationMappings {
    return {
      conversationId: this.conversationId,
      forward: Object.fromEntries(this.forward),
      reverse: Object.fromEntries(this.reverse),
      counters: { ...this.counters },
      updatedAt: Date.now(),
    };
  }

  static fromJSON(
    data: ConversationMappings,
    detector: PIIDetector,
  ): MappingManager {
    const m = new MappingManager(data.conversationId, detector);
    m.forward = new Map(Object.entries(data.forward));
    m.reverse = new Map(Object.entries(data.reverse));
    m.counters = { ...data.counters };
    return m;
  }

  private assignAlias(match: ExtendedPiiMatch): string {
    const existing = this.forward.get(match.original);
    if (existing) return existing;

    // dict aliasOverride → 고정 가명 사용 (카운터 소비 안 함)
    if (match.aliasOverride) {
      this.forward.set(match.original, match.aliasOverride);
      this.reverse.set(match.aliasOverride, match.original);
      return match.aliasOverride;
    }

    const cat = match.category as PiiCategory;
    const next = (this.counters[cat] ?? 0) + 1;
    this.counters[cat] = next;

    let alias: string;
    if (cat === 'korean_name') {
      // A씨, B씨, C씨... Z씨, AA씨, AB씨...
      alias = indexToAlias(next - 1) + '씨';
    } else {
      const prefix = ALIAS_PREFIX[cat] ?? 'PII';
      alias = `[${prefix}-${next}]`;
    }

    this.forward.set(match.original, alias);
    this.reverse.set(alias, match.original);
    return alias;
  }
}
