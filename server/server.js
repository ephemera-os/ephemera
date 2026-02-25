const express = require('express');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.EPHEMERA_SYNC_PORT || '3001', 10);
const TOKEN = process.env.EPHEMERA_SYNC_TOKEN || '';
const DATA_DIR = path.resolve(process.env.EPHEMERA_SYNC_DATA_DIR || './data');
const EPHEMERA_ROOT = path.join(DATA_DIR, 'ephemera');

if (!TOKEN) {
    console.error('EPHEMERA_SYNC_TOKEN environment variable is required');
    process.exit(1);
}

const app = express();

// ── CORS ────────────────────────────────────────────────────────────────────
app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Ephemera-ModifiedAt, X-Ephemera-MimeType');
    res.setHeader('Access-Control-Expose-Headers', 'X-Ephemera-ModifiedAt, X-Ephemera-MimeType');
    next();
});

app.options('*', (_req, res) => res.sendStatus(204));

// ── Auth ────────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
    if (req.method === 'OPTIONS') return next();
    const auth = req.headers.authorization || '';
    const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (bearer !== TOKEN) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
});

// ── Path safety ─────────────────────────────────────────────────────────────
function safePath(reqPath) {
    const decoded = decodeURIComponent(reqPath || '');
    if (decoded.includes('\0') || decoded.includes('..') || path.isAbsolute(decoded)) {
        return null;
    }
    const resolved = path.join(EPHEMERA_ROOT, decoded);
    if (!resolved.startsWith(EPHEMERA_ROOT)) {
        return null;
    }
    return resolved;
}

// ── Health ───────────────────────────────────────────────────────────────────
app.get('/api/ping', (_req, res) => {
    res.json({ ok: true, version: '1.0.0' });
});

// ── List files ──────────────────────────────────────────────────────────────
app.get('/api/files', (_req, res) => {
    const files = [];

    function walk(dir, prefix) {
        if (!fs.existsSync(dir)) return;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (entry.name.endsWith('.meta.json')) continue;
            const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                files.push({ path: '/' + rel, type: 'directory', modifiedAt: 0, mimeType: null });
                walk(full, rel);
            } else {
                const meta = readMeta(full);
                files.push({
                    path: '/' + rel,
                    type: 'file',
                    modifiedAt: meta.modifiedAt || 0,
                    mimeType: meta.mimeType || null
                });
            }
        }
    }

    walk(EPHEMERA_ROOT, '');
    res.json({ files });
});

// ── Pull file ───────────────────────────────────────────────────────────────
app.get('/api/files/*', (req, res) => {
    const filePath = safePath(req.params[0]);
    if (!filePath) return res.status(400).json({ error: 'Invalid path' });

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Not found' });
    }

    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
        return res.status(400).json({ error: 'Path is a directory' });
    }

    const meta = readMeta(filePath);
    res.setHeader('X-Ephemera-ModifiedAt', String(meta.modifiedAt || 0));
    if (meta.mimeType) {
        res.setHeader('X-Ephemera-MimeType', meta.mimeType);
        res.setHeader('Content-Type', meta.mimeType);
    } else {
        res.setHeader('Content-Type', 'application/octet-stream');
    }

    const content = fs.readFileSync(filePath);
    res.send(content);
});

// ── Push file ───────────────────────────────────────────────────────────────
app.put('/api/files/*', express.raw({ type: '*/*', limit: '50mb' }), (req, res) => {
    const filePath = safePath(req.params[0]);
    if (!filePath) return res.status(400).json({ error: 'Invalid path' });

    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, req.body);

    const modifiedAt = parseInt(req.headers['x-ephemera-modifiedat'] || '0', 10) || Date.now();
    const mimeType = req.headers['x-ephemera-mimetype'] || null;
    writeMeta(filePath, { modifiedAt, mimeType });

    res.json({ ok: true });
});

// ── Delete file ─────────────────────────────────────────────────────────────
app.delete('/api/files/*', (req, res) => {
    const filePath = safePath(req.params[0]);
    if (!filePath) return res.status(400).json({ error: 'Invalid path' });

    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
    const metaPath = filePath + '.meta.json';
    if (fs.existsSync(metaPath)) {
        fs.unlinkSync(metaPath);
    }

    res.json({ ok: true });
});

// ── Mkdir ───────────────────────────────────────────────────────────────────
app.put('/api/mkdir/*', (req, res) => {
    const dirPath = safePath(req.params[0]);
    if (!dirPath) return res.status(400).json({ error: 'Invalid path' });

    fs.mkdirSync(dirPath, { recursive: true });
    res.json({ ok: true });
});

// ── Meta helpers ────────────────────────────────────────────────────────────
function readMeta(filePath) {
    const metaPath = filePath + '.meta.json';
    try {
        return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch {
        return {};
    }
}

function writeMeta(filePath, meta) {
    const metaPath = filePath + '.meta.json';
    fs.writeFileSync(metaPath, JSON.stringify(meta), 'utf8');
}

// ── Start ───────────────────────────────────────────────────────────────────
fs.mkdirSync(EPHEMERA_ROOT, { recursive: true });
app.listen(PORT, () => {
    console.log(`Ephemera Sync Server v1.0.0 listening on port ${PORT}`);
    console.log(`Data directory: ${DATA_DIR}`);
});
