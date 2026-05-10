import type { ConversationMappings, AllSiteSettings, SiteKey, SiteSettings } from '@/shared/types';

const STORAGE_KEY_PREFIX = 'conv:';

export const storage = {
  async getConversation(conversationId: string): Promise<ConversationMappings | null> {
    const key = STORAGE_KEY_PREFIX + conversationId;
    const result = await chrome.storage.session.get(key);
    return (result[key] as ConversationMappings) ?? null;
  },
  async saveConversation(data: ConversationMappings): Promise<void> {
    const key = STORAGE_KEY_PREFIX + data.conversationId;
    await chrome.storage.session.set({ [key]: data });
  },
  async clearConversation(conversationId: string): Promise<void> {
    const key = STORAGE_KEY_PREFIX + conversationId;
    await chrome.storage.session.remove(key);
  },
};

const SITE_SETTINGS_KEY = 'site_settings_v1';

export const siteSettingsStore = {
  async getAll(): Promise<AllSiteSettings> {
    const result = await chrome.storage.sync.get(SITE_SETTINGS_KEY);
    return (result[SITE_SETTINGS_KEY] as AllSiteSettings) ?? {};
  },

  async set(siteKey: SiteKey, settings: SiteSettings): Promise<void> {
    const all = await this.getAll();
    all[siteKey] = settings;
    await chrome.storage.sync.set({ [SITE_SETTINGS_KEY]: all });
  },

  async isEnabled(siteKey: SiteKey): Promise<boolean> {
    const all = await this.getAll();
    // 기본값: 활성 (처음 설치 시 모든 사이트 활성)
    return all[siteKey]?.enabled ?? true;
  },
};
