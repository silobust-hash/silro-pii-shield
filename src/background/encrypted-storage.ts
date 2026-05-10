// Encrypted storage wrapper for chrome.storage.local
// Encryption is OPTIONAL. When disabled, behaves as a plain chrome.storage.local wrapper.
// The CryptoKey is held in memory only — never serialized or transmitted.

import { deriveKey, encrypt, decrypt, generateSalt, type EncryptedBlob } from './crypto';

const CRYPTO_FLAG = '__crypto_enabled';
const SALT_KEY = '__crypto_salt';

let sessionKey: CryptoKey | null = null;

export function isUnlocked(): boolean {
  return sessionKey !== null;
}

export async function isCryptoEnabled(): Promise<boolean> {
  const result = await chrome.storage.local.get(CRYPTO_FLAG);
  return result[CRYPTO_FLAG] === true;
}

export async function setupMasterPassword(password: string): Promise<void> {
  const salt = generateSalt();
  const key = await deriveKey(password, salt);
  // Store salt only (not password, not key)
  await chrome.storage.local.set({
    [CRYPTO_FLAG]: true,
    [SALT_KEY]: Array.from(salt),
  });
  sessionKey = key;
}

export async function unlockWithPassword(password: string): Promise<boolean> {
  try {
    const result = await chrome.storage.local.get(SALT_KEY);
    if (!result[SALT_KEY]) return false;
    const salt = new Uint8Array(result[SALT_KEY] as number[]);
    sessionKey = await deriveKey(password, salt);
    return true;
  } catch {
    return false;
  }
}

export function lockSession(): void {
  sessionKey = null;
}

export async function clearCrypto(): Promise<void> {
  sessionKey = null;
  await chrome.storage.local.remove([CRYPTO_FLAG, SALT_KEY]);
}

export async function secureSet(key: string, value: unknown): Promise<void> {
  const enabled = await isCryptoEnabled();
  if (!enabled || sessionKey === null) {
    await chrome.storage.local.set({ [key]: value });
    return;
  }
  const salt = new Uint8Array(
    (await chrome.storage.local.get(SALT_KEY))[SALT_KEY] as number[],
  );
  const blob = await encrypt(sessionKey, JSON.stringify(value), salt);
  await chrome.storage.local.set({ [key]: blob });
}

export async function secureGet<T>(key: string): Promise<T | null> {
  const result = await chrome.storage.local.get(key);
  const raw = result[key];
  if (raw === undefined) return null;

  const enabled = await isCryptoEnabled();
  // Encryption disabled: return raw value directly
  if (!enabled) return raw as T;
  // Encryption enabled but session locked: cannot decrypt
  if (sessionKey === null) return null;

  try {
    const decrypted = await decrypt(sessionKey, raw as EncryptedBlob);
    return JSON.parse(decrypted) as T;
  } catch {
    return null;
  }
}
