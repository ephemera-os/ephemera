EphemeraApps.register({
    id: 'snake',
    name: 'Snake',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.82-.13 2.67-.36"/><path d="M22 12c0-1.67-.41-3.24-1.14-4.62"/><circle cx="12" cy="12" r="3"/><path d="M18 4a2 2 0 100 4 2 2 0 000-4z"/></svg>`,
    width: 400,
    height: 480,
    category: 'games',
    content: (windowId) => {
        return {
            html: `
                <style>
                    .game-container { display:flex;flex-direction:column;align-items:center;gap:16px;height:100%; }
                    .game-canvas { background:var(--bg-primary);border:2px solid var(--border);border-radius:var(--radius-md); }
                    .game-score { font-family:var(--font-mono);font-size:1.2rem;color:var(--accent); }
                    .game-controls { display:flex;gap:12px; }
                    .game-btn { padding:10px 24px;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--fg-primary);border-radius:var(--radius-md);cursor:pointer;font-family:var(--font-sans);font-size:0.9rem;transition:all 0.2s ease; }
                    .game-btn:hover { background:var(--bg-secondary);border-color:var(--accent); }
                    .game-btn.primary { background:var(--accent);color:var(--bg-primary);border-color:var(--accent); }
                    .game-btn.primary:hover { background:var(--accent-hover); }
                </style>
                <div class="game-container">
                    <div class="game-score">Score: <span id="snake-score-${windowId}">0</span></div>
                    <canvas class="game-canvas" id="snake-canvas-${windowId}" width="340" height="340"></canvas>
                    <div class="game-controls">
                        <button class="game-btn primary" id="snake-start-${windowId}">Start Game</button>
                    </div>
                    <p style="font-size:0.75rem;color:var(--fg-muted);margin-top:8px;">Use arrow keys to move</p>
                </div>
            `,
            init: () => {
                const lifecycle = createAppLifecycle();

                const canvas = document.getElementById(`snake-canvas-${windowId}`);
                const ctx = canvas.getContext('2d');
                const scoreEl = document.getElementById(`snake-score-${windowId}`);
                const startBtn = document.getElementById(`snake-start-${windowId}`);

                const gridSize = 20;
                const tileCount = 17;
                let snake = [{ x: 8, y: 8 }];
                let food = { x: 10, y: 10 };
                let dx = 0, dy = 0;
                let score = 0;
                let gameLoop = null;
                let gameRunning = false;
                
                function draw() {
                    ctx.fillStyle = '#0a0a0f';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    
                    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
                    for (let i = 0; i <= tileCount; i++) {
                        ctx.beginPath();
                        ctx.moveTo(i * gridSize, 0);
                        ctx.lineTo(i * gridSize, canvas.height);
                        ctx.stroke();
                        ctx.beginPath();
                        ctx.moveTo(0, i * gridSize);
                        ctx.lineTo(canvas.width, i * gridSize);
                        ctx.stroke();
                    }
                    
                    snake.forEach((segment, i) => {
                        const alpha = 1 - (i / snake.length) * 0.5;
                        ctx.fillStyle = `rgba(0, 212, 170, ${alpha})`;
                        ctx.fillRect(segment.x * gridSize + 1, segment.y * gridSize + 1, gridSize - 2, gridSize - 2);
                    });
                    
                    ctx.fillStyle = '#ff4d6a';
                    ctx.beginPath();
                    ctx.arc(food.x * gridSize + gridSize / 2, food.y * gridSize + gridSize / 2, gridSize / 2 - 2, 0, Math.PI * 2);
                    ctx.fill();
                }
                
                function update() {
                    if (!gameRunning) return;
                    
                    const head = { x: snake[0].x + dx, y: snake[0].y + dy };
                    
                    if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
                        gameOver();
                        return;
                    }
                    
                    for (const segment of snake) {
                        if (head.x === segment.x && head.y === segment.y) {
                            gameOver();
                            return;
                        }
                    }
                    
                    snake.unshift(head);
                    
                    if (head.x === food.x && head.y === food.y) {
                        score += 10;
                        scoreEl.textContent = score;
                        placeFood();
                    } else {
                        snake.pop();
                    }
                    
                    draw();
                }
                
                function placeFood() {
                    do {
                        food = {
                            x: Math.floor(Math.random() * tileCount),
                            y: Math.floor(Math.random() * tileCount)
                        };
                    } while (snake.some(s => s.x === food.x && s.y === food.y));
                }
                
                function gameOver() {
                    gameRunning = false;
                    clearInterval(gameLoop);
                    startBtn.textContent = 'Play Again';
                    ctx.fillStyle = 'rgba(0,0,0,0.8)';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.fillStyle = '#ff4d6a';
                    ctx.font = 'bold 24px Space Grotesk';
                    ctx.textAlign = 'center';
                    ctx.fillText('Game Over!', canvas.width / 2, canvas.height / 2 - 10);
                    ctx.fillStyle = '#e8e8f0';
                    ctx.font = '16px Space Grotesk';
                    ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 + 20);
                }
                
                function startGame() {
                    snake = [{ x: 8, y: 8 }];
                    dx = 1;
                    dy = 0;
                    score = 0;
                    scoreEl.textContent = score;
                    placeFood();
                    gameRunning = true;
                    startBtn.textContent = 'Restart';
                    if (gameLoop) clearInterval(gameLoop);
                    gameLoop = lifecycle.addInterval(setInterval(update, 100));
                    draw();
                }

                lifecycle.addListener(startBtn, 'click', startGame);

                const keyHandler = (e) => {
                    if (!gameRunning) return;
                    if (e.key === 'ArrowUp' && dy !== 1) { dx = 0; dy = -1; }
                    if (e.key === 'ArrowDown' && dy !== -1) { dx = 0; dy = 1; }
                    if (e.key === 'ArrowLeft' && dx !== 1) { dx = -1; dy = 0; }
                    if (e.key === 'ArrowRight' && dx !== -1) { dx = 1; dy = 0; }
                };

                lifecycle.addListener(document, 'keydown', keyHandler);

                draw();

                return { destroy: lifecycle.destroy };
            }
        };
    }
});
