const sessionBuffers = new Map();

function normalizeSessionId(value) {
    const id = String(value || '').trim();
    return id || 'default';
}

function messageContentToText(content) {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content.map((part) => {
            if (typeof part === 'string') return part;
            if (part && typeof part === 'object') {
                if (typeof part.text === 'string') return part.text;
                if (typeof part.content === 'string') return part.content;
            }
            return '';
        }).filter(Boolean).join('\n');
    }
    if (content && typeof content === 'object') {
        if (typeof content.text === 'string') return content.text;
        if (typeof content.content === 'string') return content.content;
    }
    return String(content || '');
}

function processDataLine(line, events) {
    const trimmed = String(line || '').trim();
    if (!trimmed || !trimmed.startsWith('data:')) {
        return;
    }

    const data = trimmed.slice('data:'.length).trimStart();
    if (!data || data === '[DONE]') {
        return;
    }

    try {
        const parsed = JSON.parse(data);
        if (parsed?.usage) {
            events.push({
                type: 'usage',
                usage: parsed.usage
            });
        }

        const content = messageContentToText(parsed?.choices?.[0]?.delta?.content);
        if (content) {
            events.push({
                type: 'content',
                content
            });
        }
    } catch (_error) {
        // Ignore malformed SSE payloads.
    }
}

function processChunk(payload = {}) {
    const sessionId = normalizeSessionId(payload.sessionId);
    const chunk = String(payload.chunk || '');
    const previous = sessionBuffers.get(sessionId) || '';
    const combined = previous + chunk;
    const lines = combined.split('\n');
    const remainder = lines.pop() || '';
    const events = [];

    lines.forEach((line) => processDataLine(line, events));
    sessionBuffers.set(sessionId, remainder);

    return { events };
}

function flushSession(payload = {}) {
    const sessionId = normalizeSessionId(payload.sessionId);
    const remainder = sessionBuffers.get(sessionId) || '';
    const events = [];

    if (remainder.trim()) {
        processDataLine(remainder, events);
    }
    sessionBuffers.delete(sessionId);

    return { events };
}

function closeSession(payload = {}) {
    const sessionId = normalizeSessionId(payload.sessionId);
    sessionBuffers.delete(sessionId);
    return { closed: true };
}

self.onmessage = (event) => {
    const message = event?.data || {};
    const id = Number(message.id);
    const op = String(message.op || '');
    const payload = message.payload || {};

    if (!Number.isFinite(id)) return;

    try {
        let result;
        if (op === 'process-chunk') {
            result = processChunk(payload);
        } else if (op === 'flush-session') {
            result = flushSession(payload);
        } else if (op === 'close-session') {
            result = closeSession(payload);
        } else {
            throw new Error(`Unsupported ai stream worker op: ${op}`);
        }

        self.postMessage({
            id,
            ok: true,
            result
        });
    } catch (error) {
        self.postMessage({
            id,
            ok: false,
            error: error?.message || 'AI stream worker operation failed'
        });
    }
};
