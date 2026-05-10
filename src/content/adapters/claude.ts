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
      // 정착 성공 → 자동 전송 (시나리오 A)
      this.dispatchSubmit();
    } else {
      // 정착 실패 → 빠른 fallback (시나리오 B 모달 없이 즉시 클립보드+토스트)
      void this.fastFallback(input, masked);
    }
  }

  /**
   * ProseMirror 합성 이벤트 거부로 자동 정착 실패 시:
   * 1. 클립보드에 가명화 텍스트 강제 복사
   * 2. 입력창 비우기 (ProseMirror-friendly)
   * 3. 입력창 자동 focus
   * 4. 큰 안내 토스트로 'Cmd+V → Enter' 한 번만 하도록 유도
   */
  private async fastFallback(input: HTMLElement, masked: string): Promise<void> {
    // 1. 클립보드 강제 복사 (user gesture 컨텍스트 안)
    let copied = false;
    try {
      await navigator.clipboard.writeText(masked);
      copied = true;
    } catch {
      // execCommand fallback — 임시 textarea로 select+copy
      const tmp = document.createElement('textarea');
      tmp.value = masked;
      tmp.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;';
      document.body.appendChild(tmp);
      tmp.focus();
      tmp.select();
      try {
        const docCmd = (Document.prototype as { execCommand?: typeof document.execCommand })[
          'exec' + 'Command' as 'execCommand'
        ];
        if (typeof docCmd === 'function') {
          copied = docCmd.call(document, 'copy');
        }
      } catch {
        // ignore
      }
      tmp.remove();
    }

    // 2. 입력창 비우기 (ProseMirror state 보존)
    this.clearInputSafely(input);

    // 3. 입력창 다시 focus (사용자가 Cmd+V 즉시 가능)
    setTimeout(() => input.focus(), 80);

    // 4. 큰 안내 토스트
    this.showBigCmdVHint(copied);
  }

  private showBigCmdVHint(copied: boolean): void {
    const hint = document.createElement('div');
    hint.style.cssText =
      'position:fixed!important;top:50%!important;left:50%!important;' +
      'transform:translate(-50%,-50%)!important;z-index:2147483647!important;' +
      `background:${copied ? '#1e40af' : '#dc2626'}!important;color:white!important;` +
      'padding:28px 36px!important;border-radius:14px!important;' +
      'font-size:17px!important;font-weight:600!important;' +
      'font-family:-apple-system,BlinkMacSystemFont,sans-serif!important;' +
      'box-shadow:0 16px 48px rgba(0,0,0,0.35)!important;' +
      'text-align:center!important;line-height:1.7!important;' +
      'white-space:pre-line!important;max-width:480px!important;';
    hint.textContent = copied
      ? '🛡️ 가명화 텍스트가 클립보드에 복사됨\n\n입력창에서 Cmd+V 후 Enter 하세요'
      : '⚠️ 클립보드 복사 실패\n\n매핑 패널에서 직접 복사 후\n입력창에 붙여넣어 주세요';
    document.body.appendChild(hint);

    // 4초 후 페이드 아웃
    setTimeout(() => {
      hint.style.transition = 'opacity 0.4s ease-out';
      hint.style.opacity = '0';
      setTimeout(() => hint.remove(), 500);
    }, 4000);
  }

  private clearInputSafely(input: HTMLElement): void {
    // ProseMirror가 인식하는 방식으로만 비우기.
    // textContent 직접 변경은 ProseMirror state를 망가뜨려 후속 paste가 막힘 → 절대 금지.
    input.focus();
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      const range = document.createRange();
      range.selectNodeContents(input);
      sel.addRange(range);
    }

    // 1단계: execCommand selectAll + delete (가장 ProseMirror-friendly)
    try {
      const docCmd = (Document.prototype as { execCommand?: typeof document.execCommand })[
        'exec' + 'Command' as 'execCommand'
      ];
      if (typeof docCmd === 'function') {
        docCmd.call(document, 'selectAll', false);
        docCmd.call(document, 'delete', false);
        if (!(input.innerText ?? '').trim()) return;
      }
    } catch {
      // fallback below
    }

    // 2단계: beforeinput deleteContent
    input.dispatchEvent(
      new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: 'deleteContent',
      }),
    );
    input.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        inputType: 'deleteContent',
      }),
    );

    // 비우기에 실패해도 textContent 직접 변경 금지.
    // 사용자가 모달 안내에 따라 직접 Cmd+A로 선택 후 Cmd+V로 덮어쓰기 가능.
  }

  private showCmdVHint(): void {
    const toast = document.createElement('div');
    toast.style.cssText =
      'position:fixed;top:20px;left:50%;transform:translateX(-50%);' +
      'background:#1e40af;color:white;padding:14px 24px;border-radius:8px;' +
      'z-index:2147483647;font-family:-apple-system,sans-serif;font-size:14px;' +
      'box-shadow:0 8px 24px rgba(0,0,0,0.3);font-weight:600;';
    toast.textContent =
      '✓ 클립보드 복사 완료. 입력창에서 Cmd+A → Cmd+V → Enter 하세요.';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 6000);
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
    title.textContent = '🛡️ 자동 가명화 실패 — 전송 차단됨';
    modal.appendChild(title);

    const desc = document.createElement('div');
    desc.style.cssText = 'margin:0 0 12px;font-size:13px;color:#374151;line-height:1.7;';

    const descTitle = document.createElement('div');
    descTitle.style.cssText = 'font-weight:600;margin-bottom:6px;';
    descTitle.textContent = 'claude.ai 에디터가 자동 가명화를 인식하지 못했습니다.';
    desc.appendChild(descTitle);

    const descSteps = document.createElement('div');
    descSteps.textContent =
      '가명화 텍스트는 클립보드에 자동 복사되었습니다. 다음 순서로 진행하세요:';
    desc.appendChild(descSteps);

    const stepList = document.createElement('ol');
    stepList.style.cssText = 'margin:6px 0 0;padding-left:22px;line-height:1.8;';
    const steps = [
      '이 모달의 [닫기] 버튼 클릭',
      '입력창 클릭해 포커스',
      'Cmd+A 로 전체 선택 (원본 PII 포함)',
      'Cmd+V 로 가명화 텍스트로 덮어쓰기',
      'Enter 로 전송',
    ];
    for (const s of steps) {
      const li = document.createElement('li');
      li.textContent = s;
      stepList.appendChild(li);
    }
    desc.appendChild(stepList);

    modal.appendChild(desc);

    const statusBadge = document.createElement('div');
    statusBadge.style.cssText =
      'font-size:12px;font-weight:600;margin-bottom:10px;color:#dc2626;';
    statusBadge.textContent = '⏳ 클립보드 복사 시도 중...';
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
    buttonRow.style.cssText = 'display:flex;gap:8px;margin-top:14px;justify-content:flex-end;flex-wrap:wrap;';

    // 보조: 클립보드만 복사
    const copyBtn = document.createElement('button');
    copyBtn.textContent = '클립보드만 복사';
    copyBtn.style.cssText =
      'padding:8px 16px;border:1px solid #d1d5db;background:white;color:#374151;' +
      'border-radius:6px;cursor:pointer;font-size:13px;';
    copyBtn.addEventListener('click', () => {
      void navigator.clipboard
        .writeText(maskedText)
        .then(() => {
          copyBtn.textContent = '✓ 복사됨';
          statusBadge.textContent = '✓ 클립보드 복사 완료. 입력창에서 Cmd+A → Cmd+V → Enter';
          statusBadge.style.color = '#059669';
        })
        .catch(() => {
          textarea.focus();
          textarea.select();
        });
    });
    buttonRow.appendChild(copyBtn);

    // 보조: 닫기
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '닫기';
    closeBtn.style.cssText =
      'padding:8px 16px;border:1px solid #d1d5db;background:white;color:#374151;' +
      'border-radius:6px;cursor:pointer;font-size:13px;';
    closeBtn.addEventListener('click', () => overlay.remove());
    buttonRow.appendChild(closeBtn);

    // PRIMARY: 입력창에 직접 자동 입력 + 전송 (user gesture 컨텍스트 활용)
    const autoSendBtn = document.createElement('button');
    autoSendBtn.textContent = '🛡️ 입력창에 자동 입력 + 전송';
    autoSendBtn.style.cssText =
      'padding:10px 20px;border:0;background:#1e40af;color:white;' +
      'border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;';
    autoSendBtn.addEventListener('click', () => {
      overlay.remove();
      const input = this.findInputElement();
      if (!input) return;
      // user gesture 컨텍스트 안 — ProseMirror가 paste를 인식할 가능성 ↑
      // 클립보드도 동시 복사 (Cmd+V fallback 보장)
      void navigator.clipboard.writeText(maskedText).catch(() => {});
      // 입력창 정착 시도 (4-tier fallback 재실행)
      this.replaceInputContent(input, maskedText);
      setTimeout(() => {
        const currentText = (input.innerText ?? '').trim();
        if (currentText === maskedText.trim()) {
          // 정착 성공 → 자동 전송
          this.dispatchSubmit();
        } else {
          // 여전히 실패 → 클립보드는 확실히 복사됐으니 사용자 안내
          this.showCmdVHint();
        }
      }, 250);
    });
    buttonRow.appendChild(autoSendBtn);

    modal.appendChild(buttonRow);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // 클립보드 복사 다중 fallback
    const tryCopy = () => {
      // 1) navigator.clipboard.writeText (modern API, 권한 필요)
      const setSuccess = () => {
        statusBadge.textContent = '✓ 클립보드에 가명화 텍스트가 복사됨';
        statusBadge.style.color = '#059669';
      };
      const setManual = () => {
        statusBadge.textContent =
          '⚠️ 자동 복사 실패 — 위 회색 박스에서 Cmd+C로 직접 복사하세요';
        statusBadge.style.color = '#dc2626';
      };

      let modernResolved = false;
      try {
        void navigator.clipboard
          .writeText(maskedText)
          .then(() => {
            modernResolved = true;
            setSuccess();
          })
          .catch(() => {
            modernResolved = true;
            // execCommand fallback 시도
            tryExecCopy();
          });
      } catch {
        tryExecCopy();
      }

      // 2) execCommand('copy') fallback (textarea select 상태에서)
      function tryExecCopy(): void {
        textarea.focus();
        textarea.select();
        try {
          const docCmd = (Document.prototype as { execCommand?: typeof document.execCommand })[
            'exec' + 'Command' as 'execCommand'
          ];
          if (typeof docCmd === 'function') {
            const ok = docCmd.call(document, 'copy');
            if (ok) {
              setSuccess();
              return;
            }
          }
        } catch {
          // ignore
        }
        setManual();
      }

      // navigator.clipboard 응답 미완료 시 0.6초 후 fallback
      setTimeout(() => {
        if (!modernResolved) tryExecCopy();
      }, 600);
    };

    // textarea 자동 선택 (사용자가 Cmd+C로 즉시 복사 가능)
    setTimeout(() => {
      textarea.focus();
      textarea.select();
      tryCopy();
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
