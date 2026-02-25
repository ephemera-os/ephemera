import * as git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import LightningFS from '@isomorphic-git/lightning-fs';
import { Buffer as BufferPolyfill } from 'buffer';

if (typeof globalThis.Buffer === 'undefined') {
    globalThis.Buffer = BufferPolyfill;
}

const MAX_DIFF_BYTES = 256 * 1024;
const DEFAULT_REPO_ROOT = '/repos';
const DEFAULT_FS_NAME = 'ephemera-git';
const STASH_FILENAME = 'ephemera-stash.json';

function createTextEncoder() {
    if (typeof TextEncoder !== 'undefined') {
        return new TextEncoder();
    }
    return {
        encode(value) {
            const text = String(value || '');
            const out = new Uint8Array(text.length);
            for (let i = 0; i < text.length; i++) {
                out[i] = text.charCodeAt(i) & 0xff;
            }
            return out;
        }
    };
}

function createTextDecoder() {
    if (typeof TextDecoder !== 'undefined') {
        return new TextDecoder();
    }
    return {
        decode(bytesLike) {
            const bytes = toUint8Array(bytesLike);
            let out = '';
            for (let i = 0; i < bytes.length; i++) {
                out += String.fromCharCode(bytes[i]);
            }
            return out;
        }
    };
}

const textEncoder = createTextEncoder();
const textDecoder = createTextDecoder();

function normalizePath(path) {
    const raw = String(path || '').trim();
    const candidate = raw ? raw : '/';
    const source = candidate.startsWith('/') ? candidate : `/${candidate}`;
    const parts = source.split('/').filter((segment) => segment && segment !== '.');
    const out = [];
    for (const part of parts) {
        if (part === '..') {
            out.pop();
        } else {
            out.push(part);
        }
    }
    return '/' + out.join('/');
}

function joinPath(base, child) {
    if (!child) {
        return normalizePath(base);
    }
    if (String(child).startsWith('/')) {
        return normalizePath(child);
    }
    const left = normalizePath(base);
    return normalizePath(`${left}/${child}`);
}

function parentDir(path) {
    const normalized = normalizePath(path);
    if (normalized === '/') return '/';
    const idx = normalized.lastIndexOf('/');
    if (idx <= 0) return '/';
    return normalized.slice(0, idx);
}

function toRelativePath(root, fullPath) {
    const rootNorm = normalizePath(root);
    const fullNorm = normalizePath(fullPath);
    if (fullNorm === rootNorm) return '';
    const prefix = `${rootNorm}/`;
    if (!fullNorm.startsWith(prefix)) {
        throw new Error(`Path "${fullNorm}" is outside of repo root "${rootNorm}"`);
    }
    return fullNorm.slice(prefix.length);
}

function toUint8Array(content) {
    if (content == null) return new Uint8Array();
    if (content instanceof Uint8Array) return content;
    if (content instanceof ArrayBuffer) return new Uint8Array(content);
    if (ArrayBuffer.isView(content)) {
        return new Uint8Array(content.buffer, content.byteOffset, content.byteLength);
    }
    if (typeof content === 'string') {
        return textEncoder.encode(content);
    }
    return textEncoder.encode(String(content));
}

function bytesToBase64(bytesLike) {
    const bytes = toUint8Array(bytesLike);
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(bytes).toString('base64');
    }
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
}

function base64ToBytes(base64) {
    const raw = String(base64 || '');
    if (typeof Buffer !== 'undefined') {
        return new Uint8Array(Buffer.from(raw, 'base64'));
    }
    const binary = atob(raw);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        out[i] = binary.charCodeAt(i);
    }
    return out;
}

function hasBinaryByte(bytesLike) {
    const bytes = toUint8Array(bytesLike);
    for (let i = 0; i < bytes.length; i++) {
        if (bytes[i] === 0) return true;
    }
    return false;
}

function isDirectoryStat(stat) {
    if (!stat) return false;
    if (typeof stat.isDirectory === 'function') return stat.isDirectory();
    return stat.type === 'dir' || stat.type === 'directory';
}

function classifyStatus(head, workdir, stage) {
    if (head === 0 && workdir !== 0 && stage === 0) return 'untracked';
    if (head === 0 && stage !== 0) return 'added';
    if (head !== 0 && workdir === 0 && stage === 0) return 'deleted';
    if (head !== 0 && workdir === 0 && stage !== 0) return 'deleted-staged';
    if (head === workdir && head === stage) return 'clean';
    if (head === workdir && stage !== head) return 'staged';
    if (head !== workdir && stage === head) return 'modified';
    if (head !== workdir && stage === workdir) return 'staged-and-modified';
    return 'conflicted';
}

function isMissingHeadRefError(err) {
    if (!err) return false;
    const code = String(err.code || err.name || '');
    const message = String(err.message || '');
    if (code !== 'NotFoundError' && code !== 'ENOENT') {
        return false;
    }
    return /could not find refs\/heads\//i.test(message)
        || /could not find head/i.test(message)
        || /could not find ref/i.test(message);
}

function summarizeDiff(beforeText, afterText) {
    const beforeLines = String(beforeText || '').split('\n');
    const afterLines = String(afterText || '').split('\n');

    let start = 0;
    const maxStart = Math.min(beforeLines.length, afterLines.length);
    while (start < maxStart && beforeLines[start] === afterLines[start]) {
        start += 1;
    }

    let beforeEnd = beforeLines.length;
    let afterEnd = afterLines.length;
    while (
        beforeEnd > start &&
        afterEnd > start &&
        beforeLines[beforeEnd - 1] === afterLines[afterEnd - 1]
    ) {
        beforeEnd -= 1;
        afterEnd -= 1;
    }

    return {
        lineStart: start + 1,
        removedLines: Math.max(0, beforeEnd - start),
        addedLines: Math.max(0, afterEnd - start),
        beforeSnippet: beforeLines.slice(start, Math.min(beforeEnd, start + 10)),
        afterSnippet: afterLines.slice(start, Math.min(afterEnd, start + 10))
    };
}

