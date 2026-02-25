EphemeraApps.register({
    id: 'todo',
    name: 'Tasks',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>`,
    width: 900,
    height: 600,
    category: 'productivity',
    singleton: true,
    content: (windowId) => {
        return {
            html: `
                <style>
                    .todo-container { display:flex;flex-direction:column;height:100%;background:var(--bg-primary); }
                    .todo-header { display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--bg-secondary);border-bottom:1px solid var(--border); }
                    .todo-header h2 { margin:0;font-size:1.1rem;color:var(--fg-primary); }
                    .todo-header-actions { display:flex;gap:8px; }
                    .todo-header button { padding:8px 16px;background:var(--accent);border:none;color:#fff;border-radius:var(--radius-sm);cursor:pointer;font-family:inherit;font-size:0.8rem;transition:all 0.2s; }
                    .todo-header button:hover { filter:brightness(1.1); }
                    .todo-header button.secondary { background:var(--bg-tertiary);color:var(--fg-secondary); }
                    .todo-columns { display:flex;flex:1;padding:16px;gap:16px;overflow-x:auto; }
                    .todo-column { min-width:260px;max-width:300px;background:var(--bg-secondary);border-radius:var(--radius-md);display:flex;flex-direction:column;max-height:100%; }
                    .todo-column-header { padding:12px 16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center; }
                    .todo-column-title { font-weight:600;color:var(--fg-primary);display:flex;align-items:center;gap:8px; }
                    .todo-column-count { background:var(--bg-tertiary);padding:2px 8px;border-radius:10px;font-size:0.75rem;color:var(--fg-muted); }
                    .todo-column-content { flex:1;padding:12px;overflow-y:auto; }
                    .todo-card { background:var(--bg-primary);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;margin-bottom:10px;cursor:grab;transition:all 0.2s; }
                    .todo-card:hover { border-color:var(--accent); }
                    .todo-card.dragging { opacity:0.5; }
                    .todo-card-title { font-size:0.9rem;color:var(--fg-primary);margin-bottom:6px; }
                    .todo-card-desc { font-size:0.75rem;color:var(--fg-muted);margin-bottom:8px;line-height:1.4; }
                    .todo-card-meta { display:flex;justify-content:space-between;align-items:center;font-size:0.7rem; }
                    .todo-card-priority { padding:2px 6px;border-radius:4px;font-weight:500; }
                    .todo-card-priority.high { background:rgba(239,68,68,0.2);color:#ef4444; }
                    .todo-card-priority.medium { background:rgba(245,158,11,0.2);color:#f59e0b; }
                    .todo-card-priority.low { background:rgba(34,197,94,0.2);color:#22c55e; }
                    .todo-card-due { color:var(--fg-muted); }
                    .todo-card-due.overdue { color:#ef4444; }
                    .todo-card-due.today { color:#f59e0b; }
                    .todo-add-card { display:flex;align-items:center;justify-content:center;padding:12px;color:var(--fg-muted);cursor:pointer;border-radius:var(--radius-sm);transition:all 0.2s; }
                    .todo-add-card:hover { background:var(--bg-tertiary);color:var(--fg-primary); }
                    .todo-modal-overlay { position:absolute;inset:0;background:rgba(0,0,0,0.6);display:none;align-items:center;justify-content:center;z-index:100; }
                    .todo-modal-overlay.active { display:flex; }
                    .todo-modal { background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-lg);padding:24px;width:400px;max-width:90%; }
                    .todo-modal h3 { margin:0 0 16px;color:var(--fg-primary); }
                    .todo-modal-field { margin-bottom:16px; }
                    .todo-modal-field label { display:block;margin-bottom:6px;font-size:0.8rem;color:var(--fg-secondary); }
                    .todo-modal-field input,.todo-modal-field textarea,.todo-modal-field select { width:100%;padding:10px 12px;background:var(--bg-primary);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--fg-primary);font-family:inherit;font-size:0.9rem; }
                    .todo-modal-field input:focus,.todo-modal-field textarea:focus,.todo-modal-field select:focus { outline:none;border-color:var(--accent); }
                    .todo-modal-field textarea { resize:vertical;min-height:80px; }
                    .todo-modal-actions { display:flex;gap:10px;justify-content:flex-end;margin-top:20px; }
                    .todo-modal-actions button { padding:10px 20px;border-radius:var(--radius-sm);cursor:pointer;font-family:inherit;font-size:0.85rem; }
                    .todo-modal-actions .btn-primary { background:var(--accent);border:none;color:#fff; }
                    .todo-modal-actions .btn-secondary { background:transparent;border:1px solid var(--border);color:var(--fg-secondary); }
                    .todo-card-actions { display:flex;gap:4px;opacity:0;transition:opacity 0.2s; }
                    .todo-card:hover .todo-card-actions { opacity:1; }
                    .todo-card-actions button { background:none;border:none;color:var(--fg-muted);cursor:pointer;padding:4px;border-radius:4px; }
                    .todo-card-actions button:hover { color:var(--fg-primary);background:var(--bg-tertiary); }
                    .todo-empty { text-align:center;color:var(--fg-muted);padding:40px 20px; }
                </style>
                <div class="todo-container">
                    <div class="todo-header">
                        <h2>Task Manager</h2>
                        <div class="todo-header-actions">
                            <button class="secondary" id="todo-clear-${windowId}">Clear All</button>
                            <button id="todo-add-${windowId}">+ Add Task</button>
                        </div>
                    </div>
                    <div class="todo-columns" id="todo-columns-${windowId}"></div>
                    <div class="todo-modal-overlay" id="todo-modal-${windowId}">
                        <div class="todo-modal">
                            <h3 id="todo-modal-title-${windowId}">New Task</h3>
                            <div class="todo-modal-field">
                                <label>Title</label>
                                <input type="text" id="todo-input-title-${windowId}" placeholder="Task title...">
                            </div>
                            <div class="todo-modal-field">
                                <label>Description</label>
                                <textarea id="todo-input-desc-${windowId}" placeholder="Optional description..."></textarea>
                            </div>
                            <div class="todo-modal-field">
                                <label>Priority</label>
                                <select id="todo-input-priority-${windowId}">
                                    <option value="low">Low</option>
                                    <option value="medium" selected>Medium</option>
                                    <option value="high">High</option>
                                </select>
                            </div>
                            <div class="todo-modal-field">
                                <label>Due Date</label>
                                <input type="date" id="todo-input-due-${windowId}">
                            </div>
                            <div class="todo-modal-actions">
                                <button class="btn-secondary" id="todo-modal-cancel-${windowId}">Cancel</button>
                                <button class="btn-primary" id="todo-modal-save-${windowId}">Save Task</button>
                            </div>
                        </div>
                    </div>
                </div>
            `,
            init: async () => {
                const lifecycle = createAppLifecycle();

                const container = document.getElementById(`todo-columns-${windowId}`);
                const modal = document.getElementById(`todo-modal-${windowId}`);
                const modalTitle = document.getElementById(`todo-modal-title-${windowId}`);
                const inputTitle = document.getElementById(`todo-input-title-${windowId}`);
                const inputDesc = document.getElementById(`todo-input-desc-${windowId}`);
                const inputPriority = document.getElementById(`todo-input-priority-${windowId}`);
                const inputDue = document.getElementById(`todo-input-due-${windowId}`);
                const btnSave = document.getElementById(`todo-modal-save-${windowId}`);
                const btnCancel = document.getElementById(`todo-modal-cancel-${windowId}`);
                const btnAdd = document.getElementById(`todo-add-${windowId}`);
                const btnClear = document.getElementById(`todo-clear-${windowId}`);

                const STORAGE_KEY = 'ephemera_todos';
                const COLUMNS = [
                    { id: 'todo', name: 'To Do', color: '#6366f1' },
                    { id: 'progress', name: 'In Progress', color: '#f59e0b' },
                    { id: 'review', name: 'Review', color: '#8b5cf6' },
                    { id: 'done', name: 'Done', color: '#22c55e' }
                ];

                let tasks = [];
                let editingTaskId = null;
                let draggedCard = null;

                async function loadTasks() {
                    const stored = await EphemeraStorage.get('metadata', STORAGE_KEY);
                    tasks = stored?.tasks || [];
                    render();
                }

                async function saveTasks() {
                    await EphemeraStorage.put('metadata', { key: STORAGE_KEY, tasks, updated: Date.now() });
                }

                function generateId() {
                    return 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                }

                function formatDate(dateStr) {
                    if (!dateStr) return '';
                    const date = new Date(dateStr);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const taskDate = new Date(dateStr);
                    taskDate.setHours(0, 0, 0, 0);
                    const diff = Math.floor((taskDate - today) / (1000 * 60 * 60 * 24));
                    if (diff < 0) return { text: 'Overdue', class: 'overdue' };
                    if (diff === 0) return { text: 'Today', class: 'today' };
                    if (diff === 1) return { text: 'Tomorrow', class: '' };
                    return { text: date.toLocaleDateString(), class: '' };
                }

                function render() {
                    container.innerHTML = '';
                    COLUMNS.forEach(col => {
                        const colTasks = tasks.filter(t => t.column === col.id);
                        const colEl = document.createElement('div');
                        colEl.className = 'todo-column';
                        colEl.dataset.column = col.id;
                        colEl.innerHTML = `
                            <div class="todo-column-header">
                                <div class="todo-column-title">
                                    <span style="width:8px;height:8px;border-radius:50%;background:${col.color}"></span>
                                    ${col.name}
                                </div>
                                <span class="todo-column-count">${colTasks.length}</span>
                            </div>
                            <div class="todo-column-content" data-column="${col.id}">
                                ${colTasks.length === 0 ? '<div class="todo-empty">No tasks</div>' : ''}
                                ${colTasks.map(t => createCardHTML(t)).join('')}
                                <div class="todo-add-card" data-column="${col.id}">+ Add task</div>
                            </div>
                        `;
                        container.appendChild(colEl);
                    });
                    attachCardEvents();
                    attachDropEvents();
                }

                function createCardHTML(task) {
                    const due = formatDate(task.due);
                    return `
                        <div class="todo-card" draggable="true" data-id="${task.id}">
                            <div class="todo-card-title">${EphemeraSanitize.escapeHtml(task.title)}</div>
                            ${task.desc ? `<div class="todo-card-desc">${EphemeraSanitize.escapeHtml(task.desc)}</div>` : ''}
                            <div class="todo-card-meta">
                                <span class="todo-card-priority ${task.priority}">${task.priority}</span>
                                ${due.text ? `<span class="todo-card-due ${due.class}">${due.text}</span>` : ''}
                                <div class="todo-card-actions">
                                    <button data-action="edit" title="Edit">&#9998;</button>
                                    <button data-action="delete" title="Delete">&times;</button>
                                </div>
                            </div>
                        </div>
                    `;
                }

                function attachCardEvents() {
                    container.querySelectorAll('.todo-card').forEach(card => {
                        card.addEventListener('dragstart', (e) => {
                            draggedCard = card;
                            card.classList.add('dragging');
                            e.dataTransfer.effectAllowed = 'move';
                        });
                        card.addEventListener('dragend', () => {
                            card.classList.remove('dragging');
                            draggedCard = null;
                        });
                    });

                    container.querySelectorAll('.todo-card-actions button').forEach(btn => {
                        btn.addEventListener('click', async (e) => {
                            e.stopPropagation();
                            const card = btn.closest('.todo-card');
                            const taskId = card.dataset.id;
                            if (btn.dataset.action === 'edit') {
                                openEditModal(taskId);
                            } else if (btn.dataset.action === 'delete') {
                                await deleteTask(taskId);
                            }
                        });
                    });

                    container.querySelectorAll('.todo-add-card').forEach(btn => {
                        btn.addEventListener('click', () => {
                            openModal(null, btn.dataset.column);
                        });
                    });
                }

                function attachDropEvents() {
                    container.querySelectorAll('.todo-column-content').forEach(col => {
                        col.addEventListener('dragover', (e) => {
                            e.preventDefault();
                            col.style.background = 'rgba(0,212,170,0.1)';
                        });
                        col.addEventListener('dragleave', () => {
                            col.style.background = '';
                        });
                        col.addEventListener('drop', (e) => {
                            e.preventDefault();
                            col.style.background = '';
                            if (draggedCard) {
                                const taskId = draggedCard.dataset.id;
                                const newColumn = col.dataset.column;
                                const task = tasks.find(t => t.id === taskId);
                                if (task) {
                                    task.column = newColumn;
                                    task.updatedAt = Date.now();
                                    saveTasks();
                                    render();
                                    if (newColumn === 'done') {
                                        EphemeraNotifications.success('Task Completed', `"${task.title}" moved to Done!`);
                                    }
                                }
                            }
                        });
                    });
                }

                function openModal(task = null, defaultColumn = 'todo') {
                    editingTaskId = task?.id || null;
                    modalTitle.textContent = task ? 'Edit Task' : 'New Task';
                    inputTitle.value = task?.title || '';
                    inputDesc.value = task?.desc || '';
                    inputPriority.value = task?.priority || 'medium';
                    inputDue.value = task?.due || '';
                    modal.dataset.column = task?.column || defaultColumn;
                    modal.classList.add('active');
                    inputTitle.focus();
                }

                function openEditModal(taskId) {
                    const task = tasks.find(t => t.id === taskId);
                    if (task) openModal(task);
                }

                function closeModal() {
                    modal.classList.remove('active');
                    editingTaskId = null;
                }

                function saveTask() {
                    const title = inputTitle.value.trim();
                    if (!title) {
                        inputTitle.focus();
                        return;
                    }

                    const taskData = {
                        id: editingTaskId || generateId(),
                        title,
                        desc: inputDesc.value.trim(),
                        priority: inputPriority.value,
                        due: inputDue.value,
                        column: modal.dataset.column || 'todo',
                        createdAt: editingTaskId ? tasks.find(t => t.id === editingTaskId)?.createdAt : Date.now(),
                        updatedAt: Date.now()
                    };

                    if (editingTaskId) {
                        const idx = tasks.findIndex(t => t.id === editingTaskId);
                        if (idx !== -1) tasks[idx] = taskData;
                    } else {
                        tasks.push(taskData);
                    }

                    saveTasks();
                    closeModal();
                    render();
                    EphemeraNotifications.success(editingTaskId ? 'Task Updated' : 'Task Created', `"${title}" saved.`);
                }

                async function deleteTask(taskId) {
                    const task = tasks.find(t => t.id === taskId);
                    if (!task) return;
                    const confirmed = await window.EphemeraDialog?.confirm?.(
                        `Delete "${task.title}"?`,
                        'Delete Task',
                        true
                    );
                    if (!confirmed) return;
                    tasks = tasks.filter(t => t.id !== taskId);
                    await saveTasks();
                    render();
                }

                async function clearAll() {
                    const confirmed = await window.EphemeraDialog?.confirm?.(
                        'Delete all tasks? This cannot be undone.',
                        'Clear All Tasks',
                        true
                    );
                    if (!confirmed) return;
                    tasks = [];
                    await saveTasks();
                    render();
                    EphemeraNotifications.success('Tasks Cleared', 'All tasks have been removed.');
                }

                lifecycle.addListener(btnAdd, 'click', () => openModal());
                lifecycle.addListener(btnCancel, 'click', closeModal);
                lifecycle.addListener(btnSave, 'click', saveTask);
                lifecycle.addListener(btnClear, 'click', async () => {
                    await clearAll();
                });
                lifecycle.addListener(modal, 'click', (e) => {
                    if (e.target === modal) closeModal();
                });

                lifecycle.addListener(inputTitle, 'keydown', (e) => {
                    if (e.key === 'Enter') saveTask();
                    if (e.key === 'Escape') closeModal();
                });

                await loadTasks();

                return {
                    destroy: () => {
                        lifecycle.destroy();
                    }
                };
            }
        };
    }
});
