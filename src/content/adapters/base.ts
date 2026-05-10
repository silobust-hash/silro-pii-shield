export type SubmitHandler = (text: string) => Promise<string>;
export type ResponseCallback = (node: Node) => void;

export interface SiteAdapter {
  hostname: string;
  findInputElement(): HTMLElement | null;
  hookSubmit(handler: SubmitHandler): void;
  observeResponses(callback: ResponseCallback): MutationObserver;
  selfTest(): { ok: boolean; reason?: string };
  getConversationId(): string;

  // v0.4 추가
  /** 파일 업로드 endpoint URL 여부 판단 */
  isUploadEndpoint(url: string): boolean;
  /** 사이트 식별자 */
  readonly siteId: 'claude' | 'chatgpt' | 'gemini' | 'perplexity';
}
