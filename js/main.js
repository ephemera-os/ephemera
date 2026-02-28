const BOOT_TO_LOGIN_SPAN_KEY = '__ephemeraBootToLoginSpan';
const OPTIONAL_MODULE_IMPORTERS = Object.freeze({
    telemetry: () => import('./core/telemetry.js'),
    git: () => import('./system/git.js'),
    collab: () => import('./system/collab.js')
});
const optionalModulePromises = new Map();

function ensureOptionalModuleLoaded(name) {
    const moduleName = String(name || '').trim();
    const importer = OPTIONAL_MODULE_IMPORTERS[moduleName];
    if (!importer) return Promise.resolve(false);

    if (optionalModulePromises.has(moduleName)) {
        return optionalModulePromises.get(moduleName);
    }

    const promise = importer()
        .then(() => true)
        .catch((error) => {
            optionalModulePromises.delete(moduleName);
            console.warn(`[Ephemera] Failed to load optional module "${moduleName}":`, error);
            return false;
        });

    optionalModulePromises.set(moduleName, promise);
    return promise;
}

function exposeModuleLoader() {
    window.EphemeraModuleLoader = {
        ensureGit: () => ensureOptionalModuleLoaded('git'),
        ensureCollab: () => ensureOptionalModuleLoaded('collab'),
        ensureTelemetry: () => ensureOptionalModuleLoaded('telemetry')
    };
}

function prewarmOptionalModules() {
    const warm = () => {
        ensureOptionalModuleLoaded('git');
        ensureOptionalModuleLoaded('collab');
    };

    if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(() => warm(), { timeout: 3000 });
        return;
    }

    setTimeout(warm, 0);
}

async function initEphemera() {
    initPerformanceMonitoring();
    startBootToLoginMetric();
    exposeModuleLoader();
    prewarmOptionalModules();

    initTelemetry();
    
    initSession();
    
    initServiceWorker();

    if (window.EphemeraPWA) {
        try {
            await window.EphemeraPWA.init();
        } catch (e) {
            console.warn('[Ephemera] Failed to initialize PWA install UX:', e);
        }
    }
    
    if (window.EphemeraNetwork) {
        window.EphemeraNetwork.init();
    }
    
    if (window.EphemeraState) {
        window.EphemeraState.load();
    }

    if (window.EphemeraI18n) {
        window.EphemeraI18n.init();
    }
    
    if (window.EphemeraOAuth) {
        window.EphemeraOAuth.init();
    }

    if (window.EphemeraAIOAuth) {
        window.EphemeraAIOAuth.init();
    }
    
    if (window.EphemeraBoot) {
        await window.EphemeraBoot.start();
    }
    
    console.info('[Ephemera] System initialized successfully');
}

function initServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (import.meta.env?.DEV) {
        // Dev uses an injectManifest source worker in /public that is not runnable as-is.
        // Unregister any prior worker to avoid startup syntax errors/noise while developing.
        navigator.serviceWorker.getRegistrations()
            .then((registrations) => {
                registrations.forEach((registration) => {
                    registration.unregister().catch(() => {});
                });
            })
            .catch(() => {});
        return;
    }

    const baseUrl = import.meta.env?.BASE_URL || '/';
    const swUrl = `${baseUrl}sw.js`;
    let reloadForServiceWorkerUpdate = false;
    let didReloadForServiceWorkerUpdate = false;

    const requestServiceWorkerActivation = (worker) => {
        if (!worker || typeof worker.postMessage !== 'function') return;
        reloadForServiceWorkerUpdate = true;
        worker.postMessage('skipWaiting');
    };

    const notifyUpdateAvailable = (worker) => {
        if (!worker || !navigator.serviceWorker.controller) return;
        console.info('[Ephemera] New version available. Refresh to update.');

        if (window.EphemeraNotifications) {
            EphemeraNotifications.show({
                title: 'Update Available',
                message: 'A new version of Ephemera is ready.',
                type: 'info',
                duration: 0, // Don't auto-dismiss
                actions: [{
                    label: 'Refresh Now',
                    primary: true,
                    onClick: () => requestServiceWorkerActivation(worker)
                }]
            });
        }
    };

    navigator.serviceWorker.register(swUrl, { scope: baseUrl })
        .then((registration) => {
            console.info('[Ephemera] Service Worker registered:', registration.scope);

            // If a worker is already waiting, surface the update prompt now.
            notifyUpdateAvailable(registration.waiting);

            // Handle updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                if (!newWorker) return;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed') {
                        notifyUpdateAvailable(newWorker);
                    }
                });
            });

            // Handle controller change (after skipWaiting)
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (!reloadForServiceWorkerUpdate || didReloadForServiceWorkerUpdate) return;
                didReloadForServiceWorkerUpdate = true;
                window.location.reload();
            });
        })
        .catch((error) => {
            // Only warn in production - dev environments often don't have SW
            if (import.meta.env?.PROD) {
                console.warn('[Ephemera] Service Worker registration failed:', error);
            }
        });
}

