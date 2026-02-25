EphemeraApps.register({
    id: 'videoplayer',
    name: 'Video Player',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/></svg>`,
    width: 900,
    height: 600,
    category: 'media',
    content: (windowId, options = {}) => {
        const startUrl = options?.url || '';
        
        return {
            html: `
                <style>
                    .video-container { display:flex;flex-direction:column;height:100%;background:#000; }
                    .video-header { display:flex;align-items:center;gap:10px;padding:10px 16px;background:rgba(0,0,0,0.8);border-bottom:1px solid var(--border); }
                    .video-header h2 { margin:0;font-size:1rem;color:var(--fg-primary);flex:1; }
                    .video-url-input { flex:1;padding:10px 14px;background:var(--bg-primary);border:1px solid var(--border);color:var(--fg-primary);border-radius:var(--radius-md);font-family:inherit;font-size:0.85rem; }
                    .video-url-input:focus { outline:none;border-color:var(--accent); }
                    .video-header button { padding:10px 16px;background:var(--accent);border:none;color:#fff;border-radius:var(--radius-sm);cursor:pointer;font-family:inherit;font-size:0.85rem;font-weight:500; }
                    .video-header button:hover { filter:brightness(1.1); }
                    .video-header button.secondary { background:var(--bg-tertiary);color:var(--fg-secondary); }
                    .video-tabs { display:flex;gap:4px;padding:8px 16px;background:rgba(0,0,0,0.6); }
                    .video-tab { padding:8px 16px;background:transparent;border:none;color:var(--fg-muted);border-radius:var(--radius-sm);cursor:pointer;font-family:inherit;font-size:0.8rem;transition:all 0.2s; }
                    .video-tab:hover { color:var(--fg-primary);background:rgba(255,255,255,0.05); }
                    .video-tab.active { background:var(--accent);color:#fff; }
                    .video-main { flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px; }
                    .video-player { width:100%;max-width:100%;max-height:100%;border-radius:var(--radius-md); }
                    .video-welcome { text-align:center;color:var(--fg-muted);padding:40px; }
                    .video-welcome h3 { color:var(--fg-secondary);margin-bottom:16px;font-size:1.1rem; }
                    .video-welcome p { margin-bottom:8px;font-size:0.85rem; }
                    .video-sources { display:flex;gap:12px;margin-top:20px;flex-wrap:wrap;justify-content:center; }
                    .video-source { padding:12px 20px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-md);cursor:pointer;font-size:0.85rem;color:var(--fg-secondary);transition:all 0.2s; }
                    .video-source:hover { border-color:var(--accent);color:var(--fg-primary); }
                    .video-source svg { width:20px;height:20px;vertical-align:middle;margin-right:8px; }
                    .youtube-embed { width:100%;aspect-ratio:16/9;max-height:100%;border:none;border-radius:var(--radius-md); }
                    .video-local-input { display:none; }
                    .video-controls { display:flex;align-items:center;gap:10px;padding:12px 16px;background:rgba(0,0,0,0.8);border-top:1px solid var(--border); }
                    .video-controls button { width:36px;height:36px;display:flex;align-items:center;justify-content:center;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:50%;color:var(--fg-secondary);cursor:pointer;transition:all 0.2s; }
                    .video-controls button:hover { background:var(--accent);color:#fff;border-color:var(--accent); }
                    .video-progress { flex:1;height:6px;background:var(--bg-tertiary);border-radius:3px;cursor:pointer;position:relative; }
                    .video-progress-filled { height:100%;background:var(--accent);border-radius:3px;width:0%;transition:width 0.1s; }
                    .video-time { font-size:0.75rem;color:var(--fg-muted);min-width:80px;text-align:center;font-family:'JetBrains Mono',monospace; }
                    .video-volume { display:flex;align-items:center;gap:6px; }
                    .video-volume input { width:60px;accent-color:var(--accent); }
                    .playlist-panel { width:280px;background:rgba(15,15,20,0.95);border-left:1px solid var(--border);display:none;flex-direction:column; }
                    .playlist-panel.open { display:flex; }
                    .playlist-header { padding:12px 16px;border-bottom:1px solid var(--border);font-size:0.85rem;font-weight:500;color:var(--fg-primary); }
                    .playlist-items { flex:1;overflow-y:auto;padding:8px; }
                    .playlist-item { padding:10px 12px;border-radius:var(--radius-sm);cursor:pointer;font-size:0.8rem;color:var(--fg-secondary);margin-bottom:4px;display:flex;align-items:center;gap:10px;transition:all 0.15s; }
                    .playlist-item:hover { background:var(--bg-tertiary);color:var(--fg-primary); }
                    .playlist-item.active { background:rgba(0,212,170,0.15);color:var(--accent); }
                    .playlist-item-thumb { width:60px;height:34px;background:var(--bg-tertiary);border-radius:4px;overflow:hidden; }
                    .playlist-item-info { flex:1;overflow:hidden; }
                    .playlist-item-title { white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
                    .history-list { max-height:200px;overflow-y:auto; }
                    .history-item { padding:8px 12px;cursor:pointer;font-size:0.8rem;color:var(--fg-secondary);border-radius:var(--radius-sm); }
                    .history-item:hover { background:var(--bg-tertiary);color:var(--fg-primary); }
                </style>
                <div class="video-container">
                    <div class="video-header">
                        <input type="text" class="video-url-input" id="video-url-${windowId}" value="${startUrl}" placeholder="Paste YouTube URL or video link...">
                        <button id="video-load-${windowId}">Load</button>
                        <button class="secondary" id="video-file-${windowId}">Open File</button>
                        <input type="file" class="video-local-input" id="video-file-input-${windowId}" accept="video/*">
                    </div>
                    <div class="video-tabs">
                        <button class="video-tab active" data-tab="player">Player</button>
                        <button class="video-tab" data-tab="youtube">YouTube</button>
                        <button class="video-tab" data-tab="history">History</button>
                    </div>
                    <div class="video-main" id="video-main-${windowId}">
                        <div class="video-welcome">
                            <h3>Video Player</h3>
                            <p>Play videos from URLs, YouTube, or local files</p>
                            <div class="video-sources">
                                <div class="video-source" id="src-youtube-${windowId}">
                                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                                    YouTube
                                </div>
                                <div class="video-source" id="src-file-${windowId}">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                                    Local File
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="video-controls" id="video-controls-${windowId}" style="display:none;">
                        <button id="video-play-${windowId}" title="Play/Pause">
                            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        </button>
                        <div class="video-progress" id="video-progress-${windowId}">
                            <div class="video-progress-filled"></div>
                        </div>
                        <span class="video-time" id="video-time-${windowId}">0:00 / 0:00</span>
                        <div class="video-volume">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>
                            <input type="range" id="video-volume-${windowId}" min="0" max="100" value="100">
                        </div>
                        <button id="video-fullscreen-${windowId}" title="Fullscreen">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                        </button>
                    </div>
                </div>
            `,
            init: async () => {
                const lifecycle = createAppLifecycle();

                const mainEl = document.getElementById(`video-main-${windowId}`);
                const urlInput = document.getElementById(`video-url-${windowId}`);
                const loadBtn = document.getElementById(`video-load-${windowId}`);
                const fileBtn = document.getElementById(`video-file-${windowId}`);
                const fileInput = document.getElementById(`video-file-input-${windowId}`);
                const controlsEl = document.getElementById(`video-controls-${windowId}`);
                const playBtn = document.getElementById(`video-play-${windowId}`);
                const progressEl = document.getElementById(`video-progress-${windowId}`);
                const progressFilled = progressEl.querySelector('.video-progress-filled');
                const timeEl = document.getElementById(`video-time-${windowId}`);
                const volumeInput = document.getElementById(`video-volume-${windowId}`);
                const fullscreenBtn = document.getElementById(`video-fullscreen-${windowId}`);
                const tabs = document.querySelectorAll('.video-tab');

                const HISTORY_KEY = 'ephemera_video_history';
                let history = [];
                let videoElement = null;

                async function loadHistory() {
                    const stored = await EphemeraStorage.get('metadata', HISTORY_KEY);
                    history = stored?.items || [];
                }

                async function saveHistory() {
                    await EphemeraStorage.put('metadata', { key: HISTORY_KEY, items: history.slice(0, 50), updated: Date.now() });
                }

                function addToHistory(title, type, url) {
                    const existing = history.findIndex(h => h.url === url);
                    if (existing > -1) history.splice(existing, 1);
                    history.unshift({ title, type, url, timestamp: Date.now() });
                    history = history.slice(0, 50);
                    saveHistory();
                }

                function formatTime(seconds) {
                    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
                    const m = Math.floor(seconds / 60);
                    const s = Math.floor(seconds % 60);
                    return `${m}:${s.toString().padStart(2, '0')}`;
                }

                function extractYouTubeId(url) {
                    const patterns = [
                        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/,
                        /youtube\.com\/shorts\/([^&\s?]+)/
                    ];
                    for (const pattern of patterns) {
                        const match = url.match(pattern);
                        if (match) return match[1];
                    }
                    return null;
                }

                function loadYouTube(videoId) {
                    mainEl.innerHTML = `
                        <iframe 
                            class="youtube-embed" 
                            src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0" 
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                            allowfullscreen>
                        </iframe>
                    `;
                    controlsEl.style.display = 'none';
                    addToHistory(`YouTube: ${videoId}`, 'youtube', `https://youtube.com/watch?v=${videoId}`);
                }

                function loadVideoUrl(url) {
                    const ytId = extractYouTubeId(url);
                    if (ytId) {
                        loadYouTube(ytId);
                        return;
                    }

                    mainEl.innerHTML = `<video class="video-player" id="video-el-${windowId}" controls></video>`;
                    videoElement = document.getElementById(`video-el-${windowId}`);
                    videoElement.src = url;
                    videoElement.play().catch(() => {});
                    
                    videoElement.addEventListener('loadedmetadata', () => {
                        controlsEl.style.display = 'flex';
                        updateTime();
                    });

                    videoElement.addEventListener('timeupdate', () => {
                        const progress = (videoElement.currentTime / videoElement.duration) * 100;
                        progressFilled.style.width = progress + '%';
                        updateTime();
                    });

                    videoElement.addEventListener('ended', () => {
                        playBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
                    });

                    videoElement.addEventListener('play', () => {
                        playBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
                    });

                    videoElement.addEventListener('pause', () => {
                        playBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
                    });

                    const filename = url.split('/').pop() || 'Video';
                    addToHistory(filename, 'url', url);
                }

                function loadLocalFile(file) {
                    const url = URL.createObjectURL(file);
                    mainEl.innerHTML = `<video class="video-player" id="video-el-${windowId}" controls></video>`;
                    videoElement = document.getElementById(`video-el-${windowId}`);
                    videoElement.src = url;
                    videoElement.play().catch(() => {});

                    videoElement.addEventListener('loadedmetadata', () => {
                        controlsEl.style.display = 'flex';
                        updateTime();
                    });

                    videoElement.addEventListener('timeupdate', () => {
                        const progress = (videoElement.currentTime / videoElement.duration) * 100;
                        progressFilled.style.width = progress + '%';
                        updateTime();
                    });

                    addToHistory(file.name, 'local', file.name);
                }

                function updateTime() {
                    if (!videoElement) return;
                    const current = formatTime(videoElement.currentTime);
                    const total = formatTime(videoElement.duration);
                    timeEl.textContent = `${current} / ${total}`;
                }

                function showHistory() {
                    mainEl.innerHTML = `
                        <div class="video-welcome" style="text-align:left;max-width:500px;width:100%;">
                            <h3>Watch History</h3>
                            <div class="history-list">
                                ${history.length === 0 ? '<p style="color:var(--fg-muted);">No videos watched yet</p>' : 
                                    history.map(h => `
                                        <div class="history-item" data-url="${h.url}" data-type="${h.type}">
                                            ${h.type === 'youtube' ? '▶️' : '🎬'} ${h.title}
                                        </div>
                                    `).join('')
                                }
                            </div>
                        </div>
                    `;
                    controlsEl.style.display = 'none';

                    mainEl.querySelectorAll('.history-item').forEach(item => {
                        item.addEventListener('click', () => {
                            if (item.dataset.type === 'youtube') {
                                const ytId = extractYouTubeId(item.dataset.url);
                                if (ytId) loadYouTube(ytId);
                            } else {
                                loadVideoUrl(item.dataset.url);
                            }
                        });
                    });
                }

                function showYouTubeSearch() {
                    mainEl.innerHTML = `
                        <div class="video-welcome">
                            <h3>YouTube Player</h3>
                            <p>Paste a YouTube URL above or enter a video ID</p>
                            <div style="margin-top:20px;">
                                <input type="text" id="yt-id-input-${windowId}" placeholder="Enter YouTube Video ID" style="padding:12px 16px;background:var(--bg-primary);border:1px solid var(--border);color:var(--fg-primary);border-radius:var(--radius-md);width:300px;font-family:inherit;">
                                <button id="yt-load-btn-${windowId}" style="padding:12px 20px;background:var(--accent);border:none;color:#fff;border-radius:var(--radius-sm);cursor:pointer;margin-left:10px;">Load</button>
                            </div>
                        </div>
                    `;
                    controlsEl.style.display = 'none';

                    document.getElementById(`yt-load-btn-${windowId}`).addEventListener('click', () => {
                        const id = document.getElementById(`yt-id-input-${windowId}`).value.trim();
                        if (id) loadYouTube(id);
                    });

                    document.getElementById(`yt-id-input-${windowId}`).addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            const id = e.target.value.trim();
                            if (id) loadYouTube(id);
                        }
                    });
                }

                lifecycle.addListener(loadBtn, 'click', () => {
                    const url = urlInput.value.trim();
                    if (url) loadVideoUrl(url);
                });

                lifecycle.addListener(urlInput, 'keydown', (e) => {
                    if (e.key === 'Enter') {
                        const url = urlInput.value.trim();
                        if (url) loadVideoUrl(url);
                    }
                });

                lifecycle.addListener(fileBtn, 'click', () => fileInput.click());

                const srcYoutube = document.getElementById(`src-youtube-${windowId}`);
                const srcFile = document.getElementById(`src-file-${windowId}`);
                if (srcYoutube) {
                    lifecycle.addListener(srcYoutube, 'click', () => {
                        urlInput.focus();
                        urlInput.placeholder = 'Paste YouTube URL...';
                    });
                }

                if (srcFile) {
                    lifecycle.addListener(srcFile, 'click', () => fileInput.click());
                }

                lifecycle.addListener(fileInput, 'change', (e) => {
                    if (e.target.files[0]) loadLocalFile(e.target.files[0]);
                });

                lifecycle.addListener(playBtn, 'click', () => {
                    if (!videoElement) return;
                    if (videoElement.paused) {
                        videoElement.play();
                    } else {
                        videoElement.pause();
                    }
                });

                lifecycle.addListener(progressEl, 'click', (e) => {
                    if (!videoElement) return;
                    const rect = progressEl.getBoundingClientRect();
                    const percent = (e.clientX - rect.left) / rect.width;
                    videoElement.currentTime = percent * videoElement.duration;
                });

                lifecycle.addListener(volumeInput, 'input', () => {
                    if (videoElement) {
                        videoElement.volume = volumeInput.value / 100;
                    }
                });

                lifecycle.addListener(fullscreenBtn, 'click', () => {
                    if (videoElement) {
                        if (videoElement.requestFullscreen) {
                            videoElement.requestFullscreen();
                        }
                    }
                });

                tabs.forEach(tab => {
                    lifecycle.addListener(tab, 'click', () => {
                        tabs.forEach(t => t.classList.remove('active'));
                        tab.classList.add('active');

                        if (tab.dataset.tab === 'history') {
                            showHistory();
                        } else if (tab.dataset.tab === 'youtube') {
                            showYouTubeSearch();
                        }
                    });
                });

                await loadHistory();

                if (startUrl) {
                    loadVideoUrl(startUrl);
                }

                return {
                    destroy: () => {
                        // Clean up video element and object URLs
                        if (videoElement) {
                            videoElement.pause();
                            videoElement.src = '';
                            videoElement = null;
                        }
                        lifecycle.destroy();
                    }
                };
            }
        };
    }
});
