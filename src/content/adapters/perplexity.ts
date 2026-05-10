import type { SiteAdapter, SubmitHandler, ResponseCallback } from './base';

/**
 * Perplexity (perplexity.ai) adapter
 *
 * Starter selectors — verify at runtime:
 *   input:    textarea[placeholder*="Ask"]  (standard textarea)
 *   submit:   button[aria-label*="Submit"]
 *   response: .prose
 *
 * Note: standard <textarea> — value property works directly.
 * NativeInputValueSetter used for React-controlled inputs.
 */
const INPUT_SELECTOR = 'textarea[placeholder*="Ask"]';
const SUBMIT_SELECTOR = 'button[aria-label*="Submit"]';

export class PerplexityAdapter implements SiteAdapter {
  hostname = 'perplexity.ai';

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
    const input = this.findInputElement() as HTMLTextAreaElement | null;
    if (!input) return;
    const original = input.value.trim();
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

    // React controlled input: use NativeInputValueSetter
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value',
    )?.set;
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(input, masked);
    } else {
      input.value = masked;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    setTimeout(() => this.dispatchSubmit(), 50);
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
      return { ok: false, reason: 'Perplexity textarea not found' };
    }
    return { ok: true };
  }

  getConversationId(): string {
    // URL 패턴: /search/{slug} 또는 /page/{id}
    const match = location.pathname.match(/\/(?:search|page)\/([^/]+)/);
    return match ? `perplexity:${match[1]}` : `perplexity:home`;
  }
}
