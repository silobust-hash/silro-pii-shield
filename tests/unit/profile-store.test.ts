import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ClientProfile, ConversationMappings } from '@/shared/types';

// chrome.storage.local mock
const store: Record<string, unknown> = {};
vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: vi.fn(async (key: string) => ({ [key]: store[key] })),
      set: vi.fn(async (obj: Record<string, unknown>) => {
        Object.assign(store, obj);
      }),
    },
  },
});

const sampleMappings: ConversationMappings = {
  conversationId: 'conv-1',
  forward: { '홍길동': 'A씨' },
  reverse: { 'A씨': '홍길동' },
  counters: { korean_name: 1 },
  updatedAt: Date.now(),
};

describe('profileStore', () => {
  let profileStore: typeof import('@/background/profile-store').profileStore;

  beforeEach(async () => {
    Object.keys(store).forEach((k) => delete store[k]);
    vi.resetModules();
    ({ profileStore } = await import('@/background/profile-store'));
  });

  it('list() returns empty array initially', async () => {
    expect(await profileStore.list()).toEqual([]);
  });

  it('save() and get() round-trip', async () => {
    const now = Date.now();
    const p: ClientProfile = {
      id: 'test-id',
      name: '홍길동 부당해고 사건',
      mappings: sampleMappings,
      notes: '서울지방법원 2024가합1234',
      createdAt: now,
      updatedAt: now,
    };
    await profileStore.save(p);
    const retrieved = await profileStore.get('test-id');
    expect(retrieved?.name).toBe('홍길동 부당해고 사건');
  });

  it('delete() removes profile', async () => {
    const now = Date.now();
    await profileStore.save({
      id: 'del-id', name: '테스트', mappings: sampleMappings,
      notes: '', createdAt: now, updatedAt: now,
    });
    await profileStore.delete('del-id');
    expect(await profileStore.get('del-id')).toBeNull();
  });

  it('createFromConversation() creates profile with unique id', async () => {
    const p = await profileStore.createFromConversation(
      '김철수 산재 사건', sampleMappings, '산재번호 2024-12345',
    );
    expect(p.id).toBeDefined();
    expect(p.name).toBe('김철수 산재 사건');
    const list = await profileStore.list();
    expect(list).toHaveLength(1);
  });

  it('list() returns profiles sorted by updatedAt descending', async () => {
    const now = Date.now();
    for (let i = 0; i < 3; i++) {
      await profileStore.save({
        id: `id-${i}`, name: `사건 ${i}`, mappings: sampleMappings,
        notes: '', createdAt: now + i * 1000, updatedAt: now + i * 1000,
      });
    }
    const list = await profileStore.list();
    expect(list[0].id).toBe('id-2');
  });
});
