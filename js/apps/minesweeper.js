EphemeraApps.register({
    id: 'minesweeper',
    name: 'Minesweeper',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="currentColor"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>`,
    width: 520,
    height: 640,
    category: 'games',
    content: (windowId) => {
        return {
            html: `
                <style>
                    .ms-container { display:flex;flex-direction:column;height:100%;padding:16px;box-sizing:border-box;position:relative; }
                    
                    /* Theme: Default */
                    .ms-container.theme-default { }
                    .ms-container.theme-default .ms-cell { background:var(--bg-tertiary); }
                    .ms-container.theme-default .ms-cell:hover:not(.revealed):not(.flagged) { background:var(--bg-secondary); }
                    .ms-container.theme-default .ms-cell.revealed { background:var(--bg-primary); }
                    .ms-container.theme-default .ms-cell.revealed.mine { background:rgba(255,77,106,0.3); }
                    .ms-container.theme-default .ms-cell.revealed.mine.exploded { background:var(--danger); }
                    .ms-container.theme-default .ms-cell.flagged { background:rgba(0,212,170,0.15); }
                    .ms-container.theme-default .ms-grid { background:var(--border);border-color:var(--border); }
                    .ms-container.theme-default .ms-num-1 { color:#00a8ff; }
                    .ms-container.theme-default .ms-num-2 { color:#00d4aa; }
                    .ms-container.theme-default .ms-num-3 { color:#ff6b6b; }
                    .ms-container.theme-default .ms-num-4 { color:#9b59b6; }
                    .ms-container.theme-default .ms-num-5 { color:#e67e22; }
                    .ms-container.theme-default .ms-num-6 { color:#1abc9c; }
                    .ms-container.theme-default .ms-num-7 { color:#34495e; }
                    .ms-container.theme-default .ms-num-8 { color:#95a5a6; }
                    
                    /* Theme: Neon */
                    .ms-container.theme-neon { background:linear-gradient(135deg,#0d0d1a 0%,#1a1a2e 100%); }
                    .ms-container.theme-neon .ms-cell { background:#1a1a2e;border:1px solid #2d2d4a; }
                    .ms-container.theme-neon .ms-cell:hover:not(.revealed):not(.flagged) { background:#2d2d4a;box-shadow:0 0 8px rgba(0,255,245,0.3); }
                    .ms-container.theme-neon .ms-cell.revealed { background:#0d0d1a; }
                    .ms-container.theme-neon .ms-cell.revealed.mine { background:rgba(255,0,110,0.3); }
                    .ms-container.theme-neon .ms-cell.revealed.mine.exploded { background:#ff006e;box-shadow:0 0 15px #ff006e; }
                    .ms-container.theme-neon .ms-cell.flagged { background:rgba(0,255,245,0.1);border-color:#00fff5; }
                    .ms-container.theme-neon .ms-cell.flagged::after { filter:drop-shadow(0 0 5px #00fff5); }
                    .ms-container.theme-neon .ms-grid { background:#0d0d1a;border-color:#00fff5;box-shadow:0 0 20px rgba(0,255,245,0.2); }
                    .ms-container.theme-neon .ms-stat { background:rgba(0,255,245,0.1);border-color:#00fff5; }
                    .ms-container.theme-neon .ms-stat-value { color:#00fff5;text-shadow:0 0 10px #00fff5; }
                    .ms-container.theme-neon .ms-num-1 { color:#00fff5;text-shadow:0 0 5px #00fff5; }
                    .ms-container.theme-neon .ms-num-2 { color:#00ff88;text-shadow:0 0 5px #00ff88; }
                    .ms-container.theme-neon .ms-num-3 { color:#ff006e;text-shadow:0 0 5px #ff006e; }
                    .ms-container.theme-neon .ms-num-4 { color:#bf00ff;text-shadow:0 0 5px #bf00ff; }
                    .ms-container.theme-neon .ms-num-5 { color:#ff8800;text-shadow:0 0 5px #ff8800; }
                    .ms-container.theme-neon .ms-num-6 { color:#00ffcc;text-shadow:0 0 5px #00ffcc; }
                    .ms-container.theme-neon .ms-num-7 { color:#ff00ff;text-shadow:0 0 5px #ff00ff; }
                    .ms-container.theme-neon .ms-num-8 { color:#ffffff;text-shadow:0 0 5px #ffffff; }
                    .ms-container.theme-neon .ms-diff-btn.active { background:#00fff5;color:#0d0d1a;box-shadow:0 0 15px rgba(0,255,245,0.5); }
                    .ms-container.theme-neon .ms-diff-btn:hover { border-color:#00fff5; }
                    .ms-container.theme-neon .ms-new-game { background:linear-gradient(135deg,#00fff5,#00ff88);color:#0d0d1a;box-shadow:0 0 20px rgba(0,255,245,0.4); }
                    .ms-container.theme-neon .ms-new-game:hover { box-shadow:0 0 30px rgba(0,255,245,0.6); }
                    
                    /* Theme: Retro */
                    .ms-container.theme-retro { background:#008080; }
                    .ms-container.theme-retro .ms-cell { background:#c0c0c0;border:2px outset #fff;box-shadow:none; }
                    .ms-container.theme-retro .ms-cell:hover:not(.revealed):not(.flagged) { background:#d0d0d0; }
                    .ms-container.theme-retro .ms-cell.revealed { background:#bdbdbd;border:1px solid #808080; }
                    .ms-container.theme-retro .ms-cell.revealed.mine { background:#ff0000; }
                    .ms-container.theme-retro .ms-cell.revealed.mine.exploded { background:#ff0000; }
                    .ms-container.theme-retro .ms-cell.flagged { background:#c0c0c0;border:2px outset #fff; }
                    .ms-container.theme-retro .ms-grid { background:#808080;border:3px inset #808080;padding:2px; }
                    .ms-container.theme-retro .ms-stat { background:#c0c0c0;border:2px inset #808080;color:#000; }
                    .ms-container.theme-retro .ms-stat-value { color:#ff0000;font-family:'Courier New',monospace;text-shadow:none; }
                    .ms-container.theme-retro .ms-stat svg { stroke:#000; }
                    .ms-container.theme-retro .ms-num-1 { color:#0000ff; }
                    .ms-container.theme-retro .ms-num-2 { color:#008000; }
                    .ms-container.theme-retro .ms-num-3 { color:#ff0000; }
                    .ms-container.theme-retro .ms-num-4 { color:#000080; }
                    .ms-container.theme-retro .ms-num-5 { color:#800000; }
                    .ms-container.theme-retro .ms-num-6 { color:#008080; }
                    .ms-container.theme-retro .ms-num-7 { color:#000000; }
                    .ms-container.theme-retro .ms-num-8 { color:#808080; }
                    .ms-container.theme-retro .ms-diff-btn { background:#c0c0c0;border:2px outset #fff;color:#000; }
                    .ms-container.theme-retro .ms-diff-btn:hover { background:#d0d0d0; }
                    .ms-container.theme-retro .ms-diff-btn.active { background:#000080;color:#fff;border:2px inset #808080; }
                    .ms-container.theme-retro .ms-new-game { background:#c0c0c0;border:2px outset #fff;color:#000; }
                    .ms-container.theme-retro .ms-new-game:hover { background:#d0d0d0; }
                    .ms-container.theme-retro .ms-header { background:#c0c0c0;padding:4px 8px;margin:-16px -16px 12px;border-bottom:2px groove #808080; }
                    .ms-container.theme-retro .ms-difficulty { margin-top:8px; }
                    
                    /* Theme: High Contrast */
                    .ms-container.theme-contrast { background:#000; }
                    .ms-container.theme-contrast .ms-cell { background:#000;border:2px solid #fff; }
                    .ms-container.theme-contrast .ms-cell:hover:not(.revealed):not(.flagged) { background:#333;border-color:#0ff; }
                    .ms-container.theme-contrast .ms-cell.revealed { background:#fff;color:#000; }
                    .ms-container.theme-contrast .ms-cell.revealed.mine { background:#ff0; }
                    .ms-container.theme-contrast .ms-cell.revealed.mine.exploded { background:#f00; }
                    .ms-container.theme-contrast .ms-cell.flagged { background:#000;border-color:#0ff; }
                    .ms-container.theme-contrast .ms-grid { background:#fff;border:3px solid #fff; }
                    .ms-container.theme-contrast .ms-stat { background:#000;border:2px solid #fff; }
                    .ms-container.theme-contrast .ms-stat-value { color:#0ff; }
                    .ms-container.theme-contrast .ms-num-1 { color:#00f;font-weight:900; }
                    .ms-container.theme-contrast .ms-num-2 { color:#0f0;font-weight:900; }
                    .ms-container.theme-contrast .ms-num-3 { color:#f00;font-weight:900; }
                    .ms-container.theme-contrast .ms-num-4 { color:#f0f;font-weight:900; }
                    .ms-container.theme-contrast .ms-num-5 { color:#ff0;font-weight:900; }
                    .ms-container.theme-contrast .ms-num-6 { color:#0ff;font-weight:900; }
                    .ms-container.theme-contrast .ms-num-7 { color:#000;font-weight:900; }
                    .ms-container.theme-contrast .ms-num-8 { color:#888;font-weight:900; }
                    .ms-container.theme-contrast .ms-diff-btn { background:#000;border:2px solid #fff;color:#fff; }
                    .ms-container.theme-contrast .ms-diff-btn:hover { border-color:#0ff;color:#0ff; }
                    .ms-container.theme-contrast .ms-diff-btn.active { background:#0ff;color:#000; }
                    .ms-container.theme-contrast .ms-new-game { background:#0ff;color:#000;border:2px solid #0ff; }
                    
                    /* Common Styles */
                    .ms-header { display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:8px;flex-wrap:wrap; }
                    .ms-stat { display:flex;align-items:center;gap:8px;background:var(--bg-tertiary);padding:8px 14px;border-radius:var(--radius-sm);border:1px solid var(--border); }
                    .ms-stat svg { width:18px;height:18px; }
                    .ms-stat-value { font-family:var(--font-mono);font-size:1.1rem;font-weight:600;color:var(--accent);min-width:40px;text-align:center; }
                    .ms-header-actions { display:flex;gap:6px; }
                    .ms-icon-btn { width:36px;height:36px;display:flex;align-items:center;justify-content:center;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;color:var(--fg-secondary);transition:all 0.2s; }
                    .ms-icon-btn:hover { background:var(--bg-secondary);color:var(--fg-primary);border-color:var(--accent); }
                    .ms-icon-btn svg { width:18px;height:18px; }
                    .ms-difficulty { display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap; }
                    .ms-diff-btn { padding:6px 14px;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--fg-secondary);border-radius:var(--radius-sm);cursor:pointer;font-size:0.8rem;transition:all 0.2s; }
                    .ms-diff-btn:hover { background:var(--bg-secondary);color:var(--fg-primary); }
                    .ms-diff-btn.active { background:var(--accent);color:var(--bg-primary);border-color:var(--accent); }
                    .ms-grid-container { flex:1;display:flex;justify-content:center;align-items:center;overflow:auto; }
                    .ms-grid { display:grid;gap:1px;background:var(--border);border:2px solid var(--border);border-radius:var(--radius-sm);padding:1px; }
                    .ms-cell { width:28px;height:28px;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;font-family:var(--font-mono);font-size:0.85rem;font-weight:700;cursor:pointer;user-select:none;transition:background 0.1s;border-radius:2px; }
                    .ms-cell:hover:not(.revealed):not(.flagged) { background:var(--bg-secondary); }
                    .ms-cell.revealed { background:var(--bg-primary);cursor:default; }
                    .ms-cell.revealed.mine { background:rgba(255,77,106,0.3); }
                    .ms-cell.revealed.mine.exploded { background:var(--danger); }
                    .ms-cell.flagged { background:rgba(0,212,170,0.15); }
                    .ms-cell.flagged::after { content:'🚩';font-size:0.9rem; }
                    .ms-cell.mine-icon::after { content:'💣';font-size:0.9rem; }
                    .ms-cell[data-num="1"] { color:#00a8ff; }
                    .ms-cell[data-num="2"] { color:#00d4aa; }
                    .ms-cell[data-num="3"] { color:#ff6b6b; }
                    .ms-cell[data-num="4"] { color:#9b59b6; }
                    .ms-cell[data-num="5"] { color:#e67e22; }
                    .ms-cell[data-num="6"] { color:#1abc9c; }
                    .ms-cell[data-num="7"] { color:#34495e; }
                    .ms-cell[data-num="8"] { color:#95a5a6; }
                    .ms-footer { display:flex;justify-content:center;gap:12px;margin-top:12px;flex-wrap:wrap; }
                    .ms-new-game { padding:10px 28px;background:var(--accent);color:var(--bg-primary);border:none;border-radius:var(--radius-md);cursor:pointer;font-size:0.9rem;font-weight:600;transition:all 0.2s; }
                    .ms-new-game:hover { background:var(--accent-hover);transform:translateY(-1px); }
                    .ms-face { font-size:1.4rem;cursor:pointer;transition:transform 0.2s; }
                    .ms-face:hover { transform:scale(1.2); }
                    
                    /* Overlays */
                    .ms-overlay { position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(10,10,15,0.95);display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:var(--radius-md);z-index:10;padding:20px;box-sizing:border-box; }
                    .ms-overlay.win { background:rgba(0,212,170,0.1); }
                    .ms-overlay.lose { background:rgba(255,77,106,0.1); }
                    .ms-overlay h2 { font-size:1.5rem;margin-bottom:8px; }
                    .ms-overlay.win h2 { color:var(--accent); }
                    .ms-overlay.lose h2 { color:var(--danger); }
                    .ms-overlay p { color:var(--fg-secondary);margin-bottom:8px;text-align:center; }
                    .ms-overlay .new-record { color:#ffd700;font-size:1.1rem;font-weight:600;margin-bottom:12px;display:flex;align-items:center;gap:8px; }
                    .ms-overlay .new-record::before { content:'🏆'; }
                    
                    /* Stats Modal */
                    .ms-stats-modal { max-width:400px;width:100%; }
                    .ms-stats-modal h2 { margin-bottom:16px;display:flex;align-items:center;gap:10px; }
                    .ms-stats-modal h2 svg { width:24px;height:24px;color:var(--accent); }
                    .ms-stats-section { background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px;margin-bottom:16px; }
                    .ms-stats-section h3 { font-size:0.85rem;color:var(--fg-muted);margin-bottom:12px;text-transform:uppercase;letter-spacing:0.5px; }
                    .ms-stats-row { display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border); }
                    .ms-stats-row:last-child { border-bottom:none; }
                    .ms-stats-label { color:var(--fg-secondary); }
                    .ms-stats-value { font-family:var(--font-mono);color:var(--fg-primary);font-weight:600; }
                    .ms-stats-value.highlight { color:var(--accent); }
                    .ms-highscore-table { width:100%;border-collapse:collapse; }
                    .ms-highscore-table th, .ms-highscore-table td { padding:8px 12px;text-align:left;border-bottom:1px solid var(--border); }
                    .ms-highscore-table th { color:var(--fg-muted);font-size:0.75rem;text-transform:uppercase; }
                    .ms-highscore-table td { font-family:var(--font-mono); }
                    .ms-highscore-table tr:last-child td { border-bottom:none; }
                    .ms-close-btn { position:absolute;top:12px;right:12px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;color:var(--fg-secondary); }
                    .ms-close-btn:hover { background:var(--danger);border-color:var(--danger);color:#fff; }
                    
                    /* Theme Selector */
                    .ms-theme-select { padding:6px 10px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--fg-primary);font-size:0.8rem;cursor:pointer; }
                    .ms-theme-select:hover { border-color:var(--accent); }
                </style>
                <div class="ms-container theme-default" id="ms-container-${windowId}">
                    <div class="ms-header">
                        <div class="ms-stat">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></svg>
                            <span class="ms-stat-value" id="ms-mines-${windowId}">10</span>
                        </div>
                        <div class="ms-stat" style="cursor:pointer;" id="ms-face-container-${windowId}">
                            <span class="ms-face" id="ms-face-${windowId}">😊</span>
                        </div>
                        <div class="ms-stat">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            <span class="ms-stat-value" id="ms-time-${windowId}">000</span>
                        </div>
                        <div class="ms-header-actions">
                            <button class="ms-icon-btn" id="ms-stats-btn-${windowId}" title="Statistics">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
                            </button>
                            <select class="ms-theme-select" id="ms-theme-${windowId}" title="Theme">
                                <option value="default">Default</option>
                                <option value="neon">Neon</option>
                                <option value="retro">Retro</option>
                                <option value="contrast">High Contrast</option>
                            </select>
                        </div>
                    </div>
                    <div class="ms-difficulty">
                        <button class="ms-diff-btn active" data-diff="easy">Easy (9×9)</button>
                        <button class="ms-diff-btn" data-diff="medium">Medium (16×16)</button>
                        <button class="ms-diff-btn" data-diff="hard">Hard (16×30)</button>
                    </div>
                    <div class="ms-grid-container">
                        <div class="ms-grid" id="ms-grid-${windowId}"></div>
                    </div>
                    <div class="ms-footer">
                        <button class="ms-new-game" id="ms-new-${windowId}">New Game</button>
                    </div>
                </div>
            `,
            init: () => {
                const lifecycle = createAppLifecycle();

                const container = document.getElementById(`ms-container-${windowId}`);
                const grid = document.getElementById(`ms-grid-${windowId}`);
                const minesEl = document.getElementById(`ms-mines-${windowId}`);
                const timeEl = document.getElementById(`ms-time-${windowId}`);
                const faceEl = document.getElementById(`ms-face-${windowId}`);
                const faceContainer = document.getElementById(`ms-face-container-${windowId}`);
                const newBtn = document.getElementById(`ms-new-${windowId}`);
                const statsBtn = document.getElementById(`ms-stats-btn-${windowId}`);
                const themeSelect = document.getElementById(`ms-theme-${windowId}`);
                const diffBtns = container.querySelectorAll('.ms-diff-btn');

                const DIFFICULTIES = {
                    easy: { rows: 9, cols: 9, mines: 10, name: 'Easy' },
                    medium: { rows: 16, cols: 16, mines: 40, name: 'Medium' },
                    hard: { rows: 16, cols: 30, mines: 99, name: 'Hard' }
                };

                let difficulty = 'easy';
                let board = [];
                let revealed = [];
                let flagged = [];
                let gameOver = false;
                let gameStarted = false;
                let timer = null;
                let seconds = 0;
                let minesLeft = 0;
                let firstClick = true;
                let currentTheme = 'default';
                
                let stats = {
                    gamesPlayed: { easy: 0, medium: 0, hard: 0 },
                    gamesWon: { easy: 0, medium: 0, hard: 0 },
                    totalTime: 0,
                    currentStreak: 0,
                    bestStreak: 0,
                    totalFlags: 0,
                    totalCellsRevealed: 0
                };
                
                let highScores = {
                    easy: null,
                    medium: null,
                    hard: null
                };

                async function loadStats() {
                    try {
                        const savedStats = await EphemeraStorage.get('metadata', 'minesweeper_stats');
                        if (savedStats && savedStats.value) {
                            stats = { ...stats, ...savedStats.value };
                        }
                        const savedScores = await EphemeraStorage.get('metadata', 'minesweeper_highscores');
                        if (savedScores && savedScores.value) {
                            highScores = { ...highScores, ...savedScores.value };
                        }
                        const savedTheme = await EphemeraStorage.get('metadata', 'minesweeper_theme');
                        if (savedTheme && savedTheme.value) {
                            currentTheme = savedTheme.value;
                            themeSelect.value = currentTheme;
                            applyTheme(currentTheme);
                        }
                    } catch (e) {
                        console.warn('[Minesweeper] Could not load stats:', e);
                    }
                }

                async function saveStats() {
                    try {
                        await EphemeraStorage.put('metadata', { key: 'minesweeper_stats', value: stats });
                        await EphemeraStorage.put('metadata', { key: 'minesweeper_highscores', value: highScores });
                    } catch (e) {
                        console.warn('[Minesweeper] Could not save stats:', e);
                    }
                }

                function formatTime(totalSeconds) {
                    if (totalSeconds === null) return '--:--';
                    const mins = Math.floor(totalSeconds / 60);
                    const secs = totalSeconds % 60;
                    return `${mins}:${secs.toString().padStart(2, '0')}`;
                }

                function formatTotalTime(totalSeconds) {
                    const hours = Math.floor(totalSeconds / 3600);
                    const mins = Math.floor((totalSeconds % 3600) / 60);
                    if (hours > 0) {
                        return `${hours}h ${mins}m`;
                    }
                    return `${mins}m`;
                }

                function applyTheme(theme) {
                    container.className = `ms-container theme-${theme}`;
                    currentTheme = theme;
                    EphemeraStorage.put('metadata', { key: 'minesweeper_theme', value: theme }).catch(() => {});
                }

                function showStatsModal() {
                    removeOverlay();
                    const overlay = document.createElement('div');
                    overlay.className = 'ms-overlay';
                    
                    const totalPlayed = stats.gamesPlayed.easy + stats.gamesPlayed.medium + stats.gamesPlayed.hard;
                    const totalWon = stats.gamesWon.easy + stats.gamesWon.medium + stats.gamesWon.hard;
                    const winRate = totalPlayed > 0 ? Math.round((totalWon / totalPlayed) * 100) : 0;
                    
                    overlay.innerHTML = `
                        <button class="ms-close-btn" type="button" aria-label="Close">×</button>
                        <div class="ms-stats-modal">
                            <h2>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
                                Statistics
                            </h2>
                            
                            <div class="ms-stats-section">
                                <h3>🏆 Best Times</h3>
                                <table class="ms-highscore-table">
                                    <thead>
                                        <tr><th>Difficulty</th><th>Time</th></tr>
                                    </thead>
                                    <tbody>
                                        <tr><td>Easy</td><td class="${highScores.easy ? 'highlight' : ''}">${formatTime(highScores.easy)}</td></tr>
                                        <tr><td>Medium</td><td class="${highScores.medium ? 'highlight' : ''}">${formatTime(highScores.medium)}</td></tr>
                                        <tr><td>Hard</td><td class="${highScores.high ? 'highlight' : ''}">${formatTime(highScores.hard)}</td></tr>
                                    </tbody>
                                </table>
                            </div>
                            
                            <div class="ms-stats-section">
                                <h3>📊 Performance</h3>
                                <div class="ms-stats-row">
                                    <span class="ms-stats-label">Games Played</span>
                                    <span class="ms-stats-value">${totalPlayed}</span>
                                </div>
                                <div class="ms-stats-row">
                                    <span class="ms-stats-label">Games Won</span>
                                    <span class="ms-stats-value">${totalWon}</span>
                                </div>
                                <div class="ms-stats-row">
                                    <span class="ms-stats-label">Win Rate</span>
                                    <span class="ms-stats-value ${winRate >= 50 ? 'highlight' : ''}">${winRate}%</span>
                                </div>
                                <div class="ms-stats-row">
                                    <span class="ms-stats-label">Current Streak</span>
                                    <span class="ms-stats-value">${stats.currentStreak}</span>
                                </div>
                                <div class="ms-stats-row">
                                    <span class="ms-stats-label">Best Streak</span>
                                    <span class="ms-stats-value highlight">${stats.bestStreak}</span>
                                </div>
                                <div class="ms-stats-row">
                                    <span class="ms-stats-label">Total Time</span>
                                    <span class="ms-stats-value">${formatTotalTime(stats.totalTime)}</span>
                                </div>
                            </div>
                            
                            <div style="display:flex;gap:10px;justify-content:center;">
                                <button class="ms-new-game ms-overlay-dismiss" type="button">Close</button>
                            </div>
                        </div>
                    `;
                    container.appendChild(overlay);
                    overlay.querySelector('.ms-close-btn')?.addEventListener('click', () => overlay.remove());
                    overlay.querySelector('.ms-overlay-dismiss')?.addEventListener('click', () => overlay.remove());
                }

                function initGame() {
                    const config = DIFFICULTIES[difficulty];
                    board = [];
                    revealed = Array(config.rows).fill(null).map(() => Array(config.cols).fill(false));
                    flagged = Array(config.rows).fill(null).map(() => Array(config.cols).fill(false));
                    gameOver = false;
                    gameStarted = false;
                    firstClick = true;
                    seconds = 0;
                    minesLeft = config.mines;

                    if (timer) clearInterval(timer);
                    timer = null;

                    timeEl.textContent = '000';
                    minesEl.textContent = String(minesLeft).padStart(2, '0');
                    faceEl.textContent = '😊';
                    removeOverlay();

                    grid.style.gridTemplateColumns = `repeat(${config.cols}, 28px)`;
                    grid.innerHTML = '';

                    for (let r = 0; r < config.rows; r++) {
                        board[r] = [];
                        for (let c = 0; c < config.cols; c++) {
                            board[r][c] = { mine: false, adjacent: 0 };
                            const cell = document.createElement('div');
                            cell.className = 'ms-cell';
                            cell.dataset.row = r;
                            cell.dataset.col = c;
                            grid.appendChild(cell);
                        }
                    }
                }

                function placeMines(excludeRow, excludeCol) {
                    const config = DIFFICULTIES[difficulty];
                    let placed = 0;
                    while (placed < config.mines) {
                        const r = Math.floor(Math.random() * config.rows);
                        const c = Math.floor(Math.random() * config.cols);
                        if (board[r][c].mine) continue;
                        if (Math.abs(r - excludeRow) <= 1 && Math.abs(c - excludeCol) <= 1) continue;
                        board[r][c].mine = true;
                        placed++;
                    }

                    for (let r = 0; r < config.rows; r++) {
                        for (let c = 0; c < config.cols; c++) {
                            if (!board[r][c].mine) {
                                board[r][c].adjacent = countAdjacentMines(r, c);
                            }
                        }
                    }
                }

                function countAdjacentMines(row, col) {
                    const config = DIFFICULTIES[difficulty];
                    let count = 0;
                    for (let dr = -1; dr <= 1; dr++) {
                        for (let dc = -1; dc <= 1; dc++) {
                            if (dr === 0 && dc === 0) continue;
                            const nr = row + dr, nc = col + dc;
                            if (nr >= 0 && nr < config.rows && nc >= 0 && nc < config.cols) {
                                if (board[nr][nc].mine) count++;
                            }
                        }
                    }
                    return count;
                }

                function getCell(row, col) {
                    return grid.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                }

                function revealCell(row, col) {
                    const config = DIFFICULTIES[difficulty];
                    if (row < 0 || row >= config.rows || col < 0 || col >= config.cols) return;
                    if (revealed[row][col] || flagged[row][col]) return;

                    revealed[row][col] = true;
                    stats.totalCellsRevealed++;
                    const cell = getCell(row, col);
                    cell.classList.add('revealed');

                    if (board[row][col].mine) {
                        cell.classList.add('mine', 'exploded', 'mine-icon');
                        endGame(false);
                        return;
                    }

                    const adj = board[row][col].adjacent;
                    if (adj > 0) {
                        cell.textContent = adj;
                        cell.dataset.num = adj;
                    } else {
                        for (let dr = -1; dr <= 1; dr++) {
                            for (let dc = -1; dc <= 1; dc++) {
                                if (dr !== 0 || dc !== 0) {
                                    revealCell(row + dr, col + dc);
                                }
                            }
                        }
                    }

                    checkWin();
                }

                function chordReveal(row, col) {
                    const config = DIFFICULTIES[difficulty];
                    let flagCount = 0;
                    for (let dr = -1; dr <= 1; dr++) {
                        for (let dc = -1; dc <= 1; dc++) {
                            const nr = row + dr, nc = col + dc;
                            if (nr >= 0 && nr < config.rows && nc >= 0 && nc < config.cols) {
                                if (flagged[nr][nc]) flagCount++;
                            }
                        }
                    }

                    if (flagCount === board[row][col].adjacent) {
                        for (let dr = -1; dr <= 1; dr++) {
                            for (let dc = -1; dc <= 1; dc++) {
                                const nr = row + dr, nc = col + dc;
                                if (nr >= 0 && nr < config.rows && nc >= 0 && nc < config.cols) {
                                    if (!flagged[nr][nc]) {
                                        revealCell(nr, nc);
                                    }
                                }
                            }
                        }
                    }
                }

                function toggleFlag(row, col) {
                    if (revealed[row][col]) return;

                    const cell = getCell(row, col);
                    const wasFlagged = flagged[row][col];
                    flagged[row][col] = !flagged[row][col];
                    cell.classList.toggle('flagged');
                    minesLeft += flagged[row][col] ? -1 : 1;
                    minesEl.textContent = String(Math.max(0, minesLeft)).padStart(2, '0');
                    
                    if (!wasFlagged) {
                        stats.totalFlags++;
                    }
                }

                function checkWin() {
                    const config = DIFFICULTIES[difficulty];
                    let unrevealed = 0;
                    for (let r = 0; r < config.rows; r++) {
                        for (let c = 0; c < config.cols; c++) {
                            if (!revealed[r][c] && !board[r][c].mine) unrevealed++;
                        }
                    }
                    if (unrevealed === 0) {
                        endGame(true);
                    }
                }

                function endGame(won) {
                    gameOver = true;
                    if (timer) clearInterval(timer);

                    stats.totalTime += seconds;
                    stats.gamesPlayed[difficulty]++;

                    if (won) {
                        stats.gamesWon[difficulty]++;
                        stats.currentStreak++;
                        if (stats.currentStreak > stats.bestStreak) {
                            stats.bestStreak = stats.currentStreak;
                        }
                        
                        const isNewRecord = highScores[difficulty] === null || seconds < highScores[difficulty];
                        if (isNewRecord) {
                            highScores[difficulty] = seconds;
                        }
                        
                        faceEl.textContent = '😎';
                        showWinOverlay(isNewRecord);
                        
                        if (isNewRecord) {
                            EphemeraNotifications.success('New Record!', `You beat your best ${DIFFICULTIES[difficulty].name} time!`);
                        }
                    } else {
                        stats.currentStreak = 0;
                        faceEl.textContent = '😵';
                        revealAllMines();
                        showLoseOverlay();
                    }
                    
                    saveStats();
                }

                function revealAllMines() {
                    const config = DIFFICULTIES[difficulty];
                    for (let r = 0; r < config.rows; r++) {
                        for (let c = 0; c < config.cols; c++) {
                            if (board[r][c].mine) {
                                const cell = getCell(r, c);
                                cell.classList.add('revealed', 'mine', 'mine-icon');
                            }
                        }
                    }
                }

                function showWinOverlay(isNewRecord) {
                    removeOverlay();
                    const overlay = document.createElement('div');
                    overlay.className = 'ms-overlay win';
                    
                    const bestTime = highScores[difficulty];
                    
                    overlay.innerHTML = `
                        <h2>🎉 You Won!</h2>
                        ${isNewRecord ? `<div class="new-record">New Best Time!</div>` : ''}
                        <p>Time: <strong>${formatTime(seconds)}</strong></p>
                        ${bestTime && !isNewRecord ? `<p>Best: ${formatTime(bestTime)}</p>` : ''}
                        <p>Win Streak: <strong>${stats.currentStreak}</strong> 🔥</p>
                        <div style="display:flex;gap:10px;margin-top:16px;">
                            <button class="ms-new-game ms-overlay-dismiss" type="button">Play Again</button>
                        </div>
                    `;
                    container.appendChild(overlay);
                    overlay.querySelector('.ms-overlay-dismiss')?.addEventListener('click', () => overlay.remove());
                }

                function showLoseOverlay() {
                    removeOverlay();
                    const overlay = document.createElement('div');
                    overlay.className = 'ms-overlay lose';
                    
                    overlay.innerHTML = `
                        <h2>💥 Game Over</h2>
                        <p>Time: <strong>${formatTime(seconds)}</strong></p>
                        <p>Streak Lost! Was: ${stats.currentStreak}</p>
                        <div style="display:flex;gap:10px;margin-top:16px;">
                            <button class="ms-new-game ms-overlay-dismiss" type="button">Try Again</button>
                        </div>
                    `;
                    container.appendChild(overlay);
                    overlay.querySelector('.ms-overlay-dismiss')?.addEventListener('click', () => overlay.remove());
                }

                function removeOverlay() {
                    const overlay = container.querySelector('.ms-overlay');
                    if (overlay) overlay.remove();
                }

                function startTimer() {
                    if (timer) return;
                    gameStarted = true;
                    timer = lifecycle.addInterval(setInterval(() => {
                        seconds++;
                        timeEl.textContent = String(Math.min(999, seconds)).padStart(3, '0');
                    }, 1000));
                }

                lifecycle.addListener(grid, 'click', (e) => {
                    const cell = e.target.closest('.ms-cell');
                    if (!cell || gameOver) return;

                    const row = parseInt(cell.dataset.row);
                    const col = parseInt(cell.dataset.col);

                    if (flagged[row][col]) return;

                    if (firstClick) {
                        firstClick = false;
                        placeMines(row, col);
                        startTimer();
                    }

                    if (revealed[row][col] && board[row][col].adjacent > 0) {
                        chordReveal(row, col);
                    } else {
                        revealCell(row, col);
                    }
                });

                lifecycle.addListener(grid, 'contextmenu', (e) => {
                    e.preventDefault();
                    const cell = e.target.closest('.ms-cell');
                    if (!cell || gameOver) return;

                    const row = parseInt(cell.dataset.row);
                    const col = parseInt(cell.dataset.col);

                    if (!gameStarted) {
                        firstClick = false;
                        placeMines(row, col);
                        startTimer();
                    }

                    toggleFlag(row, col);
                });

                lifecycle.addListener(newBtn, 'click', initGame);
                lifecycle.addListener(faceContainer, 'click', initGame);
                lifecycle.addListener(statsBtn, 'click', showStatsModal);

                lifecycle.addListener(themeSelect, 'change', (e) => {
                    applyTheme(e.target.value);
                });

                diffBtns.forEach(btn => {
                    lifecycle.addListener(btn, 'click', () => {
                        diffBtns.forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        difficulty = btn.dataset.diff;
                        initGame();
                    });
                });

                loadStats().then(initGame);

                return { destroy: lifecycle.destroy };
            }
        };
    }
});
