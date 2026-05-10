// Export/Import UI for user dictionary, profiles, and settings.
// File download via Blob + URL.createObjectURL. No innerHTML.

import { deriveKey, encrypt, decrypt, generateSalt, type EncryptedBlob } from '../../background/crypto';
import type { ExportPayload } from '../../shared/types';

async function downloadJson(payload: ExportPayload, filename: string): Promise<void> {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

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

function inputEl(type: string, placeholder: string): HTMLInputElement {
  const i = el('input', { type, placeholder });
  i.style.cssText = 'width:100%;border:1px solid #d1d5db;border-radius:6px;padding:7px 10px;font-size:13px;margin-bottom:6px;';
  return i;
}

function btnEl(label: string, primary = false): HTMLButtonElement {
  const b = el('button', {}, label);
  b.style.cssText = primary
    ? 'background:#1e40af;color:white;border:none;border-radius:6px;padding:7px 14px;font-size:13px;cursor:pointer;margin-right:6px;'
    : 'background:none;border:1px solid #d1d5db;border-radius:6px;padding:7px 14px;font-size:13px;cursor:pointer;margin-right:6px;';
  return b;
}

export async function renderExportImportSection(container: HTMLElement): Promise<void> {
  const section = el('section');
  section.style.cssText = 'background:white;border-radius:8px;padding:20px;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,0.08);';
  container.appendChild(section);

  const title = el('h2', {}, '데이터 내보내기 / 가져오기');
  title.style.cssText = 'font-size:15px;font-weight:600;margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid #e5e7eb;';
  section.appendChild(title);

  // ── Export ────────────────────────────────────────────────────────────────
  const exportTitle = el('h3', {}, '내보내기');
  exportTitle.style.cssText = 'font-size:13px;font-weight:600;margin-bottom:8px;';
  section.appendChild(exportTitle);

  const exportPwInput = inputEl('password', '내보내기 비밀번호 (선택 — 입력 시 암호화)');
  section.appendChild(exportPwInput);

  const exportBtnRow = el('div');
  exportBtnRow.style.cssText = 'display:flex;gap:8px;margin-bottom:16px;';
  section.appendChild(exportBtnRow);

  const plainExportBtn = btnEl('평문 내보내기');
  const encExportBtn = btnEl('암호화 내보내기', true);
  exportBtnRow.appendChild(plainExportBtn);
  exportBtnRow.appendChild(encExportBtn);

  async function handleExport(withEncryption: boolean): Promise<void> {
    const [dictResult, profileResult, settingsResult] = await Promise.all([
      chrome.storage.local.get('userDictionary'),
      chrome.storage.local.get('profiles'),
      chrome.storage.local.get('settings'),
    ]);

    const payload: ExportPayload = {
      version: '1.0',
      exportedAt: Date.now(),
      encrypted: withEncryption,
      userDictionary: dictResult['userDictionary'] ?? [],
      profiles: profileResult['profiles'] ?? [],
      settings: (settingsResult['settings'] as Record<string, unknown>) ?? {},
    };

    if (withEncryption && exportPwInput.value) {
      const salt = generateSalt();
      const key = await deriveKey(exportPwInput.value, salt);
      payload.userDictionary = await encrypt(key, JSON.stringify(payload.userDictionary), salt);
      payload.profiles = await encrypt(key, JSON.stringify(payload.profiles), salt);
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    const suffix = withEncryption ? '-encrypted' : '';
    await downloadJson(payload, `pii-shield-backup-${timestamp}${suffix}.json`);
  }

  plainExportBtn.addEventListener('click', () => void handleExport(false));
  encExportBtn.addEventListener('click', () => {
    if (!exportPwInput.value) {
      alert('암호화 내보내기를 위해 비밀번호를 입력하세요.');
      return;
    }
    void handleExport(true);
  });

  // ── Import ────────────────────────────────────────────────────────────────
  const separator = el('hr');
  separator.style.cssText = 'border:none;border-top:1px solid #e5e7eb;margin-bottom:12px;';
  section.appendChild(separator);

  const importTitle = el('h3', {}, '가져오기');
  importTitle.style.cssText = 'font-size:13px;font-weight:600;margin-bottom:8px;';
  section.appendChild(importTitle);

  const fileInput = el('input', { type: 'file', accept: '.json' });
  fileInput.style.cssText = 'display:block;margin-bottom:6px;font-size:13px;';
  section.appendChild(fileInput);

  const importPwInput = inputEl('password', '암호화 백업인 경우 비밀번호');
  section.appendChild(importPwInput);

  const importMsg = el('p');
  importMsg.style.cssText = 'font-size:13px;margin-bottom:8px;min-height:18px;';
  section.appendChild(importMsg);

  const importBtn = btnEl('가져오기');
  section.appendChild(importBtn);

  importBtn.addEventListener('click', async () => {
    importMsg.textContent = '';
    const files = (fileInput as HTMLInputElement).files;
    const file = files?.[0];
    if (!file) {
      importMsg.style.color = '#ef4444';
      importMsg.textContent = '파일을 선택하세요.';
      return;
    }

    try {
      const text = await file.text();
      const payload = JSON.parse(text) as ExportPayload;

      let dict = payload.userDictionary;
      let profiles = payload.profiles;

      if (payload.encrypted) {
        if (!importPwInput.value) {
          importMsg.style.color = '#ef4444';
          importMsg.textContent = '암호화된 백업입니다. 비밀번호를 입력하세요.';
          return;
        }
        const dictBlob = dict as EncryptedBlob;
        const saltBytes = Uint8Array.from(atob(dictBlob.salt), (c) => c.charCodeAt(0));
        const key = await deriveKey(importPwInput.value, saltBytes);
        dict = JSON.parse(await decrypt(key, dictBlob));
        profiles = JSON.parse(await decrypt(key, profiles as EncryptedBlob));
      }

      await chrome.storage.local.set({
        userDictionary: dict,
        profiles,
        settings: payload.settings,
      });
      importMsg.style.color = '#059669';
      importMsg.textContent = '가져오기 완료.';
    } catch (e) {
      importMsg.style.color = '#ef4444';
      importMsg.textContent = `가져오기 실패: ${e instanceof Error ? e.message : String(e)}`;
    }
  });
}
