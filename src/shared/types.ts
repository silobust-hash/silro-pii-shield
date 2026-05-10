export type PiiCategory =
  | 'rrn'
  | 'phone'
  | 'email'
  | 'business_no'
  | 'case_no';

export type PiiMatch = {
  category: PiiCategory;
  original: string;
  start: number;
  end: number;
};

export type Mapping = {
  category: AnyCategory;
  original: string;
  alias: string;
};

export type MaskResult = {
  masked: string;
  mappings: Mapping[];
};

export type ConversationMappings = {
  conversationId: string;
  forward: Record<string, string>;
  reverse: Record<string, string>;
  counters: Partial<Record<PiiCategory, number>>;
  updatedAt: number;
};

// ── Layer 2: User Dictionary ─────────────────────────────────────────────────

export type DictCategory = 'person' | 'company' | 'hospital' | 'department' | 'custom';

export type UserDictEntry = {
  id: string;               // crypto.randomUUID()
  category: DictCategory;
  patterns: string[];       // 동일 대상의 별칭 목록 (최소 1개)
  alias: string;            // 가명 문자열 (예: "A씨", "회사1")
  caseInsensitive: boolean;
  notes?: string;
  createdAt: number;        // Date.now()
};

// ── Site Settings ────────────────────────────────────────────────────────────

export type SiteKey = 'claude.ai' | 'chatgpt.com' | 'gemini.google.com' | 'perplexity.ai';

export type SiteSettings = {
  enabled: boolean;
};

export type AllSiteSettings = Partial<Record<SiteKey, SiteSettings>>;

// ── Extended PiiMatch (Layer 1 + Layer 2 통합) ───────────────────────────────

export type AnyCategory = PiiCategory | DictCategory;

export type ExtendedPiiMatch = {
  category: AnyCategory;
  original: string;
  start: number;
  end: number;
  source: 'regex' | 'dict';
  dictId?: string;           // source === 'dict' 일 때 UserDictEntry.id
  aliasOverride?: string;    // dict entry가 제공하는 고정 alias
};

// ── Message Protocol ─────────────────────────────────────────────────────────

export type MessageType =
  | { type: 'MASK_TEXT'; conversationId: string; text: string }
  | { type: 'UNMASK_TEXT'; conversationId: string; text: string }
  | { type: 'CLEAR_CONVERSATION'; conversationId: string }
  | { type: 'GET_MAPPINGS'; conversationId: string }
  | { type: 'GET_DICT' }
  | { type: 'UPSERT_DICT_ENTRY'; entry: UserDictEntry }
  | { type: 'DELETE_DICT_ENTRY'; id: string }
  | { type: 'GET_SITE_SETTINGS' }
  | { type: 'SET_SITE_SETTINGS'; siteKey: SiteKey; settings: SiteSettings };

export type MessageResponse =
  | { ok: true; data: MaskResult | string | void | ConversationMappings | UserDictEntry[] | AllSiteSettings }
  | { ok: false; error: string };
