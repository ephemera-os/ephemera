EphemeraApps.register({
    id: 'calculator',
    name: 'Calculator',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="8" y2="10.01"/><line x1="12" y1="10" x2="12" y2="10.01"/><line x1="16" y1="10" x2="16" y2="10.01"/><line x1="8" y1="14" x2="8" y2="14.01"/><line x1="12" y1="14" x2="12" y2="14.01"/><line x1="16" y1="14" x2="16" y2="14.01"/><line x1="8" y1="18" x2="8" y2="18.01"/><line x1="12" y1="18" x2="16" y2="18"/></svg>`,
    width: 350,
    height: 580,
    category: 'utility',
    content: (windowId) => {
        return {
            html: `
                <style>
                    .calc-container { display:flex;flex-direction:column;height:100%; }
                    .calc-mode-toggle { display:flex;gap:4px;padding:8px; }
                    .calc-mode-btn { flex:1;padding:8px;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--fg-muted);border-radius:var(--radius-sm);cursor:pointer;font-family:inherit;font-size:0.8rem;transition:all 0.15s; }
                    .calc-mode-btn:hover { color:var(--fg-primary); }
                    .calc-mode-btn.active { background:var(--accent);color:#fff;border-color:var(--accent); }
                    .calc-display-area { background:var(--bg-primary);padding:16px 20px;border-radius:var(--radius-md);margin:0 12px 12px; }
                    .calc-expression { font-size:0.85rem;color:var(--fg-muted);min-height:20px;text-align:right;font-family:'JetBrains Mono',monospace; }
                    .calc-display { font-size:2.2rem;color:var(--fg-primary);text-align:right;font-family:'JetBrains Mono',monospace;word-break:break-all;min-height:50px;display:flex;align-items:center;justify-content:flex-end; }
                    .calc-grid { display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:0 12px; }
                    .calc-grid.scientific { grid-template-columns:repeat(5,1fr); }
                    .calc-btn { padding:14px 8px;font-size:1rem;font-family:'Space Grotesk',sans-serif;font-weight:500;background:var(--bg-tertiary);color:var(--fg-primary);border:1px solid var(--border);border-radius:var(--radius-md);cursor:pointer;transition:all 0.15s ease; }
                    .calc-btn:hover { background:var(--bg-secondary);border-color:var(--fg-muted); }
                    .calc-btn:active { transform:scale(0.95); }
                    .calc-btn.operator { background:rgba(0,212,170,0.15);color:var(--accent); }
                    .calc-btn.operator:hover { background:rgba(0,212,170,0.25); }
                    .calc-btn.equals { background:var(--accent);color:var(--bg-primary); }
                    .calc-btn.equals:hover { background:var(--accent-hover); }
                    .calc-btn.function { background:rgba(99,102,241,0.15);color:#818cf8;font-size:0.85rem;padding:12px 6px; }
                    .calc-btn.function:hover { background:rgba(99,102,241,0.25); }
                    .calc-btn.memory { background:rgba(245,158,11,0.15);color:#f59e0b;font-size:0.8rem;padding:12px 6px; }
                    .calc-btn.memory:hover { background:rgba(245,158,11,0.25); }
                    .calc-history { padding:8px 12px;background:var(--bg-secondary);border-top:1px solid var(--border);max-height:100px;overflow-y:auto;display:none; }
                    .calc-history.show { display:block; }
                    .calc-history-item { font-size:0.75rem;color:var(--fg-muted);padding:4px 0;cursor:pointer;font-family:'JetBrains Mono',monospace; }
                    .calc-history-item:hover { color:var(--fg-primary); }
                    .calc-row { margin-bottom:6px; }
                </style>
                <div class="calc-container">
                    <div class="calc-mode-toggle">
                        <button class="calc-mode-btn active" data-mode="basic">Basic</button>
                        <button class="calc-mode-btn" data-mode="scientific">Scientific</button>
                        <button class="calc-mode-btn" data-mode="history" id="calc-toggle-history-${windowId}">History</button>
                        <button class="calc-mode-btn angle-mode active" data-action="toggle-angle" id="calc-angle-mode-${windowId}">DEG</button>
                    </div>
                    <div class="calc-display-area">
                        <div class="calc-expression" id="calc-expr-${windowId}"></div>
                        <div class="calc-display" id="calc-display-${windowId}">0</div>
                    </div>
                    <div class="calc-grid" id="calc-grid-${windowId}">
                        <button class="calc-btn memory" data-action="mc">MC</button>
                        <button class="calc-btn memory" data-action="mr">MR</button>
                        <button class="calc-btn memory" data-action="m+">M+</button>
                        <button class="calc-btn memory" data-action="m-">M-</button>
                        <button class="calc-btn operator" data-action="clear">C</button>
                        <button class="calc-btn" data-action="backspace">DEL</button>
                        <button class="calc-btn operator" data-action="%">%</button>
                        <button class="calc-btn operator" data-action="/">÷</button>
                        <button class="calc-btn" data-action="7">7</button>
                        <button class="calc-btn" data-action="8">8</button>
                        <button class="calc-btn" data-action="9">9</button>
                        <button class="calc-btn operator" data-action="*">×</button>
                        <button class="calc-btn" data-action="4">4</button>
                        <button class="calc-btn" data-action="5">5</button>
                        <button class="calc-btn" data-action="6">6</button>
                        <button class="calc-btn operator" data-action="-">−</button>
                        <button class="calc-btn" data-action="1">1</button>
                        <button class="calc-btn" data-action="2">2</button>
                        <button class="calc-btn" data-action="3">3</button>
                        <button class="calc-btn operator" data-action="+">+</button>
                        <button class="calc-btn" data-action="negate">±</button>
                        <button class="calc-btn" data-action="0">0</button>
                        <button class="calc-btn" data-action=".">.</button>
                        <button class="calc-btn equals" data-action="=">=</button>
                    </div>
                    <div class="calc-history" id="calc-history-${windowId}"></div>
                </div>
            `,
            init: () => {
                const lifecycle = createAppLifecycle();

                const display = document.getElementById(`calc-display-${windowId}`);
                const exprEl = document.getElementById(`calc-expr-${windowId}`);
                const grid = document.getElementById(`calc-grid-${windowId}`);
                const historyEl = document.getElementById(`calc-history-${windowId}`);
                const modeBtns = document.querySelectorAll('.calc-mode-btn');

                let current = '0';
                let previous = '';
                let operation = null;
                let shouldResetDisplay = false;
                let memory = 0;
                let history = [];
                let angleMode = 'deg'; // 'deg' or 'rad'

                const STORAGE_KEY = 'ephemera_calc_history';

                async function loadHistory() {
                    const stored = await EphemeraStorage.get('metadata', STORAGE_KEY);
                    if (stored?.items) history = stored.items;
                    renderHistory();
                }

                async function saveHistory() {
                    await EphemeraStorage.put('metadata', { key: STORAGE_KEY, items: history.slice(0, 50) });
                }

                function addToHistory(expression, result) {
                    history.unshift({ expr: expression, result, time: Date.now() });
                    history = history.slice(0, 50);
                    saveHistory();
                    renderHistory();
                }

                function renderHistory() {
                    historyEl.innerHTML = history.map(h => 
                        `<div class="calc-history-item" data-result="${h.result}">${h.expr} = ${h.result}</div>`
                    ).join('') || '<div style="color:var(--fg-muted);font-size:0.75rem;padding:8px;">No history yet</div>';

                    historyEl.querySelectorAll('.calc-history-item').forEach(item => {
                        item.addEventListener('click', () => {
                            current = item.dataset.result;
                            display.textContent = current;
                            shouldResetDisplay = true;
                        });
                    });
                }

                function formatNumber(num) {
                    if (isNaN(num) || !isFinite(num)) return 'Error';
                    if (Math.abs(num) > 1e10 || (Math.abs(num) < 1e-6 && num !== 0)) {
                        return num.toExponential(6);
                    }
                    const str = String(num);
                    if (str.length > 12) {
                        return num.toPrecision(10);
                    }
                    return str;
                }

                function scientificCalc(action) {
                    const val = parseFloat(current);
                    let result;
                    // Helper for angle conversions
                    const toRadians = angleMode === 'deg' ? (v) => v * Math.PI / 180 : (v) => v;
                    const fromRadians = angleMode === 'deg' ? (v) => v * 180 / Math.PI : (v) => v;

                    switch (action) {
                        case 'sin': result = Math.sin(toRadians(val)); break;
                        case 'cos': result = Math.cos(toRadians(val)); break;
                        case 'tan': result = Math.tan(toRadians(val)); break;
                        case 'asin': result = fromRadians(Math.asin(val)); break;
                        case 'acos': result = fromRadians(Math.acos(val)); break;
                        case 'atan': result = fromRadians(Math.atan(val)); break;
                        case 'sinh': result = Math.sinh(val); break;
                        case 'cosh': result = Math.cosh(val); break;
                        case 'tanh': result = Math.tanh(val); break;
                        case 'log': result = Math.log10(val); break;
                        case 'ln': result = Math.log(val); break;
                        case 'sqrt': result = Math.sqrt(val); break;
                        case 'cbrt': result = Math.cbrt(val); break;
                        case 'square': result = val * val; break;
                        case 'cube': result = val * val * val; break;
                        case 'inv': result = val !== 0 ? 1 / val : 'Error'; break;
                        case 'abs': result = Math.abs(val); break;
                        case 'exp': result = Math.exp(val); break;
                        case 'pi': result = Math.PI; break;
                        case 'e': result = Math.E; break;
                        case 'fact': result = factorial(Math.floor(val)); break;
                        case 'pow2': result = Math.pow(2, val); break;
                        case 'pow10': result = Math.pow(10, val); break;
                        default: return;
                    }
                    current = formatNumber(result);
                    display.textContent = current;
                    shouldResetDisplay = true;
                }

                function factorial(n) {
                    if (n < 0) return NaN;
                    if (n === 0 || n === 1) return 1;
                    if (n > 170) return Infinity;
                    let result = 1;
                    for (let i = 2; i <= n; i++) result *= i;
                    return result;
                }

                function renderScientificGrid() {
                    grid.classList.add('scientific');
                    grid.innerHTML = `
                        <button class="calc-btn function" data-action="sin">sin</button>
                        <button class="calc-btn function" data-action="cos">cos</button>
                        <button class="calc-btn function" data-action="tan">tan</button>
                        <button class="calc-btn memory" data-action="mc">MC</button>
                        <button class="calc-btn memory" data-action="mr">MR</button>
                        
                        <button class="calc-btn function" data-action="asin">sin⁻¹</button>
                        <button class="calc-btn function" data-action="acos">cos⁻¹</button>
                        <button class="calc-btn function" data-action="atan">tan⁻¹</button>
                        <button class="calc-btn memory" data-action="m+">M+</button>
                        <button class="calc-btn memory" data-action="m-">M-</button>
                        
                        <button class="calc-btn function" data-action="log">log</button>
                        <button class="calc-btn function" data-action="ln">ln</button>
                        <button class="calc-btn function" data-action="exp">eˣ</button>
                        <button class="calc-btn operator" data-action="clear">C</button>
                        <button class="calc-btn" data-action="backspace">DEL</button>
                        
                        <button class="calc-btn function" data-action="pi">π</button>
                        <button class="calc-btn function" data-action="e">e</button>
                        <button class="calc-btn function" data-action="pow">xʸ</button>
                        <button class="calc-btn operator" data-action="%">%</button>
                        <button class="calc-btn operator" data-action="/">÷</button>
                        
                        <button class="calc-btn function" data-action="square">x²</button>
                        <button class="calc-btn function" data-action="cube">x³</button>
                        <button class="calc-btn function" data-action="sqrt">√x</button>
                        <button class="calc-btn" data-action="7">7</button>
                        <button class="calc-btn" data-action="8">8</button>
                        
                        <button class="calc-btn function" data-action="inv">1/x</button>
                        <button class="calc-btn function" data-action="abs">|x|</button>
                        <button class="calc-btn function" data-action="fact">n!</button>
                        <button class="calc-btn" data-action="4">4</button>
                        <button class="calc-btn" data-action="5">5</button>
                        
                        <button class="calc-btn function" data-action="(">(</button>
                        <button class="calc-btn function" data-action=")">)</button>
                        <button class="calc-btn function" data-action="pow10">10ˣ</button>
                        <button class="calc-btn" data-action="1">1</button>
                        <button class="calc-btn" data-action="2">2</button>
                        
                        <button class="calc-btn function" data-action="sinh">sinh</button>
                        <button class="calc-btn function" data-action="cosh">cosh</button>
                        <button class="calc-btn function" data-action="tanh">tanh</button>
                        <button class="calc-btn" data-action="negate">±</button>
                        <button class="calc-btn" data-action="0">0</button>
                        
                        <button class="calc-btn" data-action="3">3</button>
                        <button class="calc-btn operator" data-action="*">×</button>
                        <button class="calc-btn operator" data-action="-">−</button>
                        <button class="calc-btn" data-action=".">.</button>
                        <button class="calc-btn operator" data-action="+">+</button>
                        
                        <button class="calc-btn" style="visibility:hidden;"></button>
                        <button class="calc-btn" style="visibility:hidden;"></button>
                        <button class="calc-btn equals" data-action="=" style="grid-column:span 2;">=</button>
                        <button class="calc-btn" style="visibility:hidden;"></button>
                    `;
                    attachButtonEvents();
                }

                function renderBasicGrid() {
                    grid.classList.remove('scientific');
                    grid.innerHTML = `
                        <button class="calc-btn memory" data-action="mc">MC</button>
                        <button class="calc-btn memory" data-action="mr">MR</button>
                        <button class="calc-btn memory" data-action="m+">M+</button>
                        <button class="calc-btn memory" data-action="m-">M-</button>
                        <button class="calc-btn operator" data-action="clear">C</button>
                        <button class="calc-btn" data-action="backspace">DEL</button>
                        <button class="calc-btn operator" data-action="%">%</button>
                        <button class="calc-btn operator" data-action="/">÷</button>
                        <button class="calc-btn" data-action="7">7</button>
                        <button class="calc-btn" data-action="8">8</button>
                        <button class="calc-btn" data-action="9">9</button>
                        <button class="calc-btn operator" data-action="*">×</button>
                        <button class="calc-btn" data-action="4">4</button>
                        <button class="calc-btn" data-action="5">5</button>
                        <button class="calc-btn" data-action="6">6</button>
                        <button class="calc-btn operator" data-action="-">−</button>
                        <button class="calc-btn" data-action="1">1</button>
                        <button class="calc-btn" data-action="2">2</button>
                        <button class="calc-btn" data-action="3">3</button>
                        <button class="calc-btn operator" data-action="+">+</button>
                        <button class="calc-btn" data-action="negate">±</button>
                        <button class="calc-btn" data-action="0">0</button>
                        <button class="calc-btn" data-action=".">.</button>
                        <button class="calc-btn equals" data-action="=">=</button>
                    `;
                    attachButtonEvents();
                }

                function attachButtonEvents() {
                    grid.querySelectorAll('.calc-btn').forEach(btn => {
                        btn.addEventListener('click', () => handleAction(btn.dataset.action));
                    });
                }

                function handleAction(action) {
                    const scientificFuncs = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 
                        'log', 'ln', 'sqrt', 'cbrt', 'square', 'cube', 'inv', 'abs', 'exp', 'fact', 'pow2', 'pow10'];
                    
                    if (!isNaN(action) || action === '.') {
                        if (shouldResetDisplay) {
                            current = action === '.' ? '0.' : action;
                            shouldResetDisplay = false;
                        } else {
                            if (action === '.' && current.includes('.')) return;
                            current = current === '0' && action !== '.' ? action : current + action;
                        }
                        display.textContent = current;
                    } else if (action === 'clear') {
                        current = '0'; previous = ''; operation = null;
                        exprEl.textContent = '';
                        display.textContent = '0';
                    } else if (action === 'backspace') {
                        current = current.slice(0, -1) || '0';
                        display.textContent = current;
                    } else if (action === 'negate') {
                        current = String(-parseFloat(current));
                        display.textContent = current;
                    } else if (action === 'pi') {
                        current = String(Math.PI);
                        display.textContent = current;
                        shouldResetDisplay = true;
                    } else if (action === 'e') {
                        current = String(Math.E);
                        display.textContent = current;
                        shouldResetDisplay = true;
                    } else if (scientificFuncs.includes(action)) {
                        scientificCalc(action);
                    } else if (action === 'pow') {
                        previous = current;
                        operation = 'pow';
                        exprEl.textContent = `${current} ^`;
                        shouldResetDisplay = true;
                    } else if (action === '(' || action === ')') {
                        if (shouldResetDisplay) {
                            current = action;
                            shouldResetDisplay = false;
                        } else {
                            current += action;
                        }
                        display.textContent = current;
                    } else if (['+', '-', '*', '/', '%'].includes(action)) {
                        previous = current;
                        operation = action;
                        exprEl.textContent = `${current} ${action === '*' ? '×' : action === '/' ? '÷' : action}`;
                        shouldResetDisplay = true;
                    } else if (action === 'mc') {
                        memory = 0;
                    } else if (action === 'mr') {
                        current = String(memory);
                        display.textContent = current;
                        shouldResetDisplay = true;
                    } else if (action === 'm+') {
                        memory += parseFloat(current);
                    } else if (action === 'm-') {
                        memory -= parseFloat(current);
                    } else if (action === '=') {
                        if (operation && previous) {
                            const a = parseFloat(previous);
                            const b = parseFloat(current);
                            let result;
                            const opSymbol = operation === '*' ? '×' : operation === '/' ? '÷' : operation;
                            switch (operation) {
                                case '+': result = a + b; break;
                                case '-': result = a - b; break;
                                case '*': result = a * b; break;
                                case '/': result = b !== 0 ? a / b : 'Error'; break;
                                case '%': result = a % b; break;
                                case 'pow': result = Math.pow(a, b); break;
                            }
                            const historyExpr = `${previous} ${opSymbol} ${current}`;
                            current = formatNumber(result);
                            display.textContent = current;
                            addToHistory(historyExpr, current);
                            exprEl.textContent = '';
                            operation = null;
                            previous = '';
                            shouldResetDisplay = true;
                        }
                    }
                }

                modeBtns.forEach(btn => {
                    lifecycle.addListener(btn, 'click', () => {
                        if (btn.dataset.mode === 'history') {
                            historyEl.classList.toggle('show');
                            return;
                        }
                        historyEl.classList.remove('show');
                        modeBtns.forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');

                        if (btn.dataset.mode === 'scientific') {
                            renderScientificGrid();
                        } else {
                            renderBasicGrid();
                        }
                    });
                });

                // Angle mode toggle (DEG/RAD)
                const angleBtn = document.getElementById(`calc-angle-mode-${windowId}`);
                if (angleBtn) {
                    lifecycle.addListener(angleBtn, 'click', () => {
                        angleMode = angleMode === 'deg' ? 'rad' : 'deg';
                        angleBtn.textContent = angleMode.toUpperCase();
                        angleBtn.classList.toggle('active', angleMode === 'deg');
                    });
                }

                attachButtonEvents();
                loadHistory();

                return {
                    destroy: () => {
                        lifecycle.destroy();
                    }
                };
            }
        };
    }
});
