EphemeraApps.register({
    id: 'memory',
    name: 'Memory Match',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
    width: 380,
    height: 500,
    category: 'games',
    content: (windowId) => {
        const symbols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        const cards = [...symbols, ...symbols];
        
        return {
            html: `
                <style>
                    .memory-stats { display:flex;justify-content:space-between;margin-bottom:16px;padding:12px;background:var(--bg-primary);border-radius:var(--radius-md); }
                    .memory-stats span { font-family:var(--font-mono);color:var(--fg-secondary); }
                    .memory-grid { display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:10px; }
                    .memory-card { aspect-ratio:1;background:var(--bg-tertiary);border:2px solid var(--border);border-radius:var(--radius-md);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:2rem;transition:all 0.3s ease;transform-style:preserve-3d; }
                    .memory-card:hover:not(.flipped):not(.matched) { border-color:var(--accent);transform:scale(1.05); }
                    .memory-card.flipped, .memory-card.matched { background:rgba(0, 212, 170, 0.1);border-color:var(--accent); }
                    .memory-card.matched { opacity:0.5;pointer-events:none; }
                    .memory-card .card-front { display:none; }
                    .memory-card.flipped .card-front, .memory-card.matched .card-front { display:block; }
                    .memory-card .card-back { display:block; }
                    .memory-card.flipped .card-back, .memory-card.matched .card-back { display:none; }
                </style>
                <div class="memory-stats">
                    <span>Moves: <strong id="memory-moves-${windowId}">0</strong></span>
                    <span>Pairs: <strong id="memory-pairs-${windowId}">0</strong>/8</span>
                </div>
                <div class="memory-grid" id="memory-grid-${windowId}"></div>
                <div style="display:flex;justify-content:center;margin-top:16px;">
                    <button class="btn primary" id="memory-reset-${windowId}">New Game</button>
                </div>
            `,
            init: () => {
                const lifecycle = createAppLifecycle();

                const grid = document.getElementById(`memory-grid-${windowId}`);
                const movesEl = document.getElementById(`memory-moves-${windowId}`);
                const pairsEl = document.getElementById(`memory-pairs-${windowId}`);
                const resetBtn = document.getElementById(`memory-reset-${windowId}`);
                
                let shuffledCards = [];
                let flippedCards = [];
                let matchedPairs = 0;
                let moves = 0;
                let canFlip = true;
                
                function shuffle(array) {
                    for (let i = array.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [array[i], array[j]] = [array[j], array[i]];
                    }
                    return array;
                }
                
                function initGame() {
                    shuffledCards = shuffle([...cards]);
                    matchedPairs = 0;
                    moves = 0;
                    canFlip = true;
                    flippedCards = [];
                    movesEl.textContent = '0';
                    pairsEl.textContent = '0';
                    
                    grid.innerHTML = shuffledCards.map((_, i) => `
                        <div class="memory-card" data-index="${i}">
                            <span class="card-back">?</span>
                            <span class="card-front"></span>
                        </div>
                    `).join('');
                    
                    grid.querySelectorAll('.memory-card').forEach((card, i) => {
                        card.querySelector('.card-front').textContent = shuffledCards[i];
                        card.dataset.symbol = shuffledCards[i];
                        
                        card.addEventListener('click', () => {
                            if (!canFlip) return;
                            if (card.classList.contains('flipped')) return;
                            if (card.classList.contains('matched')) return;
                            if (flippedCards.length >= 2) return;
                            
                            card.classList.add('flipped');
                            flippedCards.push(card);
                            
                            if (flippedCards.length === 2) {
                                moves++;
                                movesEl.textContent = moves;
                                canFlip = false;
                                checkMatch();
                            }
                        });
                    });
                }
                
                function checkMatch() {
                    const [card1, card2] = flippedCards;
                    
                    if (card1.dataset.symbol === card2.dataset.symbol) {
                        card1.classList.add('matched');
                        card2.classList.add('matched');
                        matchedPairs++;
                        pairsEl.textContent = matchedPairs;
                        
                        if (matchedPairs === 8) {
                            setTimeout(() => {
                                EphemeraNotifications.success('You Won!', `Completed in ${moves} moves!`);
                            }, 300);
                        }
                        
                        flippedCards = [];
                        canFlip = true;
                    } else {
                        setTimeout(() => {
                            card1.classList.remove('flipped');
                            card2.classList.remove('flipped');
                            flippedCards = [];
                            canFlip = true;
                        }, 800);
                    }
                }
                
                lifecycle.addListener(resetBtn, 'click', initGame);
                initGame();

                return {
                    destroy: () => {
                        lifecycle.destroy();
                    }
                };
            }
        };
    }
});
