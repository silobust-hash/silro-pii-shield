// Uses vitest with a minimal chrome.storage.local mock
import { describe, it, expect, beforeEach, vi } from 'vitest';

const store: Record<string, unknown> = {};
vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: async (keys: string | string[]) => {
        const ks = typeof keys === 'string' ? [keys] : keys;
        return Object.fromEntries(ks.map((k) => [k, store[k]]));
      },
      set: async (obj: Record<string, unknown>) => Object.assign(store, obj),
      remove: async (keys: string[]) => keys.forEach((k) => delete store[k]),
    },
  },
});

import {
  setupMasterPassword,
  unlockWithPassword,
  lockSession,
  secureSet,
  secureGet,
  isCryptoEnabled,
} from '../../src/background/encrypted-storage';

describe('encrypted-storage', () => {
  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
    lockSession();
  });

  it('plain mode: set/get without password', async () => {
    await secureSet('foo', { bar: 1 });
    const val = await secureGet<{ bar: number }>('foo');
    expect(val?.bar).toBe(1);
  });

  it('crypto mode: round-trips data', async () => {
    await setupMasterPassword('secure-pw!');
    expect(await isCryptoEnabled()).toBe(true);
    await secureSet('dict', [{ name: '홍길동' }]);
    lockSession();
    // After lock, stored value should be encrypted blob
    const raw = store['dict'] as Record<string, unknown>;
    expect(raw).toHaveProperty('ciphertext');
    // Unlock and read back
    await unlockWithPassword('secure-pw!');
    const val = await secureGet<Array<{ name: string }>>('dict');
    expect(val?.[0]?.name).toBe('홍길동');
  });

  it('returns null after lock in crypto mode', async () => {
    await setupMasterPassword('pw');
    await secureSet('secret', 'value');
    lockSession();
    const val = await secureGet('secret');
    expect(val).toBeNull();
  });
});
