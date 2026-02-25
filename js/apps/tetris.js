EphemeraApps.register({
    id: 'tetris',
    name: 'Tetris',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="6" height="6"/><rect x="8" y="2" width="6" height="6"/><rect x="8" y="8" width="6" height="6"/><rect x="14" y="8" width="6" height="6"/><rect x="14" y="14" width="6" height="6"/></svg>`,
    width: 400,
    height: 550,
    category: 'game',
    content: (windowId) => {
        return {
            html: `
                <style>
                    .tetris-container { display:flex;flex-direction:column;height:100%;background:linear-gradient(135deg,#0a0a12,#1a1a2e);padding:16px; }
                    .tetris-header { display:flex;justify-content:space-between;align-items:center;margin-bottom:12px; }
                    .tetris-header h2 { margin:0;font-size:1.2rem;color:var(--fg-primary); }
                    .tetris-stats { display:flex;gap:20px; }
                    .tetris-stat { text-align:center; }
                    .tetris-stat-value { font-size:1.5rem;font-weight:700;color:var(--accent);font-family:'JetBrains Mono',monospace; }
                    .tetris-stat-label { font-size:0.7rem;color:var(--fg-muted);text-transform:uppercase; }
                    .tetris-main { display:flex;gap:16px;flex:1; }
                    .tetris-board { display:grid;grid-template-columns:repeat(10,1fr);gap:1px;background:rgba(0,0,0,0.5);padding:4px;border-radius:var(--radius-md);flex:1;aspect-ratio:10/20; }
                    .tetris-cell { background:rgba(30,30,40,0.8);border-radius:2px; }
                    .tetris-cell.I { background:linear-gradient(135deg,#00f5ff,#00b4d8);box-shadow:inset 0 0 10px rgba(255,255,255,0.3); }
                    .tetris-cell.O { background:linear-gradient(135deg,#ffd60a,#ffaa00);box-shadow:inset 0 0 10px rgba(255,255,255,0.3); }
                    .tetris-cell.T { background:linear-gradient(135deg,#b388ff,#7c4dff);box-shadow:inset 0 0 10px rgba(255,255,255,0.3); }
                    .tetris-cell.S { background:linear-gradient(135deg,#69f0ae,#00e676);box-shadow:inset 0 0 10px rgba(255,255,255,0.3); }
                    .tetris-cell.Z { background:linear-gradient(135deg,#ff5252,#d50000);box-shadow:inset 0 0 10px rgba(255,255,255,0.3); }
                    .tetris-cell.J { background:linear-gradient(135deg,#448aff,#2962ff);box-shadow:inset 0 0 10px rgba(255,255,255,0.3); }
                    .tetris-cell.L { background:linear-gradient(135deg,#ffab40,#ff6d00);box-shadow:inset 0 0 10px rgba(255,255,255,0.3); }
                    .tetris-cell.ghost { background:rgba(255,255,255,0.1);border:1px dashed rgba(255,255,255,0.3); }
                    .tetris-side { display:flex;flex-direction:column;gap:12px;width:100px; }
                    .tetris-next { background:rgba(0,0,0,0.3);padding:12px;border-radius:var(--radius-md); }
                    .tetris-next-label { font-size:0.7rem;color:var(--fg-muted);margin-bottom:8px;text-transform:uppercase; }
                    .tetris-next-grid { display:grid;grid-template-columns:repeat(4,1fr);gap:1px;width:60px;margin:0 auto; }
                    .tetris-next-cell { width:14px;height:14px;background:rgba(30,30,40,0.5);border-radius:2px; }
                    .tetris-next-cell.I { background:linear-gradient(135deg,#00f5ff,#00b4d8); }
                    .tetris-next-cell.O { background:linear-gradient(135deg,#ffd60a,#ffaa00); }
                    .tetris-next-cell.T { background:linear-gradient(135deg,#b388ff,#7c4dff); }
                    .tetris-next-cell.S { background:linear-gradient(135deg,#69f0ae,#00e676); }
                    .tetris-next-cell.Z { background:linear-gradient(135deg,#ff5252,#d50000); }
                    .tetris-next-cell.J { background:linear-gradient(135deg,#448aff,#2962ff); }
                    .tetris-next-cell.L { background:linear-gradient(135deg,#ffab40,#ff6d00); }
                    .tetris-controls { margin-top:auto;padding-top:12px;border-top:1px solid var(--border); }
                    .tetris-controls-row { display:flex;gap:8px;justify-content:center;margin-bottom:8px; }
                    .tetris-btn { width:50px;height:40px;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--fg-primary);border-radius:var(--radius-sm);cursor:pointer;font-size:1.2rem;transition:all 0.1s; }
                    .tetris-btn:hover { background:var(--bg-secondary); }
                    .tetris-btn:active { transform:scale(0.95);background:var(--accent);color:#000; }
                    .tetris-overlay { position:absolute;inset:0;background:rgba(0,0,0,0.8);display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:var(--radius-md); }
                    .tetris-overlay h3 { font-size:1.5rem;color:var(--fg-primary);margin-bottom:10px; }
                    .tetris-overlay p { color:var(--fg-muted);margin-bottom:20px; }
                    .tetris-overlay button { padding:12px 30px;background:var(--accent);border:none;color:#000;border-radius:var(--radius-md);cursor:pointer;font-family:inherit;font-size:1rem;font-weight:600; }
                    .tetris-overlay button:hover { filter:brightness(1.1); }
                    .tetris-info { font-size:0.7rem;color:var(--fg-muted);text-align:center;margin-top:8px; }
                </style>
                <div class="tetris-container" id="tetris-container-${windowId}">
                    <div class="tetris-header">
                        <h2>Tetris</h2>
                        <div class="tetris-stats">
                            <div class="tetris-stat">
                                <div class="tetris-stat-value" id="tetris-score-${windowId}">0</div>
                                <div class="tetris-stat-label">Score</div>
                            </div>
                            <div class="tetris-stat">
                                <div class="tetris-stat-value" id="tetris-level-${windowId}">1</div>
                                <div class="tetris-stat-label">Level</div>
                            </div>
                            <div class="tetris-stat">
                                <div class="tetris-stat-value" id="tetris-lines-${windowId}">0</div>
                                <div class="tetris-stat-label">Lines</div>
                            </div>
                        </div>
                    </div>
                    <div class="tetris-main">
                        <div class="tetris-board" id="tetris-board-${windowId}"></div>
                        <div class="tetris-side">
                            <div class="tetris-next">
                                <div class="tetris-next-label">Next</div>
                                <div class="tetris-next-grid" id="tetris-next-${windowId}"></div>
                            </div>
                            <div class="tetris-controls">
                                <div class="tetris-controls-row">
                                    <button class="tetris-btn" data-key="rotate">↻</button>
                                </div>
                                <div class="tetris-controls-row">
                                    <button class="tetris-btn" data-key="left">←</button>
                                    <button class="tetris-btn" data-key="down">↓</button>
                                    <button class="tetris-btn" data-key="right">→</button>
                                </div>
                                <div class="tetris-controls-row">
                                    <button class="tetris-btn" data-key="drop" style="width:100%;">Drop</button>
                                </div>
                            </div>
                            <div class="tetris-info">← → Move | ↑ Rotate | ↓ Soft Drop | Space Hard Drop</div>
                        </div>
                    </div>
                </div>
            `,
            init: () => {
                const lifecycle = createAppLifecycle();

                const container = document.getElementById(`tetris-container-${windowId}`);
                const boardEl = document.getElementById(`tetris-board-${windowId}`);
                const nextEl = document.getElementById(`tetris-next-${windowId}`);
                const scoreEl = document.getElementById(`tetris-score-${windowId}`);
                const levelEl = document.getElementById(`tetris-level-${windowId}`);
                const linesEl = document.getElementById(`tetris-lines-${windowId}`);

                const COLS = 10;
                const ROWS = 20;

                const SHAPES = {
                    I: [[1,1,1,1]],
                    O: [[1,1],[1,1]],
                    T: [[0,1,0],[1,1,1]],
                    S: [[0,1,1],[1,1,0]],
                    Z: [[1,1,0],[0,1,1]],
                    J: [[1,0,0],[1,1,1]],
                    L: [[0,0,1],[1,1,1]]
                };

                const createEmptyRow = () => Array(COLS).fill(null);
                const createEmptyBoard = () => Array.from({ length: ROWS }, () => createEmptyRow());

                let board = createEmptyBoard();
                let currentPiece = null;
                let nextPiece = null;
                let score = 0;
                let level = 1;
                let lines = 0;
                let gameOver = false;
                const paused = false;
                let dropInterval = null;
                let gameStarted = false;

                function init() {
                    if (!EphemeraWM.getWindow(windowId)) {
                        return;
                    }

                    board = createEmptyBoard();
                    score = 0; level = 1; lines = 0; gameOver = false; gameStarted = true;
                    updateStats();
                    nextPiece = createPiece();
                    spawnPiece();
                    renderBoard();
                    renderNext();
                    startDrop();
                    showOverlay(false);
                }

                function createPiece() {
                    const types = Object.keys(SHAPES);
                    const type = types[Math.floor(Math.random() * types.length)];
                    return {
                        type,
                        shape: SHAPES[type].map(row => [...row]),
                        x: 0,
                        y: 0
                    };
                }

                function spawnPiece() {
                    currentPiece = nextPiece;
                    currentPiece.x = Math.floor((COLS - currentPiece.shape[0].length) / 2);
                    currentPiece.y = 0;
                    nextPiece = createPiece();
                    renderNext();

                    if (!isValidMove(currentPiece.x, currentPiece.y, currentPiece.shape)) {
                        gameOver = true;
                        stopDrop();
                        showOverlay(true);
                    }
                }

                function isValidMove(newX, newY, shape) {
                    for (let y = 0; y < shape.length; y++) {
                        for (let x = 0; x < shape[y].length; x++) {
                            if (shape[y][x]) {
                                const boardX = newX + x;
                                const boardY = newY + y;
                                if (boardX < 0 || boardX >= COLS || boardY >= ROWS) return false;
                                if (boardY < 0) continue;
                                if (!board[boardY] || board[boardY][boardX]) return false;
                            }
                        }
                    }
                    return true;
                }

                function rotatePiece() {
                    const rotated = currentPiece.shape[0].map((_, i) =>
                        currentPiece.shape.map(row => row[i]).reverse()
                    );
                    if (isValidMove(currentPiece.x, currentPiece.y, rotated)) {
                        currentPiece.shape = rotated;
                        renderBoard();
                    }
                }

                function movePiece(dx, dy) {
                    if (isValidMove(currentPiece.x + dx, currentPiece.y + dy, currentPiece.shape)) {
                        currentPiece.x += dx;
                        currentPiece.y += dy;
                        renderBoard();
                        return true;
                    }
                    return false;
                }

                function dropPiece() {
                    if (!movePiece(0, 1)) {
                        lockPiece();
                        clearLines();
                        spawnPiece();
                    }
                }

                function hardDrop() {
                    while (movePiece(0, 1)) {
                        // Keep moving down until collision.
                    }
                    lockPiece();
                    clearLines();
                    spawnPiece();
                }

                function getGhostY() {
                    let ghostY = currentPiece.y;
                    while (isValidMove(currentPiece.x, ghostY + 1, currentPiece.shape)) {
                        ghostY++;
                    }
                    return ghostY;
                }

                function lockPiece() {
                    for (let y = 0; y < currentPiece.shape.length; y++) {
                        for (let x = 0; x < currentPiece.shape[y].length; x++) {
                            if (currentPiece.shape[y][x]) {
                                const boardY = currentPiece.y + y;
                                const boardX = currentPiece.x + x;
                                if (boardY >= 0) {
                                    if (board[boardY]) {
                                        board[boardY][boardX] = currentPiece.type;
                                    }
                                }
                            }
                        }
                    }
                }

                function clearLines() {
                    let cleared = 0;
                    for (let y = ROWS - 1; y >= 0; y--) {
                        if (!board[y] || !Array.isArray(board[y])) {
                            board[y] = createEmptyRow();
                        }
                        if (board[y].every(cell => cell !== null)) {
                            board.splice(y, 1);
                            board.unshift(createEmptyRow());
                            cleared++;
                            y++;
                        }
                    }
                    if (cleared > 0) {
                        const points = [0, 100, 300, 500, 800];
                        score += points[cleared] * level;
                        lines += cleared;
                        level = Math.floor(lines / 10) + 1;
                        updateStats();
                        adjustSpeed();
                    }
                }

                function adjustSpeed() {
                    stopDrop();
                    startDrop();
                }

                function startDrop() {
                    stopDrop();
                    const speed = Math.max(100, 1000 - (level - 1) * 100);
                    dropInterval = lifecycle.addInterval(setInterval(() => {
                        if (!paused && !gameOver) dropPiece();
                    }, speed));
                }

                function stopDrop() {
                    if (dropInterval) {
                        clearInterval(dropInterval);
                        dropInterval = null;
                    }
                }

                function renderBoard() {
                    let html = '';
                    const ghostY = currentPiece ? getGhostY() : 0;

                    for (let y = 0; y < ROWS; y++) {
                        const row = board[y] || createEmptyRow();
                        for (let x = 0; x < COLS; x++) {
                            let cellClass = 'tetris-cell';

                            if (row[x]) {
                                cellClass += ' ' + row[x];
                            } else if (currentPiece) {
                                let isCurrentPiece = false;
                                let isGhost = false;

                                for (let py = 0; py < currentPiece.shape.length; py++) {
                                    for (let px = 0; px < currentPiece.shape[py].length; px++) {
                                        if (currentPiece.shape[py][px]) {
                                            if (currentPiece.x + px === x && currentPiece.y + py === y) {
                                                isCurrentPiece = true;
                                            }
                                            if (currentPiece.x + px === x && ghostY + py === y && !isCurrentPiece) {
                                                isGhost = true;
                                            }
                                        }
                                    }
                                }

                                if (isCurrentPiece) {
                                    cellClass += ' ' + currentPiece.type;
                                } else if (isGhost) {
                                    cellClass += ' ghost';
                                }
                            }

                            html += `<div class="${cellClass}"></div>`;
                        }
                    }
                    boardEl.innerHTML = html;
                }

                function renderNext() {
                    if (!nextPiece) return;
                    const shape = nextPiece.shape;
                    let html = '';
                    for (let y = 0; y < 4; y++) {
                        for (let x = 0; x < 4; x++) {
                            const hasBlock = shape[y] && shape[y][x];
                            html += `<div class="tetris-next-cell ${hasBlock ? nextPiece.type : ''}"></div>`;
                        }
                    }
                    nextEl.innerHTML = html;
                }

                function updateStats() {
                    scoreEl.textContent = score;
                    levelEl.textContent = level;
                    linesEl.textContent = lines;
                }

                function showOverlay(show) {
                    const existing = container.querySelector('.tetris-overlay');
                    if (existing) existing.remove();

                    if (show) {
                        const overlay = document.createElement('div');
                        overlay.className = 'tetris-overlay';
                        overlay.innerHTML = `
                            <h3>${gameOver ? 'Game Over' : 'Tetris'}</h3>
                            <p>${gameOver ? `Final Score: ${score}` : 'Press Start to Play'}</p>
                            <button>${gameOver ? 'Play Again' : 'Start'}</button>
                        `;
                        overlay.querySelector('button').addEventListener('click', init);
                        container.appendChild(overlay);
                    }
                }

                function handleKey(key) {
                    if (gameOver) return;
                    if (!gameStarted) {
                        init();
                        return;
                    }

                    switch (key) {
                        case 'left': movePiece(-1, 0); break;
                        case 'right': movePiece(1, 0); break;
                        case 'down': movePiece(0, 1); break;
                        case 'rotate': rotatePiece(); break;
                        case 'drop': hardDrop(); break;
                    }
                }

                container.querySelectorAll('.tetris-btn').forEach(btn => {
                    lifecycle.addListener(btn, 'click', () => handleKey(btn.dataset.key));
                });

                const onWindowKeyDown = (e) => {
                    if (e.target.closest('.window-content') !== container.closest('.window-content')) return;

                    const keyMap = {
                        'ArrowLeft': 'left',
                        'ArrowRight': 'right',
                        'ArrowDown': 'down',
                        'ArrowUp': 'rotate',
                        ' ': 'drop'
                    };

                    if (keyMap[e.key]) {
                        e.preventDefault();
                        handleKey(keyMap[e.key]);
                    }
                };
                lifecycle.addListener(document, 'keydown', onWindowKeyDown);

                renderBoard();
                showOverlay(true);

                return { destroy: lifecycle.destroy };
            }
        };
    }
});
