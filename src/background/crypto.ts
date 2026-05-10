// Crypto module: AES-GCM encryption + PBKDF2 key derivation
// All operations use the browser's native Web Crypto API.
// The master password NEVER leaves the browser.

export type EncryptedBlob = {
  ciphertext: string; // Base64
  iv: string;         // Base64, 12 bytes
  salt: string;       // Base64, 16 bytes
};

const PBKDF2_ITERATIONS = 310_000;
const PBKDF2_HASH = 'SHA-256';
const KEY_ALGO = 'AES-GCM';
const KEY_LENGTH = 256;

function toBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

export async function deriveKey(
  password: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const rawKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: PBKDF2_HASH },
    rawKey,
    { name: KEY_ALGO, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encrypt(
  key: CryptoKey,
  plaintext: string,
  salt: Uint8Array,
): Promise<EncryptedBlob> {
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuf = await crypto.subtle.encrypt(
    { name: KEY_ALGO, iv },
    key,
    enc.encode(plaintext),
  );
  return {
    ciphertext: toBase64(cipherBuf),
    iv: toBase64(iv),
    salt: toBase64(salt),
  };
}

export async function decrypt(
  key: CryptoKey,
  blob: EncryptedBlob,
): Promise<string> {
  const iv = fromBase64(blob.iv);
  const cipherBuf = fromBase64(blob.ciphertext).buffer;
  const plainBuf = await crypto.subtle.decrypt(
    { name: KEY_ALGO, iv },
    key,
    cipherBuf,
  );
  return new TextDecoder().decode(plainBuf);
}
