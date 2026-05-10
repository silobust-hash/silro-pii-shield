import { describe, it, expect } from 'vitest';
import { generateSalt, deriveKey, encrypt, decrypt } from '../../src/background/crypto';

describe('crypto module', () => {
  it('generates 16-byte salt', () => {
    const salt = generateSalt();
    expect(salt.byteLength).toBe(16);
  });

  it('round-trips plaintext', async () => {
    const password = 'test-password-123!';
    const salt = generateSalt();
    const key = await deriveKey(password, salt);
    const blob = await encrypt(key, '홍길동 900101-1234567', salt);
    const result = await decrypt(key, blob);
    expect(result).toBe('홍길동 900101-1234567');
  });

  it('fails to decrypt with wrong password', async () => {
    const salt = generateSalt();
    const key1 = await deriveKey('correct', salt);
    const key2 = await deriveKey('wrong', salt);
    const blob = await encrypt(key1, 'secret', salt);
    await expect(decrypt(key2, blob)).rejects.toThrow();
  });

  it('produces different ciphertext each call (random IV)', async () => {
    const salt = generateSalt();
    const key = await deriveKey('pw', salt);
    const b1 = await encrypt(key, 'same', salt);
    const b2 = await encrypt(key, 'same', salt);
    expect(b1.ciphertext).not.toBe(b2.ciphertext);
    expect(b1.iv).not.toBe(b2.iv);
  });
});
