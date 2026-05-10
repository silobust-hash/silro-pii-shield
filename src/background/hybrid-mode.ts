import type { HybridModeSetting } from '@/shared/types';

const STORAGE_KEY = 'pii_shield_hybrid_modes';

type ModeRecord = Record<string, 'round-trip' | 'hybrid'>;

async function readModes(): Promise<ModeRecord> {
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  return (result[STORAGE_KEY] ?? {}) as ModeRecord;
}

export const hybridModeStore = {
  async getMode(hostname: string): Promise<'round-trip' | 'hybrid'> {
    const modes = await readModes();
    return modes[hostname] ?? 'round-trip';
  },

  async setMode(setting: HybridModeSetting): Promise<void> {
    const modes = await readModes();
    modes[setting.hostname] = setting.mode;
    await chrome.storage.sync.set({ [STORAGE_KEY]: modes });
  },
};
