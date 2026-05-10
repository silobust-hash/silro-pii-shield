import type { ConversationMappings } from '@/shared/types';

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
