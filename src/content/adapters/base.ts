export type SubmitHandler = (text: string) => Promise<string>;
export type ResponseCallback = (node: Node) => void;

export interface SiteAdapter {
  hostname: string;
  findInputElement(): HTMLElement | null;
  hookSubmit(handler: SubmitHandler): void;
  observeResponses(callback: ResponseCallback): MutationObserver;
  selfTest(): { ok: boolean; reason?: string };
  getConversationId(): string;
}
