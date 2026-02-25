EphemeraApps.register({
    id: 'pomodoro',
    name: 'Pomodoro Timer',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    width: 380,
    height: 500,
    category: 'productivity',
    singleton: true,
    content: (windowId) => {
        return {
            html: `
                <style>
                    .pomo-container { display:flex;flex-direction:column;height:100%;background:linear-gradient(135deg,rgba(0,0,0,0.3),rgba(0,0,0,0.1)); }
                    .pomo-header { text-align:center;padding:20px; }
                    .pomo-header h2 { margin:0;font-size:1.1rem;color:var(--fg-primary); }
                    .pomo-tabs { display:flex;justify-content:center;gap:8px;margin-bottom:20px; }
                    .pomo-tab { padding:8px 16px;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--fg-muted);border-radius:var(--radius-lg);cursor:pointer;font-family:inherit;font-size:0.8rem;transition:all 0.2s; }
                    .pomo-tab:hover { color:var(--fg-primary); }
                    .pomo-tab.active { background:var(--accent);color:#fff;border-color:var(--accent); }
                    .pomo-timer-display { text-align:center;padding:20px; }
                    .pomo-time { font-size:4.5rem;font-weight:700;color:var(--fg-primary);font-family:'JetBrains Mono',monospace;letter-spacing:-2px; }
                    .pomo-time.break { color:var(--accent); }
                    .pomo-label { font-size:0.9rem;color:var(--fg-muted);margin-top:8px;text-transform:uppercase;letter-spacing:2px; }
                    .pomo-controls { display:flex;justify-content:center;gap:12px;padding:20px; }
                    .pomo-btn { padding:14px 28px;border-radius:var(--radius-lg);cursor:pointer;font-family:inherit;font-size:1rem;font-weight:500;transition:all 0.2s;border:none; }
                    .pomo-btn-primary { background:var(--accent);color:#fff; }
                    .pomo-btn-primary:hover { filter:brightness(1.1); }
                    .pomo-btn-secondary { background:var(--bg-tertiary);color:var(--fg-secondary);border:1px solid var(--border); }
                    .pomo-btn-secondary:hover { color:var(--fg-primary); }
                    .pomo-progress { width:200px;height:4px;background:var(--bg-tertiary);border-radius:2px;margin:0 auto 20px;overflow:hidden; }
                    .pomo-progress-bar { height:100%;background:var(--accent);border-radius:2px;transition:width 1s linear; }
                    .pomo-stats { padding:20px;background:var(--bg-secondary);border-top:1px solid var(--border); }
                    .pomo-stats-title { font-size:0.8rem;color:var(--fg-muted);margin-bottom:12px;text-align:center;text-transform:uppercase;letter-spacing:1px; }
                    .pomo-stats-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:12px;text-align:center; }
                    .pomo-stat-value { font-size:1.5rem;font-weight:600;color:var(--fg-primary); }
                    .pomo-stat-label { font-size:0.7rem;color:var(--fg-muted);margin-top:4px; }
                    .pomo-settings { padding:16px;border-top:1px solid var(--border); }
                    .pomo-setting-row { display:flex;justify-content:space-between;align-items:center;padding:8px 0; }
                    .pomo-setting-label { color:var(--fg-secondary);font-size:0.85rem; }
                    .pomo-setting-input { width:60px;padding:6px 10px;background:var(--bg-primary);border:1px solid var(--border);color:var(--fg-primary);border-radius:var(--radius-sm);text-align:center;font-family:inherit;font-size:0.85rem; }
                    .pomo-setting-input:focus { outline:none;border-color:var(--accent); }
                    .pomo-sessions-dots { display:flex;justify-content:center;gap:8px;margin-top:16px; }
                    .pomo-dot { width:12px;height:12px;border-radius:50%;background:var(--bg-tertiary);border:1px solid var(--border); }
                    .pomo-dot.completed { background:var(--accent);border-color:var(--accent); }
                </style>
                <div class="pomo-container">
                    <div class="pomo-header">
                        <h2>Pomodoro Timer</h2>
                    </div>
                    <div class="pomo-tabs">
                        <button class="pomo-tab active" data-mode="work">Focus</button>
                        <button class="pomo-tab" data-mode="short">Short Break</button>
                        <button class="pomo-tab" data-mode="long">Long Break</button>
                    </div>
                    <div class="pomo-timer-display">
                        <div class="pomo-time" id="pomo-time-${windowId}">25:00</div>
                        <div class="pomo-label" id="pomo-label-${windowId}">Focus Time</div>
                    </div>
                    <div class="pomo-progress">
                        <div class="pomo-progress-bar" id="pomo-progress-${windowId}" style="width:100%"></div>
                    </div>
                    <div class="pomo-sessions-dots" id="pomo-dots-${windowId}">
                        <div class="pomo-dot"></div>
                        <div class="pomo-dot"></div>
                        <div class="pomo-dot"></div>
                        <div class="pomo-dot"></div>
                    </div>
                    <div class="pomo-controls">
                        <button class="pomo-btn pomo-btn-primary" id="pomo-start-${windowId}">Start</button>
                        <button class="pomo-btn pomo-btn-secondary" id="pomo-reset-${windowId}">Reset</button>
                    </div>
                    <div class="pomo-stats">
                        <div class="pomo-stats-title">Today's Progress</div>
                        <div class="pomo-stats-grid">
                            <div>
                                <div class="pomo-stat-value" id="pomo-sessions-${windowId}">0</div>
                                <div class="pomo-stat-label">Sessions</div>
                            </div>
                            <div>
                                <div class="pomo-stat-value" id="pomo-focus-time-${windowId}">0</div>
                                <div class="pomo-stat-label">Focus mins</div>
                            </div>
                            <div>
                                <div class="pomo-stat-value" id="pomo-streak-${windowId}">0</div>
                                <div class="pomo-stat-label">Day Streak</div>
                            </div>
                        </div>
                    </div>
                    <div class="pomo-settings">
                        <div class="pomo-setting-row">
                            <span class="pomo-setting-label">Focus Duration</span>
                            <input type="number" class="pomo-setting-input" id="pomo-work-${windowId}" value="25" min="1" max="60">
                        </div>
                        <div class="pomo-setting-row">
                            <span class="pomo-setting-label">Short Break</span>
                            <input type="number" class="pomo-setting-input" id="pomo-short-${windowId}" value="5" min="1" max="30">
                        </div>
                        <div class="pomo-setting-row">
                            <span class="pomo-setting-label">Long Break</span>
                            <input type="number" class="pomo-setting-input" id="pomo-long-${windowId}" value="15" min="1" max="60">
                        </div>
                    </div>
                </div>
            `,
            init: async () => {
                const lifecycle = createAppLifecycle();

                const timeEl = document.getElementById(`pomo-time-${windowId}`);
                const labelEl = document.getElementById(`pomo-label-${windowId}`);
                const progressEl = document.getElementById(`pomo-progress-${windowId}`);
                const startBtn = document.getElementById(`pomo-start-${windowId}`);
                const resetBtn = document.getElementById(`pomo-reset-${windowId}`);
                const sessionsEl = document.getElementById(`pomo-sessions-${windowId}`);
                const focusTimeEl = document.getElementById(`pomo-focus-time-${windowId}`);
                const streakEl = document.getElementById(`pomo-streak-${windowId}`);
                const dotsEl = document.getElementById(`pomo-dots-${windowId}`);
                const tabs = document.querySelectorAll('.pomo-tab');
                const workInput = document.getElementById(`pomo-work-${windowId}`);
                const shortInput = document.getElementById(`pomo-short-${windowId}`);
                const longInput = document.getElementById(`pomo-long-${windowId}`);

                const STORAGE_KEY = 'ephemera_pomodoro_stats';
                const MODES = {
                    work: { label: 'Focus Time', time: () => parseInt(workInput.value) * 60, isBreak: false },
                    short: { label: 'Short Break', time: () => parseInt(shortInput.value) * 60, isBreak: true },
                    long: { label: 'Long Break', time: () => parseInt(longInput.value) * 60, isBreak: true }
                };

                let currentMode = 'work';
                let timeLeft = MODES.work.time();
                let totalTime = timeLeft;
                let isRunning = false;
                let interval = null;
                let stats = { sessions: 0, focusMinutes: 0, streak: 0, completedToday: 0, lastDate: null };

                async function loadStats() {
                    const stored = await EphemeraStorage.get('metadata', STORAGE_KEY);
                    if (stored) {
                        stats = stored;
                        const today = new Date().toDateString();
                        if (stats.lastDate !== today) {
                            stats.completedToday = 0;
                            stats.lastDate = today;
                            if (stats.sessions > 0) {
                                const last = new Date(stats.lastDate);
                                const diff = Math.floor((new Date() - last) / (1000 * 60 * 60 * 24));
                                if (diff > 1) stats.streak = 0;
                            }
                        }
                    }
                    updateStats();
                }

                async function saveStats() {
                    await EphemeraStorage.put('metadata', { key: STORAGE_KEY, ...stats });
                }

                function updateStats() {
                    sessionsEl.textContent = stats.sessions;
                    focusTimeEl.textContent = stats.focusMinutes;
                    streakEl.textContent = stats.streak;
                    updateDots();
                }

                function updateDots() {
                    const dots = dotsEl.querySelectorAll('.pomo-dot');
                    dots.forEach((dot, i) => {
                        dot.classList.toggle('completed', i < stats.completedToday);
                    });
                }

                function formatTime(seconds) {
                    const m = Math.floor(seconds / 60);
                    const s = seconds % 60;
                    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                }

                function updateDisplay() {
                    timeEl.textContent = formatTime(timeLeft);
                    timeEl.classList.toggle('break', MODES[currentMode].isBreak);
                    labelEl.textContent = MODES[currentMode].label;
                    
                    const progress = ((totalTime - timeLeft) / totalTime) * 100;
                    progressEl.style.width = progress + '%';
                    
                    startBtn.textContent = isRunning ? 'Pause' : (timeLeft < totalTime ? 'Resume' : 'Start');
                }

                async function setMode(mode) {
                    if (isRunning) {
                        const confirmed = await window.EphemeraDialog?.confirm?.(
                            'Timer is running. Switch mode?',
                            'Switch Mode'
                        );
                        if (!confirmed) return;
                        stopTimer();
                    }
                    currentMode = mode;
                    timeLeft = MODES[mode].time();
                    totalTime = timeLeft;
                    updateDisplay();
                    
                    tabs.forEach(tab => {
                        tab.classList.toggle('active', tab.dataset.mode === mode);
                    });
                }

                function tick() {
                    if (timeLeft > 0) {
                        timeLeft--;
                        updateDisplay();
                    } else {
                        completeSession();
                    }
                }

                function startTimer() {
                    isRunning = true;
                    interval = lifecycle.addInterval(setInterval(tick, 1000));
                    updateDisplay();
                }

                function stopTimer() {
                    isRunning = false;
                    if (interval) {
                        clearInterval(interval);
                        interval = null;
                    }
                    updateDisplay();
                }

                function resetTimer() {
                    stopTimer();
                    timeLeft = MODES[currentMode].time();
                    totalTime = timeLeft;
                    updateDisplay();
                }

                function completeSession() {
                    stopTimer();
                    
                    if (currentMode === 'work') {
                        stats.sessions++;
                        stats.focusMinutes += parseInt(workInput.value);
                        stats.completedToday++;
                        stats.lastDate = new Date().toDateString();
                        
                        if (stats.completedToday === 4) {
                            stats.streak++;
                        }
                        
                        saveStats();
                        updateStats();
                        
                        EphemeraNotifications.success('Pomodoro Complete!', 'Great work! Time for a break.');
                        
                        if (stats.completedToday % 4 === 0) {
                            setMode('long');
                        } else {
                            setMode('short');
                        }
                    } else {
                        EphemeraNotifications.success('Break Over!', 'Ready to focus again?');
                        setMode('work');
                    }
                    
                    if (window.EphemeraSounds) {
                        EphemeraSounds.play('notification');
                    }
                }

                startBtn.addEventListener('click', () => {
                    if (isRunning) {
                        stopTimer();
                    } else {
                        startTimer();
                    }
                });

                resetBtn.addEventListener('click', resetTimer);

                tabs.forEach(tab => {
                    tab.addEventListener('click', async () => {
                        await setMode(tab.dataset.mode);
                    });
                });

                [workInput, shortInput, longInput].forEach(input => {
                    input.addEventListener('change', () => {
                        if (!isRunning) {
                            timeLeft = MODES[currentMode].time();
                            totalTime = timeLeft;
                            updateDisplay();
                        }
                    });
                });

                await loadStats();
                updateDisplay();

                return {
                    destroy: () => {
                        lifecycle.destroy();
                    }
                };
            }
        };
    }
});
