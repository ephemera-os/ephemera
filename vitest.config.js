import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'jsdom',
        include: ['tests/**/*.test.js'],
        exclude: ['node_modules', 'dist'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['js/core/*.js', 'js/system/*.js', 'js/apps/*.js'],
            exclude: ['js/main.js'],
            thresholds: {
                lines: { 'js/core/': 40, 'js/system/': 40, 'js/apps/': 20 },
                functions: { 'js/core/': 40, 'js/system/': 40, 'js/apps/': 20 },
                branches: { 'js/core/': 30, 'js/system/': 30, 'js/apps/': 15 },
                statements: { 'js/core/': 40, 'js/system/': 40, 'js/apps/': 20 }
            },
            perFile: true
        },
        setupFiles: ['./tests/setup.js'],
        testTimeout: 10000,
        hookTimeout: 10000
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, 'js'),
            '@core': resolve(__dirname, 'js/core'),
            '@system': resolve(__dirname, 'js/system')
        }
    }
});
