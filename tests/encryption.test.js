const { encrypt, decrypt, isEncrypted } = require('../src/utils/encryption');

// Set a test encryption key (32 bytes = 64 hex chars)
const TEST_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

beforeAll(() => {
  process.env.ENCRYPTION_KEY = TEST_KEY;
});

afterAll(() => {
  delete process.env.ENCRYPTION_KEY;
});

describe('Encryption Utility', () => {
  test('should encrypt and decrypt a string correctly', () => {
    const plaintext = 'my-secret-bot-token-abc123';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
    expect(encrypted).not.toBe(plaintext);
  });

  test('encrypted text should have correct format (iv:authTag:ciphertext)', () => {
    const encrypted = encrypt('test-value');
    const parts = encrypted.split(':');

    expect(parts).toHaveLength(3);
    // IV is 16 bytes = 32 hex chars
    expect(parts[0]).toMatch(/^[0-9a-f]{32}$/);
    // Auth tag is 16 bytes = 32 hex chars
    expect(parts[1]).toMatch(/^[0-9a-f]{32}$/);
    // Ciphertext should be hex
    expect(parts[2]).toMatch(/^[0-9a-f]+$/);
  });

  test('encrypting the same text twice should produce different ciphertexts', () => {
    const plaintext = 'same-text';
    const encrypted1 = encrypt(plaintext);
    const encrypted2 = encrypt(plaintext);

    expect(encrypted1).not.toBe(encrypted2);

    // Both should decrypt to the same value
    expect(decrypt(encrypted1)).toBe(plaintext);
    expect(decrypt(encrypted2)).toBe(plaintext);
  });

  test('isEncrypted should correctly identify encrypted strings', () => {
    const encrypted = encrypt('some-value');

    expect(isEncrypted(encrypted)).toBe(true);
    expect(isEncrypted('not-encrypted')).toBe(false);
    expect(isEncrypted('')).toBe(false);
    expect(isEncrypted(null)).toBe(false);
    expect(isEncrypted(undefined)).toBe(false);
    expect(isEncrypted('abc:def:ghi')).toBe(false);
  });

  test('should handle empty strings', () => {
    const encrypted = encrypt('');
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe('');
  });

  test('should handle special characters and unicode', () => {
    const specialChars = 'token!@#$%^&*()_+{}|:"<>?';
    const encrypted = encrypt(specialChars);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(specialChars);
  });

  test('decrypt should throw on tampered ciphertext', () => {
    const encrypted = encrypt('test');
    const parts = encrypted.split(':');
    // Tamper with the ciphertext
    parts[2] = 'ff' + parts[2].slice(2);
    const tampered = parts.join(':');

    expect(() => decrypt(tampered)).toThrow();
  });

  test('decrypt should throw on invalid format', () => {
    expect(() => decrypt('invalid')).toThrow('Invalid encrypted text format');
    expect(() => decrypt('a:b')).toThrow('Invalid encrypted text format');
  });
});
