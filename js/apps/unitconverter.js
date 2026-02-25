EphemeraApps.register({
    id: 'unitconverter',
    name: 'Unit Converter',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>`,
    width: 450,
    height: 520,
    category: 'utility',
    content: (windowId) => {
        return {
            html: `
                <style>
                    .conv-container { display:flex;flex-direction:column;height:100%;padding:16px; }
                    .conv-header { margin-bottom:16px; }
                    .conv-header h2 { margin:0;font-size:1.1rem;color:var(--fg-primary); }
                    .conv-category { display:flex;gap:6px;flex-wrap:wrap;margin-top:12px; }
                    .conv-cat-btn { padding:8px 14px;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--fg-muted);border-radius:var(--radius-lg);cursor:pointer;font-family:inherit;font-size:0.8rem;transition:all 0.15s; }
                    .conv-cat-btn:hover { color:var(--fg-primary); }
                    .conv-cat-btn.active { background:var(--accent);color:#fff;border-color:var(--accent); }
                    .conv-main { flex:1;display:flex;flex-direction:column;gap:16px; }
                    .conv-field { background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px; }
                    .conv-field-label { font-size:0.75rem;color:var(--fg-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px; }
                    .conv-field-input { display:flex;gap:12px;align-items:center; }
                    .conv-field-input input { flex:1;padding:12px;background:var(--bg-primary);border:1px solid var(--border);color:var(--fg-primary);border-radius:var(--radius-sm);font-family:'JetBrains Mono',monospace;font-size:1.2rem; }
                    .conv-field-input input:focus { outline:none;border-color:var(--accent); }
                    .conv-field-input select { padding:10px 12px;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--fg-primary);border-radius:var(--radius-sm);font-family:inherit;font-size:0.9rem;min-width:100px; }
                    .conv-swap { display:flex;justify-content:center; }
                    .conv-swap button { width:50px;height:50px;border-radius:50%;background:var(--accent);border:none;color:#fff;cursor:pointer;font-size:1.5rem;transition:all 0.2s; }
                    .conv-swap button:hover { transform:scale(1.1); }
                    .conv-result { background:rgba(0,212,170,0.1);border:1px solid rgba(0,212,170,0.3);border-radius:var(--radius-md);padding:20px;text-align:center; }
                    .conv-result-value { font-size:2rem;font-weight:700;color:var(--accent);font-family:'JetBrains Mono',monospace; }
                    .conv-result-unit { font-size:0.9rem;color:var(--fg-muted);margin-top:4px; }
                    .conv-common { margin-top:auto; }
                    .conv-common-title { font-size:0.75rem;color:var(--fg-muted);margin-bottom:8px; }
                    .conv-common-list { display:grid;grid-template-columns:repeat(2,1fr);gap:8px; }
                    .conv-common-item { padding:10px 12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;transition:all 0.15s; }
                    .conv-common-item:hover { border-color:var(--accent); }
                    .conv-common-value { font-size:0.9rem;color:var(--fg-primary);font-family:'JetBrains Mono',monospace; }
                    .conv-common-unit { font-size:0.7rem;color:var(--fg-muted); }
                </style>
                <div class="conv-container">
                    <div class="conv-header">
                        <h2>Unit Converter</h2>
                        <div class="conv-category" id="conv-category-${windowId}"></div>
                    </div>
                    <div class="conv-main">
                        <div class="conv-field">
                            <div class="conv-field-label">From</div>
                            <div class="conv-field-input">
                                <input type="number" id="conv-from-value-${windowId}" placeholder="0" value="1">
                                <select id="conv-from-unit-${windowId}"></select>
                            </div>
                        </div>
                        <div class="conv-swap">
                            <button id="conv-swap-${windowId}" title="Swap units">⇅</button>
                        </div>
                        <div class="conv-field">
                            <div class="conv-field-label">To</div>
                            <div class="conv-field-input">
                                <input type="number" id="conv-to-value-${windowId}" placeholder="0" readonly>
                                <select id="conv-to-unit-${windowId}"></select>
                            </div>
                        </div>
                        <div class="conv-common" id="conv-common-${windowId}"></div>
                    </div>
                </div>
            `,
            init: () => {
                const lifecycle = createAppLifecycle();

                const categoryEl = document.getElementById(`conv-category-${windowId}`);
                const fromValueEl = document.getElementById(`conv-from-value-${windowId}`);
                const fromUnitEl = document.getElementById(`conv-from-unit-${windowId}`);
                const toValueEl = document.getElementById(`conv-to-value-${windowId}`);
                const toUnitEl = document.getElementById(`conv-to-unit-${windowId}`);
                const swapBtn = document.getElementById(`conv-swap-${windowId}`);
                const commonEl = document.getElementById(`conv-common-${windowId}`);

                const CATEGORIES = {
                    length: {
                        name: 'Length',
                        units: {
                            m: { name: 'Meters', toBase: 1 },
                            km: { name: 'Kilometers', toBase: 1000 },
                            cm: { name: 'Centimeters', toBase: 0.01 },
                            mm: { name: 'Millimeters', toBase: 0.001 },
                            mi: { name: 'Miles', toBase: 1609.344 },
                            yd: { name: 'Yards', toBase: 0.9144 },
                            ft: { name: 'Feet', toBase: 0.3048 },
                            in: { name: 'Inches', toBase: 0.0254 }
                        }
                    },
                    weight: {
                        name: 'Weight',
                        units: {
                            kg: { name: 'Kilograms', toBase: 1 },
                            g: { name: 'Grams', toBase: 0.001 },
                            mg: { name: 'Milligrams', toBase: 0.000001 },
                            lb: { name: 'Pounds', toBase: 0.453592 },
                            oz: { name: 'Ounces', toBase: 0.0283495 },
                            t: { name: 'Metric Tons', toBase: 1000 }
                        }
                    },
                    temperature: {
                        name: 'Temperature',
                        units: {
                            c: { name: 'Celsius' },
                            f: { name: 'Fahrenheit' },
                            k: { name: 'Kelvin' }
                        }
                    },
                    volume: {
                        name: 'Volume',
                        units: {
                            l: { name: 'Liters', toBase: 1 },
                            ml: { name: 'Milliliters', toBase: 0.001 },
                            gal: { name: 'Gallons (US)', toBase: 3.78541 },
                            qt: { name: 'Quarts', toBase: 0.946353 },
                            pt: { name: 'Pints', toBase: 0.473176 },
                            cup: { name: 'Cups', toBase: 0.236588 }
                        }
                    },
                    area: {
                        name: 'Area',
                        units: {
                            m2: { name: 'Square Meters', toBase: 1 },
                            km2: { name: 'Square Kilometers', toBase: 1000000 },
                            ha: { name: 'Hectares', toBase: 10000 },
                            acre: { name: 'Acres', toBase: 4046.86 },
                            ft2: { name: 'Square Feet', toBase: 0.092903 }
                        }
                    },
                    speed: {
                        name: 'Speed',
                        units: {
                            mps: { name: 'Meters/sec', toBase: 1 },
                            kmh: { name: 'Km/hour', toBase: 0.277778 },
                            mph: { name: 'Miles/hour', toBase: 0.44704 },
                            kn: { name: 'Knots', toBase: 0.514444 },
                            fps: { name: 'Feet/sec', toBase: 0.3048 }
                        }
                    },
                    time: {
                        name: 'Time',
                        units: {
                            s: { name: 'Seconds', toBase: 1 },
                            min: { name: 'Minutes', toBase: 60 },
                            h: { name: 'Hours', toBase: 3600 },
                            d: { name: 'Days', toBase: 86400 },
                            wk: { name: 'Weeks', toBase: 604800 },
                            mo: { name: 'Months', toBase: 2592000 },
                            yr: { name: 'Years', toBase: 31536000 }
                        }
                    },
                    data: {
                        name: 'Data',
                        units: {
                            b: { name: 'Bytes', toBase: 1 },
                            kb: { name: 'Kilobytes', toBase: 1024 },
                            mb: { name: 'Megabytes', toBase: 1048576 },
                            gb: { name: 'Gigabytes', toBase: 1073741824 },
                            tb: { name: 'Terabytes', toBase: 1099511627776 }
                        }
                    }
                };

                let currentCategory = 'length';

                function renderCategories() {
                    categoryEl.innerHTML = Object.entries(CATEGORIES).map(([id, cat]) => 
                        `<button class="conv-cat-btn ${id === currentCategory ? 'active' : ''}" data-cat="${id}">${cat.name}</button>`
                    ).join('');

                    categoryEl.querySelectorAll('.conv-cat-btn').forEach(btn => {
                        btn.addEventListener('click', () => {
                            currentCategory = btn.dataset.cat;
                            renderCategories();
                            renderUnits();
                            convert();
                        });
                    });
                }

                function renderUnits() {
                    const units = CATEGORIES[currentCategory].units;
                    const unitOptions = Object.entries(units).map(([id, u]) => 
                        `<option value="${id}">${u.name}</option>`
                    ).join('');

                    fromUnitEl.innerHTML = unitOptions;
                    toUnitEl.innerHTML = unitOptions;

                    const unitIds = Object.keys(units);
                    if (unitIds.length > 1) {
                        toUnitEl.value = unitIds[1];
                    }
                }

                function convert() {
                    const value = parseFloat(fromValueEl.value) || 0;
                    const fromUnit = fromUnitEl.value;
                    const toUnit = toUnitEl.value;
                    const category = CATEGORIES[currentCategory];

                    let result;

                    if (currentCategory === 'temperature') {
                        result = convertTemperature(value, fromUnit, toUnit);
                    } else {
                        const fromBase = category.units[fromUnit].toBase;
                        const toBase = category.units[toUnit].toBase;
                        result = (value * fromBase) / toBase;
                    }

                    const formatted = formatNumber(result);
                    toValueEl.value = formatted;
                    renderCommon(value, fromUnit);
                }

                function convertTemperature(value, from, to) {
                    let celsius;
                    switch (from) {
                        case 'c': celsius = value; break;
                        case 'f': celsius = (value - 32) * 5/9; break;
                        case 'k': celsius = value - 273.15; break;
                    }

                    switch (to) {
                        case 'c': return celsius;
                        case 'f': return celsius * 9/5 + 32;
                        case 'k': return celsius + 273.15;
                    }
                }

                function formatNumber(num) {
                    if (Math.abs(num) < 0.000001 || Math.abs(num) > 999999999) {
                        return num.toExponential(6);
                    }
                    if (Number.isInteger(num)) return num.toString();
                    return parseFloat(num.toPrecision(10)).toString();
                }

                function renderCommon(value, fromUnit) {
                    const category = CATEGORIES[currentCategory];
                    const units = Object.entries(category.units).filter(([id]) => id !== fromUnit).slice(0, 4);

                    commonEl.innerHTML = `
                        <div class="conv-common-title">Also equals</div>
                        <div class="conv-common-list">
                            ${units.map(([id, unit]) => {
                                let result;
                                if (currentCategory === 'temperature') {
                                    result = convertTemperature(value, fromUnit, id);
                                } else {
                                    result = (value * category.units[fromUnit].toBase) / unit.toBase;
                                }
                                return `
                                    <div class="conv-common-item" data-unit="${id}">
                                        <div class="conv-common-value">${formatNumber(result)}</div>
                                        <div class="conv-common-unit">${unit.name}</div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `;

                    commonEl.querySelectorAll('.conv-common-item').forEach(item => {
                        item.addEventListener('click', () => {
                            toUnitEl.value = item.dataset.unit;
                            convert();
                        });
                    });
                }

                lifecycle.addListener(fromValueEl, 'input', convert);
                lifecycle.addListener(fromUnitEl, 'change', convert);
                lifecycle.addListener(toUnitEl, 'change', convert);

                lifecycle.addListener(swapBtn, 'click', () => {
                    const tempUnit = fromUnitEl.value;
                    fromUnitEl.value = toUnitEl.value;
                    toUnitEl.value = tempUnit;

                    const tempValue = fromValueEl.value;
                    fromValueEl.value = toValueEl.value;
                    toValueEl.value = tempValue;

                    convert();
                });

                renderCategories();
                renderUnits();
                convert();

                return {
                    destroy: () => {
                        lifecycle.destroy();
                    }
                };
            }
        };
    }
});
