EphemeraApps.register({
    id: 'contacts',
    name: 'Contacts',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`,
    width: 700,
    height: 550,
    category: 'utility',
    singleton: true,
    content: (windowId) => {
        return {
            html: `
                <style>
                    .contacts-container { display:flex;height:100%; }
                    .contacts-sidebar { width:250px;background:var(--bg-secondary);border-right:1px solid var(--border);display:flex;flex-direction:column; }
                    .contacts-search { padding:12px;border-bottom:1px solid var(--border); }
                    .contacts-search input { width:100%;padding:10px 12px;background:var(--bg-primary);border:1px solid var(--border);border-radius:var(--radius-md);color:var(--fg-primary);font-family:inherit;font-size:0.85rem; }
                    .contacts-search input:focus { outline:none;border-color:var(--accent); }
                    .contacts-list { flex:1;overflow-y:auto;padding:8px; }
                    .contact-item { display:flex;align-items:center;padding:10px 12px;border-radius:var(--radius-sm);cursor:pointer;margin-bottom:4px;transition:background 0.15s; }
                    .contact-item:hover { background:var(--bg-tertiary); }
                    .contact-item.active { background:rgba(0,212,170,0.15); }
                    .contact-avatar { width:40px;height:40px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:1rem;margin-right:12px;flex-shrink:0; }
                    .contact-info { flex:1;overflow:hidden; }
                    .contact-name { color:var(--fg-primary);font-weight:500;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
                    .contact-preview { font-size:0.75rem;color:var(--fg-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
                    .contact-empty { text-align:center;color:var(--fg-muted);padding:40px 20px; }
                    .contacts-main { flex:1;display:flex;flex-direction:column; }
                    .contacts-header { display:flex;justify-content:space-between;align-items:center;padding:16px;border-bottom:1px solid var(--border); }
                    .contacts-header h2 { margin:0;font-size:1.2rem;color:var(--fg-primary); }
                    .contacts-header-actions { display:flex;gap:8px; }
                    .contacts-header button { padding:8px 14px;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--fg-secondary);border-radius:var(--radius-sm);cursor:pointer;font-family:inherit;font-size:0.8rem; }
                    .contacts-header button:hover { background:var(--bg-secondary);color:var(--fg-primary); }
                    .contacts-header button.primary { background:var(--accent);color:#fff;border-color:var(--accent); }
                    .contact-detail { flex:1;padding:24px;overflow-y:auto;display:none; }
                    .contact-detail.active { display:block; }
                    .contact-detail-header { display:flex;align-items:center;margin-bottom:24px; }
                    .contact-detail-avatar { width:80px;height:80px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-size:2rem;font-weight:600;margin-right:20px; }
                    .contact-detail-name { flex:1; }
                    .contact-detail-name h3 { margin:0 0 4px;font-size:1.3rem;color:var(--fg-primary); }
                    .contact-detail-name p { margin:0;color:var(--fg-muted);font-size:0.9rem; }
                    .contact-section { margin-bottom:24px; }
                    .contact-section-title { font-size:0.75rem;color:var(--fg-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px; }
                    .contact-field { display:flex;align-items:center;padding:10px 0;border-bottom:1px solid var(--border); }
                    .contact-field-icon { width:32px;color:var(--fg-muted);margin-right:12px; }
                    .contact-field-content { flex:1; }
                    .contact-field-label { font-size:0.75rem;color:var(--fg-muted);margin-bottom:2px; }
                    .contact-field-value { color:var(--fg-primary); }
                    .contact-field-value a { color:var(--accent);text-decoration:none; }
                    .contact-field-value a:hover { text-decoration:underline; }
                    .contact-field-actions { display:flex;gap:8px;opacity:0;transition:opacity 0.15s; }
                    .contact-field:hover .contact-field-actions { opacity:1; }
                    .contact-field-actions button { padding:4px 8px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;font-size:0.7rem;color:var(--fg-muted); }
                    .contact-field-actions button:hover { color:var(--fg-primary); }
                    .contact-welcome { flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--fg-muted); }
                    .contact-welcome svg { width:64px;height:64px;opacity:0.3;margin-bottom:16px; }
                    .contact-welcome h3 { color:var(--fg-secondary);margin-bottom:8px; }
                    .contact-modal-overlay { position:absolute;inset:0;background:rgba(0,0,0,0.6);display:none;align-items:center;justify-content:center;z-index:100; }
                    .contact-modal-overlay.active { display:flex; }
                    .contact-modal { background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-lg);padding:24px;width:450px;max-width:90%;max-height:80vh;overflow-y:auto; }
                    .contact-modal h3 { margin:0 0 20px;color:var(--fg-primary); }
                    .contact-modal-row { display:flex;gap:12px;margin-bottom:12px; }
                    .contact-modal-field { flex:1;margin-bottom:0; }
                    .contact-modal-field { margin-bottom:12px; }
                    .contact-modal-field label { display:block;margin-bottom:6px;font-size:0.8rem;color:var(--fg-secondary); }
                    .contact-modal-field input,.contact-modal-field textarea,.contact-modal-field select { width:100%;padding:10px 12px;background:var(--bg-primary);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--fg-primary);font-family:inherit;font-size:0.9rem; }
                    .contact-modal-field input:focus,.contact-modal-field textarea:focus,.contact-modal-field select:focus { outline:none;border-color:var(--accent); }
                    .contact-modal-actions { display:flex;gap:10px;justify-content:flex-end;margin-top:20px; }
                    .contact-modal-actions button { padding:10px 20px;border-radius:var(--radius-sm);cursor:pointer;font-family:inherit;font-size:0.85rem; }
                    .contact-modal-actions .btn-primary { background:var(--accent);border:none;color:#fff; }
                    .contact-modal-actions .btn-secondary { background:transparent;border:1px solid var(--border);color:var(--fg-secondary); }
                    .contact-notes { background:var(--bg-tertiary);padding:12px;border-radius:var(--radius-sm);font-size:0.85rem;color:var(--fg-secondary);line-height:1.5; }
                </style>
                <div class="contacts-container">
                    <div class="contacts-sidebar">
                        <div class="contacts-search">
                            <input type="text" id="contacts-search-${windowId}" placeholder="Search contacts...">
                        </div>
                        <div class="contacts-list" id="contacts-list-${windowId}"></div>
                    </div>
                    <div class="contacts-main">
                        <div class="contacts-header">
                            <h2>Contacts</h2>
                            <div class="contacts-header-actions">
                                <button id="contacts-import-${windowId}">Import</button>
                                <button id="contacts-export-${windowId}">Export</button>
                                <button class="primary" id="contacts-add-${windowId}">+ Add Contact</button>
                            </div>
                        </div>
                        <div class="contact-welcome" id="contact-welcome-${windowId}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                            <h3>No contact selected</h3>
                            <p>Select a contact or add a new one</p>
                        </div>
                        <div class="contact-detail" id="contact-detail-${windowId}"></div>
                    </div>
                    <div class="contact-modal-overlay" id="contact-modal-${windowId}">
                        <div class="contact-modal">
                            <h3 id="contact-modal-title-${windowId}">Add Contact</h3>
                            <div class="contact-modal-row">
                                <div class="contact-modal-field">
                                    <label>First Name *</label>
                                    <input type="text" id="contact-firstname-${windowId}" placeholder="John">
                                </div>
                                <div class="contact-modal-field">
                                    <label>Last Name</label>
                                    <input type="text" id="contact-lastname-${windowId}" placeholder="Doe">
                                </div>
                            </div>
                            <div class="contact-modal-field">
                                <label>Email</label>
                                <input type="email" id="contact-email-${windowId}" placeholder="john@example.com">
                            </div>
                            <div class="contact-modal-field">
                                <label>Phone</label>
                                <input type="tel" id="contact-phone-${windowId}" placeholder="+1 234 567 8900">
                            </div>
                            <div class="contact-modal-row">
                                <div class="contact-modal-field">
                                    <label>Company</label>
                                    <input type="text" id="contact-company-${windowId}" placeholder="Company name">
                                </div>
                                <div class="contact-modal-field">
                                    <label>Job Title</label>
                                    <input type="text" id="contact-title-${windowId}" placeholder="Job title">
                                </div>
                            </div>
                            <div class="contact-modal-field">
                                <label>Address</label>
                                <textarea id="contact-address-${windowId}" rows="2" placeholder="Street, City, Country"></textarea>
                            </div>
                            <div class="contact-modal-row">
                                <div class="contact-modal-field">
                                    <label>Website</label>
                                    <input type="url" id="contact-website-${windowId}" placeholder="https://example.com">
                                </div>
                                <div class="contact-modal-field">
                                    <label>Birthday</label>
                                    <input type="date" id="contact-birthday-${windowId}">
                                </div>
                            </div>
                            <div class="contact-modal-field">
                                <label>Notes</label>
                                <textarea id="contact-notes-${windowId}" rows="2" placeholder="Additional notes..."></textarea>
                            </div>
                            <div class="contact-modal-actions">
                                <button class="btn-secondary" id="contact-modal-cancel-${windowId}">Cancel</button>
                                <button class="btn-primary" id="contact-modal-save-${windowId}">Save</button>
                            </div>
                        </div>
                    </div>
                    <input type="file" id="contact-file-input-${windowId}" accept=".json,.vcf" style="display:none;">
                </div>
            `,
            init: async () => {
                const lifecycle = createAppLifecycle();

                const listEl = document.getElementById(`contacts-list-${windowId}`);
                const searchInput = document.getElementById(`contacts-search-${windowId}`);
                const detailEl = document.getElementById(`contact-detail-${windowId}`);
                const welcomeEl = document.getElementById(`contact-welcome-${windowId}`);
                const modal = document.getElementById(`contact-modal-${windowId}`);
                const modalTitle = document.getElementById(`contact-modal-title-${windowId}`);
                const addBtn = document.getElementById(`contacts-add-${windowId}`);
                const importBtn = document.getElementById(`contacts-import-${windowId}`);
                const exportBtn = document.getElementById(`contacts-export-${windowId}`);
                const fileInput = document.getElementById(`contact-file-input-${windowId}`);

                const STORAGE_KEY = 'ephemera_contacts';
                let contacts = [];
                let selectedId = null;
                let editingId = null;

                const firstNameInput = document.getElementById(`contact-firstname-${windowId}`);
                const lastNameInput = document.getElementById(`contact-lastname-${windowId}`);
                const emailInput = document.getElementById(`contact-email-${windowId}`);
                const phoneInput = document.getElementById(`contact-phone-${windowId}`);
                const companyInput = document.getElementById(`contact-company-${windowId}`);
                const titleInput = document.getElementById(`contact-title-${windowId}`);
                const addressInput = document.getElementById(`contact-address-${windowId}`);
                const websiteInput = document.getElementById(`contact-website-${windowId}`);
                const birthdayInput = document.getElementById(`contact-birthday-${windowId}`);
                const notesInput = document.getElementById(`contact-notes-${windowId}`);

                async function loadContacts() {
                    const stored = await EphemeraStorage.get('metadata', STORAGE_KEY);
                    contacts = stored?.items || [];
                    renderList();
                }

                async function saveContacts() {
                    await EphemeraStorage.put('metadata', { key: STORAGE_KEY, items: contacts, updated: Date.now() });
                }

                function generateId() {
                    return 'contact_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                }

                function getInitials(contact) {
                    const first = contact.firstName?.charAt(0) || '';
                    const last = contact.lastName?.charAt(0) || '';
                    return (first + last).toUpperCase() || '?';
                }

                function getFullName(contact) {
                    return [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Unnamed';
                }

                function renderList() {
                    const search = searchInput.value.toLowerCase();
                    const filtered = contacts.filter(c => {
                        const name = getFullName(c).toLowerCase();
                        const email = c.email?.toLowerCase() || '';
                        const company = c.company?.toLowerCase() || '';
                        return name.includes(search) || email.includes(search) || company.includes(search);
                    });

                    if (filtered.length === 0) {
                        listEl.innerHTML = `<div class="contact-empty">${contacts.length === 0 ? 'No contacts yet' : 'No matches found'}</div>`;
                        return;
                    }

                    const sorted = [...filtered].sort((a, b) => {
                        const nameA = getFullName(a).toLowerCase();
                        const nameB = getFullName(b).toLowerCase();
                        return nameA.localeCompare(nameB);
                    });

                    listEl.innerHTML = sorted.map(c => `
                        <div class="contact-item ${c.id === selectedId ? 'active' : ''}" data-id="${c.id}">
                            <div class="contact-avatar">${getInitials(c)}</div>
                            <div class="contact-info">
                                <div class="contact-name">${EphemeraSanitize.escapeHtml(getFullName(c))}</div>
                                <div class="contact-preview">${EphemeraSanitize.escapeHtml(c.email || c.phone || c.company || '')}</div>
                            </div>
                        </div>
                    `).join('');

                    listEl.querySelectorAll('.contact-item').forEach(item => {
                        item.addEventListener('click', () => selectContact(item.dataset.id));
                    });
                }

                function selectContact(id) {
                    selectedId = id;
                    renderList();
                    showDetail(id);
                }

                function showDetail(id) {
                    const contact = contacts.find(c => c.id === id);
                    if (!contact) return;

                    welcomeEl.style.display = 'none';
                    detailEl.classList.add('active');
                    detailEl.style.display = 'block';

                    detailEl.innerHTML = `
                        <div class="contact-detail-header">
                            <div class="contact-detail-avatar">${getInitials(contact)}</div>
                            <div class="contact-detail-name">
                                <h3>${EphemeraSanitize.escapeHtml(getFullName(contact))}</h3>
                                <p>${EphemeraSanitize.escapeHtml(contact.title || '')}${contact.title && contact.company ? ' at ' : ''}${EphemeraSanitize.escapeHtml(contact.company || '')}</p>
                            </div>
                        </div>
                        
                        ${contact.email || contact.phone ? `
                        <div class="contact-section">
                            <div class="contact-section-title">Contact</div>
                            ${contact.email ? `
                            <div class="contact-field">
                                <div class="contact-field-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></div>
                                <div class="contact-field-content">
                                    <div class="contact-field-label">Email</div>
                                    <div class="contact-field-value"><a href="mailto:${contact.email}">${EphemeraSanitize.escapeHtml(contact.email)}</a></div>
                                </div>
                                <div class="contact-field-actions">
                                    <button data-action="copy" data-value="${contact.email}">Copy</button>
                                </div>
                            </div>
                            ` : ''}
                            ${contact.phone ? `
                            <div class="contact-field">
                                <div class="contact-field-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg></div>
                                <div class="contact-field-content">
                                    <div class="contact-field-label">Phone</div>
                                    <div class="contact-field-value"><a href="tel:${contact.phone}">${EphemeraSanitize.escapeHtml(contact.phone)}</a></div>
                                </div>
                                <div class="contact-field-actions">
                                    <button data-action="copy" data-value="${contact.phone}">Copy</button>
                                </div>
                            </div>
                            ` : ''}
                        </div>
                        ` : ''}

                        ${contact.company || contact.title || contact.address ? `
                        <div class="contact-section">
                            <div class="contact-section-title">Work</div>
                            ${contact.company ? `
                            <div class="contact-field">
                                <div class="contact-field-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg></div>
                                <div class="contact-field-content">
                                    <div class="contact-field-label">Company</div>
                                    <div class="contact-field-value">${EphemeraSanitize.escapeHtml(contact.company)}</div>
                                </div>
                            </div>
                            ` : ''}
                            ${contact.address ? `
                            <div class="contact-field">
                                <div class="contact-field-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg></div>
                                <div class="contact-field-content">
                                    <div class="contact-field-label">Address</div>
                                    <div class="contact-field-value">${EphemeraSanitize.escapeHtml(contact.address)}</div>
                                </div>
                            </div>
                            ` : ''}
                        </div>
                        ` : ''}

                        ${contact.website || contact.birthday ? `
                        <div class="contact-section">
                            <div class="contact-section-title">Other</div>
                            ${contact.website ? `
                            <div class="contact-field">
                                <div class="contact-field-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg></div>
                                <div class="contact-field-content">
                                    <div class="contact-field-label">Website</div>
                                    <div class="contact-field-value"><a href="${contact.website}" target="_blank">${EphemeraSanitize.escapeHtml(contact.website)}</a></div>
                                </div>
                            </div>
                            ` : ''}
                            ${contact.birthday ? `
                            <div class="contact-field">
                                <div class="contact-field-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
                                <div class="contact-field-content">
                                    <div class="contact-field-label">Birthday</div>
                                    <div class="contact-field-value">${new Date(contact.birthday).toLocaleDateString()}</div>
                                </div>
                            </div>
                            ` : ''}
                        </div>
                        ` : ''}

                        ${contact.notes ? `
                        <div class="contact-section">
                            <div class="contact-section-title">Notes</div>
                            <div class="contact-notes">${EphemeraSanitize.escapeHtml(contact.notes)}</div>
                        </div>
                        ` : ''}

                        <div style="display:flex;gap:10px;margin-top:24px;">
                            <button class="primary" id="contact-edit-${windowId}" style="flex:1;padding:10px;background:var(--accent);border:none;color:#fff;border-radius:var(--radius-sm);cursor:pointer;">Edit</button>
                            <button id="contact-delete-${windowId}" style="flex:1;padding:10px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#ef4444;border-radius:var(--radius-sm);cursor:pointer;">Delete</button>
                        </div>
                    `;

                    detailEl.querySelectorAll('.contact-field-actions button').forEach(btn => {
                        btn.addEventListener('click', () => {
                            navigator.clipboard.writeText(btn.dataset.value);
                            EphemeraNotifications.success('Copied', 'Copied to clipboard');
                        });
                    });

                    document.getElementById(`contact-edit-${windowId}`).addEventListener('click', () => openEditModal(contact));
                    document.getElementById(`contact-delete-${windowId}`).addEventListener('click', () => deleteContact(contact.id));
                }

                function openModal(contact = null) {
                    editingId = contact?.id || null;
                    modalTitle.textContent = contact ? 'Edit Contact' : 'Add Contact';
                    firstNameInput.value = contact?.firstName || '';
                    lastNameInput.value = contact?.lastName || '';
                    emailInput.value = contact?.email || '';
                    phoneInput.value = contact?.phone || '';
                    companyInput.value = contact?.company || '';
                    titleInput.value = contact?.title || '';
                    addressInput.value = contact?.address || '';
                    websiteInput.value = contact?.website || '';
                    birthdayInput.value = contact?.birthday || '';
                    notesInput.value = contact?.notes || '';
                    modal.classList.add('active');
                    firstNameInput.focus();
                }

                function openEditModal(contact) {
                    openModal(contact);
                }

                function closeModal() {
                    modal.classList.remove('active');
                    editingId = null;
                }

                function saveContact() {
                    const firstName = firstNameInput.value.trim();
                    if (!firstName) {
                        EphemeraNotifications.error('Error', 'First name is required');
                        return;
                    }

                    const contact = {
                        id: editingId || generateId(),
                        firstName,
                        lastName: lastNameInput.value.trim(),
                        email: emailInput.value.trim(),
                        phone: phoneInput.value.trim(),
                        company: companyInput.value.trim(),
                        title: titleInput.value.trim(),
                        address: addressInput.value.trim(),
                        website: websiteInput.value.trim(),
                        birthday: birthdayInput.value,
                        notes: notesInput.value.trim(),
                        createdAt: editingId ? contacts.find(c => c.id === editingId)?.createdAt : Date.now(),
                        updatedAt: Date.now()
                    };

                    if (editingId) {
                        const idx = contacts.findIndex(c => c.id === editingId);
                        if (idx !== -1) contacts[idx] = contact;
                    } else {
                        contacts.push(contact);
                    }

                    saveContacts();
                    closeModal();
                    renderList();
                    selectContact(contact.id);
                    EphemeraNotifications.success('Saved', `Contact ${editingId ? 'updated' : 'added'}`);
                }

                async function deleteContact(id) {
                    const contact = contacts.find(c => c.id === id);
                    if (!contact) return;

                    const confirmed = await window.EphemeraDialog?.confirm?.(
                        `Delete "${getFullName(contact)}"?`,
                        'Delete Contact',
                        true
                    );
                    if (!confirmed) return;

                    contacts = contacts.filter(c => c.id !== id);
                    await saveContacts();
                    selectedId = null;
                    detailEl.style.display = 'none';
                    detailEl.classList.remove('active');
                    welcomeEl.style.display = 'flex';
                    renderList();
                }

                function exportContacts() {
                    const data = JSON.stringify(contacts, null, 2);
                    const blob = new Blob([data], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'contacts_export.json';
                    a.click();
                    URL.revokeObjectURL(url);
                    EphemeraNotifications.success('Exported', 'Contacts exported successfully');
                }

                function importContacts(e) {
                    const file = e.target.files[0];
                    if (!file) return;

                    const reader = new FileReader();
                    reader.onload = async (ev) => {
                        try {
                            const imported = JSON.parse(ev.target.result);
                            if (Array.isArray(imported)) {
                                const count = imported.length;
                                const confirmed = await window.EphemeraDialog?.confirm?.(
                                    `Import ${count} contacts?`,
                                    'Import Contacts'
                                );
                                if (!confirmed) return;
                                contacts = [...contacts, ...imported.map(c => ({ ...c, id: generateId() }))];
                                await saveContacts();
                                renderList();
                                EphemeraNotifications.success('Imported', `${count} contacts imported`);
                            }
                        } catch {
                            EphemeraNotifications.error('Error', 'Invalid import file');
                        }
                    };
                    reader.readAsText(file);
                    fileInput.value = '';
                }

                lifecycle.addListener(addBtn, 'click', () => openModal());
                lifecycle.addListener(document.getElementById(`contact-modal-cancel-${windowId}`), 'click', closeModal);
                lifecycle.addListener(document.getElementById(`contact-modal-save-${windowId}`), 'click', saveContact);
                lifecycle.addListener(exportBtn, 'click', exportContacts);
                lifecycle.addListener(importBtn, 'click', () => fileInput.click());
                lifecycle.addListener(fileInput, 'change', importContacts);
                lifecycle.addListener(searchInput, 'input', renderList);
                lifecycle.addListener(modal, 'click', (e) => { if (e.target === modal) closeModal(); });

                await loadContacts();

                return {
                    destroy: () => {
                        lifecycle.destroy();
                    }
                };
            }
        };
    }
});
