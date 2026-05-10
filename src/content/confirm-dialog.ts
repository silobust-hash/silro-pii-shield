import type { PendingKoreanNameMatch } from '@/shared/types';

export type ConfirmResult = {
  confirmed: PendingKoreanNameMatch[];   // 가명화할 이름
  skipped: PendingKoreanNameMatch[];     // 건너뜀
};

/**
 * Shows a DOM dialog for each pending Korean name match.
 * Safe: uses textContent only, never innerHTML.
 */
export async function showKoreanNameConfirm(
  pending: PendingKoreanNameMatch[],
): Promise<ConfirmResult> {
  if (pending.length === 0) return { confirmed: [], skipped: [] };

  return new Promise<ConfirmResult>((resolve) => {
    const confirmed: PendingKoreanNameMatch[] = [];
    const skipped: PendingKoreanNameMatch[] = [];

    // Overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'background:rgba(0,0,0,0.45)',
      'z-index:2147483647', 'display:flex', 'align-items:center',
      'justify-content:center',
    ].join(';');

    // Dialog box
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.style.cssText = [
      'background:#fff', 'border-radius:12px', 'padding:24px',
      'max-width:480px', 'width:90vw', 'box-shadow:0 8px 32px rgba(0,0,0,0.2)',
      'font-family:system-ui,sans-serif',
    ].join(';');

    // Title
    const title = document.createElement('h2');
    title.style.cssText = 'margin:0 0 8px;font-size:16px;font-weight:700;color:#111';
    title.textContent = '한글 이름 감지 확인';
    dialog.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.style.cssText = 'margin:0 0 16px;font-size:13px;color:#555';
    subtitle.textContent = '다음 항목이 개인 이름으로 감지되었습니다. 가명화할 항목을 선택하세요.';
    dialog.appendChild(subtitle);

    // Checkboxes for each pending match
    const checkboxes: Array<{ checkbox: HTMLInputElement; match: PendingKoreanNameMatch }> = [];
    for (const match of pending) {
      const row = document.createElement('label');
      row.style.cssText = [
        'display:flex', 'align-items:flex-start', 'gap:10px',
        'padding:10px 12px', 'border-radius:8px', 'cursor:pointer',
        'background:#f7f7f8', 'margin-bottom:8px',
      ].join(';');

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = true; // 기본 체크
      checkbox.style.marginTop = '2px';

      const label = document.createElement('span');
      label.style.cssText = 'font-size:14px;line-height:1.5';

      const nameSpan = document.createElement('strong');
      nameSpan.textContent = match.original;

      const confSpan = document.createElement('span');
      confSpan.style.cssText = 'color:#888;font-size:12px;margin-left:6px';
      confSpan.textContent = `(신뢰도 ${Math.round(match.confidence * 100)}%)`;

      const ctxSpan = document.createElement('span');
      ctxSpan.style.cssText = 'display:block;color:#666;font-size:12px;margin-top:2px';
      ctxSpan.textContent = `…${match.contextSnippet}…`;

      label.appendChild(nameSpan);
      label.appendChild(confSpan);
      label.appendChild(ctxSpan);
      row.appendChild(checkbox);
      row.appendChild(label);
      dialog.appendChild(row);

      checkboxes.push({ checkbox, match });
    }

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:16px';

    const skipAll = document.createElement('button');
    skipAll.textContent = '모두 건너뜀';
    skipAll.style.cssText = 'padding:8px 16px;border:1px solid #ddd;border-radius:6px;background:#fff;cursor:pointer;font-size:13px';

    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = '선택 항목 가명화';
    confirmBtn.style.cssText = [
      'padding:8px 16px;border:none;border-radius:6px',
      'background:#2563eb;color:#fff;cursor:pointer;font-size:13px;font-weight:600',
    ].join(';');

    skipAll.addEventListener('click', () => {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      resolve({ confirmed: [], skipped: pending });
    });

    confirmBtn.addEventListener('click', () => {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      for (const { checkbox, match } of checkboxes) {
        if (checkbox.checked) confirmed.push(match);
        else skipped.push(match);
      }
      resolve({ confirmed, skipped });
    });

    btnRow.appendChild(skipAll);
    btnRow.appendChild(confirmBtn);
    dialog.appendChild(btnRow);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // 접근성: ESC로 닫기 (= 모두 건너뜀)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', onKey);
        resolve({ confirmed: [], skipped: pending });
      }
    };
    document.addEventListener('keydown', onKey);
  });
}
