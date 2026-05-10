import type { SiteAdapter, SubmitHandler, ResponseCallback } from './base';

/**
 * Gemini (gemini.google.com) adapter
 *
 * Starter selectors — verify at runtime:
 *   input:    rich-textarea .ql-editor[contenteditable="true"]
 *             Shadow DOM fallback: rich-textarea shadowRoot → .ql-editor
 *   submit:   button.send-button  OR  button[aria-label*="Send"]
 *   response: message-content  (custom element)
 *
 * Shadow DOM note: if querySelector returns null, try shadowRoot.querySelector.
 */
const INPUT_LIGHT_SELECTOR = 'rich-textarea .ql-editor[contenteditable="true"]';
const SUBMIT_SELECTOR = 'button.send-button, button[aria-label*="Send"]';

function findInput(): HTMLElement | null {
  const el = document.querySelector<HTMLElement>(INPUT_LIGHT_SELECTOR);
  if (el) return el;
  // Shadow DOM fallback
  const richTextarea = document.querySelector('rich-textarea');
  if (richTextarea?.shadowRoot) {
    return richTextarea.shadowRoot.querySelector<HTMLElement>('.ql-editor');
  }
  return null;
}

export class GeminiAdapter implements SiteAdapter {
  hostname = 'gemini.google.com';

  findInputElement(): HTMLElement | null {
    return findInput();
  }

  hookSubmit(handler: SubmitHandler): void {
    document.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          const input = findInput();
          if (input && (e.target === input || input.contains(e.target as Node))) {
            void this.interceptAndReplace(e, handler);
          }
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
    const input = findInput();
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

    // Gemini Quill editor: textContent + composed input event
    input.textContent = masked;
    input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    setTimeout(() => this.dispatchSubmit(), 100);
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
    // document.body 관찰 — shadow DOM 내부는 v0.3에서 개선
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return observer;
  }

  selfTest(): { ok: boolean; reason?: string } {
    if (!findInput()) {
      return { ok: false, reason: 'Gemini input (rich-textarea .ql-editor or shadowRoot) not found' };
    }
    if (!document.querySelector(SUBMIT_SELECTOR)) {
      console.warn('[pii-shield] Gemini send button not found — selector may have changed');
    }
    return { ok: true };
  }

  getConversationId(): string {
    // URL 패턴: /app/{id}
    const match = location.pathname.match(/\/app\/([a-zA-Z0-9_-]+)/);
    return match ? `gemini:${match[1]}` : `gemini:home`;
  }

  // v0.4: 파일 업로드 endpoint 매처
  // Spike 메모: GCS signed URL 패턴은 Gemini UI 업데이트에 따라 변경될 수 있음
  // v0.4 릴리즈 전 DevTools Network 탭으로 실제 패턴 검증 필요
  isUploadEndpoint(url: string): boolean {
    return (
      url.includes('storage.googleapis.com') ||
      url.includes('generativelanguage.googleapis.com/upload') ||
      url.includes('/upload/v1/files')  // Gemini Files API
    );
  }

  readonly siteId = 'gemini' as const;
}
