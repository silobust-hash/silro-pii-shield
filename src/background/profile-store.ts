import type { ClientProfile, ConversationMappings } from '@/shared/types';

const STORAGE_KEY = 'pii_shield_profiles';

type ProfileRecord = Record<string, ClientProfile>;

async function readAll(): Promise<ProfileRecord> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return (result[STORAGE_KEY] ?? {}) as ProfileRecord;
}

async function writeAll(profiles: ProfileRecord): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: profiles });
}

export const profileStore = {
  async list(): Promise<ClientProfile[]> {
    const all = await readAll();
    return Object.values(all).sort((a, b) => b.updatedAt - a.updatedAt);
  },

  async get(id: string): Promise<ClientProfile | null> {
    const all = await readAll();
    return all[id] ?? null;
  },

  async save(profile: ClientProfile): Promise<void> {
    const all = await readAll();
    // Preserve caller-provided updatedAt; only auto-set if zero/falsy
    all[profile.id] = {
      ...profile,
      updatedAt: profile.updatedAt || Date.now(),
    };
    await writeAll(all);
  },

  async delete(id: string): Promise<void> {
    const all = await readAll();
    delete all[id];
    await writeAll(all);
  },

  /** 현재 대화 매핑을 신규 프로필로 저장 */
  async createFromConversation(
    name: string,
    mappings: ConversationMappings,
    notes = '',
  ): Promise<ClientProfile> {
    const now = Date.now();
    const profile: ClientProfile = {
      id: crypto.randomUUID(),
      name,
      mappings: { ...mappings, conversationId: crypto.randomUUID() },
      notes,
      createdAt: now,
      updatedAt: now,
    };
    await this.save(profile);
    return profile;
  },
};
