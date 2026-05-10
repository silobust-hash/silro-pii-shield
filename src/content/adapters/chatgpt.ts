import type { SiteAdapter, SubmitHandler, ResponseCallback } from './base';

/**
 * ChatGPT (chatgpt.com) adapter
 *
 * Starter selectors — verify at runtime:
 *   input:    div#prompt-textarea[contenteditable="true"]  (ProseMirror)
 *   submit:   button[data-testid="send-button"]
 *   response: div[data-message-author-role="assistant"]
 */
const INPUT_SELECTOR = 'div#prompt-textarea[contenteditable="true"]';
const SUBMIT_SELECTOR = 'button[data-testid="send-button"]';

export class ChatGPTAdapter implements SiteAdapter {
  hostname = 'chatgpt.com';

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
          (e.target as HTMLElement)?.closest?.(INPUT_SELECTOR)
        ) {
          void this.interceptAndReplace(e, handler);
        }
      },
      true,
    );

    document.addEventListener(
      'click',
      (e) => {
        const target = (e.target as HTMLElement)?.closest?.(SUBMIT_SELECTOR);
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
    const original = input.innerText.trim();
    if (!original) return;

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

    // textContent 사용 (innerHTML 금지)
    input.textContent = masked;
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    // ChatGPT React 상태 업데이트 딜레이
    setTimeout(() => this.dispatchSubmit(), 80);
  }

  private dispatchSubmit(): void {
    const button = document.querySelector<HTMLButtonElement>(SUBMIT_SELECTOR);
    button?.click();
  }

  observeResponses(callback: ResponseCallback): MutationObserver {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((n) => callback(n));
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return observer;
  }

  selfTest(): { ok: boolean; reason?: string } {
    if (!this.findInputElement()) {
      return { ok: false, reason: 'ChatGPT input (#prompt-textarea) not found' };
    }
    if (!document.querySelector(SUBMIT_SELECTOR)) {
      return { ok: false, reason: 'ChatGPT send button not found' };
    }
    return { ok: true };
  }

  getConversationId(): string {
    // URL 패턴: /c/{uuid}
    const match = location.pathname.match(/\/c\/([a-f0-9-]+)/);
    return match ? `chatgpt:${match[1]}` : `chatgpt:home`;
  }
}
