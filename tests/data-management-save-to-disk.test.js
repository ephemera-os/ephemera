import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import EphemeraDataManagement from '../js/system/data-management.js';

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const SAMPLE_PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2X4mQAAAAASUVORK5CYII=';

describe('EphemeraDataManagement save-to-disk binary handling', () => {
    let originalFS;
    let originalShowSaveFilePicker;
    let originalShowOpenFilePicker;
    let originalCreateObjectURL;
    let originalRevokeObjectURL;
    let anchorClickSpy;

    beforeEach(() => {
        originalFS = window.EphemeraFS;
        originalShowSaveFilePicker = window.showSaveFilePicker;
        originalShowOpenFilePicker = window.showOpenFilePicker;
        originalCreateObjectURL = URL.createObjectURL;
        originalRevokeObjectURL = URL.revokeObjectURL;

        window.EphemeraFS = {
            readFile: vi.fn(async () => SAMPLE_PNG_DATA_URL),
            stat: vi.fn(async () => ({ type: 'file', mimeType: 'image/png' })),
            getMimeType: vi.fn(() => 'image/png')
        };

        URL.createObjectURL = vi.fn(() => 'blob:test-image');
        URL.revokeObjectURL = vi.fn();
        anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        window.EphemeraNotifications.success.mockReset();
    });

    afterEach(() => {
        anchorClickSpy?.mockRestore();
        window.EphemeraFS = originalFS;
        window.showSaveFilePicker = originalShowSaveFilePicker;
        window.showOpenFilePicker = originalShowOpenFilePicker;
        URL.createObjectURL = originalCreateObjectURL;
        URL.revokeObjectURL = originalRevokeObjectURL;
    });

    it('decodes data URL images to raw bytes when saving via File System Access API', async () => {
        const write = vi.fn(async () => {});
        const close = vi.fn(async () => {});
        window.showSaveFilePicker = vi.fn(async () => ({
            createWritable: vi.fn(async () => ({ write, close }))
        }));
        window.showOpenFilePicker = vi.fn(async () => []);

        const result = await EphemeraDataManagement.saveToDisk('/home/testuser/Pictures/screenshot.png');

        expect(result.success).toBe(true);
        expect(write).toHaveBeenCalledTimes(1);
        const payload = write.mock.calls[0][0];
        expect(payload).toBeInstanceOf(Uint8Array);
        expect(Array.from(payload.slice(0, 8))).toEqual(PNG_SIGNATURE);
    });

    it('decodes data URL images to binary blob in legacy download fallback', async () => {
        const normalizeSpy = vi.spyOn(EphemeraDataManagement, '_normalizeFileExportPayload');
        const result = await EphemeraDataManagement._legacySaveToDisk('/home/testuser/Pictures/screenshot.png');

        expect(result.success).toBe(true);
        expect(normalizeSpy).toHaveBeenCalledTimes(1);
        const normalized = normalizeSpy.mock.results[0]?.value;
        expect(normalized?.mimeType).toBe('image/png');
        expect(normalized?.data).toBeInstanceOf(Uint8Array);
        expect(Array.from(normalized.data.slice(0, 8))).toEqual(PNG_SIGNATURE);
        expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
        const blob = URL.createObjectURL.mock.calls[0][0];
        expect(blob).toBeInstanceOf(Blob);
        expect(blob.type).toBe('image/png');
        normalizeSpy.mockRestore();
    });
});
