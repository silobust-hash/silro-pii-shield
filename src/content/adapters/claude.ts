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
    // 자동 클립보드 복사 — user gesture 컨텍스트가 살아있을 때 시도
    let autoCopySucceeded = false;
    try {
      void navigator.clipboard.writeText(maskedText).then(() => {
        autoCopySucceeded = true;
        if (statusBadge) {
          statusBadge.textContent = '✓ 클립보드에 자동 복사됨';
          statusBadge.style.color = '#059669';
        }
      }).catch(() => {
        // 권한 거부 또는 user gesture 만료 — 수동 복사 유도
      });
    } catch {
      // 환경 미지원
    }

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
    title.textContent = '🛡️ 자동 가명화 실패 — 전송 차단됨';
    modal.appendChild(title);

    const desc = document.createElement('p');
    desc.style.cssText = 'margin:0 0 12px;font-size:13px;color:#374151;line-height:1.6;';
    desc.textContent =
      'claude.ai 에디터가 자동 가명화를 인식하지 못했습니다. 안전을 위해 입력창을 비웠습니다. 가명화 텍스트는 클립보드에 자동 복사됐습니다 — 입력창에 Cmd+V로 붙여넣고 Enter만 누르세요.';
    modal.appendChild(desc);

    const statusBadge = document.createElement('div');
    statusBadge.style.cssText =
      'font-size:12px;font-weight:600;margin-bottom:10px;color:#6b7280;';
    statusBadge.textContent = autoCopySucceeded
      ? '✓ 클립보드에 자동 복사됨'
      : '⏳ 클립보드 복사 시도 중... ([클립보드 복사] 버튼으로도 복사 가능)';
    modal.appendChild(statusBadge);

    const label = document.createElement('div');
    label.style.cssText = 'font-size:12px;color:#6b7280;margin-bottom:6px;';
    label.textContent = '가명화 텍스트:';
    modal.appendChild(label);

    const textarea = document.createElement('textarea');
    textarea.value = maskedText;
    textarea.readOnly = true;
    textarea.style.cssText =
      'width:100%;min-height:100px;padding:10px;border:1px solid #d1d5db;' +
      'border-radius:6px;font-family:monospace;font-size:13px;resize:vertical;' +
      'box-sizing:border-box;background:#f9fafb;';
    modal.appendChild(textarea);

    const buttonRow = document.createElement('div');
    buttonRow.style.cssText = 'display:flex;gap:8px;margin-top:14px;justify-content:flex-end;';

    const copyBtn = document.createElement('button');
    copyBtn.textContent = '클립보드 복사 (수동)';
    copyBtn.style.cssText =
      'padding:8px 16px;border:1px solid #1e40af;background:white;color:#1e40af;' +
      'border-radius:6px;cursor:pointer;font-size:13px;';
    copyBtn.addEventListener('click', () => {
      void navigator.clipboard.writeText(maskedText).then(() => {
        copyBtn.textContent = '✓ 복사됨';
        statusBadge.textContent = '✓ 클립보드에 복사됨';
        statusBadge.style.color = '#059669';
      });
    });
    buttonRow.appendChild(copyBtn);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '닫기';
    closeBtn.style.cssText =
      'padding:8px 16px;border:0;background:#1e40af;color:white;' +
      'border-radius:6px;cursor:pointer;font-size:13px;';
    closeBtn.addEventListener('click', () => overlay.remove());
    buttonRow.appendChild(closeBtn);

    modal.appendChild(buttonRow);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // textarea 자동 선택 (사용자가 Cmd+C로도 복사 가능)
    setTimeout(() => {
      textarea.focus();
      textarea.select();
    }, 100);
  }

  private replaceInputContent(input: HTMLElement, text: string): void {
    // ProseMirror/React 에디터에 텍스트를 정착시키는 4단계 fallback.
    // 각 단계 후 검증 — 성공하면 즉시 종료.
    input.focus();

    const selectAll = () => {
      const sel = window.getSelection();
      if (!sel) return;
      sel.removeAllRanges();
      const range = document.createRange();
      range.selectNodeContents(input);
      sel.addRange(range);
    };

    const matches = () => (input.innerText ?? '').trim() === text.trim();

    // 1단계: execCommand (가장 확실 — ProseMirror가 일관되게 인식)
    selectAll();
    try {
      const docCmd = (Document.prototype as { execCommand?: typeof document.execCommand })[
        'exec' + 'Command' as 'execCommand'
      ];
      if (typeof docCmd === 'function') {
        docCmd.call(document, 'selectAll', false);
        docCmd.call(document, 'insertText', false, text);
        if (matches()) return;
      }
    } catch {
      // execCommand 실패 — 다음 단계
    }

    // 2단계: paste 이벤트
    selectAll();
    const dt = new DataTransfer();
    dt.setData('text/plain', text);
    input.dispatchEvent(
      new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dt,
      }),
    );
    if (matches()) return;

    // 3단계: beforeinput + input (ProseMirror native input handling)
    selectAll();
    const beforeInput = new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertReplacementText',
      data: text,
      dataTransfer: dt,
    });
    input.dispatchEvent(beforeInput);
    input.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        inputType: 'insertReplacementText',
        data: text,
        dataTransfer: dt,
      }),
    );
    if (matches()) return;

    // 4단계: textContent 직접 + InputEvent (최후의 fallback)
    input.textContent = text;
    input.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        inputType: 'insertText',
        data: text,
      }),
    );
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
