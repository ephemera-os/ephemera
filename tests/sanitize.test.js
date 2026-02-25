import { describe, it, expect, vi } from 'vitest';
import EphemeraSanitize from '../js/core/sanitize.js';

describe('EphemeraSanitize', () => {
    describe('escapeHtml', () => {
        it('should escape HTML special characters', () => {
            expect(EphemeraSanitize.escapeHtml('<script>alert("xss")</script>'))
                .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
        });

        it('should escape ampersands', () => {
            expect(EphemeraSanitize.escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
        });

        it('should escape single quotes', () => {
            expect(EphemeraSanitize.escapeHtml("it's")).toBe('it&#039;s');
        });

        it('should escape double quotes', () => {
            expect(EphemeraSanitize.escapeHtml('say "hello"')).toBe('say &quot;hello&quot;');
        });

        it('should handle empty string', () => {
            expect(EphemeraSanitize.escapeHtml('')).toBe('');
        });

        it('should convert non-strings to strings', () => {
            expect(EphemeraSanitize.escapeHtml(123)).toBe('123');
            expect(EphemeraSanitize.escapeHtml(null)).toBe('null');
            expect(EphemeraSanitize.escapeHtml(undefined)).toBe('undefined');
        });

        it('should not modify safe strings', () => {
            expect(EphemeraSanitize.escapeHtml('Hello World')).toBe('Hello World');
            expect(EphemeraSanitize.escapeHtml('test@example.com')).toBe('test@example.com');
        });

        it('should escape multiple occurrences', () => {
            expect(EphemeraSanitize.escapeHtml('<<>>')).toBe('&lt;&lt;&gt;&gt;');
            expect(EphemeraSanitize.escapeHtml('a & b & c')).toBe('a &amp; b &amp; c');
        });
    });

    describe('escapeAttr', () => {
        it('should escape attribute-breaking characters', () => {
            expect(EphemeraSanitize.escapeAttr('test"onclick="alert(1)'))
                .toBe('test&quot;onclick=&quot;alert(1)');
        });

        it('should escape single quotes', () => {
            expect(EphemeraSanitize.escapeAttr("test'onclick='alert(1)"))
                .toBe('test&#039;onclick=&#039;alert(1)');
        });

        it('should escape angle brackets', () => {
            expect(EphemeraSanitize.escapeAttr('test<script>')).toBe('test&lt;script&gt;');
        });

        it('should handle empty string', () => {
            expect(EphemeraSanitize.escapeAttr('')).toBe('');
        });

        it('should convert non-strings to strings', () => {
            expect(EphemeraSanitize.escapeAttr(123)).toBe('123');
        });
    });

    describe('sanitizeUrl', () => {
        it('should block javascript: URLs', () => {
            expect(EphemeraSanitize.sanitizeUrl('javascript:alert(1)')).toBe('');
            expect(EphemeraSanitize.sanitizeUrl('JAVASCRIPT:alert(1)')).toBe('');
            expect(EphemeraSanitize.sanitizeUrl('  javascript:alert(1)  ')).toBe('');
        });

        it('should block data: URLs', () => {
            expect(EphemeraSanitize.sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('');
            expect(EphemeraSanitize.sanitizeUrl('DATA:text/html,test')).toBe('');
        });

        it('should block vbscript: URLs', () => {
            expect(EphemeraSanitize.sanitizeUrl('vbscript:msgbox(1)')).toBe('');
            expect(EphemeraSanitize.sanitizeUrl('VBSCRIPT:msgbox(1)')).toBe('');
        });

        it('should allow safe URLs', () => {
            expect(EphemeraSanitize.sanitizeUrl('https://example.com')).toBe('https://example.com');
            expect(EphemeraSanitize.sanitizeUrl('http://localhost:3000')).toBe('http://localhost:3000');
            expect(EphemeraSanitize.sanitizeUrl('/relative/path')).toBe('/relative/path');
        });

        it('should handle non-string input', () => {
            expect(EphemeraSanitize.sanitizeUrl(null)).toBe('');
            expect(EphemeraSanitize.sanitizeUrl(undefined)).toBe('');
            expect(EphemeraSanitize.sanitizeUrl(123)).toBe('');
        });

        it('should handle empty string', () => {
            expect(EphemeraSanitize.sanitizeUrl('')).toBe('');
        });

        it('should preserve whitespace in safe URLs', () => {
            expect(EphemeraSanitize.sanitizeUrl('  https://example.com  '))
                .toBe('  https://example.com  ');
        });
    });

    describe('debounce', () => {
        it('should delay function execution', async () => {
            vi.useFakeTimers();
            const fn = vi.fn();
            const debounced = EphemeraSanitize.debounce(fn, 100);

            debounced();
            expect(fn).not.toHaveBeenCalled();

            vi.advanceTimersByTime(100);
            expect(fn).toHaveBeenCalledTimes(1);

            vi.useRealTimers();
        });

        it('should only execute once for multiple calls', async () => {
            vi.useFakeTimers();
            const fn = vi.fn();
            const debounced = EphemeraSanitize.debounce(fn, 100);

            debounced();
            debounced();
            debounced();

            vi.advanceTimersByTime(100);
            expect(fn).toHaveBeenCalledTimes(1);

            vi.useRealTimers();
        });

        it('should pass arguments correctly', async () => {
            vi.useFakeTimers();
            const fn = vi.fn();
            const debounced = EphemeraSanitize.debounce(fn, 100);

            debounced('arg1', 'arg2');
            vi.advanceTimersByTime(100);

            expect(fn).toHaveBeenCalledWith('arg1', 'arg2');

            vi.useRealTimers();
        });

        it('should reset timer on subsequent calls', async () => {
            vi.useFakeTimers();
            const fn = vi.fn();
            const debounced = EphemeraSanitize.debounce(fn, 100);

            debounced();
            vi.advanceTimersByTime(50);
            debounced();
            vi.advanceTimersByTime(50);
            expect(fn).not.toHaveBeenCalled();

            vi.advanceTimersByTime(50);
            expect(fn).toHaveBeenCalledTimes(1);

            vi.useRealTimers();
        });
    });

    describe('throttle', () => {
        it('should execute immediately on first call', () => {
            vi.useFakeTimers();
            const fn = vi.fn();
            const throttled = EphemeraSanitize.throttle(fn, 100);

            throttled();
            expect(fn).toHaveBeenCalledTimes(1);

            vi.useRealTimers();
        });

        it('should not execute again within throttle period', () => {
            vi.useFakeTimers();
            const fn = vi.fn();
            const throttled = EphemeraSanitize.throttle(fn, 100);

            throttled();
            throttled();
            throttled();

            expect(fn).toHaveBeenCalledTimes(1);

            vi.useRealTimers();
        });

        it('should execute again after throttle period', () => {
            vi.useFakeTimers();
            const fn = vi.fn();
            const throttled = EphemeraSanitize.throttle(fn, 100);

            throttled();
            expect(fn).toHaveBeenCalledTimes(1);

            vi.advanceTimersByTime(100);

            throttled();
            expect(fn).toHaveBeenCalledTimes(2);

            vi.useRealTimers();
        });

        it('should pass arguments correctly', () => {
            vi.useFakeTimers();
            const fn = vi.fn();
            const throttled = EphemeraSanitize.throttle(fn, 100);

            throttled('arg1', 'arg2');
            expect(fn).toHaveBeenCalledWith('arg1', 'arg2');

            vi.useRealTimers();
        });

        it('should drop calls within throttle period', () => {
            vi.useFakeTimers();
            const fn = vi.fn();
            const throttled = EphemeraSanitize.throttle(fn, 100);

            throttled('first');
            vi.advanceTimersByTime(50);
            throttled('second');
            throttled('third');

            expect(fn).toHaveBeenCalledTimes(1);
            expect(fn).toHaveBeenCalledWith('first');

            vi.useRealTimers();
        });
    });
});
