const encoder = new TextEncoder();

function normalizeBuffer(bytes) {
    if (bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength) {
        return bytes.buffer;
    }
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

async function streamToUint8Array(stream) {
    const reader = stream.getReader();
    const chunks = [];
    let total = 0;

    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
        chunks.push(chunk);
        total += chunk.byteLength;
    }

    const merged = new Uint8Array(total);
    let offset = 0;
    chunks.forEach((chunk) => {
        merged.set(chunk, offset);
        offset += chunk.byteLength;
    });
    return merged;
}

async function gzipBytes(bytes) {
    if (typeof CompressionStream !== 'function') {
        throw new Error('CompressionStream is not supported');
    }

    const sourceStream = new Blob([bytes]).stream();
    const compressedStream = sourceStream.pipeThrough(new CompressionStream('gzip'));
    return streamToUint8Array(compressedStream);
}

async function serializeExport(payload = {}) {
    const data = payload.data ?? {};
    const compress = payload.options?.compress === true;
    const json = JSON.stringify(data, null, 2);
    const plainBytes = encoder.encode(json);

    if (!compress) {
        return {
            bytes: plainBytes,
            compressed: false,
            mimeType: 'application/json',
            extension: 'json'
        };
    }

    const zipped = await gzipBytes(plainBytes);
    return {
        bytes: zipped,
        compressed: true,
        mimeType: 'application/gzip',
        extension: 'json.gz'
    };
}

self.onmessage = (event) => {
    const message = event?.data || {};
    const id = Number(message.id);
    const op = String(message.op || '');
    const payload = message.payload || {};

    if (!Number.isFinite(id)) return;

    if (op !== 'serialize-export') {
        self.postMessage({
            id,
            ok: false,
            error: `Unsupported export worker op: ${op}`
        });
        return;
    }

    serializeExport(payload).then((result) => {
        const buffer = normalizeBuffer(result.bytes || new Uint8Array());
        self.postMessage({
            id,
            ok: true,
            result: {
                buffer,
                compressed: Boolean(result.compressed),
                mimeType: String(result.mimeType || 'application/octet-stream'),
                extension: String(result.extension || 'bin')
            }
        }, [buffer]);
    }).catch((error) => {
        self.postMessage({
            id,
            ok: false,
            error: error?.message || 'Export worker operation failed'
        });
    });
};
