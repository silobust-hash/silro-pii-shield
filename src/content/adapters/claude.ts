import type { SiteAdapter, SubmitHandler, ResponseCallback } from './base';

const INPUT_SELECTOR = 'div[contenteditable="true"]';

const SUBMIT_BUTTON_SELECTORS = [
  'button[aria-label*="Send"]',
  'button[aria-label*="send"]',
  'button[aria-label*="보내기"]',
  'button[aria-label*="message"]',
  'button[aria-label*="Message"]',
  'fieldset button[type="submit"]',
  'button[type="submit"]',
  'div.flex button:has(svg)',
];

const RESPONSE_CONTAINER_SELECTORS = [
  'div[data-testid="conversation"]',
  'main',
  'div[role="main"]',
];

function findFirst(selectors: readonly string[]): HTMLElement | null {
  for (const selector of selectors) {
    try {
      const el = document.querySelector<HTMLElement>(selector);
      if (el) return el;
    } catch {
      // invalid selector in some browsers (e.g. :has support)
    }
  }
  return null;
}

function matchesAny(el: HTMLElement | null, selectors: readonly string[]): boolean {
  if (!el) return false;
  for (const selector of selectors) {
    try {
      if (el.closest?.(selector)) return true;
    } catch {
      // ignore unsupported selector
    }
  }
  return false;
}

export class ClaudeAdapter implements SiteAdapter {
  hostname = 'claude.ai';

  findInputElement(): HTMLElement | null {
    return document.querySelector<HTMLElement>(INPUT_SELECTOR);
  }

  private findSubmitButton(): HTMLButtonElement | null {
    return findFirst(SUBMIT_BUTTON_SELECTORS) as HTMLButtonElement | null;
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
        if (matchesAny(e.target as HTMLElement, SUBMIT_BUTTON_SELECTORS)) {
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
    this.findSubmitButton()?.click();
  }

  observeResponses(callback: ResponseCallback): MutationObserver {
    const container = findFirst(RESPONSE_CONTAINER_SELECTORS) ?? document.body;
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
    if (!this.findSubmitButton()) {
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
