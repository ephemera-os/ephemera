import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eventsMock } from './setup.js';

import '../js/system/git.js';

const EphemeraGit = window.EphemeraGit;

function normalizePath(path) {
    const raw = String(path || '').trim();
    const source = raw.startsWith('/') ? raw : `/${raw}`;
    const parts = source.split('/').filter((segment) => segment && segment !== '.');
    const out = [];
    for (const part of parts) {
        if (part === '..') out.pop();
        else out.push(part);
    }
    return '/' + out.join('/');
}

function parentDir(path) {
    const normalized = normalizePath(path);
    if (normalized === '/') return '/';
    const idx = normalized.lastIndexOf('/');
    return idx <= 0 ? '/' : normalized.slice(0, idx);
}

function ext(path) {
    const normalized = normalizePath(path);
    const base = normalized.split('/').pop() || '';
    const idx = base.lastIndexOf('.');
    return idx > 0 ? base.slice(idx + 1).toLowerCase() : '';
}

function err(code, message = code) {
    const e = new Error(message);
    e.code = code;
    return e;
}

function createEphemeraFSMock() {
    const dirs = new Set(['/']);
    const files = new Map();

    function ensureDirSync(path) {
        const normalized = normalizePath(path);
        if (normalized === '/') return;
        const parts = normalized.split('/').filter(Boolean);
        let current = '';
        for (const part of parts) {
            current = normalizePath(`${current}/${part}`);
            dirs.add(current);
        }
    }

    function listChildren(path) {
        const normalized = normalizePath(path);
        const seen = new Map();

        for (const dirPath of dirs) {
            if (dirPath === normalized) continue;
            if (!dirPath.startsWith(`${normalized}/`)) continue;
            const rest = dirPath.slice(normalized.length + 1);
            if (!rest || rest.includes('/')) continue;
            seen.set(dirPath, {
                name: rest,
                path: dirPath,
                type: 'directory'
            });
        }

        for (const [filePath] of files) {
            if (!filePath.startsWith(`${normalized}/`)) continue;
            const rest = filePath.slice(normalized.length + 1);
            if (!rest || rest.includes('/')) continue;
            seen.set(filePath, {
                name: rest,
                path: filePath,
                type: 'file'
            });
        }

        return Array.from(seen.values()).sort((a, b) => a.path.localeCompare(b.path));
    }

    async function permanentDelete(path) {
        const normalized = normalizePath(path);
        for (const filePath of Array.from(files.keys())) {
            if (filePath === normalized || filePath.startsWith(`${normalized}/`)) {
                files.delete(filePath);
            }
        }
        for (const dirPath of Array.from(dirs.values())) {
            if (dirPath !== '/' && (dirPath === normalized || dirPath.startsWith(`${normalized}/`))) {
                dirs.delete(dirPath);
            }
        }
    }

    return {
        homeDir: '/home/testuser',
        normalizePath,
        getExtension: ext,
        isTextFile(path) {
            return ['txt', 'md', 'js', 'json', 'css', 'html', 'yml', 'yaml'].includes(ext(path));
        },
        async ensureDir(path) {
            ensureDirSync(path);
        },
        async exists(path) {
            const normalized = normalizePath(path);
            return dirs.has(normalized) || files.has(normalized);
        },
        async readdir(path) {
            const normalized = normalizePath(path);
            if (!dirs.has(normalized)) return [];
            return listChildren(normalized);
        },
        async readFile(path) {
            const normalized = normalizePath(path);
            return files.has(normalized) ? files.get(normalized) : null;
        },
        async writeFile(path, content) {
            const normalized = normalizePath(path);
            ensureDirSync(parentDir(normalized));
            files.set(normalized, content);
            return { path: normalized, type: 'file' };
        },
        async permanentDelete(path) {
            await permanentDelete(path);
        },
        async delete(path) {
            await permanentDelete(path);
            return true;
        },
        _files: files,
        _dirs: dirs
    };
}

