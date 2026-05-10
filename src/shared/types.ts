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
  category: PiiCategory;
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

export type MessageType =
  | { type: 'MASK_TEXT'; conversationId: string; text: string }
  | { type: 'UNMASK_TEXT'; conversationId: string; text: string }
  | { type: 'CLEAR_CONVERSATION'; conversationId: string };

export type MessageResponse =
  | { ok: true; data: MaskResult | string | void }
  | { ok: false; error: string };
