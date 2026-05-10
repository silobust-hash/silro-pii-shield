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

  // 우리가 트리거한 click을 다시 가로채지 않도록 가드
  private isInternalDispatch = false;

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
        if (this.isInternalDispatch) return;
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
        if (this.isInternalDispatch) return;
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
    if (typeof (event as Event & { stopImmediatePropagation?: () => void }).stopImmediatePropagation === 'function') {
      (event as Event & { stopImmediatePropagation: () => void }).stopImmediatePropagation();
    }

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

    // 가명화 텍스트로 입력창 교체
    this.replaceInputContent(input, masked);

    // 200ms 후 정착 검증
    await new Promise((r) => setTimeout(r, 200));

    const currentText = (input.innerText ?? '').trim();
    const expectedText = masked.trim();

    if (currentText === expectedText) {
      // 정착 성공 → 자동 전송
      this.dispatchSubmit();
    } else if (currentText === '' || currentText === original.trim()) {
      // 정착 실패 (빈 상태 또는 원본 그대로) → 안전 모드: 입력창 비우고 알림
      this.clearInputSafely(input);
      this.showSafetyAlert(masked);
    } else {
      // 부분 정착 — 이상 상태. 안전을 위해 차단.
      this.clearInputSafely(input);
      this.showSafetyAlert(masked);
    }
  }

  private clearInputSafely(input: HTMLElement): void {
    input.focus();
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      const range = document.createRange();
      range.selectNodeContents(input);
      sel.addRange(range);
    }
    const dt = new DataTransfer();
    dt.setData('text/plain', '');
    input.dispatchEvent(
      new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dt,
      }),
    );
    // fallback: 강제 textContent 비우기
    setTimeout(() => {
      if ((input.innerText ?? '').trim()) {
        input.textContent = '';
        input.dispatchEvent(new InputEvent('input', { bubbles: true }));
      }
    }, 30);
  }

  private showSafetyAlert(maskedText: string): void {
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.5);' +
      'z-index:2147483647;display:flex;align-items:center;justify-content:center;' +
      'font-family:-apple-system,BlinkMacSystemFont,sans-serif;';

    const modal = document.createElement('div');
    modal.style.cssText =
      'background:white;border-radius:12px;padding:24px;max-width:560px;width:90%;' +
      'box-shadow:0 10px 40px rgba(0,0,0,0.3);';

    const title = document.createElement('h2');
    title.style.cssText = 'margin:0 0 12px;color:#dc2626;font-size:18px;';
    title.textContent = '🛡️ 마스킹 실패 — 전송 차단됨';
    modal.appendChild(title);

    const desc = document.createElement('p');
    desc.style.cssText = 'margin:0 0 16px;font-size:13px;color:#374151;line-height:1.6;';
    desc.textContent =
      'claude.ai의 입력 에디터가 자동 가명화를 인식하지 못했습니다. 안전을 위해 전송을 차단하고 입력창을 비웠습니다.';
    modal.appendChild(desc);

    const label = document.createElement('div');
    label.style.cssText = 'font-size:12px;color:#6b7280;margin-bottom:6px;';
    label.textContent = '아래 가명화 텍스트를 직접 복사해서 붙여넣고 전송하세요:';
    modal.appendChild(label);

    const textarea = document.createElement('textarea');
    textarea.value = maskedText;
    textarea.readOnly = true;
    textarea.style.cssText =
      'width:100%;min-height:120px;padding:10px;border:1px solid #d1d5db;' +
      'border-radius:6px;font-family:monospace;font-size:13px;resize:vertical;' +
      'box-sizing:border-box;';
    modal.appendChild(textarea);

    const buttonRow = document.createElement('div');
    buttonRow.style.cssText = 'display:flex;gap:8px;margin-top:14px;justify-content:flex-end;';

    const copyBtn = document.createElement('button');
    copyBtn.textContent = '클립보드 복사';
    copyBtn.style.cssText =
      'padding:8px 16px;border:0;background:#1e40af;color:white;' +
      'border-radius:6px;cursor:pointer;font-size:13px;';
    copyBtn.addEventListener('click', () => {
      void navigator.clipboard.writeText(maskedText);
      copyBtn.textContent = '✓ 복사됨';
    });
    buttonRow.appendChild(copyBtn);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '닫기';
    closeBtn.style.cssText =
      'padding:8px 16px;border:1px solid #d1d5db;background:white;' +
      'border-radius:6px;cursor:pointer;font-size:13px;';
    closeBtn.addEventListener('click', () => overlay.remove());
    buttonRow.appendChild(closeBtn);

    modal.appendChild(buttonRow);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // textarea 자동 선택
    setTimeout(() => {
      textarea.focus();
      textarea.select();
    }, 100);
  }

  private replaceInputContent(input: HTMLElement, text: string): void {
    // ProseMirror/React 에디터는 textContent 직접 변경을 인식 못함.
    // paste 이벤트로 시뮬레이션 (사용자가 붙여넣기한 것처럼)
    input.focus();

    // 기존 내용 모두 선택
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      const range = document.createRange();
      range.selectNodeContents(input);
      selection.addRange(range);
    }

    // paste 이벤트 디스패치
    const dataTransfer = new DataTransfer();
    dataTransfer.setData('text/plain', text);
    const pasteEvent = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: dataTransfer,
    });
    const accepted = input.dispatchEvent(pasteEvent);

    // paste가 처리 안 됐으면 fallback (textContent 직접 + InputEvent)
    if (!accepted || input.innerText.trim() !== text.trim()) {
      input.textContent = text;
      input.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          inputType: 'insertText',
          data: text,
        }),
      );
    }
  }

  private dispatchSubmit(): void {
    this.isInternalDispatch = true;
    // ProseMirror가 paste 후 state를 업데이트할 시간을 줌
    setTimeout(() => {
      const button = this.findSubmitButton();
      if (button && !button.disabled) {
        button.click();
      } else {
        // 버튼이 여전히 disabled면 사용자에게 알림
        console.warn('[pii-shield] submit button still disabled — please press Enter manually');
      }
      // 가드 해제 (혹시 모를 사이드이펙트 방지)
      setTimeout(() => {
        this.isInternalDispatch = false;
      }, 200);
    }, 250);
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
