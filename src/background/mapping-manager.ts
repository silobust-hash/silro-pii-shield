import type {
  PiiCategory,
  PiiMatch,
  Mapping,
  MaskResult,
  ConversationMappings,
} from '@/shared/types';
import { PIIDetector } from './pii-detector/detector';

const ALIAS_PREFIX: Record<PiiCategory, string> = {
  rrn: '주민번호',
  phone: '전화',
  email: '이메일',
  business_no: '사업자번호',
  case_no: '사건',
};

const ALIAS_PATTERN =
  /\[(?:주민번호|전화|이메일|사업자번호|사건)-\d+\]/g;

export class MappingManager {
  private forward = new Map<string, string>();
  private reverse = new Map<string, string>();
  private counters: Partial<Record<PiiCategory, number>> = {};

  constructor(
    public readonly conversationId: string,
    private detector: PIIDetector,
  ) {}

  mask(text: string): MaskResult {
    const matches = this.detector.detect(text);
    const seen = new Map<string, Mapping>();
    let result = '';
    let cursor = 0;
    for (const match of matches) {
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
    return { masked: result, mappings: [...seen.values()] };
  }

  unmask(text: string): string {
    if (this.reverse.size === 0) return text;
    return text.replace(ALIAS_PATTERN, (alias) => this.reverse.get(alias) ?? alias);
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

  private assignAlias(match: PiiMatch): string {
    const existing = this.forward.get(match.original);
    if (existing) return existing;
    const next = (this.counters[match.category] ?? 0) + 1;
    this.counters[match.category] = next;
    const alias = `[${ALIAS_PREFIX[match.category]}-${next}]`;
    this.forward.set(match.original, alias);
    this.reverse.set(alias, match.original);
    return alias;
  }
}
