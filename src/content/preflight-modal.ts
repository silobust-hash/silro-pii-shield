import type { Mapping } from '@/shared/types';

// v0.4: 파일 프리뷰 모달은 file-preflight-modal.ts에서 구현
export { showFilePreflightModal } from './file-preflight-modal';

export type PreflightDecision = 'send' | 'cancel';

const OVERLAY_STYLE =
  'position:fixed;inset:0;background:rgba(0,0,0,0.5);' +
  'z-index:2147483647;display:flex;align-items:center;justify-content:center;' +
  'font-family:-apple-system,BlinkMacSystemFont,sans-serif;';
const MODAL_STYLE =
  'background:white;border-radius:12px;padding:24px;' +
  'max-width:600px;width:90%;max-height:80vh;overflow-y:auto;' +
  'box-shadow:0 10px 40px rgba(0,0,0,0.2);';
const HEADING_STYLE = 'margin:0 0 12px;font-size:18px;';
const PREVIEW_BOX_STYLE =
  'background:#f3f4f6;padding:12px;border-radius:6px;margin-bottom:12px;';
const PREVIEW_LABEL_STYLE = 'font-size:12px;color:#6b7280;margin-bottom:4px;';
const PREVIEW_TEXT_STYLE = 'white-space:pre-wrap;font-size:13px;';
const SECTION_STYLE = 'margin-bottom:12px;';
const SECTION_LABEL_STYLE = 'font-size:13px;font-weight:600;margin-bottom:6px;';
const LIST_STYLE = 'margin:0;padding-left:20px;font-size:12px;line-height:1.6;';
const EMPTY_STYLE = 'color:#6b7280;';
const BUTTON_ROW_STYLE = 'display:flex;gap:8px;justify-content:flex-end;';
const CANCEL_BUTTON_STYLE =
  'padding:8px 16px;border:1px solid #d1d5db;background:white;border-radius:6px;cursor:pointer;';
const SEND_BUTTON_STYLE =
  'padding:8px 16px;border:0;background:#1e40af;color:white;border-radius:6px;cursor:pointer;';
const CODE_STYLE =
  'background:#e5e7eb;padding:1px 4px;border-radius:3px;font-family:monospace;';

export function showPreflight(opts: {
  original: string;
  masked: string;
  mappings: Mapping[];
}): Promise<PreflightDecision> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.id = 'pii-shield-preflight';
    overlay.style.cssText = OVERLAY_STYLE;

    const modal = document.createElement('div');
    modal.style.cssText = MODAL_STYLE;

    const heading = document.createElement('h2');
    heading.style.cssText = HEADING_STYLE;
    heading.textContent = '🛡️ 마스킹 미리보기';
    modal.appendChild(heading);

    const previewBox = document.createElement('div');
    previewBox.style.cssText = PREVIEW_BOX_STYLE;
    const previewLabel = document.createElement('div');
    previewLabel.style.cssText = PREVIEW_LABEL_STYLE;
    previewLabel.textContent = '변환 후 (전송될 내용)';
    previewBox.appendChild(previewLabel);
    const previewText = document.createElement('div');
    previewText.style.cssText = PREVIEW_TEXT_STYLE;
    previewText.textContent = opts.masked;
    previewBox.appendChild(previewText);
    modal.appendChild(previewBox);

    const section = document.createElement('div');
    section.style.cssText = SECTION_STYLE;
    const sectionLabel = document.createElement('div');
    sectionLabel.style.cssText = SECTION_LABEL_STYLE;
    sectionLabel.textContent = `감지된 PII (${opts.mappings.length}개)`;
    section.appendChild(sectionLabel);

    const list = document.createElement('ul');
    list.style.cssText = LIST_STYLE;
    if (opts.mappings.length === 0) {
      const empty = document.createElement('li');
      empty.style.cssText = EMPTY_STYLE;
      empty.textContent = '없음';
      list.appendChild(empty);
    } else {
      for (const mapping of opts.mappings) {
        const li = document.createElement('li');
        const origCode = document.createElement('code');
        origCode.style.cssText = CODE_STYLE;
        origCode.textContent = mapping.original;
        const arrow = document.createTextNode(' → ');
        const aliasCode = document.createElement('code');
        aliasCode.style.cssText = CODE_STYLE;
        aliasCode.textContent = mapping.alias;
        li.appendChild(origCode);
        li.appendChild(arrow);
        li.appendChild(aliasCode);
        list.appendChild(li);
      }
    }
    section.appendChild(list);
    modal.appendChild(section);

    const buttonRow = document.createElement('div');
    buttonRow.style.cssText = BUTTON_ROW_STYLE;
    const cancelBtn = document.createElement('button');
    cancelBtn.style.cssText = CANCEL_BUTTON_STYLE;
    cancelBtn.textContent = '취소';
    const sendBtn = document.createElement('button');
    sendBtn.style.cssText = SEND_BUTTON_STYLE;
    sendBtn.textContent = '전송';
    buttonRow.appendChild(cancelBtn);
    buttonRow.appendChild(sendBtn);
    modal.appendChild(buttonRow);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const cleanup = (decision: PreflightDecision) => {
      overlay.remove();
      resolve(decision);
    };
    cancelBtn.addEventListener('click', () => cleanup('cancel'));
    sendBtn.addEventListener('click', () => {
      // ⚡ 사용자 클릭 시점에 sync로 클립보드 복사 (user gesture context 보장)
      // 1) execCommand('copy') 먼저 — sync 호출이라 gesture 만료 위험 0
      const tmp = document.createElement('textarea');
      tmp.value = opts.masked;
      tmp.style.cssText =
        'position:fixed!important;left:0!important;top:0!important;' +
        'width:1px!important;height:1px!important;opacity:0!important;' +
        'pointer-events:none!important;';
      document.body.appendChild(tmp);
      tmp.focus();
      tmp.select();
      tmp.setSelectionRange(0, opts.masked.length);
      try {
        const docCmd = (Document.prototype as { execCommand?: typeof document.execCommand })[
          'exec' + 'Command' as 'execCommand'
        ];
        if (typeof docCmd === 'function') docCmd.call(document, 'copy');
      } catch {
        // ignore
      }
      tmp.remove();

      // 2) navigator.clipboard.writeText 보조 (modern API, 일부 환경에서 우선)
      void navigator.clipboard.writeText(opts.masked).catch(() => {});

      cleanup('send');
    });
  });
}
