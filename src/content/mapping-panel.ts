import type { Mapping } from '@/shared/types';

/**
 * 응답에 가명이 보일 때 화면 우측 상단에 매핑 표를 띄움.
 * Round-trip 자동 복원이 React 재렌더링에 의해 덮어써지는 경우의 fallback UX.
 */

let panelEl: HTMLDivElement | null = null;
let lastShownAt = 0;
const COOLDOWN_MS = 4000;

const PANEL_STYLE =
  'position:fixed;top:80px;right:20px;z-index:2147483646;' +
  'background:white;border:1px solid #d1d5db;border-radius:12px;' +
  'box-shadow:0 8px 24px rgba(0,0,0,0.12);padding:14px 16px;' +
  'max-width:380px;max-height:70vh;overflow-y:auto;' +
  'font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:13px;' +
  'animation:pii-shield-slide-in 0.25s ease-out;';

const HEADER_STYLE =
  'display:flex;justify-content:space-between;align-items:center;' +
  'font-weight:600;margin-bottom:8px;color:#1e40af;';

const CLOSE_BTN_STYLE =
  'border:0;background:transparent;cursor:pointer;font-size:20px;' +
  'color:#6b7280;padding:0 4px;line-height:1;';

const LIST_STYLE = 'margin:0;padding-left:0;list-style:none;line-height:1.9;';

const ALIAS_CODE_STYLE =
  'background:#e5e7eb;padding:2px 6px;border-radius:4px;' +
  'font-family:monospace;font-size:12px;color:#1f2937;';

const ORIG_CODE_STYLE =
  'background:#dbeafe;padding:2px 6px;border-radius:4px;' +
  'font-family:monospace;font-size:12px;color:#1e3a8a;font-weight:500;';

const NOTE_STYLE =
  'margin-top:10px;padding-top:8px;border-top:1px solid #f3f4f6;' +
  'font-size:11px;color:#6b7280;line-height:1.4;';

let styleInjected = false;

function injectAnimationStyle(): void {
  if (styleInjected) return;
  const style = document.createElement('style');
  style.textContent = `
@keyframes pii-shield-slide-in {
  from { transform: translateX(20px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
`;
  document.head.appendChild(style);
  styleInjected = true;
}

/**
 * 매핑 패널을 화면에 표시. 짧은 시간 내 중복 호출은 무시 (cooldown).
 * 기존 패널이 있으면 갱신.
 */
export function showMappingPanel(mappings: Mapping[]): void {
  console.log('[pii-shield][panel] showMappingPanel called with', mappings.length, 'mappings');
  if (mappings.length === 0) {
    console.warn('[pii-shield][panel] empty mappings, returning');
    return;
  }

  const now = Date.now();
  if (now - lastShownAt < COOLDOWN_MS && panelEl) {
    console.log('[pii-shield][panel] cooldown — updating existing panel');
    updatePanelContents(mappings);
    return;
  }
  lastShownAt = now;

  injectAnimationStyle();

  if (panelEl) {
    panelEl.remove();
    panelEl = null;
  }

  panelEl = document.createElement('div');
  panelEl.id = 'pii-shield-mapping-panel';
  panelEl.style.cssText = PANEL_STYLE;

  buildPanelContents(panelEl, mappings);
  document.body.appendChild(panelEl);
  console.log('[pii-shield][panel] panel appended to body');
}

function buildPanelContents(panel: HTMLDivElement, mappings: Mapping[]): void {
  // header
  const header = document.createElement('div');
  header.style.cssText = HEADER_STYLE;

  const title = document.createElement('span');
  title.textContent = '🛡️ PII 매핑 (응답 해석용)';
  header.appendChild(title);

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.title = '닫기';
  closeBtn.style.cssText = CLOSE_BTN_STYLE;
  closeBtn.addEventListener('click', () => {
    panelEl?.remove();
    panelEl = null;
  });
  header.appendChild(closeBtn);
  panel.appendChild(header);

  // list
  const list = document.createElement('ul');
  list.id = 'pii-shield-mapping-list';
  list.style.cssText = LIST_STYLE;
  populateList(list, mappings);
  panel.appendChild(list);

  // footer note
  const note = document.createElement('div');
  note.style.cssText = NOTE_STYLE;
  note.textContent =
    'Claude가 가명만 받았으니 응답에도 가명이 보입니다. 위 표로 원본을 확인하세요.';
  panel.appendChild(note);
}

function updatePanelContents(mappings: Mapping[]): void {
  const list = panelEl?.querySelector<HTMLUListElement>('#pii-shield-mapping-list');
  if (!list) return;
  // 기존 li 제거 (textContent 비우기는 createElement로 다시 만드는 것)
  while (list.firstChild) {
    list.removeChild(list.firstChild);
  }
  populateList(list, mappings);
}

function populateList(list: HTMLUListElement, mappings: Mapping[]): void {
  for (const m of mappings) {
    const li = document.createElement('li');
    const aliasCode = document.createElement('code');
    aliasCode.style.cssText = ALIAS_CODE_STYLE;
    aliasCode.textContent = m.alias;

    const arrow = document.createTextNode(' = ');

    const origCode = document.createElement('code');
    origCode.style.cssText = ORIG_CODE_STYLE;
    origCode.textContent = m.original;

    li.appendChild(aliasCode);
    li.appendChild(arrow);
    li.appendChild(origCode);
    list.appendChild(li);
  }
}

/**
 * 텍스트 노드의 내용에 가명 패턴이 포함되어 있는지 검사.
 */
export function nodeContainsAlias(node: Node, regex: RegExp): boolean {
  const text = node.textContent ?? '';
  return regex.test(text);
}
