import type { UserDictEntry } from '@/shared/types';

const DICT_KEY = 'user_dict_v1';

export const dictStore = {
  async getAll(): Promise<UserDictEntry[]> {
    const result = await chrome.storage.local.get(DICT_KEY);
    return (result[DICT_KEY] as UserDictEntry[]) ?? [];
  },

  async upsert(entry: UserDictEntry): Promise<void> {
    const all = await this.getAll();
    const idx = all.findIndex((e) => e.id === entry.id);
    if (idx >= 0) {
      all[idx] = entry;
    } else {
      all.push(entry);
    }
    await chrome.storage.local.set({ [DICT_KEY]: all });
  },

  async delete(id: string): Promise<void> {
    const all = await this.getAll();
    const filtered = all.filter((e) => e.id !== id);
    await chrome.storage.local.set({ [DICT_KEY]: filtered });
  },

  async clear(): Promise<void> {
    await chrome.storage.local.remove(DICT_KEY);
  },
};