async function initTelemetry() {
    const dsn = String(import.meta.env?.VITE_SENTRY_DSN || '').trim();
    if (!dsn) return;

    const loaded = await ensureOptionalModuleLoaded('telemetry');
    if (!loaded || !window.EphemeraTelemetry) return;

    try {
        window.EphemeraTelemetry.init({
            dsn,
            environment: import.meta.env?.VITE_SENTRY_ENVIRONMENT || import.meta.env?.MODE || 'development',
            release: import.meta.env?.VITE_SENTRY_RELEASE || '2.0.0'
        });
    } catch (e) {
        console.warn('[Ephemera] Failed to initialize telemetry:', e);
    }
}

function initPerformanceMonitoring() {
    if (window.EphemeraPerformance) {
        try {
            window.EphemeraPerformance.init();
        } catch (e) {
            console.warn('[Ephemera] Failed to initialize performance monitor:', e);
        }
    }
}

function startBootToLoginMetric() {
    if (!window.EphemeraPerformance?.start) return;
    if (window[BOOT_TO_LOGIN_SPAN_KEY]) return;

    window[BOOT_TO_LOGIN_SPAN_KEY] = window.EphemeraPerformance.start('boot.time_to_login_ms', {
        flow: 'boot',
        target: 'login-screen'
    });
}

function initSession() {
    if (window.EphemeraSession) {
        try {
            window.EphemeraSession.init();
            
            window.EphemeraSession.onLock(() => {
                if (window.EphemeraTelemetry) {
                    window.EphemeraTelemetry.addBreadcrumb({
                        category: 'session',
                        message: 'Session locked',
                        level: 'info'
                    });
                }
            });
            
            window.EphemeraSession.onUnlock(async (user) => {
                if (window.EphemeraTelemetry) {
                    window.EphemeraTelemetry.setUser(user);
                    window.EphemeraTelemetry.addBreadcrumb({
                        category: 'session',
                        message: 'Session unlocked',
                        level: 'info'
                    });
                }

                // Process queued writes that were deferred while session was locked
                if (window.EphemeraStorage?.processQueuedWrites) {
                    await window.EphemeraStorage.processQueuedWrites();
                }
            });
        } catch (e) {
            console.warn('[Ephemera] Failed to initialize session:', e);
        }
    }
}

function handleGlobalError(event, source, lineno, colno, error) {
    console.error('[Ephemera] Global error:', error || event);

    if (window.EphemeraTelemetry) {
        window.EphemeraTelemetry.captureException(error || new Error(String(event)), {
            extra: {
                source,
                lineno,
                colno,
                event: String(event)
            }
        });
    }

    // Show user-facing notification for errors
    if (window.EphemeraNotifications) {
        const message = error?.message || (typeof event === 'string' ? event : 'An unexpected error occurred');
        EphemeraNotifications.error('Error', message);
    }

    return false;
}

function handleUnhandledRejection(event) {
    console.error('[Ephemera] Unhandled promise rejection:', event.reason);

    if (window.EphemeraTelemetry) {
        const error = event.reason instanceof Error
            ? event.reason
            : new Error(String(event.reason));

        window.EphemeraTelemetry.captureException(error, {
            tags: { type: 'unhandledrejection' }
        });
    }

    // Show user-facing notification for unhandled rejections
    if (window.EphemeraNotifications) {
        const message = event.reason?.message || String(event.reason) || 'An unexpected error occurred';
        EphemeraNotifications.error('Error', message);
    }
}

window.onerror = handleGlobalError;
window.onunhandledrejection = handleUnhandledRejection;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEphemera);
} else {
    initEphemera();
}

window.Ephemera = {
    version: '2.0.0',
    initComplete: false
};

