EphemeraApps.register({
    id: 'calendar',
    name: 'Calendar',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    width: 450,
    height: 500,
    category: 'productivity',
    content: (windowId) => {
        return {
            html: `
                <style>
                    .calendar-container { height:100%;display:flex;flex-direction:column; }
                    .calendar-header { display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--border); }
                    .calendar-header h2 { font-size:1.2rem; }
                    .calendar-nav { display:flex;gap:8px; }
                    .calendar-nav button { width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;color:var(--fg-secondary); }
                    .calendar-nav button:hover { background:var(--bg-secondary);color:var(--fg-primary); }
                    .calendar-days { display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:8px; }
                    .calendar-day-name { text-align:center;font-size:0.75rem;color:var(--fg-muted);padding:8px 0; }
                    .calendar-grid { display:grid;grid-template-columns:repeat(7,1fr);gap:4px;flex:1; }
                    .calendar-day { aspect-ratio:1;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:var(--radius-sm);cursor:pointer;font-size:0.9rem;transition:all 0.15s;position:relative; }
                    .calendar-day:hover { background:rgba(255,255,255,0.08); }
                    .calendar-day.other-month { color:var(--fg-muted);opacity:0.5; }
                    .calendar-day.today { background:rgba(0,212,170,0.2);color:var(--accent);font-weight:600; }
                    .calendar-day.selected { background:var(--accent);color:var(--bg-primary); }
                    .calendar-day.has-event::after { content:'';position:absolute;bottom:4px;width:4px;height:4px;background:var(--warning);border-radius:50%; }
                    .calendar-events { border-top:1px solid var(--border);padding-top:12px;margin-top:12px;max-height:150px;overflow-y:auto; }
                    .calendar-events h4 { font-size:0.85rem;color:var(--fg-secondary);margin-bottom:8px; }
                    .event-item { display:flex;align-items:center;gap:10px;padding:8px;background:var(--bg-tertiary);border-radius:var(--radius-sm);margin-bottom:6px; }
                    .event-item .time { font-size:0.75rem;color:var(--accent);font-family:var(--font-mono); }
                    .event-item .title { font-size:0.85rem;flex:1; }
                    .event-item .delete { opacity:0.5;cursor:pointer; }
                    .event-item .delete:hover { opacity:1;color:var(--danger); }
                    .add-event { display:flex;gap:8px;margin-top:12px; }
                    .add-event input { flex:1; }
                    .add-event input[type="time"] { width:100px;flex:none; }
                </style>
                <div class="calendar-container">
                    <div class="calendar-header">
                        <h2 id="calendar-month-${windowId}"></h2>
                        <div class="calendar-nav">
                            <button id="cal-prev-${windowId}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></button>
                            <button id="cal-today-${windowId}">Today</button>
                            <button id="cal-next-${windowId}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>
                        </div>
                    </div>
                    <div class="calendar-days">
                        <div class="calendar-day-name">Sun</div>
                        <div class="calendar-day-name">Mon</div>
                        <div class="calendar-day-name">Tue</div>
                        <div class="calendar-day-name">Wed</div>
                        <div class="calendar-day-name">Thu</div>
                        <div class="calendar-day-name">Fri</div>
                        <div class="calendar-day-name">Sat</div>
                    </div>
                    <div class="calendar-grid" id="calendar-grid-${windowId}"></div>
                    <div class="calendar-events" id="calendar-events-${windowId}">
                        <h4>Events for <span id="selected-date-${windowId}">today</span></h4>
                        <div id="events-list-${windowId}"></div>
                        <div class="add-event">
                            <input type="time" id="event-time-${windowId}" value="09:00">
                            <input type="text" id="event-title-${windowId}" placeholder="Add event...">
                            <button class="btn btn-sm" id="add-event-${windowId}">Add</button>
                        </div>
                    </div>
                </div>
            `,
            init: () => {
                const lifecycle = createAppLifecycle();

                const grid = document.getElementById(`calendar-grid-${windowId}`);
                const monthEl = document.getElementById(`calendar-month-${windowId}`);
                const selectedDateEl = document.getElementById(`selected-date-${windowId}`);
                const eventsList = document.getElementById(`events-list-${windowId}`);
                const eventTimeInput = document.getElementById(`event-time-${windowId}`);
                const eventTitleInput = document.getElementById(`event-title-${windowId}`);
                
                let currentDate = new Date();
                let selectedDate = new Date();
                let events = {};
                
                function loadEvents() {
                    const saved = localStorage.getItem('calendar-events');
                    if (saved) events = JSON.parse(saved);
                }
                
                function saveEvents() {
                    localStorage.setItem('calendar-events', JSON.stringify(events));
                }
                
                function getDateKey(date) {
                    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                }
                
                function render() {
                    const year = currentDate.getFullYear();
                    const month = currentDate.getMonth();
                    
                    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                    monthEl.textContent = `${monthNames[month]} ${year}`;
                    
                    const firstDay = new Date(year, month, 1).getDay();
                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                    const daysInPrevMonth = new Date(year, month, 0).getDate();
                    
                    const today = new Date();
                    const todayKey = getDateKey(today);
                    const selectedKey = getDateKey(selectedDate);
                    
                    let html = '';
                    
                    for (let i = firstDay - 1; i >= 0; i--) {
                        const day = daysInPrevMonth - i;
                        html += `<div class="calendar-day other-month" data-day="${day}">${day}</div>`;
                    }
                    
                    for (let day = 1; day <= daysInMonth; day++) {
                        const date = new Date(year, month, day);
                        const key = getDateKey(date);
                        const isToday = key === todayKey;
                        const isSelected = key === selectedKey;
                        const hasEvent = events[key] && events[key].length > 0;
                        
                        let classes = 'calendar-day';
                        if (isToday) classes += ' today';
                        if (isSelected) classes += ' selected';
                        if (hasEvent) classes += ' has-event';
                        
                        html += `<div class="${classes}" data-day="${day}" data-key="${key}">${day}</div>`;
                    }
                    
                    const totalCells = firstDay + daysInMonth;
                    const remainingCells = (7 - (totalCells % 7)) % 7;
                    for (let day = 1; day <= remainingCells; day++) {
                        html += `<div class="calendar-day other-month" data-day="${day}">${day}</div>`;
                    }
                    
                    grid.innerHTML = html;
                    
                    grid.querySelectorAll('.calendar-day:not(.other-month)').forEach(el => {
                        el.addEventListener('click', () => {
                            const day = parseInt(el.dataset.day);
                            selectedDate = new Date(year, month, day);
                            render();
                        });
                    });
                    
                    renderEvents();
                }
                
                function renderEvents() {
                    const key = getDateKey(selectedDate);
                    const dayEvents = events[key] || [];
                    
                    selectedDateEl.textContent = selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                    
                    if (dayEvents.length === 0) {
                        eventsList.innerHTML = '<p style="color:var(--fg-muted);font-size:0.85rem;">No events</p>';
                        return;
                    }
                    
                    dayEvents.sort((a, b) => a.time.localeCompare(b.time));
                    
                    eventsList.innerHTML = dayEvents.map((event, i) => `
                        <div class="event-item">
                            <span class="time">${event.time}</span>
                            <span class="title">${event.title}</span>
                            <span class="delete" data-key="${key}" data-index="${i}">×</span>
                        </div>
                    `).join('');
                    
                    eventsList.querySelectorAll('.delete').forEach(btn => {
                        btn.addEventListener('click', () => {
                            const key = btn.dataset.key;
                            const index = parseInt(btn.dataset.index);
                            events[key].splice(index, 1);
                            if (events[key].length === 0) delete events[key];
                            saveEvents();
                            render();
                        });
                    });
                }
                
                
                lifecycle.addListener(document.getElementById(`cal-prev-${windowId}`), 'click', () => {
                    currentDate.setMonth(currentDate.getMonth() - 1);
                    render();
                });

                lifecycle.addListener(document.getElementById(`cal-next-${windowId}`), 'click', () => {
                    currentDate.setMonth(currentDate.getMonth() + 1);
                    render();
                });

                lifecycle.addListener(document.getElementById(`cal-today-${windowId}`), 'click', () => {
                    currentDate = new Date();
                    selectedDate = new Date();
                    render();
                });

                lifecycle.addListener(document.getElementById(`add-event-${windowId}`), 'click', () => {
                    const time = eventTimeInput.value;
                    const title = eventTitleInput.value.trim();

                    if (!title) return;

                    const key = getDateKey(selectedDate);
                    if (!events[key]) events[key] = [];

                    events[key].push({ time, title });
                    saveEvents();
                    render();

                    eventTitleInput.value = '';
                });

                lifecycle.addListener(eventTitleInput, 'keydown', (e) => {
                    if (e.key === 'Enter') document.getElementById(`add-event-${windowId}`).click();
                });

                loadEvents();
                render();

                return {
                    destroy: () => {
                        lifecycle.destroy();
                    }
                };
            }
        };
    }
});