function repoPathToId(repoPath) {
    const bytes = textEncoder.encode(normalizePath(repoPath));
    return bytesToBase64(bytes)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

const EphemeraGit = {
    _git: git,
    _http: http,
    _fsCtor: LightningFS,
    _repoRoot: DEFAULT_REPO_ROOT,
    _fsName: DEFAULT_FS_NAME,
    _lfs: null,
    _fs: null,
    _initialized: false,
    _repoMap: new Map(),
    _operationQueue: Promise.resolve(),

    async init(options = {}) {
        if (this._initialized && !options.force) return this;

        if (options.repoRoot) {
            this._repoRoot = normalizePath(options.repoRoot);
        }
        if (options.fsName) {
            this._fsName = String(options.fsName || DEFAULT_FS_NAME);
        }

        this._lfs = new this._fsCtor(this._fsName, {
            wipe: Boolean(options.wipe)
        });
        this._fs = this._lfs.promises;
        this._initialized = true;
        await this._ensureLightningDir(this._repoRoot);
        return this;
    },

    _emit(event, payload) {
        window.EphemeraEvents?.emit?.(event, payload);
    },

    _withLock(task) {
        const run = this._operationQueue.then(task, task);
        this._operationQueue = run.catch(() => {});
        return run;
    },

    _assertEphemeraFS() {
        if (!window.EphemeraFS) {
            throw new Error('Ephemera filesystem is unavailable');
        }
    },

    _normalizeRepoPath(repoPath) {
        if (!repoPath || typeof repoPath !== 'string') {
            throw new Error('Repository path is required');
        }
        if (window.EphemeraFS?.normalizePath) {
            return window.EphemeraFS.normalizePath(repoPath);
        }
        return normalizePath(repoPath);
    },

    _repoForPath(repoPath) {
        const normalized = this._normalizeRepoPath(repoPath);
        const existing = this._repoMap.get(normalized);
        if (existing) return existing;

        const id = repoPathToId(normalized);
        const record = {
            repoPath: normalized,
            id,
            dir: joinPath(this._repoRoot, id)
        };
        this._repoMap.set(normalized, record);
        return record;
    },

    async _existsLightning(path) {
        try {
            await this._fs.stat(normalizePath(path));
            return true;
        } catch (_err) {
            return false;
        }
    },

    async _ensureLightningDir(path) {
        const target = normalizePath(path);
        if (target === '/') return;
        const parts = target.split('/').filter(Boolean);
        let current = '';
        for (const part of parts) {
            current = joinPath(current || '/', part);
            if (await this._existsLightning(current)) continue;
            try {
                await this._fs.mkdir(current);
            } catch (err) {
                if (err?.code !== 'EEXIST') {
                    throw err;
                }
            }
        }
    },

    async _readDirLightning(path) {
        try {
            return await this._fs.readdir(normalizePath(path));
        } catch (_err) {
            return [];
        }
    },

    async _deleteLightningPath(path) {
        const target = normalizePath(path);
        let stat;
        try {
            stat = await this._fs.lstat(target);
        } catch (_err) {
            return;
        }

        if (isDirectoryStat(stat)) {
            const entries = await this._readDirLightning(target);
            for (const entry of entries) {
                await this._deleteLightningPath(joinPath(target, entry));
            }
            try {
                await this._fs.rmdir(target);
            } catch (err) {
                if (err?.code !== 'ENOENT') throw err;
            }
            return;
        }

        try {
            await this._fs.unlink(target);
        } catch (err) {
            if (err?.code !== 'ENOENT') throw err;
        }
    },

    async _clearLightningWorktree(repoDir) {
        await this._ensureLightningDir(repoDir);
        const entries = await this._readDirLightning(repoDir);
        for (const entry of entries) {
            if (entry === '.git') continue;
            await this._deleteLightningPath(joinPath(repoDir, entry));
        }
    },

    async _clearLightningRepoDir(repoDir) {
        if (!(await this._existsLightning(repoDir))) {
            await this._ensureLightningDir(repoDir);
            return;
        }
        const entries = await this._readDirLightning(repoDir);
        for (const entry of entries) {
            await this._deleteLightningPath(joinPath(repoDir, entry));
        }
    },

    async _hasGitDir(repo) {
        return this._existsLightning(joinPath(repo.dir, '.git'));
    },

    async _collectEphemeraTree(repoPath) {
        this._assertEphemeraFS();
        const fs = window.EphemeraFS;
        const root = this._normalizeRepoPath(repoPath);

        const exists = await fs.exists(root);
        if (!exists) {
            return { directories: [root], files: [] };
        }

        const directories = [root];
        const files = [];
        const stack = [root];

        while (stack.length > 0) {
            const currentDir = stack.pop();
            const entries = await fs.readdir(currentDir);
            for (const entry of entries) {
                if (entry.name === '.git') continue;
                if (entry.type === 'directory') {
                    directories.push(entry.path);
                    stack.push(entry.path);
                    continue;
                }
                const content = await fs.readFile(entry.path);
                files.push({
                    path: entry.path,
                    content
                });
            }
        }

        return { directories, files };
    },

    async _collectLightningTree(repoDir) {
        const directories = [''];
        const files = [];
        const stack = [''];

        while (stack.length > 0) {
            const relDir = stack.pop();
            const absoluteDir = relDir ? joinPath(repoDir, relDir) : repoDir;
            const entries = await this._readDirLightning(absoluteDir);

            for (const entry of entries) {
                if (entry === '.git') continue;
                const relPath = relDir ? `${relDir}/${entry}` : entry;
                const absolutePath = joinPath(repoDir, relPath);
                let stat;
                try {
                    stat = await this._fs.stat(absolutePath);
                } catch (_err) {
                    continue;
                }

                if (isDirectoryStat(stat)) {
                    directories.push(relPath);
                    stack.push(relPath);
                } else {
                    const content = await this._fs.readFile(absolutePath);
                    files.push({
                        relPath,
                        content: toUint8Array(content)
                    });
                }
            }
        }

        return { directories, files };
    },

    async _clearEphemeraWorktree(repoPath) {
        this._assertEphemeraFS();
        const fs = window.EphemeraFS;
        const root = this._normalizeRepoPath(repoPath);
        if (!(await fs.exists(root))) return;

        const entries = await fs.readdir(root);
        for (const entry of entries) {
            if (entry.name === '.git') continue;
            if (typeof fs.permanentDelete === 'function') {
                await fs.permanentDelete(entry.path);
            } else {
                await fs.delete(entry.path);
            }
        }
    },

    async _syncFromEphemera(repoPath, options = {}) {
        await this.init();
        this._assertEphemeraFS();

        const repo = this._repoForPath(repoPath);
        await this._ensureLightningDir(this._repoRoot);
        await this._ensureLightningDir(repo.dir);

        if (options.clearWorktree !== false) {
            await this._clearLightningWorktree(repo.dir);
        }

        const tree = await this._collectEphemeraTree(repo.repoPath);
        for (const dirPath of tree.directories) {
            const relPath = toRelativePath(repo.repoPath, dirPath);
            const lightningDir = relPath ? joinPath(repo.dir, relPath) : repo.dir;
            await this._ensureLightningDir(lightningDir);
        }

        for (const file of tree.files) {
            const relPath = toRelativePath(repo.repoPath, file.path);
            const lightningPath = joinPath(repo.dir, relPath);
            await this._ensureLightningDir(parentDir(lightningPath));

            if (typeof file.content === 'string') {
                await this._fs.writeFile(lightningPath, file.content);
            } else {
                await this._fs.writeFile(lightningPath, toUint8Array(file.content));
            }
        }

        return {
            repoPath: repo.repoPath,
            directories: tree.directories.length,
            files: tree.files.length
        };
    },

    async syncFromEphemera(repoPath, options = {}) {
        return this._withLock(() => this._syncFromEphemera(repoPath, options));
    },

    async _syncToEphemera(repoPath, options = {}) {
        await this.init();
        this._assertEphemeraFS();

        const fs = window.EphemeraFS;
        const repo = this._repoForPath(repoPath);

        await fs.ensureDir(repo.repoPath);
        if (options.clearWorktree !== false) {
            await this._clearEphemeraWorktree(repo.repoPath);
        }

        const tree = await this._collectLightningTree(repo.dir);
        for (const relDir of tree.directories.sort((a, b) => a.length - b.length)) {
            const targetDir = relDir ? joinPath(repo.repoPath, relDir) : repo.repoPath;
            await fs.ensureDir(targetDir);
        }

        for (const file of tree.files) {
            const targetPath = joinPath(repo.repoPath, file.relPath);
            await fs.ensureDir(parentDir(targetPath));

            const bytes = toUint8Array(file.content);
            const asText = fs.isTextFile?.(targetPath) && !hasBinaryByte(bytes);
            const content = asText ? textDecoder.decode(bytes) : bytes;
            await fs.writeFile(targetPath, content);
        }

        return {
            repoPath: repo.repoPath,
            directories: tree.directories.length,
            files: tree.files.length
        };
    },

    async syncToEphemera(repoPath, options = {}) {
        return this._withLock(() => this._syncToEphemera(repoPath, options));
    },

    _resolveAuthor(author = {}) {
        const user = window.EphemeraState?.user || {};
        const name = String(
            author.name
            || author.authorName
            || user.displayName
            || user.name
            || 'Ephemera User'
        );
        const email = String(
            author.email
            || author.authorEmail
            || user.email
            || `${(user.id || 'user').toString().replace(/\s+/g, '-')}@ephemera.local`
        );
        return { name, email };
    },

    async _getRemoteUrl(repo, remote = 'origin') {
        if (!repo || !remote || typeof this._git.getConfig !== 'function') {
            return '';
        }
        try {
            const value = await this._git.getConfig({
                fs: this._lfs,
                dir: repo.dir,
                path: `remote.${remote}.url`
            });
            return String(value || '').trim();
        } catch (_err) {
            return '';
        }
    },

    async _buildAuthCallbacks(options = {}, context = {}) {
        if (typeof options.onAuth === 'function') {
            return { onAuth: options.onAuth };
        }

        const auth = options.auth || options;
        const username = auth?.username;
        const password = auth?.password || auth?.token || auth?.accessToken;
        if (username || password) {
            return {
                onAuth: () => ({
                    username: username || 'oauth2',
                    password: password || ''
                })
            };
        }

        if (options.useOAuth === false) {
            return {};
        }

        const remoteUrl = String(context.url || '').trim();
        if (!remoteUrl) {
            return {};
        }

        const oauth = window.EphemeraOAuth;
        if (!oauth || typeof oauth.getGitAuthForUrl !== 'function') {
            return {};
        }

        try {
            const oauthAuth = await oauth.getGitAuthForUrl(remoteUrl);
            const oauthUser = String(oauthAuth?.username || '').trim();
            const oauthPassword = String(oauthAuth?.password || '').trim();
            if (!oauthPassword) {
                return {};
            }
            return {
                onAuth: () => ({
                    username: oauthUser || 'x-access-token',
                    password: oauthPassword
                })
            };
        } catch (_err) {
            return {};
        }
    },

    async _ensureRepoPrepared(repoPath, options = {}) {
        await this.init();
        const repo = this._repoForPath(repoPath);

        await this._ensureLightningDir(this._repoRoot);
        await this._ensureLightningDir(repo.dir);

        if (options.syncFromEphemera !== false) {
            await this._syncFromEphemera(repo.repoPath, {
                clearWorktree: options.clearWorktree !== false
            });
        }

        let hasGitDir = await this._hasGitDir(repo);
        if (!hasGitDir && options.initialize) {
            await this._git.init({
                fs: this._lfs,
                dir: repo.dir,
                defaultBranch: options.defaultBranch || 'main'
            });
            hasGitDir = true;
        }

        if (options.requireGit !== false && !hasGitDir) {
            throw new Error(`No git repository found at ${repo.repoPath}`);
        }

        return repo;
    },

    async _setAuthorInternal(repoPath, author = {}) {
        const repo = this._repoForPath(repoPath);
        const identity = this._resolveAuthor(author);
        await this._git.setConfig({
            fs: this._lfs,
            dir: repo.dir,
            path: 'user.name',
            value: identity.name
        });
        await this._git.setConfig({
            fs: this._lfs,
            dir: repo.dir,
            path: 'user.email',
            value: identity.email
        });
        return identity;
    },

    async setAuthor(repoPath, author = {}) {
        return this._withLock(async () => {
            await this._ensureRepoPrepared(repoPath, {
                requireGit: true,
                syncFromEphemera: false
            });
            return this._setAuthorInternal(repoPath, author);
        });
    },

    async initRepo(repoPath, options = {}) {
        return this._withLock(async () => {
            this._assertEphemeraFS();
            const fs = window.EphemeraFS;
            const normalized = this._normalizeRepoPath(repoPath);
            await fs.ensureDir(normalized);

            const repo = await this._ensureRepoPrepared(normalized, {
                requireGit: false,
                initialize: !options.skipInit,
                defaultBranch: options.defaultBranch || 'main',
                syncFromEphemera: true,
                clearWorktree: options.clearWorktree !== false
            });

            if (options.author || options.authorName || options.authorEmail) {
                await this._setAuthorInternal(repo.repoPath, {
                    ...options.author,
                    authorName: options.authorName,
                    authorEmail: options.authorEmail
                });
            }

            this._emit('git:changed', {
                action: 'init',
                repoPath: repo.repoPath
            });

            return {
                repoPath: repo.repoPath,
                dir: repo.dir,
                initialized: true
            };
        });
    },

    async clone(url, repoPath, options = {}) {
        return this._withLock(async () => {
            if (!url || typeof url !== 'string') {
                throw new Error('Clone URL is required');
            }

            this._assertEphemeraFS();
            const normalized = this._normalizeRepoPath(repoPath);
            await window.EphemeraFS.ensureDir(normalized);

            await this.init();
            const repo = this._repoForPath(normalized);
            await this._ensureLightningDir(this._repoRoot);
            await this._clearLightningRepoDir(repo.dir);
            await this._ensureLightningDir(repo.dir);

            const trimmedUrl = url.trim();
            const auth = await this._buildAuthCallbacks(options, { url: trimmedUrl });
            const cloneArgs = {
                fs: this._lfs,
                http: this._http,
                dir: repo.dir,
                url: trimmedUrl,
                singleBranch: options.singleBranch !== false,
                depth: options.depth,
                ref: options.ref,
                noTags: options.noTags,
                noCheckout: options.noCheckout,
                corsProxy: options.corsProxy,
                onProgress: options.onProgress,
                onMessage: options.onMessage,
                onAuthFailure: options.onAuthFailure,
                onAuthSuccess: options.onAuthSuccess,
                ...auth
            };

            Object.keys(cloneArgs).forEach((key) => {
                if (cloneArgs[key] === undefined || cloneArgs[key] === null) {
                    delete cloneArgs[key];
                }
            });

            await this._git.clone(cloneArgs);
            await this._syncToEphemera(repo.repoPath, { clearWorktree: true });

            this._emit('git:changed', {
                action: 'clone',
                repoPath: repo.repoPath,
                url: trimmedUrl
            });

            return {
                repoPath: repo.repoPath,
                dir: repo.dir
            };
        });
    },

    async pull(repoPath, options = {}) {
        return this._withLock(async () => {
            const repo = await this._ensureRepoPrepared(repoPath, {
                requireGit: true,
                syncFromEphemera: true,
                clearWorktree: true
            });

            const remote = options.remote || 'origin';
            const remoteUrl = await this._getRemoteUrl(repo, remote);
            const auth = await this._buildAuthCallbacks(options, { url: remoteUrl });
            const args = {
                fs: this._lfs,
                http: this._http,
                dir: repo.dir,
                remote,
                ref: options.ref,
                singleBranch: options.singleBranch,
                fastForwardOnly: options.fastForwardOnly,
                corsProxy: options.corsProxy,
                author: options.author ? this._resolveAuthor(options.author) : undefined,
                onProgress: options.onProgress,
                onMessage: options.onMessage,
                onAuthFailure: options.onAuthFailure,
                onAuthSuccess: options.onAuthSuccess,
                ...auth
            };
            Object.keys(args).forEach((key) => {
                if (args[key] === undefined || args[key] === null) {
                    delete args[key];
                }
            });

            const result = await this._git.pull(args);
            await this._syncToEphemera(repo.repoPath, { clearWorktree: true });

            this._emit('git:changed', {
                action: 'pull',
                repoPath: repo.repoPath
            });

            return result;
        });
    },

    async push(repoPath, options = {}) {
        return this._withLock(async () => {
            const repo = await this._ensureRepoPrepared(repoPath, {
                requireGit: true,
                syncFromEphemera: true,
                clearWorktree: true
            });

            const remote = options.remote || 'origin';
            const remoteUrl = await this._getRemoteUrl(repo, remote);
            const auth = await this._buildAuthCallbacks(options, { url: remoteUrl });
            const args = {
                fs: this._lfs,
                http: this._http,
                dir: repo.dir,
                remote,
                ref: options.ref,
                remoteRef: options.remoteRef,
                force: options.force,
                corsProxy: options.corsProxy,
                onProgress: options.onProgress,
                onMessage: options.onMessage,
                onAuthFailure: options.onAuthFailure,
                onAuthSuccess: options.onAuthSuccess,
                ...auth
            };
            Object.keys(args).forEach((key) => {
                if (args[key] === undefined || args[key] === null) {
                    delete args[key];
                }
            });

            const result = await this._git.push(args);
            this._emit('git:changed', {
                action: 'push',
                repoPath: repo.repoPath
            });
            return result;
        });
    },

    async fetch(repoPath, options = {}) {
        return this._withLock(async () => {
            const repo = await this._ensureRepoPrepared(repoPath, {
                requireGit: true,
                syncFromEphemera: false
            });
            const remote = options.remote || 'origin';
            const remoteUrl = await this._getRemoteUrl(repo, remote);
            const auth = await this._buildAuthCallbacks(options, { url: remoteUrl });
            const args = {
                fs: this._lfs,
                http: this._http,
                dir: repo.dir,
                remote,
                ref: options.ref,
                singleBranch: options.singleBranch,
                depth: options.depth,
                relative: options.relative,
                tags: options.tags,
                corsProxy: options.corsProxy,
                onProgress: options.onProgress,
                onMessage: options.onMessage,
                onAuthFailure: options.onAuthFailure,
                onAuthSuccess: options.onAuthSuccess,
                ...auth
            };
            Object.keys(args).forEach((key) => {
                if (args[key] === undefined || args[key] === null) {
                    delete args[key];
                }
            });
            return this._git.fetch(args);
        });
    },

    async statusMatrix(repoPath, options = {}) {
        return this._withLock(async () => {
            const repo = await this._ensureRepoPrepared(repoPath, {
                requireGit: true,
                syncFromEphemera: true,
                clearWorktree: true
            });
            return this._git.statusMatrix({
                fs: this._lfs,
                dir: repo.dir,
                filepaths: options.filepaths
            });
        });
    },

    _rowToStatus(row) {
        const [filepath, head, workdir, stage] = row;
        return {
            filepath,
            head,
            workdir,
            stage,
            status: classifyStatus(head, workdir, stage),
            staged: head !== stage,
            unstaged: stage !== workdir,
            untracked: head === 0 && workdir !== 0 && stage === 0,
            deleted: workdir === 0
        };
    },

    async status(repoPath, options = {}) {
        return this._withLock(async () => {
            const repo = await this._ensureRepoPrepared(repoPath, {
                requireGit: true,
                syncFromEphemera: true,
                clearWorktree: true
            });
            const matrix = await this._git.statusMatrix({
                fs: this._lfs,
                dir: repo.dir,
                filepaths: options.filepaths
            });
            return matrix.map((row) => this._rowToStatus(row));
        });
    },

    async stageFile(repoPath, filepath) {
        return this._withLock(async () => {
            if (!filepath) throw new Error('File path is required');
            const repo = await this._ensureRepoPrepared(repoPath, {
                requireGit: true,
                syncFromEphemera: true,
                clearWorktree: true
            });
            await this._git.add({
                fs: this._lfs,
                dir: repo.dir,
                filepath
            });
            this._emit('git:changed', { action: 'stage', repoPath: repo.repoPath, filepath });
            return true;
        });
    },

    async unstageFile(repoPath, filepath) {
        return this._withLock(async () => {
            if (!filepath) throw new Error('File path is required');
            const repo = await this._ensureRepoPrepared(repoPath, {
                requireGit: true,
                syncFromEphemera: true,
                clearWorktree: true
            });
            await this._git.resetIndex({
                fs: this._lfs,
                dir: repo.dir,
                filepath
            });
            this._emit('git:changed', { action: 'unstage', repoPath: repo.repoPath, filepath });
            return true;
        });
    },

    async _stageAllInternal(repo) {
        const matrix = await this._git.statusMatrix({
            fs: this._lfs,
            dir: repo.dir
        });

        let stagedCount = 0;
        for (const [filepath, head, workdir, stage] of matrix) {
            if (head === workdir && workdir === stage) continue;

            if (workdir === 0) {
                await this._git.remove({
                    fs: this._lfs,
                    dir: repo.dir,
                    filepath,
                    cached: true
                });
                stagedCount += 1;
                continue;
            }

            await this._git.add({
                fs: this._lfs,
                dir: repo.dir,
                filepath
            });
            stagedCount += 1;
        }

        return {
            staged: stagedCount,
            total: matrix.length
        };
    },

    async stageAll(repoPath) {
        return this._withLock(async () => {
            const repo = await this._ensureRepoPrepared(repoPath, {
                requireGit: true,
                syncFromEphemera: true,
                clearWorktree: true
            });
            const result = await this._stageAllInternal(repo);
            this._emit('git:changed', { action: 'stage-all', repoPath: repo.repoPath, ...result });
            return result;
        });
    },

    async commit(repoPath, message, options = {}) {
        return this._withLock(async () => {
            const text = String(message || '').trim();
            if (!text) throw new Error('Commit message is required');

            const repo = await this._ensureRepoPrepared(repoPath, {
                requireGit: true,
                syncFromEphemera: true,
                clearWorktree: true
            });

            if (options.stageAll !== false) {
                await this._stageAllInternal(repo);
            }

            if (options.author || options.authorName || options.authorEmail) {
                await this._setAuthorInternal(repo.repoPath, {
                    ...options.author,
                    authorName: options.authorName,
                    authorEmail: options.authorEmail
                });
            }

            const author = this._resolveAuthor(options.author || options);
            const oid = await this._git.commit({
                fs: this._lfs,
                dir: repo.dir,
                message: text,
                author
            });

            this._emit('git:changed', {
                action: 'commit',
                repoPath: repo.repoPath,
                oid
            });

            return oid;
        });
    },

    async getLog(repoPath, options = {}) {
        return this._withLock(async () => {
            const repo = await this._ensureRepoPrepared(repoPath, {
                requireGit: true,
                syncFromEphemera: false
            });
            try {
                return await this._git.log({
                    fs: this._lfs,
                    dir: repo.dir,
                    ref: options.ref,
                    depth: options.depth
                });
            } catch (err) {
                const requestedRef = String(options.ref || '').trim();
                if (!requestedRef && isMissingHeadRefError(err)) {
                    return [];
                }
                throw err;
            }
        });
    },

    async getCurrentBranch(repoPath) {
        return this._withLock(async () => {
            const repo = await this._ensureRepoPrepared(repoPath, {
                requireGit: true,
                syncFromEphemera: false
            });
            return this._git.currentBranch({
                fs: this._lfs,
                dir: repo.dir,
                fullname: false
            });
        });
    },

    async listBranches(repoPath, options = {}) {
        return this._withLock(async () => {
            const repo = await this._ensureRepoPrepared(repoPath, {
                requireGit: true,
                syncFromEphemera: false
            });
            return this._git.listBranches({
                fs: this._lfs,
                dir: repo.dir,
                remote: options.remote
            });
        });
    },

    async createBranch(repoPath, ref, options = {}) {
        return this._withLock(async () => {
            const branch = String(ref || '').trim();
            if (!branch) throw new Error('Branch name is required');

            const repo = await this._ensureRepoPrepared(repoPath, {
                requireGit: true,
                syncFromEphemera: false
            });
            const result = await this._git.branch({
                fs: this._lfs,
                dir: repo.dir,
                ref: branch,
                checkout: Boolean(options.checkout)
            });

            if (options.checkout) {
                await this._syncToEphemera(repo.repoPath, { clearWorktree: true });
            }

            this._emit('git:changed', {
                action: 'branch-create',
                repoPath: repo.repoPath,
                ref: branch
            });
            return result;
        });
    },

    async deleteBranch(repoPath, ref, options = {}) {
        return this._withLock(async () => {
            const branch = String(ref || '').trim();
            if (!branch) throw new Error('Branch name is required');

            const repo = await this._ensureRepoPrepared(repoPath, {
                requireGit: true,
                syncFromEphemera: false
            });
            const result = await this._git.deleteBranch({
                fs: this._lfs,
                dir: repo.dir,
                ref: branch,
                force: Boolean(options.force)
            });

            this._emit('git:changed', {
                action: 'branch-delete',
                repoPath: repo.repoPath,
                ref: branch
            });
            return result;
        });
    },

    async checkout(repoPath, ref, options = {}) {
        return this._withLock(async () => {
            const branch = String(ref || '').trim();
            if (!branch) throw new Error('Branch or ref is required');

            const repo = await this._ensureRepoPrepared(repoPath, {
                requireGit: true,
                syncFromEphemera: true,
                clearWorktree: true
            });
            const result = await this._git.checkout({
                fs: this._lfs,
                dir: repo.dir,
                ref: branch,
                filepaths: options.filepaths,
                force: Boolean(options.force),
                noCheckout: Boolean(options.noCheckout)
            });
            await this._syncToEphemera(repo.repoPath, { clearWorktree: true });
            this._emit('git:changed', {
                action: 'checkout',
                repoPath: repo.repoPath,
                ref: branch
            });
            return result;
        });
    },

    async merge(repoPath, options = {}) {
        return this._withLock(async () => {
            if (!options.theirs) {
                throw new Error('Merge target branch (theirs) is required');
            }

            const repo = await this._ensureRepoPrepared(repoPath, {
                requireGit: true,
                syncFromEphemera: true,
                clearWorktree: true
            });
            const ours = options.ours
                || await this._git.currentBranch({
                    fs: this._lfs,
                    dir: repo.dir,
                    fullname: false
                })
                || 'main';
            const author = this._resolveAuthor(options.author || {});
            const result = await this._git.merge({
                fs: this._lfs,
                dir: repo.dir,
                ours,
                theirs: options.theirs,
                fastForwardOnly: options.fastForwardOnly,
                noUpdateBranch: options.noUpdateBranch,
                dryRun: options.dryRun,
                message: options.message,
                author
            });

            if (!options.dryRun) {
                await this._syncToEphemera(repo.repoPath, { clearWorktree: true });
            }

            this._emit('git:changed', {
                action: 'merge',
                repoPath: repo.repoPath,
                ours,
                theirs: options.theirs
            });
            return result;
        });
    },

    _decodeBlob(filepath, bytesLike, options = {}) {
        const bytes = toUint8Array(bytesLike);
        const maxBytes = Number.isFinite(options.maxBytes)
            ? Math.max(1, Math.floor(options.maxBytes))
            : MAX_DIFF_BYTES;
        const binary = hasBinaryByte(bytes);
        const size = bytes.byteLength;
        const truncated = size > maxBytes;

        if (binary) {
            return {
                binary: true,
                size,
                truncated,
                text: '',
                base64: bytesToBase64(truncated ? bytes.subarray(0, maxBytes) : bytes)
            };
        }

        const text = textDecoder.decode(truncated ? bytes.subarray(0, maxBytes) : bytes);
        return {
            binary: false,
            size,
            truncated,
            text
        };
    },

    async _readBlobAtRef(repoDir, ref, filepath, options = {}) {
        try {
            const oid = await this._git.resolveRef({
                fs: this._lfs,
                dir: repoDir,
                ref
            });
            const { blob } = await this._git.readBlob({
                fs: this._lfs,
                dir: repoDir,
                oid,
                filepath
            });
            return {
                missing: false,
                ...this._decodeBlob(filepath, blob, options)
            };
        } catch (_err) {
            return {
                missing: true,
                binary: false,
                size: 0,
                truncated: false,
                text: ''
            };
        }
    },

    async _readWorkingBlob(repoDir, filepath, options = {}) {
        const absolutePath = joinPath(repoDir, filepath);
        try {
            const bytes = await this._fs.readFile(absolutePath);
            return {
                missing: false,
                ...this._decodeBlob(filepath, bytes, options)
            };
        } catch (_err) {
            return {
                missing: true,
                binary: false,
                size: 0,
                truncated: false,
                text: ''
            };
        }
    },

    async diff(repoPath, options = {}) {
        return this._withLock(async () => {
            const repo = await this._ensureRepoPrepared(repoPath, {
                requireGit: true,
                syncFromEphemera: true,
                clearWorktree: true
            });
            const matrix = await this._git.statusMatrix({
                fs: this._lfs,
                dir: repo.dir,
                filepaths: options.filepaths
            });

            const changedRows = matrix.filter((row) => row[1] !== row[2]);
            const ref = options.ref || 'HEAD';
            const out = [];
            for (const row of changedRows) {
                const [filepath, head, workdir, stage] = row;
                const before = head === 0
                    ? { missing: true, binary: false, size: 0, truncated: false, text: '' }
                    : await this._readBlobAtRef(repo.dir, ref, filepath, options);
                const after = workdir === 0
                    ? { missing: true, binary: false, size: 0, truncated: false, text: '' }
                    : await this._readWorkingBlob(repo.dir, filepath, options);

                const binary = before.binary || after.binary;
                out.push({
                    filepath,
                    status: classifyStatus(head, workdir, stage),
                    binary,
                    before,
                    after,
                    summary: binary ? null : summarizeDiff(before.text, after.text)
                });
            }
            return out;
        });
    },

    _stashFilePath(repo) {
        return joinPath(repo.dir, `.git/${STASH_FILENAME}`);
    },

    async _readStashStack(repo) {
        const stashPath = this._stashFilePath(repo);
        try {
            const raw = await this._fs.readFile(stashPath);
            const text = typeof raw === 'string' ? raw : textDecoder.decode(toUint8Array(raw));
            const parsed = JSON.parse(text);
            return Array.isArray(parsed) ? parsed : [];
        } catch (_err) {
            return [];
        }
    },

    async _writeStashStack(repo, stack) {
        const stashPath = this._stashFilePath(repo);
        await this._ensureLightningDir(parentDir(stashPath));
        await this._fs.writeFile(stashPath, JSON.stringify(stack));
    },

    _resolveStashIndex(stack, options = {}) {
        if (!Array.isArray(stack) || stack.length === 0) {
            throw new Error('Stash list is empty');
        }
        if (options.id) {
            const idx = stack.findIndex((entry) => entry.id === options.id);
            if (idx === -1) throw new Error('Stash entry not found');
            return idx;
        }
        const idx = Number.isFinite(options.index) ? Number(options.index) : 0;
        if (idx < 0 || idx >= stack.length) {
            throw new Error('Stash index out of range');
        }
        return idx;
    },

    async stashList(repoPath) {
        return this._withLock(async () => {
            const repo = await this._ensureRepoPrepared(repoPath, {
                requireGit: true,
                syncFromEphemera: false
            });
            const stack = await this._readStashStack(repo);
            return stack.map((entry, index) => ({
                index,
                id: entry.id,
                message: entry.message,
                createdAt: entry.createdAt,
                branch: entry.branch,
                fileCount: Array.isArray(entry.files) ? entry.files.length : 0
            }));
        });
    },

    async stashSave(repoPath, options = {}) {
        return this._withLock(async () => {
            const repo = await this._ensureRepoPrepared(repoPath, {
                requireGit: true,
                syncFromEphemera: true,
                clearWorktree: true
            });

            const matrix = await this._git.statusMatrix({
                fs: this._lfs,
                dir: repo.dir
            });
            const changedRows = matrix.filter((row) => row[1] !== row[2]);
            if (changedRows.length === 0) return null;

            const currentBranch = await this._git.currentBranch({
                fs: this._lfs,
                dir: repo.dir,
                fullname: false
            });
            const headOid = await this._git.resolveRef({
                fs: this._lfs,
                dir: repo.dir,
                ref: 'HEAD'
            }).catch(() => null);

            const files = [];
            for (const [filepath, , workdir] of changedRows) {
                if (workdir === 0) {
                    files.push({
                        filepath,
                        exists: false
                    });
                    continue;
                }
                const absolutePath = joinPath(repo.dir, filepath);
                const bytes = await this._fs.readFile(absolutePath);
                files.push({
                    filepath,
                    exists: true,
                    content: bytesToBase64(bytes)
                });
            }

            const entry = {
                id: `stash-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                createdAt: Date.now(),
                message: String(options.message || `WIP on ${currentBranch || 'detached'}: ${new Date().toISOString()}`),
                branch: currentBranch || null,
                baseOid: headOid || null,
                files
            };

            const stack = await this._readStashStack(repo);
            stack.unshift(entry);
            await this._writeStashStack(repo, stack);

            for (const [filepath, head] of changedRows) {
                if (head === 0) {
                    const absolutePath = joinPath(repo.dir, filepath);
                    await this._deleteLightningPath(absolutePath);
                    continue;
                }
                await this._git.checkout({
                    fs: this._lfs,
                    dir: repo.dir,
                    filepaths: [filepath],
                    force: true
                });
                await this._git.resetIndex({
                    fs: this._lfs,
                    dir: repo.dir,
                    filepath
                }).catch(() => {});
            }

            await this._syncToEphemera(repo.repoPath, { clearWorktree: true });

            this._emit('git:changed', {
                action: 'stash-save',
                repoPath: repo.repoPath,
                stashId: entry.id
            });

            return {
                id: entry.id,
                message: entry.message,
                fileCount: entry.files.length
            };
        });
    },

    async stashApply(repoPath, options = {}) {
        return this._withLock(async () => {
            const repo = await this._ensureRepoPrepared(repoPath, {
                requireGit: true,
                syncFromEphemera: true,
                clearWorktree: true
            });
            const stack = await this._readStashStack(repo);
            const idx = this._resolveStashIndex(stack, options);
            const entry = stack[idx];

            for (const file of entry.files || []) {
                const absolutePath = joinPath(repo.dir, file.filepath);
                if (!file.exists) {
                    await this._deleteLightningPath(absolutePath);
                    continue;
                }
                await this._ensureLightningDir(parentDir(absolutePath));
                await this._fs.writeFile(absolutePath, base64ToBytes(file.content));
            }

            if (options.drop) {
                stack.splice(idx, 1);
                await this._writeStashStack(repo, stack);
            }

            await this._syncToEphemera(repo.repoPath, { clearWorktree: true });

            this._emit('git:changed', {
                action: options.drop ? 'stash-pop' : 'stash-apply',
                repoPath: repo.repoPath,
                stashId: entry.id
            });

            return {
                id: entry.id,
                message: entry.message,
                fileCount: Array.isArray(entry.files) ? entry.files.length : 0
            };
        });
    },

    async stashPop(repoPath, options = {}) {
        return this.stashApply(repoPath, {
            ...options,
            drop: true
        });
    },

    async stashDrop(repoPath, options = {}) {
        return this._withLock(async () => {
            const repo = await this._ensureRepoPrepared(repoPath, {
                requireGit: true,
                syncFromEphemera: false
            });
            const stack = await this._readStashStack(repo);
            const idx = this._resolveStashIndex(stack, options);
            const [removed] = stack.splice(idx, 1);
            await this._writeStashStack(repo, stack);
            this._emit('git:changed', {
                action: 'stash-drop',
                repoPath: repo.repoPath,
                stashId: removed.id
            });
            return {
                id: removed.id,
                message: removed.message
            };
        });
    },

    async getRepoInfo(repoPath) {
        return this._withLock(async () => {
            await this.init();
            const repo = this._repoForPath(repoPath);
            const hasGitDir = await this._hasGitDir(repo);
            if (!hasGitDir) {
                return {
                    repoPath: repo.repoPath,
                    dir: repo.dir,
                    isRepo: false,
                    branch: null,
                    branches: [],
                    status: []
                };
            }

            await this._syncFromEphemera(repo.repoPath, {
                clearWorktree: true
            });
            const branch = await this._git.currentBranch({
                fs: this._lfs,
                dir: repo.dir,
                fullname: false
            });
            const branches = await this._git.listBranches({
                fs: this._lfs,
                dir: repo.dir
            });
            const statusMatrix = await this._git.statusMatrix({
                fs: this._lfs,
                dir: repo.dir
            });

            return {
                repoPath: repo.repoPath,
                dir: repo.dir,
                isRepo: true,
                branch,
                branches,
                status: statusMatrix.map((row) => this._rowToStatus(row))
            };
        });
    },

    _setAdaptersForTests(adapters = {}) {
        if (adapters.git) this._git = adapters.git;
        if (adapters.http) this._http = adapters.http;
        if (adapters.fsCtor) this._fsCtor = adapters.fsCtor;
        if (adapters.repoRoot) this._repoRoot = normalizePath(adapters.repoRoot);
        if (adapters.fsName) this._fsName = String(adapters.fsName);
        this._lfs = null;
        this._fs = null;
        this._initialized = false;
        this._repoMap.clear();
        this._operationQueue = Promise.resolve();
    },

    _resetForTests() {
        this._lfs = null;
        this._fs = null;
        this._initialized = false;
        this._repoMap.clear();
        this._operationQueue = Promise.resolve();
        this._repoRoot = DEFAULT_REPO_ROOT;
        this._fsName = DEFAULT_FS_NAME;
        this._git = git;
        this._http = http;
        this._fsCtor = LightningFS;
    }
};

window.EphemeraGit = EphemeraGit;

export default EphemeraGit;
