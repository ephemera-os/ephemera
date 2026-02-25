EphemeraApps.register({
    id: 'worldclock',
    name: 'World Clock',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M12 2v2"/><path d="M12 20v2"/></svg>`,
    width: 600,
    height: 500,
    category: 'utility',
    singleton: true,
    content: (windowId) => {
        return {
            html: `
                <style>
                    .clock-container { display:flex;flex-direction:column;height:100%; }
                    .clock-header { display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--bg-secondary);border-bottom:1px solid var(--border); }
                    .clock-header h2 { margin:0;font-size:1.1rem;color:var(--fg-primary); }
                    .clock-local { text-align:center;padding:24px;background:linear-gradient(135deg,rgba(0,212,170,0.1),rgba(0,100,150,0.1));border-bottom:1px solid var(--border); }
                    .clock-local-time { font-size:3.5rem;font-weight:700;color:var(--fg-primary);font-family:'JetBrains Mono',monospace; }
                    .clock-local-date { font-size:1rem;color:var(--fg-muted);margin-top:8px; }
                    .clock-local-timezone { font-size:0.85rem;color:var(--accent);margin-top:4px; }
                    .clock-list { flex:1;overflow-y:auto;padding:12px; }
                    .clock-item { display:flex;align-items:center;padding:16px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-md);margin-bottom:10px; }
                    .clock-item-time { min-width:120px; }
                    .clock-item-hours { font-size:1.8rem;font-weight:600;color:var(--fg-primary);font-family:'JetBrains Mono',monospace; }
                    .clock-item-period { font-size:0.9rem;color:var(--fg-muted);margin-left:4px; }
                    .clock-item-info { flex:1;margin-left:16px; }
                    .clock-item-city { font-size:1rem;color:var(--fg-primary);font-weight:500;margin-bottom:4px; }
                    .clock-item-offset { font-size:0.8rem;color:var(--fg-muted); }
                    .clock-item-date { font-size:0.75rem;color:var(--fg-muted);margin-top:2px; }
                    .clock-item-actions { display:flex;gap:6px; }
                    .clock-item-actions button { padding:6px 10px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;font-size:0.75rem;color:var(--fg-muted); }
                    .clock-item-actions button:hover { color:var(--fg-primary); }
                    .clock-item.night { background:rgba(0,0,30,0.3); }
                    .clock-item.night .clock-item-hours { color:#8b9dc3; }
                    .clock-add { padding:12px 16px;background:var(--bg-secondary);border-top:1px solid var(--border); }
                    .clock-add select { width:100%;padding:10px 12px;background:var(--bg-primary);border:1px solid var(--border);color:var(--fg-primary);border-radius:var(--radius-sm);font-family:inherit;font-size:0.9rem; }
                    .clock-add select:focus { outline:none;border-color:var(--accent); }
                    .clock-empty { text-align:center;color:var(--fg-muted);padding:40px; }
                    .clock-diff { font-size:0.7rem;padding:2px 6px;background:var(--bg-tertiary);border-radius:4px;color:var(--fg-muted);margin-left:8px; }
                </style>
                <div class="clock-container">
                    <div class="clock-header">
                        <h2>World Clock</h2>
                        <button id="clock-add-btn-${windowId}" style="padding:8px 14px;background:var(--accent);border:none;color:#fff;border-radius:var(--radius-sm);cursor:pointer;font-family:inherit;font-size:0.8rem;">+ Add City</button>
                    </div>
                    <div class="clock-local">
                        <div class="clock-local-time" id="clock-local-time-${windowId}">--:--:--</div>
                        <div class="clock-local-date" id="clock-local-date-${windowId}">Loading...</div>
                        <div class="clock-local-timezone" id="clock-local-tz-${windowId}">Local Time</div>
                    </div>
                    <div class="clock-list" id="clock-list-${windowId}"></div>
                    <div class="clock-add" id="clock-add-panel-${windowId}" style="display:none;">
                        <select id="clock-city-select-${windowId}">
                            <option value="">Select a city...</option>
                        </select>
                    </div>
                </div>
            `,
            init: async () => {
                const lifecycle = createAppLifecycle();

                const localTimeEl = document.getElementById(`clock-local-time-${windowId}`);
                const localDateEl = document.getElementById(`clock-local-date-${windowId}`);
                const localTzEl = document.getElementById(`clock-local-tz-${windowId}`);
                const listEl = document.getElementById(`clock-list-${windowId}`);
                const addBtn = document.getElementById(`clock-add-btn-${windowId}`);
                const addPanel = document.getElementById(`clock-add-panel-${windowId}`);
                const citySelect = document.getElementById(`clock-city-select-${windowId}`);

                const STORAGE_KEY = 'ephemera_worldclock_cities';

                const CITIES = [
                    { id: 'new_york', city: 'New York', country: 'USA', timezone: 'America/New_York' },
                    { id: 'los_angeles', city: 'Los Angeles', country: 'USA', timezone: 'America/Los_Angeles' },
                    { id: 'chicago', city: 'Chicago', country: 'USA', timezone: 'America/Chicago' },
                    { id: 'london', city: 'London', country: 'UK', timezone: 'Europe/London' },
                    { id: 'paris', city: 'Paris', country: 'France', timezone: 'Europe/Paris' },
                    { id: 'berlin', city: 'Berlin', country: 'Germany', timezone: 'Europe/Berlin' },
                    { id: 'moscow', city: 'Moscow', country: 'Russia', timezone: 'Europe/Moscow' },
                    { id: 'dubai', city: 'Dubai', country: 'UAE', timezone: 'Asia/Dubai' },
                    { id: 'mumbai', city: 'Mumbai', country: 'India', timezone: 'Asia/Kolkata' },
                    { id: 'singapore', city: 'Singapore', country: 'Singapore', timezone: 'Asia/Singapore' },
                    { id: 'hong_kong', city: 'Hong Kong', country: 'China', timezone: 'Asia/Hong_Kong' },
                    { id: 'beijing', city: 'Beijing', country: 'China', timezone: 'Asia/Shanghai' },
                    { id: 'tokyo', city: 'Tokyo', country: 'Japan', timezone: 'Asia/Tokyo' },
                    { id: 'seoul', city: 'Seoul', country: 'South Korea', timezone: 'Asia/Seoul' },
                    { id: 'sydney', city: 'Sydney', country: 'Australia', timezone: 'Australia/Sydney' },
                    { id: 'melbourne', city: 'Melbourne', country: 'Australia', timezone: 'Australia/Melbourne' },
                    { id: 'auckland', city: 'Auckland', country: 'New Zealand', timezone: 'Pacific/Auckland' },
                    { id: 'sao_paulo', city: 'São Paulo', country: 'Brazil', timezone: 'America/Sao_Paulo' },
                    { id: 'toronto', city: 'Toronto', country: 'Canada', timezone: 'America/Toronto' },
                    { id: 'vancouver', city: 'Vancouver', country: 'Canada', timezone: 'America/Vancouver' },
                    { id: 'amsterdam', city: 'Amsterdam', country: 'Netherlands', timezone: 'Europe/Amsterdam' },
                    { id: 'rome', city: 'Rome', country: 'Italy', timezone: 'Europe/Rome' },
                    { id: 'madrid', city: 'Madrid', country: 'Spain', timezone: 'Europe/Madrid' },
                    { id: 'bangkok', city: 'Bangkok', country: 'Thailand', timezone: 'Asia/Bangkok' },
                    { id: 'jakarta', city: 'Jakarta', country: 'Indonesia', timezone: 'Asia/Jakarta' },
                    { id: 'cairo', city: 'Cairo', country: 'Egypt', timezone: 'Africa/Cairo' },
                    { id: 'johannesburg', city: 'Johannesburg', country: 'South Africa', timezone: 'Africa/Johannesburg' },
                    { id: 'istanbul', city: 'Istanbul', country: 'Turkey', timezone: 'Europe/Istanbul' }
                ];

                let selectedCities = [];

                async function loadCities() {
                    const stored = await EphemeraStorage.get('metadata', STORAGE_KEY);
                    selectedCities = stored?.cities || ['london', 'tokyo', 'sydney'];
                    populateSelect();
                    renderList();
                }

                async function saveCities() {
                    await EphemeraStorage.put('metadata', { key: STORAGE_KEY, cities: selectedCities });
                }

                function populateSelect() {
                    const available = CITIES.filter(c => !selectedCities.includes(c.id));
                    citySelect.innerHTML = '<option value="">Select a city to add...</option>' +
                        available.map(c => `<option value="${c.id}">${c.city}, ${c.country}</option>`).join('');
                }

                function formatTimeShort(date, timezone) {
                    return new Date(date).toLocaleTimeString('en-US', {
                        timeZone: timezone,
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                    });
                }

                function formatDate(date, timezone) {
                    return new Date(date).toLocaleDateString('en-US', {
                        timeZone: timezone,
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                    });
                }

                function getOffset(timezone) {
                    const now = new Date();
                    const targetDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
                    const localDate = new Date(now.toLocaleString('en-US'));
                    const diff = (targetDate - localDate) / (1000 * 60 * 60);
                    const sign = diff >= 0 ? '+' : '';
                    return `UTC${sign}${diff}`;
                }

                function getOffsetDiff(timezone) {
                    const now = new Date();
                    const localOffset = -now.getTimezoneOffset() / 60;
                    const targetDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
                    const localDate = new Date(now.toLocaleString('en-US'));
                    const targetOffset = (targetDate - localDate) / (1000 * 60 * 60);
                    const diff = targetOffset - localOffset;
                    
                    if (diff === 0) return 'Same time';
                    const hours = Math.abs(diff);
                    const sign = diff > 0 ? '+' : '-';
                    return `${sign}${hours}h from you`;
                }

                function isNightTime(timezone) {
                    const hourInTz = new Date().toLocaleString('en-US', { timeZone: timezone, hour: 'numeric', hour12: false });
                    return parseInt(hourInTz) < 6 || parseInt(hourInTz) > 20;
                }

                function updateLocalTime() {
                    const now = new Date();
                    localTimeEl.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
                    localDateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                    
                    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                    localTzEl.textContent = `${tz.replace(/_/g, ' ')} (${getOffset(tz)})`;
                }

                function renderList() {
                    if (selectedCities.length === 0) {
                        listEl.innerHTML = `<div class="clock-empty">No cities added. Click "Add City" to add world clocks.</div>`;
                        return;
                    }

                    listEl.innerHTML = selectedCities.map(cityId => {
                        const city = CITIES.find(c => c.id === cityId);
                        if (!city) return '';
                        
                        const now = new Date();
                        const time = formatTimeShort(now, city.timezone);
                        const date = formatDate(now, city.timezone);
                        const offset = getOffset(city.timezone);
                        const diff = getOffsetDiff(city.timezone);
                        const isNight = isNightTime(city.timezone);

                        return `
                            <div class="clock-item ${isNight ? 'night' : ''}" data-id="${city.id}">
                                <div class="clock-item-time">
                                    <span class="clock-item-hours">${time.split(' ')[0]}</span>
                                    <span class="clock-item-period">${time.split(' ')[1]}</span>
                                </div>
                                <div class="clock-item-info">
                                    <div class="clock-item-city">${city.city}</div>
                                    <div class="clock-item-offset">${city.country} · ${offset}<span class="clock-diff">${diff}</span></div>
                                    <div class="clock-item-date">${date}</div>
                                </div>
                                <div class="clock-item-actions">
                                    <button data-action="remove" title="Remove">×</button>
                                </div>
                            </div>
                        `;
                    }).join('');

                    listEl.querySelectorAll('.clock-item-actions button').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const item = btn.closest('.clock-item');
                            const cityId = item.dataset.id;
                            if (btn.dataset.action === 'remove') {
                                removeCity(cityId);
                            }
                        });
                    });
                }

                function addCity(cityId) {
                    if (!selectedCities.includes(cityId)) {
                        selectedCities.push(cityId);
                        saveCities();
                        populateSelect();
                        renderList();
                    }
                }

                function removeCity(cityId) {
                    selectedCities = selectedCities.filter(id => id !== cityId);
                    saveCities();
                    populateSelect();
                    renderList();
                }

                function updateAll() {
                    updateLocalTime();
                    renderList();
                }

                lifecycle.addListener(addBtn, 'click', () => {
                    const isVisible = addPanel.style.display === 'block';
                    addPanel.style.display = isVisible ? 'none' : 'block';
                    if (!isVisible) {
                        citySelect.focus();
                    }
                });

                lifecycle.addListener(citySelect, 'change', () => {
                    if (citySelect.value) {
                        addCity(citySelect.value);
                        citySelect.value = '';
                        addPanel.style.display = 'none';
                    }
                });

                updateAll();
                lifecycle.addInterval(setInterval(updateAll, 1000));

                await loadCities();

                return { destroy: lifecycle.destroy };
            }
        };
    }
});
