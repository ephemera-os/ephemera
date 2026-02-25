EphemeraApps.register({
    id: 'musicplayer',
    name: 'Music Player',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
    width: 450,
    height: 400,
    category: 'media',
    content: (windowId) => {
        return {
            html: `
                <style>
                    .mp { display:flex;flex-direction:column;height:100%;gap:12px; }
                    .mp-viz { flex:1;background:rgba(0,0,0,0.3);border-radius:var(--radius-md);overflow:hidden;min-height:100px; }
                    .mp-viz canvas { width:100%;height:100%;display:block; }
                    .mp-info { text-align:center; }
                    .mp-title { font-size:1rem;font-weight:500; }
                    .mp-artist { font-size:0.8rem;color:var(--fg-muted);margin-top:2px; }
                    .mp-progress { display:flex;align-items:center;gap:8px; }
                    .mp-progress .time { font-size:0.7rem;color:var(--fg-muted);min-width:35px; }
                    .mp-progress input[type=range] { flex:1;accent-color:var(--accent); }
                    .mp-controls { display:flex;align-items:center;justify-content:center;gap:16px; }
                    .mp-controls button { width:40px;height:40px;border-radius:50%;background:var(--bg-tertiary);border:1px solid var(--border);cursor:pointer;color:var(--fg-secondary);display:flex;align-items:center;justify-content:center; }
                    .mp-controls button:hover { background:var(--bg-secondary);color:var(--fg-primary); }
                    .mp-controls button.play { width:48px;height:48px;background:var(--accent);color:var(--bg-primary);border-color:var(--accent); }
                    .mp-controls button svg { width:18px;height:18px; }
                    .mp-bottom { display:flex;align-items:center;gap:8px;font-size:0.75rem; }
                    .mp-bottom button { padding:4px 8px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;color:var(--fg-secondary);font-size:0.75rem; }
                    .mp-volume { display:flex;align-items:center;gap:4px;margin-left:auto; }
                    .mp-volume input[type=range] { width:80px;accent-color:var(--accent); }
                    .mp-playlist { max-height:100px;overflow-y:auto;background:rgba(0,0,0,0.2);border-radius:var(--radius-sm);display:none; }
                    .mp-playlist.open { display:block; }
                    .mp-playlist-item { padding:6px 10px;font-size:0.8rem;cursor:pointer;display:flex;justify-content:space-between; }
                    .mp-playlist-item:hover { background:rgba(255,255,255,0.05); }
                    .mp-playlist-item.active { color:var(--accent); }
                </style>
                <div class="mp">
                    <div class="mp-viz"><canvas id="mp-canvas-${windowId}"></canvas></div>
                    <div class="mp-info">
                        <div class="mp-title" id="mp-title-${windowId}">No track loaded</div>
                        <div class="mp-artist" id="mp-artist-${windowId}">Open a file to play</div>
                    </div>
                    <div class="mp-progress">
                        <span class="time" id="mp-cur-${windowId}">0:00</span>
                        <input type="range" id="mp-seek-${windowId}" min="0" max="100" value="0">
                        <span class="time" id="mp-dur-${windowId}">0:00</span>
                    </div>
                    <div class="mp-controls">
                        <button id="mp-prev-${windowId}" title="Previous" aria-label="Previous track"><svg viewBox="0 0 24 24" fill="currentColor"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" stroke-width="2"/></svg></button>
                        <button class="play" id="mp-play-${windowId}" title="Play" aria-label="Play or pause"><svg viewBox="0 0 24 24" fill="currentColor" id="mp-play-icon-${windowId}"><polygon points="5 3 19 12 5 21 5 3"/></svg></button>
                        <button id="mp-next-${windowId}" title="Next" aria-label="Next track"><svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2"/></svg></button>
                    </div>
                    <div class="mp-bottom">
                        <button id="mp-open-${windowId}" aria-label="Open audio file">Open File</button>
                        <button id="mp-playlist-toggle-${windowId}" aria-label="Toggle playlist">Playlist</button>
                        <div class="mp-volume">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14"/></svg>
                            <input type="range" id="mp-vol-${windowId}" min="0" max="100" value="75">
                        </div>
                    </div>
                    <div class="mp-playlist" id="mp-playlist-${windowId}"></div>
                </div>
            `,
            init: () => {
                const lifecycle = createAppLifecycle();

                const canvas = document.getElementById(`mp-canvas-${windowId}`);
                const ctx = canvas.getContext('2d');
                const titleEl = document.getElementById(`mp-title-${windowId}`);
                const artistEl = document.getElementById(`mp-artist-${windowId}`);
                const curEl = document.getElementById(`mp-cur-${windowId}`);
                const durEl = document.getElementById(`mp-dur-${windowId}`);
                const seekEl = document.getElementById(`mp-seek-${windowId}`);
                const volEl = document.getElementById(`mp-vol-${windowId}`);
                const playBtn = document.getElementById(`mp-play-${windowId}`);
                const playIcon = document.getElementById(`mp-play-icon-${windowId}`);
                const playlistEl = document.getElementById(`mp-playlist-${windowId}`);

                let audioCtx, analyser, source, audio = null;
                let isPlaying = false;
                const playlist = [];
                let currentIndex = -1;
                let animId = null;

                function formatTime(s) {
                    if (!s || isNaN(s)) return '0:00';
                    const m = Math.floor(s / 60);
                    const sec = Math.floor(s % 60);
                    return `${m}:${sec.toString().padStart(2, '0')}`;
                }

                function setupAudio() {
                    if (!audioCtx) {
                        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                        analyser = audioCtx.createAnalyser();
                        analyser.fftSize = 128;
                        analyser.connect(audioCtx.destination);
                    }
                }

                async function loadFile(path) {
                    setupAudio();
                    if (audio) { audio.pause(); audio.src = ''; if (source) source.disconnect(); }

                    const content = await EphemeraFS.readFile(path);
                    if (!content) return;

                    const mime = EphemeraFS.getMimeType(path);
                    const blob = typeof content === 'string'
                        ? new Blob([Uint8Array.from(atob(content), c => c.charCodeAt(0))], { type: mime })
                        : new Blob([content], { type: mime });

                    audio = new Audio(URL.createObjectURL(blob));
                    source = audioCtx.createMediaElementSource(audio);
                    source.connect(analyser);
                    audio.volume = volEl.value / 100;

                    titleEl.textContent = EphemeraFS.getBasename(path);
                    artistEl.textContent = path;

                    audio.addEventListener('loadedmetadata', () => {
                        durEl.textContent = formatTime(audio.duration);
                        seekEl.max = Math.floor(audio.duration);
                    });
                    audio.addEventListener('timeupdate', () => {
                        curEl.textContent = formatTime(audio.currentTime);
                        if (!seekEl._dragging) seekEl.value = Math.floor(audio.currentTime);
                    });
                    audio.addEventListener('ended', () => { isPlaying = false; updatePlayIcon(); });

                    play();
                }

                function play() {
                    if (!audio) return;
                    audioCtx.resume();
                    audio.play();
                    isPlaying = true;
                    updatePlayIcon();
                    visualize();
                }

                function pause() {
                    if (!audio) return;
                    audio.pause();
                    isPlaying = false;
                    updatePlayIcon();
                }

                function updatePlayIcon() {
                    playIcon.innerHTML = isPlaying
                        ? '<rect x="6" y="4" width="4" height="16" fill="currentColor"/><rect x="14" y="4" width="4" height="16" fill="currentColor"/>'
                        : '<polygon points="5 3 19 12 5 21 5 3"/>';
                }

                function visualize() {
                    if (animId) cancelAnimationFrame(animId);
                    const bufLen = analyser.frequencyBinCount;
                    const data = new Uint8Array(bufLen);
                    function draw() {
                        canvas.width = canvas.clientWidth;
                        canvas.height = canvas.clientHeight;
                        analyser.getByteFrequencyData(data);
                        const w = canvas.width, h = canvas.height;
                        ctx.clearRect(0, 0, w, h);
                        const barW = (w / bufLen) * 1.5;
                        for (let i = 0; i < bufLen; i++) {
                            const barH = (data[i] / 255) * h;
                            const x = i * barW;
                            const grad = ctx.createLinearGradient(0, h, 0, h - barH);
                            grad.addColorStop(0, 'rgba(0,212,170,0.6)');
                            grad.addColorStop(1, 'rgba(0,168,255,0.3)');
                            ctx.fillStyle = grad;
                            ctx.fillRect(x, h - barH, barW - 1, barH);
                        }
                        if (isPlaying) animId = requestAnimationFrame(draw);
                    }
                    draw();
                }

                lifecycle.addListener(playBtn, 'click', () => { isPlaying ? pause() : play(); });
                lifecycle.addListener(volEl, 'input', () => { if (audio) audio.volume = volEl.value / 100; });
                lifecycle.addListener(seekEl, 'mousedown', () => { seekEl._dragging = true; });
                lifecycle.addListener(seekEl, 'mouseup', () => { seekEl._dragging = false; if (audio) audio.currentTime = seekEl.value; });
                lifecycle.addListener(seekEl, 'input', () => { if (audio && seekEl._dragging) audio.currentTime = seekEl.value; });

                lifecycle.addListener(document.getElementById(`mp-open-${windowId}`), 'click', () => {
                    EphemeraWM.open('files', { mode: 'open', onFileSelect: (path) => loadFile(path), modal: true, parentWindowId: windowId });
                });
                lifecycle.addListener(document.getElementById(`mp-playlist-toggle-${windowId}`), 'click', () => {
                    playlistEl.classList.toggle('open');
                });
                lifecycle.addListener(document.getElementById(`mp-prev-${windowId}`), 'click', () => {
                    if (playlist.length > 0 && currentIndex > 0) loadFile(playlist[--currentIndex]);
                });
                lifecycle.addListener(document.getElementById(`mp-next-${windowId}`), 'click', () => {
                    if (playlist.length > 0 && currentIndex < playlist.length - 1) loadFile(playlist[++currentIndex]);
                });

                return {
                    destroy: () => {
                        // Clean up audio resources
                        if (audio) {
                            audio.pause();
                            audio.src = '';
                            audio = null;
                        }
                        if (animId) {
                            cancelAnimationFrame(animId);
                            animId = null;
                        }
                        if (source) {
                            try { source.disconnect(); } catch (_e) { /* ignore disconnected node */ }
                            source = null;
                        }
                        // Clean up all listeners
                        lifecycle.destroy();
                    }
                };
            }
        };
    }
});
