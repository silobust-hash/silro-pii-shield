export type PiiCategory =
  | 'rrn'
  | 'phone'
  | 'email'
  | 'business_no'
  | 'case_no'
  | 'korean_name';   // Layer 3

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

// Layer 3 pending match (requires user confirm before masking)
export type PendingKoreanNameMatch = {
  original: string;
  start: number;
  end: number;
  confidence: number;
  contextSnippet: string;
};

export type MaskResult = {
  masked: string;
  mappings: Mapping[];
  pendingNames: PendingKoreanNameMatch[];  // confidence ≥ 0.7, user confirm 대기
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

// ── Client Profile ───────────────────────────────────────────────────────────

export type ClientProfile = {
  id: string;                      // uuid v4 (crypto.randomUUID())
  name: string;                    // "홍길동 사건", "A사 부당해고" 등 사용자 지정 이름
  mappings: ConversationMappings;  // forward/reverse 매핑 + counters
  notes: string;                   // 자유 메모 (사건번호, 법원명 등)
  createdAt: number;               // Unix ms
  updatedAt: number;               // Unix ms
};

export type HybridModeSetting = {
  hostname: string;                // 'claude.ai' | 'chatgpt.com' | 'gemini.google.com' | 'perplexity.ai'
  mode: 'round-trip' | 'hybrid';  // round-trip: 자동 복원 ON, hybrid: 사이드패널 복원 ON/OFF
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
  | { type: 'SET_SITE_SETTINGS'; siteKey: SiteKey; settings: SiteSettings }
  // v0.3 신규
  | { type: 'LIST_PROFILES' }
  | { type: 'GET_PROFILE'; profileId: string }
  | { type: 'SAVE_PROFILE'; profile: ClientProfile }
  | { type: 'DELETE_PROFILE'; profileId: string }
  | { type: 'GET_HYBRID_MODE'; hostname: string }
  | { type: 'SET_HYBRID_MODE'; setting: HybridModeSetting }
  | { type: 'MASK_NAMES'; conversationId: string; text: string; names: string[] };

export type MessageResponse =
  | { ok: true; data: MaskResult | string | void | ConversationMappings | UserDictEntry[] | AllSiteSettings | ClientProfile | ClientProfile[] | 'round-trip' | 'hybrid' }
  | { ok: false; error: string };

// ── v0.4: File Handler Types ──────────────────────────────────────────────────

/** 지원 파일 포맷 (v0.4 + v0.5 + v0.6) */
export type SupportedFormat =
  | 'docx' | 'xlsx' | 'pdf'          // v0.4 기존
  | 'pptx' | 'hwp' | 'hwpx'          // v0.5 신규
  | 'jpeg' | 'png' | 'webp';          // v0.6 신규

// ── v0.6: OCR Types ───────────────────────────────────────────────────────────

export type OcrRequest = {
  type: 'OCR_RUN';
  id: string;          // 요청 추적용 UUID
  imageData: ArrayBuffer;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
};

export type OcrResponse =
  | { type: 'OCR_RESULT'; id: string; text: string; confidence: number }
  | { type: 'OCR_ERROR'; id: string; error: string };

/** 재생성 모드 */
export type ReconstructionMode = 'txt' | 'preserve';

/** 파일 인터셉트 이벤트 (content → SW) */
export interface FileInterceptEvent {
  requestId: string;          // 인터셉트한 fetch/XHR 요청 고유 ID
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  arrayBuffer: ArrayBuffer;   // 파일 원본 바이트
  site: 'claude' | 'chatgpt' | 'gemini' | 'perplexity';
  conversationId: string;
}

/** SW → content: 파일 처리 결과 */
export interface FileProcessResult {
  requestId: string;
  status: 'ok' | 'blocked' | 'unsupported' | 'size_exceeded' | 'parse_error';
  extractedText?: string;       // 미리보기용 (최초 500자)
  piiSummary?: PiiMatch[];      // 감지된 PII 목록
  reconstructedBuffer?: ArrayBuffer;  // 가명화된 파일 바이트
  reconstructedFileName?: string;     // 예: original.docx → original_masked.docx
  reconstructedMimeType?: string;
  errorMessage?: string;
}

/** 파일별 재생성 설정 */
export interface FileMaskingSettings {
  reconstructionMode: ReconstructionMode;  // 기본값: 'txt'
  maxFileSizeBytes: number;                // 기본값: 100 * 1024 * 1024 (100MB)
}
