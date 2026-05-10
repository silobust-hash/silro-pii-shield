import type { SiteAdapter, SubmitHandler, ResponseCallback } from './base';

const INPUT_SELECTOR = 'div[contenteditable="true"][role="textbox"]';
const SUBMIT_BUTTON_SELECTOR = 'button[aria-label*="Send"]';
const RESPONSE_CONTAINER_SELECTOR = 'div[data-testid="conversation"]';

export class ClaudeAdapter implements SiteAdapter {
  hostname = 'claude.ai';

  findInputElement(): HTMLElement | null {
    return document.querySelector<HTMLElement>(INPUT_SELECTOR);
  }

  hookSubmit(handler: SubmitHandler): void {
    document.addEventListener(
      'keydown',
      (e) => {
        if (
          e.key === 'Enter' &&
          !e.shiftKey &&
          (e.target as HTMLElement)?.matches?.(INPUT_SELECTOR)
        ) {
          void this.interceptAndReplace(e, handler);
        }
      },
      true,
    );

    document.addEventListener(
      'click',
      (e) => {
        const target = (e.target as HTMLElement)?.closest?.(SUBMIT_BUTTON_SELECTOR);
        if (target) {
          void this.interceptAndReplace(e, handler);
        }
      },
      true,
    );
  }

  private async interceptAndReplace(
    event: Event,
    handler: SubmitHandler,
  ): Promise<void> {
    const input = this.findInputElement();
    if (!input) return;
    const original = input.innerText;
    if (!original.trim()) return;

    event.preventDefault();
    event.stopPropagation();

    let masked: string;
    try {
      masked = await handler(original);
    } catch {
      return;
    }

    if (masked === original) {
      this.dispatchSubmit();
      return;
    }

    this.replaceInputContent(input, masked);
    setTimeout(() => this.dispatchSubmit(), 50);
  }

  private replaceInputContent(input: HTMLElement, text: string): void {
    // textContent 사용 (innerHTML 금지 — XSS 방지)
    input.textContent = text;
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  }

  private dispatchSubmit(): void {
    const button = document.querySelector<HTMLButtonElement>(SUBMIT_BUTTON_SELECTOR);
    button?.click();
  }

  observeResponses(callback: ResponseCallback): MutationObserver {
    const container = document.querySelector(RESPONSE_CONTAINER_SELECTOR) ?? document.body;
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((n) => callback(n));
      }
    });
    observer.observe(container, { childList: true, subtree: true, characterData: true });
    return observer;
  }

  selfTest(): { ok: boolean; reason?: string } {
    if (!this.findInputElement()) {
      return { ok: false, reason: 'input element not found' };
    }
    if (!document.querySelector(SUBMIT_BUTTON_SELECTOR)) {
      return { ok: false, reason: 'submit button not found' };
    }
    return { ok: true };
  }

  getConversationId(): string {
    const match = location.pathname.match(/\/chat\/([a-f0-9-]+)/);
    return match ? `claude:${match[1]}` : `claude:home`;
  }

  // v0.4: 파일 업로드 endpoint 매처
  isUploadEndpoint(url: string): boolean {
    return /\/api\/organizations\/[^/]+\/files/.test(url);
  }

  readonly siteId = 'claude' as const;
}