function createMemoryFs() {
    const dirs = new Set(['/']);
    const files = new Map();

    function ensureDirSync(path) {
        const normalized = normalizePath(path);
        if (normalized === '/') return;
        const parts = normalized.split('/').filter(Boolean);
        let current = '';
        for (const part of parts) {
            current = normalizePath(`${current}/${part}`);
            dirs.add(current);
        }
    }

    function toStored(content) {
        if (typeof content === 'string') return content;
        if (content instanceof Uint8Array) return new Uint8Array(content);
        if (content instanceof ArrayBuffer) return new Uint8Array(content);
        if (ArrayBuffer.isView(content)) {
            return new Uint8Array(content.buffer, content.byteOffset, content.byteLength);
        }
        return String(content ?? '');
    }

    return {
        async mkdir(path) {
            ensureDirSync(path);
        },
        async stat(path) {
            const normalized = normalizePath(path);
            if (dirs.has(normalized)) {
                return { isDirectory: () => true, isFile: () => false, type: 'directory' };
            }
            if (files.has(normalized)) {
                return { isDirectory: () => false, isFile: () => true, type: 'file' };
            }
            throw err('ENOENT');
        },
        async lstat(path) {
            return this.stat(path);
        },
        async readdir(path) {
            const normalized = normalizePath(path);
            if (!dirs.has(normalized)) throw err('ENOENT');
            const names = new Set();
            for (const dirPath of dirs) {
                if (dirPath === normalized) continue;
                if (!dirPath.startsWith(`${normalized}/`)) continue;
                const rest = dirPath.slice(normalized.length + 1);
                if (!rest || rest.includes('/')) continue;
                names.add(rest);
            }
            for (const filePath of files.keys()) {
                if (!filePath.startsWith(`${normalized}/`)) continue;
                const rest = filePath.slice(normalized.length + 1);
                if (!rest || rest.includes('/')) continue;
                names.add(rest);
            }
            return Array.from(names.values());
        },
        async writeFile(path, content) {
            const normalized = normalizePath(path);
            ensureDirSync(parentDir(normalized));
            files.set(normalized, toStored(content));
        },
        async readFile(path) {
            const normalized = normalizePath(path);
            if (!files.has(normalized)) throw err('ENOENT');
            return files.get(normalized);
        },
        async unlink(path) {
            const normalized = normalizePath(path);
            if (!files.has(normalized)) throw err('ENOENT');
            files.delete(normalized);
        },
        async rmdir(path) {
            const normalized = normalizePath(path);
            for (const dirPath of dirs) {
                if (dirPath !== normalized && dirPath.startsWith(`${normalized}/`)) {
                    throw err('ENOTEMPTY');
                }
            }
            for (const filePath of files.keys()) {
                if (filePath.startsWith(`${normalized}/`)) {
                    throw err('ENOTEMPTY');
                }
            }
            dirs.delete(normalized);
        },
        _dirs: dirs,
        _files: files
    };
}

class FakeLightningFS {
    constructor() {
        this.promises = createMemoryFs();
    }
}

function createGitMock() {
    const statusRows = [];
    const branches = ['main'];
    let currentBranch = 'main';
    const readBlobMap = new Map();
    const commitLog = [];
    const configMap = new Map([
        ['remote.origin.url', 'https://github.com/example/repo.git']
    ]);
    let oidCounter = 1;

    return {
        statusRows,
        readBlobMap,
        configMap,
        init: vi.fn(async ({ fs, dir }) => {
            await fs.promises.mkdir(`${dir}/.git`);
        }),
        clone: vi.fn(async ({ fs, dir }) => {
            await fs.promises.mkdir(`${dir}/.git`);
        }),
        pull: vi.fn(async () => ({ ok: true })),
        push: vi.fn(async () => ({ ok: true })),
        fetch: vi.fn(async () => ({ ok: true })),
        statusMatrix: vi.fn(async () => statusRows.slice()),
        add: vi.fn(async () => {}),
        remove: vi.fn(async () => {}),
        resetIndex: vi.fn(async () => {}),
        commit: vi.fn(async ({ message }) => {
            const oid = `oid-${oidCounter++}`;
            commitLog.unshift({
                oid,
                commit: {
                    message,
                    author: { name: 'Test', timestamp: Math.floor(Date.now() / 1000) }
                }
            });
            return oid;
        }),
        log: vi.fn(async () => commitLog.slice()),
        currentBranch: vi.fn(async () => currentBranch),
        listBranches: vi.fn(async () => branches.slice()),
        branch: vi.fn(async ({ ref, checkout }) => {
            if (!branches.includes(ref)) branches.push(ref);
            if (checkout) currentBranch = ref;
            return ref;
        }),
        deleteBranch: vi.fn(async ({ ref }) => {
            const idx = branches.indexOf(ref);
            if (idx >= 0) branches.splice(idx, 1);
            return true;
        }),
        checkout: vi.fn(async ({ ref }) => {
            if (ref) currentBranch = ref;
            return true;
        }),
        merge: vi.fn(async () => ({ oid: 'merge-oid' })),
        setConfig: vi.fn(async ({ path, value }) => {
            if (path) configMap.set(path, value);
            return true;
        }),
        getConfig: vi.fn(async ({ path }) => configMap.get(path)),
        resolveRef: vi.fn(async () => 'head-oid'),
        readBlob: vi.fn(async ({ filepath }) => ({
            blob: readBlobMap.get(filepath) || new Uint8Array()
        }))
    };
}

