EphemeraApps.register({
    id: 'diceroller',
    name: 'Dice Roller',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="3"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/><circle cx="16" cy="8" r="1.5" fill="currentColor"/><circle cx="8" cy="16" r="1.5" fill="currentColor"/><circle cx="16" cy="16" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>`,
    width: 500,
    height: 550,
    category: 'utility',
    content: (windowId) => {
        return {
            html: `
                <style>
                    .dice-container { display:flex;flex-direction:column;height:100%;padding:16px; }
                    .dice-header { display:flex;justify-content:space-between;align-items:center;margin-bottom:16px; }
                    .dice-header h2 { margin:0;font-size:1.1rem;color:var(--fg-primary); }
                    .dice-controls { display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px; }
                    .dice-control { display:flex;align-items:center;gap:8px;padding:10px 14px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-md); }
                    .dice-control label { font-size:0.85rem;color:var(--fg-secondary); }
                    .dice-control input,.dice-control select { width:60px;padding:6px 8px;background:var(--bg-primary);border:1px solid var(--border);color:var(--fg-primary);border-radius:var(--radius-sm);text-align:center;font-family:inherit; }
                    .dice-roll-area { display:flex;flex-wrap:wrap;gap:16px;justify-content:center;padding:30px 20px;background:var(--bg-secondary);border-radius:var(--radius-lg);min-height:150px;margin-bottom:20px; }
                    .dice { width:70px;height:70px;background:linear-gradient(135deg,#fff 0%,#e8e8e8 100%);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:2rem;font-weight:700;color:#333;box-shadow:0 4px 12px rgba(0,0,0,0.2),inset 0 1px 0 rgba(255,255,255,0.8);transition:transform 0.1s; }
                    .dice.rolling { animation:dice-roll 0.3s ease-out; }
                    @keyframes dice-roll { 0% { transform:rotate(0deg) scale(1); } 50% { transform:rotate(180deg) scale(1.1); } 100% { transform:rotate(360deg) scale(1); } }
                    .dice-dots { display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);gap:2px;width:50px;height:50px;padding:8px; }
                    .dice-dot { width:10px;height:10px;background:#333;border-radius:50%;opacity:0; }
                    .dice-dot.visible { opacity:1; }
                    .dice-result { text-align:center;margin-bottom:20px; }
                    .dice-total { font-size:3rem;font-weight:700;color:var(--accent);font-family:'JetBrains Mono',monospace; }
                    .dice-breakdown { font-size:0.9rem;color:var(--fg-muted);margin-top:8px; }
                    .dice-roll-btn { display:block;width:100%;padding:16px;background:var(--accent);border:none;color:#fff;border-radius:var(--radius-md);cursor:pointer;font-family:inherit;font-size:1.1rem;font-weight:600;transition:all 0.2s;margin-bottom:20px; }
                    .dice-roll-btn:hover { filter:brightness(1.1); }
                    .dice-roll-btn:active { transform:scale(0.98); }
                    .dice-presets { display:flex;gap:8px;flex-wrap:wrap; }
                    .dice-preset { padding:10px 16px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;font-family:inherit;font-size:0.85rem;color:var(--fg-secondary);transition:all 0.15s; }
                    .dice-preset:hover { border-color:var(--accent);color:var(--fg-primary); }
                    .dice-preset.active { background:var(--accent);color:#fff;border-color:var(--accent); }
                    .dice-history { margin-top:auto; }
                    .dice-history-title { font-size:0.75rem;color:var(--fg-muted);margin-bottom:8px; }
                    .dice-history-list { max-height:100px;overflow-y:auto; }
                    .dice-history-item { display:flex;justify-content:space-between;padding:8px 12px;background:var(--bg-secondary);border-radius:var(--radius-sm);margin-bottom:4px;font-size:0.8rem; }
                    .dice-history-roll { color:var(--fg-primary); }
                    .dice-history-result { color:var(--accent);font-weight:600;font-family:'JetBrains Mono',monospace; }
                </style>
                <div class="dice-container">
                    <div class="dice-header">
                        <h2>Dice Roller</h2>
                    </div>
                    <div class="dice-controls">
                        <div class="dice-control">
                            <label>Count:</label>
                            <input type="number" id="dice-count-${windowId}" value="2" min="1" max="20">
                        </div>
                        <div class="dice-control">
                            <label>Type:</label>
                            <select id="dice-type-${windowId}">
                                <option value="4">D4</option>
                                <option value="6" selected>D6</option>
                                <option value="8">D8</option>
                                <option value="10">D10</option>
                                <option value="12">D12</option>
                                <option value="20">D20</option>
                                <option value="100">D100</option>
                            </select>
                        </div>
                        <div class="dice-control">
                            <label>Modifier:</label>
                            <input type="number" id="dice-mod-${windowId}" value="0">
                        </div>
                    </div>
                    <div class="dice-presets">
                        <button class="dice-preset" data-count="1" data-type="20">1d20</button>
                        <button class="dice-preset" data-count="2" data-type="6">2d6</button>
                        <button class="dice-preset" data-count="4" data-type="6">4d6</button>
                        <button class="dice-preset" data-count="3" data-type="6" data-mod="3">3d6+3</button>
                        <button class="dice-preset" data-count="8" data-type="6">8d6</button>
                        <button class="dice-preset" data-count="2" data-type="10">2d10</button>
                    </div>
                    <button class="dice-roll-btn" id="dice-roll-${windowId}">🎲 Roll Dice</button>
                    <div class="dice-roll-area" id="dice-area-${windowId}">
                        <div class="dice" style="opacity:0.5;">?</div>
                    </div>
                    <div class="dice-result">
                        <div class="dice-total" id="dice-total-${windowId}">-</div>
                        <div class="dice-breakdown" id="dice-breakdown-${windowId}">Roll to see results</div>
                    </div>
                    <div class="dice-history">
                        <div class="dice-history-title">Roll History</div>
                        <div class="dice-history-list" id="dice-history-${windowId}">
                            <div style="color:var(--fg-muted);font-size:0.8rem;text-align:center;padding:8px;">No rolls yet</div>
                        </div>
                    </div>
                </div>
            `,
            init: () => {
                const lifecycle = createAppLifecycle();

                const countInput = document.getElementById(`dice-count-${windowId}`);
                const typeSelect = document.getElementById(`dice-type-${windowId}`);
                const modInput = document.getElementById(`dice-mod-${windowId}`);
                const rollBtn = document.getElementById(`dice-roll-${windowId}`);
                const areaEl = document.getElementById(`dice-area-${windowId}`);
                const totalEl = document.getElementById(`dice-total-${windowId}`);
                const breakdownEl = document.getElementById(`dice-breakdown-${windowId}`);
                const historyEl = document.getElementById(`dice-history-${windowId}`);

                let rollHistory = [];
                let isRolling = false;

                function rollDie(sides) {
                    return Math.floor(Math.random() * sides) + 1;
                }

                function createDiceFace(value, sides) {
                    if (sides <= 10 || sides === 12 || sides === 20) {
                        const dice = document.createElement('div');
                        dice.className = 'dice';
                        
                        if (sides === 6) {
                            const dots = document.createElement('div');
                            dots.className = 'dice-dots';
                            const patterns = {
                                1: [4],
                                2: [0, 8],
                                3: [0, 4, 8],
                                4: [0, 2, 6, 8],
                                5: [0, 2, 4, 6, 8],
                                6: [0, 2, 3, 5, 6, 8]
                            };
                            for (let i = 0; i < 9; i++) {
                                const dot = document.createElement('div');
                                dot.className = 'dice-dot' + (patterns[value]?.includes(i) ? ' visible' : '');
                                dots.appendChild(dot);
                            }
                            dice.appendChild(dots);
                        } else {
                            dice.textContent = value;
                        }
                        return dice;
                    }
                    
                    const dice = document.createElement('div');
                    dice.className = 'dice';
                    dice.textContent = value;
                    return dice;
                }

                async function roll() {
                    if (isRolling) return;
                    isRolling = true;

                    const count = Math.max(1, Math.min(20, parseInt(countInput.value) || 1));
                    const sides = parseInt(typeSelect.value) || 6;
                    const mod = parseInt(modInput.value) || 0;

                    areaEl.innerHTML = '';
                    const dice = [];
                    for (let i = 0; i < count; i++) {
                        const die = createDiceFace('?', sides);
                        die.classList.add('rolling');
                        areaEl.appendChild(die);
                        dice.push(die);
                    }

                    await new Promise(r => setTimeout(r, 300));

                    const rolls = [];
                    for (let i = 0; i < count; i++) {
                        rolls.push(rollDie(sides));
                    }

                    areaEl.innerHTML = '';
                    for (let i = 0; i < rolls.length; i++) {
                        const die = createDiceFace(rolls[i], sides);
                        die.classList.add('rolling');
                        areaEl.appendChild(die);
                        await new Promise(r => setTimeout(r, 100));
                    }

                    const sum = rolls.reduce((a, b) => a + b, 0);
                    const total = sum + mod;

                    totalEl.textContent = total;
                    
                    let breakdown = `${count}d${sides}: [${rolls.join(', ')}]`;
                    if (mod !== 0) {
                        breakdown += ` ${mod > 0 ? '+' : ''}${mod}`;
                    }
                    breakdown += ` = ${total}`;
                    breakdownEl.textContent = breakdown;

                    addToHistory(`${count}d${sides}${mod !== 0 ? (mod > 0 ? '+' : '') + mod : ''}`, total, rolls);

                    isRolling = false;
                }

                function addToHistory(notation, total, rolls) {
                    rollHistory.unshift({ notation, total, rolls, time: Date.now() });
                    rollHistory = rollHistory.slice(0, 20);
                    renderHistory();
                }

                function renderHistory() {
                    if (rollHistory.length === 0) {
                        historyEl.innerHTML = '<div style="color:var(--fg-muted);font-size:0.8rem;text-align:center;padding:8px;">No rolls yet</div>';
                        return;
                    }

                    historyEl.innerHTML = rollHistory.map(h => `
                        <div class="dice-history-item">
                            <span class="dice-history-roll">${h.notation} [${h.rolls.join(', ')}]</span>
                            <span class="dice-history-result">${h.total}</span>
                        </div>
                    `).join('');
                }

                lifecycle.addListener(rollBtn, 'click', roll);

                document.querySelectorAll('.dice-preset').forEach(btn => {
                    lifecycle.addListener(btn, 'click', () => {
                        countInput.value = btn.dataset.count;
                        typeSelect.value = btn.dataset.type;
                        modInput.value = btn.dataset.mod || 0;
                        roll();
                    });
                });

                lifecycle.addListener(document, 'keydown', (e) => {
                    if (e.target.closest('.window-content')?.id === `content-${windowId}`) {
                        if (e.key === ' ' || e.key === 'Enter') {
                            e.preventDefault();
                            roll();
                        }
                    }
                });

                return { destroy: lifecycle.destroy };
            }
        };
    }
});
