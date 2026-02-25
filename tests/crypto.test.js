import { describe, it, expect } from 'vitest';
import EphemeraCrypto from '../js/core/crypto.js';

describe('EphemeraCrypto', () => {
    describe('generateSalt', () => {
        it('should generate a 32-character hex string', () => {
            const salt = EphemeraCrypto.generateSalt();
            expect(salt).toHaveLength(32);
            expect(/^[0-9a-f]+$/.test(salt)).toBe(true);
        });

        it('should generate different salts each time', () => {
            const salt1 = EphemeraCrypto.generateSalt();
            const salt2 = EphemeraCrypto.generateSalt();
            expect(salt1).not.toBe(salt2);
        });
    });

    describe('generateToken', () => {
        it('should generate a 64-character hex string', () => {
            const token = EphemeraCrypto.generateToken();
            expect(token).toHaveLength(64);
            expect(/^[0-9a-f]+$/.test(token)).toBe(true);
        });

        it('should generate different tokens each time', () => {
            const token1 = EphemeraCrypto.generateToken();
            const token2 = EphemeraCrypto.generateToken();
            expect(token1).not.toBe(token2);
        });
    });

    describe('hash', () => {
        it('should return a 64-character SHA-256 hash', async () => {
            const hash = await EphemeraCrypto.hash('test');
            expect(hash).toHaveLength(64);
            expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
        });

        it('should produce consistent hashes for the same input', async () => {
            const hash1 = await EphemeraCrypto.hash('test');
            const hash2 = await EphemeraCrypto.hash('test');
            expect(hash1).toBe(hash2);
        });

        it('should handle empty string', async () => {
            const hash = await EphemeraCrypto.hash('');
            expect(hash).toHaveLength(64);
        });
    });

    describe('isEncrypted', () => {
        it('should return true for encrypted values', () => {
            expect(EphemeraCrypto.isEncrypted('enc:somedata')).toBe(true);
            expect(EphemeraCrypto.isEncrypted('enc:')).toBe(true);
        });

        it('should return false for non-encrypted values', () => {
            expect(EphemeraCrypto.isEncrypted('plain text')).toBe(false);
            expect(EphemeraCrypto.isEncrypted('')).toBe(false);
            expect(EphemeraCrypto.isEncrypted(null)).toBe(false);
            expect(EphemeraCrypto.isEncrypted(undefined)).toBe(false);
            expect(EphemeraCrypto.isEncrypted(123)).toBe(false);
        });
    });

    describe('constantTimeEquals', () => {
        it('should return true for equal strings', async () => {
            const result = await EphemeraCrypto.constantTimeEquals('test', 'test');
            expect(result).toBe(true);
        });

        it('should return false for different strings', async () => {
            const result = await EphemeraCrypto.constantTimeEquals('test1', 'test2');
            expect(result).toBe(false);
        });

        it('should return false for different lengths', async () => {
            const result = await EphemeraCrypto.constantTimeEquals('test', 'testing');
            expect(result).toBe(false);
        });

        it('should return false for non-string inputs', async () => {
            expect(await EphemeraCrypto.constantTimeEquals(null, 'test')).toBe(false);
            expect(await EphemeraCrypto.constantTimeEquals('test', null)).toBe(false);
            expect(await EphemeraCrypto.constantTimeEquals(123, 123)).toBe(false);
        });
    });

    describe('hashPassword', () => {
        it('should hash a password and return hash object with correct structure', async () => {
            const result = await EphemeraCrypto.hashPassword('testpassword123');
            expect(result).toHaveProperty('hash');
            expect(result).toHaveProperty('salt');
            expect(result.salt).toHaveLength(32);
            expect(result).toHaveProperty('algorithm', 'pbkdf2-sha256');
            expect(result).toHaveProperty('iterations', 600000);
            expect(result).toHaveProperty('createdAt');
        });

        it('should return hash as 64-character hex string', async () => {
            const result = await EphemeraCrypto.hashPassword('testpassword123');
            expect(result.hash).toHaveLength(64);
            expect(/^[0-9a-f]+$/.test(result.hash)).toBe(true);
        });
    });

    describe('verifyPassword', () => {
        it('should return false for invalid stored hash', async () => {
            expect(await EphemeraCrypto.verifyPassword('test', null)).toBe(false);
            expect(await EphemeraCrypto.verifyPassword('test', {})).toBe(false);
            expect(await EphemeraCrypto.verifyPassword('test', { hash: 'abc' })).toBe(false);
        });
    });

    describe('encrypt', () => {
        it('should return null for null/undefined input', async () => {
            const salt = EphemeraCrypto.generateSalt();
            const key = await EphemeraCrypto.deriveKey('password', salt);
            
            expect(await EphemeraCrypto.encrypt(null, key)).toBeNull();
            expect(await EphemeraCrypto.encrypt(undefined, key)).toBeNull();
        });
    });

    describe('decrypt', () => {
        it('should return original value for non-encrypted input on decrypt', async () => {
            const salt = EphemeraCrypto.generateSalt();
            const key = await EphemeraCrypto.deriveKey('password', salt);
            
            expect(await EphemeraCrypto.decrypt('plain text', key)).toBe('plain text');
            expect(await EphemeraCrypto.decrypt(null, key)).toBeNull();
        });
    });

    describe('generateVerificationHash', () => {
        it('should generate a 32-character hex string', () => {
            const hash = EphemeraCrypto.generateVerificationHash();
            expect(hash).toHaveLength(32);
            expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
        });

        it('should generate different hashes each time', () => {
            const hash1 = EphemeraCrypto.generateVerificationHash();
            const hash2 = EphemeraCrypto.generateVerificationHash();
            expect(hash1).not.toBe(hash2);
        });
    });
});