describe('EphemeraGit', () => {
    let fsMock;
    let gitMock;

    beforeEach(() => {
        eventsMock._reset();
        fsMock = createEphemeraFSMock();
        gitMock = createGitMock();

        window.EphemeraFS = fsMock;
        window.EphemeraState.user = {
            id: 'tester',
            name: 'Test User',
            homeDir: '/home/testuser'
        };
        window.EphemeraOAuth = null;

        EphemeraGit._resetForTests();
        EphemeraGit._setAdaptersForTests({
            git: gitMock,
            fsCtor: FakeLightningFS,
            fsName: 'git-test-fs'
        });
    });

    it('initializes repo and bridges EphemeraFS files into git FS', async () => {
        await fsMock.ensureDir('/home/testuser/repo');
        await fsMock.writeFile('/home/testuser/repo/readme.txt', 'hello repo');

        const result = await EphemeraGit.initRepo('/home/testuser/repo');
        const repo = EphemeraGit._repoForPath('/home/testuser/repo');
        const stored = await EphemeraGit._fs.readFile(`${repo.dir}/readme.txt`);

        expect(result.initialized).toBe(true);
        expect(gitMock.init).toHaveBeenCalledTimes(1);
        expect(String(stored)).toContain('hello repo');
    });

    it('clones a repository URL into EphemeraFS path', async () => {
        const repoPath = '/home/testuser/Documents/demo-clone';
        const url = 'https://github.com/example/demo.git';

        const result = await EphemeraGit.clone(url, repoPath);
        const info = await EphemeraGit.getRepoInfo(repoPath);

        expect(result.repoPath).toBe(repoPath);
        expect(gitMock.clone).toHaveBeenCalledTimes(1);
        expect(gitMock.clone).toHaveBeenCalledWith(expect.objectContaining({
            url,
            dir: expect.any(String)
        }));
        expect(info.isRepo).toBe(true);
        expect(eventsMock.emit).toHaveBeenCalledWith('git:changed', expect.objectContaining({
            action: 'clone',
            repoPath
        }));
    });

    it('uses OAuth credentials for GitHub remotes when explicit auth is not provided', async () => {
        window.EphemeraOAuth = {
            getGitAuthForUrl: vi.fn(async (remoteUrl) => {
                if (!/github\.com/i.test(remoteUrl)) return null;
                return { username: 'x-access-token', password: 'gho_test_token' };
            })
        };

        const clonePath = '/home/testuser/Documents/oauth-clone';
        await EphemeraGit.clone('https://github.com/example/private.git', clonePath);
        expect(window.EphemeraOAuth.getGitAuthForUrl).toHaveBeenCalledWith('https://github.com/example/private.git');

        const cloneCall = gitMock.clone.mock.calls[0][0];
        expect(typeof cloneCall.onAuth).toBe('function');
        expect(cloneCall.onAuth()).toEqual({
            username: 'x-access-token',
            password: 'gho_test_token'
        });

        await fsMock.ensureDir('/home/testuser/repo');
        await fsMock.writeFile('/home/testuser/repo/file.txt', 'oauth');
        await EphemeraGit.initRepo('/home/testuser/repo');
        gitMock.configMap.set('remote.origin.url', 'https://github.com/example/repo.git');

        await EphemeraGit.push('/home/testuser/repo');
        expect(window.EphemeraOAuth.getGitAuthForUrl).toHaveBeenCalledWith('https://github.com/example/repo.git');

        const pushCall = gitMock.push.mock.calls[0][0];
        expect(typeof pushCall.onAuth).toBe('function');
        expect(pushCall.onAuth()).toEqual({
            username: 'x-access-token',
            password: 'gho_test_token'
        });
    });

    it('stages modified and deleted files via stageAll', async () => {
        await fsMock.ensureDir('/home/testuser/repo');
        await fsMock.writeFile('/home/testuser/repo/file.txt', 'x');
        await EphemeraGit.initRepo('/home/testuser/repo');

        gitMock.statusRows.splice(0, gitMock.statusRows.length,
            ['modified.txt', 1, 2, 1],
            ['deleted.txt', 1, 0, 1],
            ['clean.txt', 1, 1, 1]
        );

        const result = await EphemeraGit.stageAll('/home/testuser/repo');

        expect(result.staged).toBe(2);
        expect(gitMock.add).toHaveBeenCalledWith(expect.objectContaining({ filepath: 'modified.txt' }));
        expect(gitMock.remove).toHaveBeenCalledWith(expect.objectContaining({ filepath: 'deleted.txt', cached: true }));
    });

    it('returns structured working-tree diff output', async () => {
        await fsMock.ensureDir('/home/testuser/repo');
        await fsMock.writeFile('/home/testuser/repo/a.txt', 'line1\nline2-new\n');
        await EphemeraGit.initRepo('/home/testuser/repo');

        gitMock.statusRows.splice(0, gitMock.statusRows.length, ['a.txt', 1, 2, 1]);
        gitMock.readBlobMap.set('a.txt', new TextEncoder().encode('line1\nline2-old\n'));

        const diff = await EphemeraGit.diff('/home/testuser/repo');

        expect(diff).toHaveLength(1);
        expect(diff[0].filepath).toBe('a.txt');
        expect(diff[0].binary).toBe(false);
        expect(diff[0].summary.addedLines).toBeGreaterThanOrEqual(1);
        expect(diff[0].summary.removedLines).toBeGreaterThanOrEqual(1);
    });

    it('supports stash save/list/pop lifecycle', async () => {
        await fsMock.ensureDir('/home/testuser/repo');
        await fsMock.writeFile('/home/testuser/repo/app.js', 'console.log("one");');
        await EphemeraGit.initRepo('/home/testuser/repo');

        gitMock.statusRows.splice(0, gitMock.statusRows.length, ['app.js', 1, 2, 1]);

        const saved = await EphemeraGit.stashSave('/home/testuser/repo', { message: 'WIP test' });
        const listAfterSave = await EphemeraGit.stashList('/home/testuser/repo');
        const popped = await EphemeraGit.stashPop('/home/testuser/repo');
        const listAfterPop = await EphemeraGit.stashList('/home/testuser/repo');

        expect(saved.id).toBeTruthy();
        expect(listAfterSave).toHaveLength(1);
        expect(popped.id).toBe(saved.id);
        expect(listAfterPop).toHaveLength(0);
    });

    it('returns empty log for a newly initialized repository with no commits', async () => {
        const repoPath = '/home/testuser/repo';
        await fsMock.ensureDir(repoPath);
        await EphemeraGit.initRepo(repoPath);

        const notFound = new Error('Could not find refs/heads/main.');
        notFound.code = 'NotFoundError';
        gitMock.log.mockImplementationOnce(async () => {
            throw notFound;
        });

        const result = await EphemeraGit.getLog(repoPath);
        expect(result).toEqual([]);
    });

    it('preserves getLog missing-ref errors when an explicit ref is requested', async () => {
        const repoPath = '/home/testuser/repo';
        await fsMock.ensureDir(repoPath);
        await EphemeraGit.initRepo(repoPath);

        const notFound = new Error('Could not find refs/heads/main.');
        notFound.code = 'NotFoundError';
        gitMock.log.mockImplementationOnce(async () => {
            throw notFound;
        });

        await expect(EphemeraGit.getLog(repoPath, { ref: 'main' })).rejects.toThrow('Could not find refs/heads/main.');
    });
});
