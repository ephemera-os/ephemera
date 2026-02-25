const encoder = new TextEncoder();
const decoder = new TextDecoder();
const keyCache = new Map();

function toBase64(bytesLike) {
    const bytes = bytesLike instanceof Uint8Array
        ? bytesLike
        : new Uint8Array(bytesLike);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
}

function fromBase64(base64) {
    const binary = atob(String(base64 || ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function combineIvAndCiphertext(iv, ciphertextBuffer) {
    const ciphertext = new Uint8Array(ciphertextBuffer);
    const combined = new Uint8Array(iv.length + ciphertext.length);
    combined.set(iv, 0);
    combined.set(ciphertext, iv.length);
    return combined;
}

async function getAesKey(rawKeyBase64) {
    const cacheKey = String(rawKeyBase64 || '');
    if (!cacheKey) {
        throw new Error('Missing worker key material');
    }

    let key = keyCache.get(cacheKey);
    if (key) return key;

    const rawKey = fromBase64(cacheKey);
    key = await crypto.subtle.importKey(
        'raw',
        rawKey,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
    );
    keyCache.set(cacheKey, key);
    return key;
}

async function encryptText(text, rawKeyBase64) {
    const key = await getAesKey(rawKeyBase64);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = encoder.encode(String(text ?? ''));
    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        plaintext
    );
    const combined = combineIvAndCiphertext(iv, ciphertext);
    return `enc:${toBase64(combined)}`;
}

async function decryptText(ciphertext, rawKeyBase64) {
    if (!ciphertext || typeof ciphertext !== 'string' || !ciphertext.startsWith('enc:')) {
        return ciphertext;
    }

    try {
        const key = await getAesKey(rawKeyBase64);
        const packed = fromBase64(ciphertext.slice(4));
        const iv = packed.slice(0, 12);
        const encrypted = packed.slice(12);
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            encrypted
        );
        return decoder.decode(decrypted);
    } catch (_error) {
        return null;
    }
}

self.onmessage = async (event) => {
    const message = event?.data || {};
    const id = Number(message.id);
    const op = String(message.op || '');
    const payload = message.payload || {};

    if (!Number.isFinite(id)) return;

    try {
        let result = null;
        if (op === 'encrypt') {
            result = await encryptText(payload.text, payload.key);
        } else if (op === 'decrypt') {
            result = await decryptText(payload.ciphertext, payload.key);
        } else {
            throw new Error(`Unsupported crypto worker op: ${op}`);
        }

        self.postMessage({ id, ok: true, result });
    } catch (error) {
        self.postMessage({
            id,
            ok: false,
            error: error?.message || 'Crypto worker operation failed'
        });
    }
};