window.EphemeraEvents?.on?.('desktop:ready', () => {
    window.Ephemera.initComplete = true;

    // Handle incoming share / view URL parameters.
    const params = new URLSearchParams(window.location.search);
    const receiveCode = params.get('ephemera-receive');
    const receiveSessionToken = params.get('ephemera-session');
    const viewCode = params.get('ephemera-view');
    const gistCode = params.get('ephemera-gist');

    if (receiveCode || viewCode || gistCode) {
        // Clean the URL so refreshing doesn't re-trigger.
        history.replaceState({}, '', window.location.pathname);

        const shareLinks = window.EphemeraShareLinks || null;

        const notifyError = (title, message) => {
            if (window.EphemeraNotifications) {
                EphemeraNotifications.error(title, message);
            }
        };

        const openSharedPayload = async (rawPayload) => {
            if (!window.EphemeraFS || !window.EphemeraWM) {
                throw new Error('Ephemera filesystem is not ready');
            }
            if (!shareLinks) {
                throw new Error('Share links module is not available');
            }

            const payload = shareLinks.normalizePayload(rawPayload);
            const homeDir = EphemeraFS.homeDir || '/home/user';
            const baseDir = `${homeDir}/.tmp-shared`;
            const stamp = Date.now();

            await EphemeraFS.ensureDir(baseDir);

            if (payload.kind === 'directory') {
                const dirName = shareLinks.sanitizeFileName(payload.name || 'shared-folder');
                const dirPath = `${baseDir}/${stamp}-${dirName}`;
                await EphemeraFS.ensureDir(dirPath);

                for (const entry of payload.entries || []) {
                    const rel = shareLinks.sanitizeRelativePath(entry.path || '');
                    if (!rel) continue;
                    const filePath = `${dirPath}/${rel}`;
                    await EphemeraFS.ensureDir(EphemeraFS.getParentDir(filePath));
                    await EphemeraFS.writeFile(filePath, shareLinks.decodeContent(entry), {
                        mimeType: entry.mimeType || 'application/octet-stream'
                    });
                }

                EphemeraWM.open('files', { startPath: dirPath });
                return;
            }

            const fileName = shareLinks.sanitizeFileName(payload.name || 'shared-file');
            const filePath = `${baseDir}/${stamp}-${fileName}`;
            await EphemeraFS.writeFile(filePath, shareLinks.decodeContent(payload), {
                mimeType: payload.mimeType || 'application/octet-stream'
            });

            if (window.EphemeraFileAssoc) {
                EphemeraFileAssoc.openFile(filePath);
            } else {
                EphemeraWM.open('notepad', { filePath });
            }
        };

        const readGistFileContent = async (fileInfo) => {
            if (!fileInfo) return '';
            if (!fileInfo.truncated || !fileInfo.raw_url) {
                return fileInfo.content || '';
            }
            const rawRes = await fetch(fileInfo.raw_url);
            if (!rawRes.ok) {
                throw new Error(`Could not fetch gist file (${rawRes.status})`);
            }
            return rawRes.text();
        };

        const fetchGistPayload = async (gistRef) => {
            const raw = String(gistRef || '').trim();
            if (!raw) throw new Error('Gist id is missing');
            const idMatch = raw.match(/([a-f0-9]{8,})$/i);
            const gistId = idMatch ? idMatch[1] : raw;

            const res = await fetch(`https://api.github.com/gists/${encodeURIComponent(gistId)}`, {
                headers: {
                    'Accept': 'application/vnd.github+json'
                }
            });
            if (!res.ok) throw new Error(`GitHub ${res.status}: ${res.statusText}`);

            const gist = await res.json();
            const files = gist?.files || {};
            const manifest = files['.ephemera-share.json'];

            if (manifest) {
                const text = await readGistFileContent(manifest);
                return JSON.parse(text);
            }

            const firstFile = Object.values(files)[0];
            if (!firstFile) {
                throw new Error('Gist is empty');
            }

            return {
                kind: 'file',
                name: firstFile.filename || 'shared-file.txt',
                mimeType: 'text/plain',
                encoding: 'utf8',
                data: await readGistFileContent(firstFile)
            };
        };

        setTimeout(() => {
            (async () => {
                if (receiveCode) {
                    if (window.EphemeraWM) {
                        EphemeraWM.open('share', {
                            mode: 'receive',
                            offerCode: receiveCode,
                            sessionToken: receiveSessionToken || ''
                        });
                    }
                    return;
                }

                if (viewCode) {
                    if (!shareLinks) throw new Error('Share links module is not available');
                    const payload = shareLinks.decodePayload(viewCode);
                    await openSharedPayload(payload);
                    return;
                }

                if (gistCode) {
                    const payload = await fetchGistPayload(gistCode);
                    await openSharedPayload(payload);
                }
            })().catch((e) => {
                notifyError('Share Link Error', e?.message || 'Unable to open shared link.');
            });
        }, 1000); // Give desktop a moment to fully render before opening windows.
    }
});
