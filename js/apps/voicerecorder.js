EphemeraApps.register({
    id: 'voicerecorder',
    name: 'Voice Recorder',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`,
    width: 450,
    height: 550,
    category: 'media',
    content: (windowId) => {
        return {
            html: `
                <style>
                    .voice-container { display:flex;flex-direction:column;height:100%;background:linear-gradient(135deg,#0a0a12,#1a1a2e); }
                    .voice-header { padding:16px;text-align:center;border-bottom:1px solid var(--border); }
                    .voice-header h2 { margin:0;font-size:1.1rem;color:var(--fg-primary); }
                    .voice-main { flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px; }
                    .voice-visualizer { width:100%;max-width:300px;height:100px;margin-bottom:30px; }
                    .voice-visualizer canvas { width:100%;height:100%; }
                    .voice-timer { font-size:3rem;font-weight:700;color:var(--fg-primary);font-family:'JetBrains Mono',monospace;margin-bottom:30px; }
                    .voice-timer.recording { color:var(--danger);animation:voice-pulse 1s infinite; }
                    @keyframes voice-pulse { 0%,100% { opacity:1; } 50% { opacity:0.6; } }
                    .voice-controls { display:flex;gap:20px;align-items:center; }
                    .voice-btn { width:70px;height:70px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s; }
                    .voice-btn-record { background:var(--danger);color:#fff; }
                    .voice-btn-record:hover { background:#ff6b6b;transform:scale(1.05); }
                    .voice-btn-record.recording { background:var(--danger);animation:voice-record-pulse 1s infinite; }
                    @keyframes voice-record-pulse { 0%,100% { box-shadow:0 0 0 0 rgba(239,68,68,0.4); } 50% { box-shadow:0 0 0 15px rgba(239,68,68,0); } }
                    .voice-btn-stop { background:var(--bg-tertiary);color:var(--fg-secondary);border:2px solid var(--border); }
                    .voice-btn-stop:hover { background:var(--bg-secondary);color:var(--fg-primary); }
                    .voice-btn svg { width:28px;height:28px; }
                    .voice-list { border-top:1px solid var(--border);max-height:200px;overflow-y:auto; }
                    .voice-list-header { padding:10px 16px;font-size:0.8rem;color:var(--fg-muted);background:var(--bg-secondary); }
                    .voice-item { display:flex;align-items:center;padding:12px 16px;border-bottom:1px solid var(--border);cursor:pointer;transition:background 0.15s; }
                    .voice-item:hover { background:var(--bg-secondary); }
                    .voice-item-icon { width:40px;height:40px;background:var(--bg-tertiary);border-radius:50%;display:flex;align-items:center;justify-content:center;margin-right:12px;color:var(--accent); }
                    .voice-item-info { flex:1; }
                    .voice-item-name { color:var(--fg-primary);font-size:0.9rem;margin-bottom:2px; }
                    .voice-item-meta { color:var(--fg-muted);font-size:0.75rem; }
                    .voice-item-actions { display:flex;gap:8px; }
                    .voice-item-actions button { padding:6px 10px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;font-size:0.75rem;color:var(--fg-secondary); }
                    .voice-item-actions button:hover { background:var(--bg-secondary);color:var(--fg-primary); }
                    .voice-player { width:100%;margin-top:10px; }
                    .voice-empty { text-align:center;color:var(--fg-muted);padding:20px;font-size:0.85rem; }
                    .voice-status { font-size:0.85rem;color:var(--fg-muted);margin-top:20px;text-align:center; }
                    .voice-status.recording { color:var(--danger); }
                </style>
                <div class="voice-container">
                    <div class="voice-header">
                        <h2>Voice Recorder</h2>
                    </div>
                    <div class="voice-main">
                        <div class="voice-visualizer">
                            <canvas id="voice-canvas-${windowId}"></canvas>
                        </div>
                        <div class="voice-timer" id="voice-timer-${windowId}">00:00</div>
                        <div class="voice-controls">
                            <button class="voice-btn voice-btn-stop" id="voice-play-${windowId}" style="display:none;">
                                <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            </button>
                            <button class="voice-btn voice-btn-record" id="voice-record-${windowId}">
                                <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6"/></svg>
                            </button>
                            <button class="voice-btn voice-btn-stop" id="voice-stop-${windowId}" style="display:none;">
                                <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12"/></svg>
                            </button>
                        </div>
                        <div class="voice-status" id="voice-status-${windowId}">Click to start recording</div>
                    </div>
                    <div class="voice-list" id="voice-list-${windowId}">
                        <div class="voice-list-header">Recordings</div>
                        <div class="voice-empty" id="voice-empty-${windowId}">No recordings yet</div>
                    </div>
                </div>
            `,
            init: async () => {
                const lifecycle = createAppLifecycle();

                const canvas = document.getElementById(`voice-canvas-${windowId}`);
                const ctx = canvas.getContext('2d');
                const timerEl = document.getElementById(`voice-timer-${windowId}`);
                const recordBtn = document.getElementById(`voice-record-${windowId}`);
                const stopBtn = document.getElementById(`voice-stop-${windowId}`);
                const playBtn = document.getElementById(`voice-play-${windowId}`);
                const statusEl = document.getElementById(`voice-status-${windowId}`);
                const listEl = document.getElementById(`voice-list-${windowId}`);
                const emptyEl = document.getElementById(`voice-empty-${windowId}`);

                canvas.width = canvas.offsetWidth * 2;
                canvas.height = canvas.offsetHeight * 2;

                const STORAGE_KEY = 'ephemera_voice_recordings';
                let recordings = [];
                let mediaRecorder = null;
                let audioChunks = [];
                let stream = null;
                let isRecording = false;
                let startTime = 0;
                let timerInterval = null;
                let analyser = null;
                let animationId = null;
                let currentAudio = null;

                async function loadRecordings() {
                    const stored = await EphemeraStorage.get('metadata', STORAGE_KEY);
                    recordings = stored?.items || [];
                    renderList();
                }

                async function saveRecordings() {
                    await EphemeraStorage.put('metadata', { key: STORAGE_KEY, items: recordings });
                }

                function formatTime(seconds) {
                    const m = Math.floor(seconds / 60);
                    const s = Math.floor(seconds % 60);
                    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                }

                function renderList() {
                    if (recordings.length === 0) {
                        emptyEl.style.display = 'block';
                        return;
                    }
                    emptyEl.style.display = 'none';
                    
                    const itemsHtml = recordings.map(r => `
                        <div class="voice-item" data-id="${r.id}">
                            <div class="voice-item-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            </div>
                            <div class="voice-item-info">
                                <div class="voice-item-name">${r.name}</div>
                                <div class="voice-item-meta">${formatTime(r.duration)} · ${new Date(r.date).toLocaleDateString()}</div>
                            </div>
                            <div class="voice-item-actions">
                                <button data-action="play">▶️</button>
                                <button data-action="download">💾</button>
                                <button data-action="delete">🗑️</button>
                            </div>
                        </div>
                    `).join('');

                    listEl.innerHTML = `<div class="voice-list-header">Recordings</div>${itemsHtml}`;

                    listEl.querySelectorAll('.voice-item').forEach(item => {
                        const id = item.dataset.id;
                        const recording = recordings.find(r => r.id === id);

                        item.querySelectorAll('button').forEach(btn => {
                            btn.addEventListener('click', (e) => {
                                e.stopPropagation();
                                const action = btn.dataset.action;
                                if (action === 'play') playRecording(recording);
                                if (action === 'download') downloadRecording(recording);
                                if (action === 'delete') deleteRecording(id);
                            });
                        });
                    });
                }

                function drawIdle() {
                    ctx.fillStyle = '#1a1a2e';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    
                    const bars = 40;
                    const barWidth = canvas.width / bars;
                    const centerY = canvas.height / 2;
                    
                    for (let i = 0; i < bars; i++) {
                        const height = Math.sin(Date.now() / 500 + i * 0.3) * 5 + 10;
                        ctx.fillStyle = 'rgba(0, 212, 170, 0.3)';
                        ctx.fillRect(i * barWidth + 2, centerY - height, barWidth - 4, height * 2);
                    }
                }

                function visualize() {
                    if (!analyser) return;
                    
                    const bufferLength = analyser.frequencyBinCount;
                    const dataArray = new Uint8Array(bufferLength);
                    analyser.getByteFrequencyData(dataArray);
                    
                    ctx.fillStyle = '#1a1a2e';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    
                    const barWidth = canvas.width / 60;
                    const centerY = canvas.height / 2;
                    
                    for (let i = 0; i < 60; i++) {
                        const value = dataArray[i * 2] || 0;
                        const height = (value / 255) * (canvas.height / 2 - 10);
                        const gradient = ctx.createLinearGradient(0, centerY - height, 0, centerY + height);
                        gradient.addColorStop(0, '#00d4aa');
                        gradient.addColorStop(1, '#0066aa');
                        ctx.fillStyle = gradient;
                        ctx.fillRect(i * barWidth + 2, centerY - height, barWidth - 4, height * 2);
                    }
                    
                    if (isRecording) {
                        animationId = requestAnimationFrame(visualize);
                    }
                }

                async function startRecording() {
                    try {
                        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        mediaRecorder = new MediaRecorder(stream);
                        audioChunks = [];

                        mediaRecorder.ondataavailable = (e) => {
                            audioChunks.push(e.data);
                        };

                        mediaRecorder.onstop = async () => {
                            const blob = new Blob(audioChunks, { type: 'audio/webm' });
                            const reader = new FileReader();
                            reader.onloadend = async () => {
                                const base64 = reader.result;
                                const duration = (Date.now() - startTime) / 1000;
                                const recording = {
                                    id: 'rec_' + Date.now(),
                                    name: `Recording ${recordings.length + 1}`,
                                    data: base64,
                                    duration,
                                    date: Date.now()
                                };
                                recordings.unshift(recording);
                                await saveRecordings();
                                renderList();
                            };
                            reader.readAsDataURL(blob);
                        };

                        const audioContext = new AudioContext();
                        const source = audioContext.createMediaStreamSource(stream);
                        analyser = audioContext.createAnalyser();
                        analyser.fftSize = 256;
                        source.connect(analyser);

                        mediaRecorder.start();
                        isRecording = true;
                        startTime = Date.now();

                        recordBtn.classList.add('recording');
                        stopBtn.style.display = 'flex';
                        playBtn.style.display = 'none';
                        timerEl.classList.add('recording');
                        statusEl.textContent = 'Recording...';
                        statusEl.classList.add('recording');

                        timerInterval = setInterval(() => {
                            timerEl.textContent = formatTime((Date.now() - startTime) / 1000);
                        }, 100);

                        visualize();
                    } catch (err) {
                        EphemeraNotifications.error('Error', 'Could not access microphone');
                        console.error(err);
                    }
                }

                function stopRecording() {
                    if (mediaRecorder && isRecording) {
                        mediaRecorder.stop();
                        stream.getTracks().forEach(track => track.stop());
                        isRecording = false;

                        clearInterval(timerInterval);
                        cancelAnimationFrame(animationId);

                        recordBtn.classList.remove('recording');
                        stopBtn.style.display = 'none';
                        timerEl.classList.remove('recording');
                        timerEl.textContent = '00:00';
                        statusEl.textContent = 'Recording saved';
                        statusEl.classList.remove('recording');

                        drawIdle();
                    }
                }

                function playRecording(recording) {
                    if (currentAudio) {
                        currentAudio.pause();
                        currentAudio = null;
                    }
                    currentAudio = new Audio(recording.data);
                    currentAudio.play();
                    
                    currentAudio.onended = () => {
                        playBtn.style.display = 'none';
                        recordBtn.style.display = 'flex';
                    };

                    statusEl.textContent = `Playing: ${recording.name}`;
                }

                function downloadRecording(recording) {
                    const a = document.createElement('a');
                    a.href = recording.data;
                    a.download = `${recording.name}.webm`;
                    a.click();
                }

                async function deleteRecording(id) {
                    const confirmed = await window.EphemeraDialog?.confirm?.(
                        'Delete this recording?',
                        'Delete Recording',
                        true
                    );
                    if (!confirmed) return;
                    recordings = recordings.filter(r => r.id !== id);
                    await saveRecordings();
                    renderList();
                }

                lifecycle.addListener(recordBtn, 'click', () => {
                    if (isRecording) {
                        stopRecording();
                    } else {
                        startRecording();
                    }
                });

                lifecycle.addListener(stopBtn, 'click', stopRecording);

                drawIdle();
                lifecycle.addInterval(setInterval(drawIdle, 50));

                await loadRecordings();

                return {
                    destroy: () => {
                        if (timerInterval) clearInterval(timerInterval);
                        if (isRecording) stopRecording();
                        if (currentAudio) currentAudio.pause();
                        lifecycle.destroy();
                    }
                };
            }
        };
    }
});
