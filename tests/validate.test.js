import { describe, it, expect, beforeEach } from 'vitest';
import EphemeraValidate from '../js/core/validate.js';

describe('EphemeraValidate', () => {
    describe('isValidFilename', () => {
        it('should accept valid filenames', () => {
            expect(EphemeraValidate.isValidFilename('test.txt').valid).toBe(true);
            expect(EphemeraValidate.isValidFilename('my-file.js').valid).toBe(true);
            expect(EphemeraValidate.isValidFilename('document.pdf').valid).toBe(true);
            expect(EphemeraValidate.isValidFilename('image 2.png').valid).toBe(true);
            expect(EphemeraValidate.isValidFilename('.gitignore').valid).toBe(true);
            expect(EphemeraValidate.isValidFilename('file.tar.gz').valid).toBe(true);
        });

        it('should reject empty or null filenames', () => {
            expect(EphemeraValidate.isValidFilename('').valid).toBe(false);
            expect(EphemeraValidate.isValidFilename(null).valid).toBe(false);
            expect(EphemeraValidate.isValidFilename(undefined).valid).toBe(false);
        });

        it('should reject filenames with forbidden characters', () => {
            expect(EphemeraValidate.isValidFilename('test<file>.txt').valid).toBe(false);
            expect(EphemeraValidate.isValidFilename('test|file.txt').valid).toBe(false);
            expect(EphemeraValidate.isValidFilename('test?file.txt').valid).toBe(false);
            expect(EphemeraValidate.isValidFilename('test*file.txt').valid).toBe(false);
            expect(EphemeraValidate.isValidFilename('test"file.txt').valid).toBe(false);
            expect(EphemeraValidate.isValidFilename('test:file.txt').valid).toBe(false);
        });

        it('should reject . and .. as filenames', () => {
            expect(EphemeraValidate.isValidFilename('.').valid).toBe(false);
            expect(EphemeraValidate.isValidFilename('..').valid).toBe(false);
        });

        it('should reject overly long filenames', () => {
            const longName = 'a'.repeat(300);
            expect(EphemeraValidate.isValidFilename(longName).valid).toBe(false);
        });

        it('should reject Windows reserved filenames', () => {
            expect(EphemeraValidate.isValidFilename('CON').valid).toBe(false);
            expect(EphemeraValidate.isValidFilename('PRN').valid).toBe(false);
            expect(EphemeraValidate.isValidFilename('AUX').valid).toBe(false);
            expect(EphemeraValidate.isValidFilename('NUL').valid).toBe(false);
            expect(EphemeraValidate.isValidFilename('COM1').valid).toBe(false);
            expect(EphemeraValidate.isValidFilename('LPT1').valid).toBe(false);
            expect(EphemeraValidate.isValidFilename('CON.txt').valid).toBe(false);
        });

        it('should reject filenames starting/ending with space or ending with period', () => {
            expect(EphemeraValidate.isValidFilename(' test.txt').valid).toBe(false);
            expect(EphemeraValidate.isValidFilename('test.txt ').valid).toBe(false);
            expect(EphemeraValidate.isValidFilename('test.').valid).toBe(false);
        });
    });

    describe('isValidPath', () => {
        it('should accept valid paths', () => {
            expect(EphemeraValidate.isValidPath('/home/user').valid).toBe(true);
            expect(EphemeraValidate.isValidPath('/home/user/documents').valid).toBe(true);
            expect(EphemeraValidate.isValidPath('/').valid).toBe(true);
            expect(EphemeraValidate.isValidPath('/home/user/file.txt').valid).toBe(true);
        });

        it('should reject paths not starting with /', () => {
            expect(EphemeraValidate.isValidPath('home/user').valid).toBe(false);
            expect(EphemeraValidate.isValidPath('./test').valid).toBe(false);
            expect(EphemeraValidate.isValidPath('relative/path').valid).toBe(false);
        });

        it('should reject paths with .. (path traversal)', () => {
            expect(EphemeraValidate.isValidPath('/home/../etc').valid).toBe(false);
            expect(EphemeraValidate.isValidPath('/home/user/../../..').valid).toBe(false);
            expect(EphemeraValidate.isValidPath('/../etc').valid).toBe(false);
        });

        it('should reject empty paths', () => {
            expect(EphemeraValidate.isValidPath('').valid).toBe(false);
            expect(EphemeraValidate.isValidPath(null).valid).toBe(false);
            expect(EphemeraValidate.isValidPath(undefined).valid).toBe(false);
        });

        it('should reject paths with double slashes', () => {
            expect(EphemeraValidate.isValidPath('//home/user').valid).toBe(false);
            expect(EphemeraValidate.isValidPath('/home//user').valid).toBe(false);
        });

        it('should reject overly long paths', () => {
            const longPath = '/' + 'a'.repeat(5000);
            expect(EphemeraValidate.isValidPath(longPath).valid).toBe(false);
        });
    });

    describe('sanitizePath', () => {
        it('should remove path traversal sequences', () => {
            expect(EphemeraValidate.sanitizePath('/home/../test')).toBe('/home/test');
            expect(EphemeraValidate.sanitizePath('/path/../../../etc')).toBe('/path/etc');
        });

        it('should normalize multiple slashes', () => {
            expect(EphemeraValidate.sanitizePath('//home///user')).toBe('/home/user');
        });

        it('should return / for empty or null paths', () => {
            expect(EphemeraValidate.sanitizePath('')).toBe('/');
            expect(EphemeraValidate.sanitizePath(null)).toBe('/');
        });

        it('should ensure path starts with /', () => {
            expect(EphemeraValidate.sanitizePath('home/user')).toBe('/home/user');
        });

        it('should remove null bytes', () => {
            expect(EphemeraValidate.sanitizePath('/home\0/user')).toBe('/home/user');
        });
    });

    describe('isValidFileContent', () => {
        it('should accept valid content', () => {
            const result = EphemeraValidate.isValidFileContent('Hello, World!', 'text/plain');
            expect(result.valid).toBe(true);
            expect(result.size).toBeGreaterThan(0);
        });

        it('should reject null or undefined content', () => {
            expect(EphemeraValidate.isValidFileContent(null, 'text/plain').valid).toBe(false);
            expect(EphemeraValidate.isValidFileContent(undefined, 'text/plain').valid).toBe(false);
        });
    });

    describe('isValidPassword', () => {
        it('should accept strong passwords', () => {
            const result = EphemeraValidate.isValidPassword('Str0ngP@ssword!');
            expect(result.valid).toBe(true);
            expect(result.strength).toBeGreaterThanOrEqual(4);
        });

        it('should reject passwords shorter than 12 characters', () => {
            const result = EphemeraValidate.isValidPassword('Short1!');
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Password must be at least 12 characters');
        });

        it('should reject overly long passwords', () => {
            const result = EphemeraValidate.isValidPassword('a'.repeat(300));
            expect(result.valid).toBe(false);
        });

        it('should reject empty passwords', () => {
            const result = EphemeraValidate.isValidPassword('');
            expect(result.valid).toBe(false);
        });

        it('should calculate strength correctly', () => {
            const weak = EphemeraValidate.isValidPassword('aaaaaaaaaaaa');
            expect(weak.strength).toBeLessThan(3);

            const medium = EphemeraValidate.isValidPassword('Password1234');
            expect(medium.strength).toBeGreaterThan(weak.strength);

            const strong = EphemeraValidate.isValidPassword('Str0ngP@ssword!');
            expect(strong.strength).toBeGreaterThan(medium.strength);
        });

        it('should penalize common passwords', () => {
            const result = EphemeraValidate.isValidPassword('password123456');
            expect(result.strength).toBeLessThan(3);
        });
    });

    describe('isValidEmail', () => {
        it('should accept valid emails', () => {
            expect(EphemeraValidate.isValidEmail('test@example.com').valid).toBe(true);
            expect(EphemeraValidate.isValidEmail('user.name@domain.co.uk').valid).toBe(true);
            expect(EphemeraValidate.isValidEmail('user+tag@example.org').valid).toBe(true);
        });

        it('should reject invalid emails', () => {
            expect(EphemeraValidate.isValidEmail('notanemail').valid).toBe(false);
            expect(EphemeraValidate.isValidEmail('missing@domain').valid).toBe(false);
            expect(EphemeraValidate.isValidEmail('@nodomain.com').valid).toBe(false);
            expect(EphemeraValidate.isValidEmail('spaces in@email.com').valid).toBe(false);
        });

        it('should reject empty emails', () => {
            expect(EphemeraValidate.isValidEmail('').valid).toBe(false);
            expect(EphemeraValidate.isValidEmail(null).valid).toBe(false);
        });

        it('should reject overly long emails', () => {
            const longEmail = 'a'.repeat(250) + '@example.com';
            expect(EphemeraValidate.isValidEmail(longEmail).valid).toBe(false);
        });
    });

    describe('isValidUrl', () => {
        it('should reject javascript: URLs', () => {
            const result = EphemeraValidate.isValidUrl('javascript:alert(1)');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('JavaScript');
        });

        it('should reject data: URLs', () => {
            const result = EphemeraValidate.isValidUrl('data:text/html,<script>alert(1)</script>');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Data');
        });

        it('should reject vbscript: URLs', () => {
            const result = EphemeraValidate.isValidUrl('vbscript:alert(1)');
            expect(result.valid).toBe(false);
        });

        it('should reject empty URLs', () => {
            expect(EphemeraValidate.isValidUrl('').valid).toBe(false);
            expect(EphemeraValidate.isValidUrl(null).valid).toBe(false);
        });

        it('should reject private IP addresses by default', () => {
            expect(EphemeraValidate.isValidUrl('http://127.0.0.1').valid).toBe(false);
            expect(EphemeraValidate.isValidUrl('http://10.0.0.1').valid).toBe(false);
            expect(EphemeraValidate.isValidUrl('http://192.168.1.1').valid).toBe(false);
            expect(EphemeraValidate.isValidUrl('http://localhost').valid).toBe(false);
        });

        it('should allow private IPs when allowPrivate is true', () => {
            expect(EphemeraValidate.isValidUrl('http://localhost', { allowPrivate: true }).valid).toBe(true);
            expect(EphemeraValidate.isValidUrl('http://127.0.0.1', { allowPrivate: true }).valid).toBe(true);
        });

        it('should allow data URLs when allowData is true', () => {
            expect(EphemeraValidate.isValidUrl('data:text/plain,hello', { allowData: true }).valid).toBe(true);
        });
    });

    describe('isValidApiKey', () => {
        it('should accept valid API keys', () => {
            expect(EphemeraValidate.isValidApiKey('sk-1234567890abcdef').valid).toBe(true);
            expect(EphemeraValidate.isValidApiKey('abc123XYZ_').valid).toBe(true);
        });

        it('should reject empty or null keys', () => {
            expect(EphemeraValidate.isValidApiKey('').valid).toBe(false);
            expect(EphemeraValidate.isValidApiKey(null).valid).toBe(false);
        });

        it('should reject too short keys', () => {
            expect(EphemeraValidate.isValidApiKey('abc').valid).toBe(false);
        });

        it('should reject keys with invalid characters', () => {
            expect(EphemeraValidate.isValidApiKey('key with spaces').valid).toBe(false);
            expect(EphemeraValidate.isValidApiKey('key!@#$%').valid).toBe(false);
        });
    });

    describe('isValidAppManifest', () => {
        it('should accept valid manifests', () => {
            const manifest = {
                id: 'com.example.myapp',
                name: 'My App',
                version: '1.0.0'
            };
            expect(EphemeraValidate.isValidAppManifest(manifest).valid).toBe(true);
        });

        it('should reject manifests without id', () => {
            expect(EphemeraValidate.isValidAppManifest({ name: 'Test' }).valid).toBe(false);
        });

        it('should reject manifests without name', () => {
            expect(EphemeraValidate.isValidAppManifest({ id: 'test' }).valid).toBe(false);
        });

        it('should reject manifests with invalid id format', () => {
            expect(EphemeraValidate.isValidAppManifest({ id: 'invalid id!', name: 'Test' }).valid).toBe(false);
        });

        it('should reject manifests with invalid version format', () => {
            expect(EphemeraValidate.isValidAppManifest({ id: 'test', name: 'Test', version: '1' }).valid).toBe(false);
        });

        it('should reject manifests with out-of-bounds window dimensions', () => {
            const manifest = {
                id: 'test',
                name: 'Test',
                window: { width: 50, height: 50 }
            };
            expect(EphemeraValidate.isValidAppManifest(manifest).valid).toBe(false);
        });

        it('should accept extension types and namespaced permissions', () => {
            const manifest = {
                id: 'com.example.systemext',
                name: 'System Extension',
                type: 'system',
                permissions: ['filesystem:read', 'clipboard', 'ai', 'shortcuts']
            };
            expect(EphemeraValidate.isValidAppManifest(manifest).valid).toBe(true);
        });

        it('should reject unknown extension type', () => {
            const manifest = {
                id: 'com.example.unknown',
                name: 'Unknown',
                type: 'gadget'
            };
            expect(EphemeraValidate.isValidAppManifest(manifest).valid).toBe(false);
        });

        it('should accept widget extension type', () => {
            const manifest = {
                id: 'com.example.widget',
                name: 'Widget Extension',
                type: 'widget'
            };
            expect(EphemeraValidate.isValidAppManifest(manifest).valid).toBe(true);
        });

        it('should reject invalid extension permission', () => {
            const manifest = {
                id: 'com.example.badperm',
                name: 'Bad Permission',
                permissions: ['filesystem:destroy']
            };
            expect(EphemeraValidate.isValidAppManifest(manifest).valid).toBe(false);
        });
    });

    describe('isValidAppCode', () => {
        it('should accept valid code', () => {
            expect(EphemeraValidate.isValidAppCode('console.log("hello")').valid).toBe(true);
        });

        it('should reject empty code', () => {
            expect(EphemeraValidate.isValidAppCode('').valid).toBe(false);
            expect(EphemeraValidate.isValidAppCode(null).valid).toBe(false);
        });

        it('should reject code with eval', () => {
            expect(EphemeraValidate.isValidAppCode('eval("code")').valid).toBe(false);
        });

        it('should reject code with Function constructor', () => {
            expect(EphemeraValidate.isValidAppCode('new Function("return 1")').valid).toBe(false);
        });

        it('should reject code with document.write', () => {
            expect(EphemeraValidate.isValidAppCode('document.write("test")').valid).toBe(false);
        });

        it('should reject code with javascript: URLs', () => {
            expect(EphemeraValidate.isValidAppCode('location.href = "javascript:alert(1)"').valid).toBe(false);
        });
    });

    describe('sanitizeHtml', () => {
        it('should escape HTML special characters', () => {
            expect(EphemeraValidate.sanitizeHtml('<script>')).toBe('&lt;script&gt;');
            expect(EphemeraValidate.sanitizeHtml('test "quote"')).toBe('test &quot;quote&quot;');
            expect(EphemeraValidate.sanitizeHtml("test 'quote'")).toBe('test &#x27;quote&#x27;');
        });

        it('should handle empty input', () => {
            expect(EphemeraValidate.sanitizeHtml('')).toBe('');
            expect(EphemeraValidate.sanitizeHtml(null)).toBe('');
        });

        it('should not modify safe text', () => {
            expect(EphemeraValidate.sanitizeHtml('Hello World')).toBe('Hello World');
            expect(EphemeraValidate.sanitizeHtml('Test 123')).toBe('Test 123');
        });

        it('should escape forward slashes', () => {
            expect(EphemeraValidate.sanitizeHtml('path/to/file')).toBe('path&#x2F;to&#x2F;file');
        });

        it('should escape backticks', () => {
            expect(EphemeraValidate.sanitizeHtml('`code`')).toBe('&#96;code&#96;');
        });
    });

    describe('sanitizeForLog', () => {
        it('should truncate long strings', () => {
            const longString = 'a'.repeat(1000);
            expect(EphemeraValidate.sanitizeForLog(longString).length).toBe(500);
        });

        it('should escape newlines and tabs', () => {
            expect(EphemeraValidate.sanitizeForLog('line1\nline2')).toBe('line1\\nline2');
            expect(EphemeraValidate.sanitizeForLog('col1\tcol2')).toBe('col1\\tcol2');
        });

        it('should handle objects', () => {
            const result = EphemeraValidate.sanitizeForLog({ key: 'value' });
            expect(result).toContain('key');
            expect(result).toContain('value');
        });

        it('should handle circular objects gracefully', () => {
            const obj = { a: 1 };
            obj.self = obj;
            const result = EphemeraValidate.sanitizeForLog(obj);
            expect(typeof result).toBe('string');
        });
    });

    describe('validateSettingsValue', () => {
        it('should validate theme values', () => {
            expect(EphemeraValidate.validateSettingsValue('theme', 'dark').valid).toBe(true);
            expect(EphemeraValidate.validateSettingsValue('theme', 'light').valid).toBe(true);
            expect(EphemeraValidate.validateSettingsValue('theme', 'invalid').valid).toBe(false);
        });

        it('should validate accent color', () => {
            expect(EphemeraValidate.validateSettingsValue('accentColor', '#00d4aa').valid).toBe(true);
            expect(EphemeraValidate.validateSettingsValue('accentColor', 'invalid').valid).toBe(false);
        });

        it('should validate boolean settings', () => {
            expect(EphemeraValidate.validateSettingsValue('notifications', true).valid).toBe(true);
            expect(EphemeraValidate.validateSettingsValue('notifications', 'yes').valid).toBe(false);
        });

        it('should validate AI settings', () => {
            expect(EphemeraValidate.validateSettingsValue('aiMaxTokens', 1000).valid).toBe(true);
            expect(EphemeraValidate.validateSettingsValue('aiMaxTokens', 50).valid).toBe(false);
            expect(EphemeraValidate.validateSettingsValue('aiTemperature', 0.7).valid).toBe(true);
            expect(EphemeraValidate.validateSettingsValue('aiTemperature', 3).valid).toBe(false);
        });

        it('should validate terminal backend settings', () => {
            expect(EphemeraValidate.validateSettingsValue('terminalBackendEnabled', true).valid).toBe(true);
            expect(EphemeraValidate.validateSettingsValue('terminalBackendEnabled', 'yes').valid).toBe(false);

            expect(EphemeraValidate.validateSettingsValue('terminalBackendUrl', '').valid).toBe(true);
            expect(EphemeraValidate.validateSettingsValue('terminalBackendUrl', 'ws://localhost:8787/terminal').valid).toBe(true);
            expect(EphemeraValidate.validateSettingsValue('terminalBackendUrl', 'wss://terminal.example.com/ws').valid).toBe(true);
            expect(EphemeraValidate.validateSettingsValue('terminalBackendUrl', 'https://example.com').valid).toBe(false);
        });

        it('should return warning for unknown settings', () => {
            const result = EphemeraValidate.validateSettingsValue('unknownKey', 'value');
            expect(result.valid).toBe(true);
            expect(result.warning).toBeDefined();
        });
    });
});
