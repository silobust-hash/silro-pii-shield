import { sendMessage } from '@/shared/messaging';
import type {
  ConversationMappings,
  UserDictEntry,
  AllSiteSettings,
  SiteKey,
  DictCategory,
} from '@/shared/types';

const SITE_KEYS: SiteKey[] = [
  'claude.ai',
  'chatgpt.com',
  'gemini.google.com',
  'perplexity.ai',
];

const SITE_LABELS: Record<SiteKey, string> = {
  'claude.ai': 'Claude',
  'chatgpt.com': 'ChatGPT',
  'gemini.google.com': 'Gemini',
  'perplexity.ai': 'Perplexity',
};

async function getActiveTabInfo(): Promise<{ hostname: string; path: string }> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url ?? '';
      try {
        const u = new URL(url);
        resolve({ hostname: u.hostname, path: u.pathname });
      } catch {
        resolve({ hostname: '', path: '' });
      }
    });
  });
}

function getConversationIdFromUrl(hostname: string, path: string): string {
  if (hostname === 'claude.ai') {
    const m = path.match(/\/chat\/([a-f0-9-]+)/);
    return m ? `claude:${m[1]}` : 'claude:home';
  }
  if (hostname === 'chatgpt.com') {
    const m = path.match(/\/c\/([a-f0-9-]+)/);
    return m ? `chatgpt:${m[1]}` : 'chatgpt:home';
  }
  if (hostname === 'gemini.google.com') {
    const m = path.match(/\/app\/([a-zA-Z0-9_-]+)/);
    return m ? `gemini:${m[1]}` : 'gemini:home';
  }
  if (hostname === 'perplexity.ai') {
    const m = path.match(/\/(?:search|page)\/([^/]+)/);
    return m ? `perplexity:${m[1]}` : 'perplexity:home';
  }
  return 'unknown';
}

function renderMappings(data: ConversationMappings | null): void {
  const container = document.getElementById('mappings-list')!;
  while (container.firstChild) container.removeChild(container.firstChild);

  if (!data || Object.keys(data.reverse).length === 0) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = '매핑 없음 (이 대화에서 PII가 감지되지 않았습니다)';
    container.appendChild(p);
    return;
  }

  for (const [alias, original] of Object.entries(data.reverse)) {
    const row = document.createElement('div');
    row.className = 'mapping-row';

    const aliasEl = document.createElement('span');
    aliasEl.className = 'mapping-alias';
    aliasEl.textContent = alias;

    const arrow = document.createTextNode(' ↔ ');

    const origEl = document.createElement('span');
    origEl.className = 'mapping-original';
    origEl.textContent = original;

    row.appendChild(aliasEl);
    row.appendChild(arrow);
    row.appendChild(origEl);
    container.appendChild(row);
  }
}

function renderDict(entries: UserDictEntry[]): void {
  const container = document.getElementById('dict-list')!;
  while (container.firstChild) container.removeChild(container.firstChild);

  if (entries.length === 0) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = '등록된 항목 없음';
    container.appendChild(p);
    return;
  }

  for (const entry of entries) {
    const row = document.createElement('div');
    row.className = 'dict-row';

    const aliasEl = document.createElement('span');
    aliasEl.className = 'dict-alias';
    aliasEl.textContent = entry.alias;

    const patternsEl = document.createElement('span');
    patternsEl.className = 'dict-patterns';
    patternsEl.textContent = entry.patterns.join(', ');

    const delBtn = document.createElement('button');
    delBtn.className = 'dict-del';
    delBtn.textContent = '삭제';
    delBtn.addEventListener('click', async () => {
      await sendMessage({ type: 'DELETE_DICT_ENTRY', id: entry.id });
      await refreshDict();
    });

    row.appendChild(aliasEl);
    row.appendChild(patternsEl);
    row.appendChild(delBtn);
    container.appendChild(row);
  }
}

async function refreshDict(): Promise<void> {
  const entries = await sendMessage<UserDictEntry[]>({ type: 'GET_DICT' });
  renderDict(entries as UserDictEntry[]);
}

function renderSiteToggles(settings: AllSiteSettings): void {
  const container = document.getElementById('site-toggles')!;
  while (container.firstChild) container.removeChild(container.firstChild);

  for (const key of SITE_KEYS) {
    const enabled = settings[key]?.enabled ?? true;

    const row = document.createElement('div');
    row.className = 'toggle-row';

    const label = document.createElement('span');
    label.textContent = SITE_LABELS[key];

    const wrapper = document.createElement('label');
    wrapper.className = 'toggle-switch';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = enabled;
    checkbox.addEventListener('change', async () => {
      await sendMessage({
        type: 'SET_SITE_SETTINGS',
        siteKey: key,
        settings: { enabled: checkbox.checked },
      });
    });

    const slider = document.createElement('span');
    slider.className = 'toggle-slider';

    wrapper.appendChild(checkbox);
    wrapper.appendChild(slider);
    row.appendChild(label);
    row.appendChild(wrapper);
    container.appendChild(row);
  }
}

function setupAddForm(): void {
  const addBtn = document.getElementById('dict-add-btn')!;
  addBtn.addEventListener('click', async () => {
    const categoryEl = document.getElementById('dict-category') as HTMLSelectElement;
    const patternsEl = document.getElementById('dict-patterns') as HTMLInputElement;
    const aliasEl = document.getElementById('dict-alias') as HTMLInputElement;

    const patterns = patternsEl.value.split(',').map((s) => s.trim()).filter(Boolean);
    const alias = aliasEl.value.trim();
    if (patterns.length === 0 || !alias) return;

    const entry: UserDictEntry = {
      id: crypto.randomUUID(),
      category: categoryEl.value as DictCategory,
      patterns,
      alias,
      caseInsensitive: false,
      createdAt: Date.now(),
    };

    await sendMessage({ type: 'UPSERT_DICT_ENTRY', entry });
    patternsEl.value = '';
    aliasEl.value = '';
    await refreshDict();
  });
}

async function init(): Promise<void> {
  const { hostname, path } = await getActiveTabInfo();
  const conversationId = getConversationIdFromUrl(hostname, path);

  const siteLabel = document.getElementById('site-label')!;
  siteLabel.textContent = hostname || '(지원 사이트 아님)';

  try {
    const mappings = await sendMessage<ConversationMappings | null>({
      type: 'GET_MAPPINGS',
      conversationId,
    });
    renderMappings(mappings as ConversationMappings | null);
  } catch {
    renderMappings(null);
  }

  await refreshDict();

  try {
    const settings = await sendMessage<AllSiteSettings>({ type: 'GET_SITE_SETTINGS' });
    renderSiteToggles(settings as AllSiteSettings);
  } catch {
    renderSiteToggles({});
  }

  setupAddForm();
}

void init();
