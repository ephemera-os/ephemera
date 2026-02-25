import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const assetsDir = process.argv[2] && !process.argv[2].startsWith('-')
    ? process.argv[2]
    : 'dist/assets';
const strict = process.argv.includes('--strict');
const thresholdBytes = Number(process.env.BUNDLE_GZIP_LIMIT || 921600); // 900 KiB

function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    const units = ['KiB', 'MiB', 'GiB'];
    let value = bytes / 1024;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex++;
    }
    return `${value.toFixed(1)} ${units[unitIndex]}`;
}

if (!existsSync(assetsDir)) {
    console.error(`[bundle:size] Assets directory not found: ${assetsDir}`);
    process.exit(1);
}

const files = readdirSync(assetsDir)
    .filter((name) => name.endsWith('.js'))
    .sort((a, b) => a.localeCompare(b));

if (files.length === 0) {
    console.error(`[bundle:size] No JS files found in ${assetsDir}`);
    process.exit(1);
}

let totalRaw = 0;
let totalGzip = 0;

console.log('Bundle Size Report');
console.log('');
console.log('File'.padEnd(36), 'Raw'.padStart(12), 'Gzip'.padStart(12));
console.log('-'.repeat(62));

for (const file of files) {
    const fullPath = join(assetsDir, file);
    const rawBuffer = readFileSync(fullPath);
    const gzipBuffer = gzipSync(rawBuffer);
    const rawSize = rawBuffer.byteLength;
    const gzipSize = gzipBuffer.byteLength;
    totalRaw += rawSize;
    totalGzip += gzipSize;

    console.log(
        file.padEnd(36),
        formatBytes(rawSize).padStart(12),
        formatBytes(gzipSize).padStart(12)
    );
}

console.log('-'.repeat(62));
console.log('TOTAL'.padEnd(36), formatBytes(totalRaw).padStart(12), formatBytes(totalGzip).padStart(12));
console.log(`Target gzip threshold: ${formatBytes(thresholdBytes)}`);

if (totalGzip > thresholdBytes) {
    console.warn(`[bundle:size] Above threshold by ${formatBytes(totalGzip - thresholdBytes)}.`);
    if (strict) {
        process.exit(1);
    }
} else {
    console.log('[bundle:size] Within threshold.');
}
