// Master password setup/change/clear UI for options page.
// No innerHTML. All DOM via DOM API only (matching existing options.ts style).

import {
  setupMasterPassword,
  unlockWithPassword,
  lockSession,
  clearCrypto,
  isCryptoEnabled,
  isUnlocked,
} from '../../background/encrypted-storage';

type Phase = 'loading' | 'disabled' | 'locked' | 'unlocked';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Partial<Record<string, string>> = {},
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined) node.setAttribute(k, v);
  }
  if (text !== undefined) node.textContent = text;
  return node;
}

function input(type: string, placeholder: string): HTMLInputElement {
  const i = el('input', { type, placeholder });
  i.style.cssText = 'width:100%;border:1px solid #d1d5db;border-radius:6px;padding:7px 10px;font-size:13px;margin-bottom:6px;';
  return i;
}

function btn(label: string, primary = false): HTMLButtonElement {
  const b = el('button', {}, label);
  b.style.cssText = primary
    ? 'background:#1e40af;color:white;border:none;border-radius:6px;padding:7px 14px;font-size:13px;cursor:pointer;margin-right:6px;'
    : 'background:none;border:1px solid #d1d5db;border-radius:6px;padding:7px 14px;font-size:13px;cursor:pointer;margin-right:6px;';
  return b;
}

export async function renderMasterPasswordSection(container: HTMLElement): Promise<void> {
  // Section wrapper
  const section = el('section');
  section.style.cssText = 'background:white;border-radius:8px;padding:20px;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,0.08);';
  container.appendChild(section);

  const title = el('h2', {}, '데이터 암호화 (선택 사항)');
  title.style.cssText = 'font-size:15px;font-weight:600;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #e5e7eb;';
  section.appendChild(title);

  const desc = el('p', {}, '마스터 비밀번호로 사용자 사전·프로필을 AES-GCM 256-bit 암호화합니다. 비밀번호는 브라우저 밖으로 전송되지 않습니다.');
  desc.style.cssText = 'font-size:12px;color:#6b7280;margin-bottom:12px;';
  section.appendChild(desc);

  const msgEl = el('p');
  msgEl.style.cssText = 'font-size:13px;margin-bottom:8px;min-height:18px;';
  section.appendChild(msgEl);

  const formArea = el('div');
  section.appendChild(formArea);

  function showMsg(text: string, color: string) {
    msgEl.textContent = text;
    msgEl.style.color = color;
  }

  async function render(phase: Phase) {
    while (formArea.firstChild) formArea.removeChild(formArea.firstChild);

    if (phase === 'loading') return;

    if (phase === 'disabled') {
      const pw1 = input('password', '새 마스터 비밀번호 (8자 이상)');
      const pw2 = input('password', '비밀번호 확인');
      const enableBtn = btn('암호화 활성화', true);
      enableBtn.addEventListener('click', async () => {
        showMsg('', '');
        if (pw1.value.length < 8) { showMsg('비밀번호는 8자 이상이어야 합니다.', '#ef4444'); return; }
        if (pw1.value !== pw2.value) { showMsg('비밀번호가 일치하지 않습니다.', '#ef4444'); return; }
        await setupMasterPassword(pw1.value);
        pw1.value = ''; pw2.value = '';
        showMsg('암호화가 활성화되었습니다.', '#059669');
        await render('unlocked');
      });
      formArea.appendChild(pw1);
      formArea.appendChild(pw2);
      formArea.appendChild(enableBtn);
    }

    if (phase === 'locked') {
      const pw = input('password', '마스터 비밀번호');
      const unlockBtn = btn('잠금 해제', true);
      unlockBtn.addEventListener('click', async () => {
        showMsg('', '');
        const ok = await unlockWithPassword(pw.value);
        if (!ok) { showMsg('비밀번호가 올바르지 않습니다.', '#ef4444'); return; }
        pw.value = '';
        showMsg('', '');
        await render('unlocked');
      });
      formArea.appendChild(pw);
      formArea.appendChild(unlockBtn);
    }

    if (phase === 'unlocked') {
      const lockBtn = btn('세션 잠금');
      lockBtn.addEventListener('click', async () => {
        lockSession();
        showMsg('세션이 잠겼습니다.', '#374151');
        await render('locked');
      });

      const disableBtn = btn('암호화 비활성화');
      disableBtn.style.color = '#ef4444';
      disableBtn.style.borderColor = '#fca5a5';
      disableBtn.addEventListener('click', async () => {
        if (!confirm('암호화를 비활성화하면 저장된 데이터가 평문으로 전환됩니다. 계속할까요?')) return;
        await clearCrypto();
        showMsg('암호화가 비활성화되었습니다.', '#374151');
        await render('disabled');
      });

      formArea.appendChild(lockBtn);
      formArea.appendChild(disableBtn);
    }
  }

  // Determine initial phase
  const enabled = await isCryptoEnabled();
  let phase: Phase;
  if (!enabled) phase = 'disabled';
  else if (isUnlocked()) phase = 'unlocked';
  else phase = 'locked';

  await render(phase);
}
