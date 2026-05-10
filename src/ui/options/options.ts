import { sendMessage } from '@/shared/messaging';
import type { UserDictEntry, AllSiteSettings, SiteKey, DictCategory } from '@/shared/types';

const SITE_KEYS: SiteKey[] = [
  'claude.ai', 'chatgpt.com', 'gemini.google.com', 'perplexity.ai',
];

const SITE_LABELS: Record<SiteKey, string> = {
  'claude.ai': 'Claude (claude.ai)',
  'chatgpt.com': 'ChatGPT (chatgpt.com)',
  'gemini.google.com': 'Gemini (gemini.google.com)',
  'perplexity.ai': 'Perplexity (perplexity.ai)',
};

const CATEGORY_BADGE: Record<DictCategory, string> = {
  person: 'badge-person', company: 'badge-company', hospital: 'badge-hospital',
  department: 'badge-department', custom: 'badge-custom',
};

const CATEGORY_LABEL: Record<DictCategory, string> = {
  person: '사람', company: '회사', hospital: '병원', department: '부서', custom: '기타',
};

function renderDictTable(entries: UserDictEntry[]): void {
  const tbody = document.getElementById('dict-tbody')!;
  while (tbody.firstChild) tbody.removeChild(tbody.firstChild);

  if (entries.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
    td.className = 'empty';
    td.textContent = '등록된 항목 없음';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  for (const entry of entries) {
    const tr = document.createElement('tr');

    const tdCat = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = `badge ${CATEGORY_BADGE[entry.category]}`;
    badge.textContent = CATEGORY_LABEL[entry.category];
    tdCat.appendChild(badge);

    const tdPat = document.createElement('td');
    tdPat.textContent = entry.patterns.join(', ');

    const tdAlias = document.createElement('td');
    tdAlias.textContent = entry.alias;

    const tdDel = document.createElement('td');
    const delBtn = document.createElement('button');
    delBtn.className = 'del-btn';
    delBtn.textContent = '삭제';
    delBtn.addEventListener('click', async () => {
      await sendMessage({ type: 'DELETE_DICT_ENTRY', id: entry.id });
      await refreshDict();
    });
    tdDel.appendChild(delBtn);

    tr.appendChild(tdCat);
    tr.appendChild(tdPat);
    tr.appendChild(tdAlias);
    tr.appendChild(tdDel);
    tbody.appendChild(tr);
  }
}

async function refreshDict(): Promise<void> {
  const entries = await sendMessage<UserDictEntry[]>({ type: 'GET_DICT' });
  renderDictTable(entries as UserDictEntry[]);
}

function setupAddForm(): void {
  document.getElementById('opt-add-btn')!.addEventListener('click', async () => {
    const categoryEl = document.getElementById('opt-category') as HTMLSelectElement;
    const patternsEl = document.getElementById('opt-patterns') as HTMLInputElement;
    const aliasEl = document.getElementById('opt-alias') as HTMLInputElement;

    const patterns = patternsEl.value.split(',').map((s) => s.trim()).filter(Boolean);
    const alias = aliasEl.value.trim();
    if (patterns.length === 0 || !alias) {
      alert('패턴과 가명을 모두 입력하세요.');
      return;
    }

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

function renderSiteToggles(settings: AllSiteSettings): void {
  const container = document.getElementById('site-toggle-list')!;
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
    slider.className = 'slider';

    wrapper.appendChild(checkbox);
    wrapper.appendChild(slider);
    row.appendChild(label);
    row.appendChild(wrapper);
    container.appendChild(row);
  }
}

async function init(): Promise<void> {
  await refreshDict();
  setupAddForm();

  try {
    const settings = await sendMessage<AllSiteSettings>({ type: 'GET_SITE_SETTINGS' });
    renderSiteToggles(settings as AllSiteSettings);
  } catch {
    renderSiteToggles({});
  }
}

void init();
