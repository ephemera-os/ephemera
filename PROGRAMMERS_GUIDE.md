# Ephemera Programmer's Guide

Complete API reference for developing applications on the Ephemera platform.

## Table of Contents

1. [Quick Start](#quick-start)
2. [App Structure](#app-structure)
3. [Core APIs](#core-apis)
4. [System APIs](#system-apis)
5. [UI Components](#ui-components)
6. [Events](#events)
7. [Storage & Files](#storage--files)
8. [App Lifecycle](#app-lifecycle)
9. [AI Integration](#ai-integration)
10. [Network & Proxies](#network--proxies)
11. [Best Practices](#best-practices)
12. [Testing](#testing)
13. [Contributing](#contributing)

---

## Quick Start

### Creating a New App

1. Open **Code Editor** from the desktop or start menu
2. Click **New App** or press `Ctrl+N`
3. Fill in your app details (ID, name, description)
4. Start coding!

### App Template

```javascript
/**
 * Ephemera App: [Your App Name]
 * 
 * Available APIs (see Programmers Guide for details):
 *   - EphemeraFS.*       - Virtual file system operations
 *   - EphemeraStorage.*  - Key-value storage with encryption
 *   - EphemeraWM.*       - Window management
 *   - EphemeraApps.*     - App registry and management
 *   - EphemeraNetwork.*  - HTTP client with CORS proxy
 *   - EphemeraDialog.*   - Modal dialogs
 *   - EphemeraNotifications.* - Toast notifications
 *   - EphemeraState.*    - Global state management
 *   - EphemeraEvents.*   - Event pub/sub system
 *   - EphemeraSanitize.* - XSS protection utilities
 * 
 * Global variables in your app:
 *   - container  - Your app's root DOM element
 *   - windowId   - Unique ID for your window instance
 */

function init() {
    container.innerHTML = `
        <div style="padding: 20px;">
            <h1>Hello, Ephemera!</h1>
            <p>This is my first app.</p>
            <button id="myBtn">Click Me</button>
        </div>
    `;
    
    document.getElementById('myBtn').addEventListener('click', () => {
        EphemeraNotifications.success('Button Clicked', 'You clicked the button!');
    });
}

init();
```

---

## App Structure

### Directory Layout

```
/home/user/apps/
└── myapp/               # Your app directory
    ├── app.js          # Main application code (required)
    └── app.json        # App metadata (required)
```

### app.json

```json
{
    "id": "com.user.myapp",
    "name": "My App",
    "type": "app",
    "version": "1.0.0",
    "description": "A custom Ephemera application",
    "icon": "<svg>...</svg>",
    "category": "user",
    "permissions": [],
    "window": {
        "width": 600,
        "height": 400,
        "resizable": true,
        "minWidth": 400,
        "minHeight": 300
    },
    "singleton": false
}
```

#### app.json Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | Yes | Unique identifier (e.g., `com.user.myapp`) |
| `name` | string | Yes | Display name |
| `type` | string | No | Extension type (`app`, `system`, `editor`, `theme`, `widget`) |
| `version` | string | No | Semantic version (default: "1.0.0") |
| `description` | string | No | Short description |
| `icon` | string | No | SVG icon markup |
| `category` | string | No | Category for grouping (`user`, `system`, etc.) |
| `permissions` | array | No | Requested permissions (least-privilege) |
| `window.width` | number | No | Initial window width (default: 600) |
| `window.height` | number | No | Initial window height (default: 400) |
| `window.resizable` | boolean | No | Allow window resizing (default: true) |
| `window.minWidth` | number | No | Minimum window width |
| `window.minHeight` | number | No | Minimum window height |
| `singleton` | boolean | No | Only one instance allowed (default: false) |

---

## Core APIs

### EphemeraFS - File System

Virtual file system with IndexedDB persistence.

#### Reading Files

```javascript
// Read file content (returns string or null)
const content = await EphemeraFS.readFile('/home/user/document.txt');

// Read with stats
const file = await EphemeraFS.stat('/home/user/document.txt');
// Returns: { path, name, type, size, modifiedAt, createdAt }
```

#### Writing Files

```javascript
// Write content to file
await EphemeraFS.writeFile('/home/user/newfile.txt', 'Hello World');

// Create directory
await EphemeraFS.mkdir('/home/user/newfolder');

// Append to file
const existing = await EphemeraFS.readFile('/home/user/log.txt') || '';
await EphemeraFS.writeFile('/home/user/log.txt', existing + '\nNew line');
```

#### Directory Operations

```javascript
// List directory contents
const files = await EphemeraFS.readdir('/home/user');
// Returns: [{ path, name, type: 'file'|'directory', ... }]

// Check if path exists
const exists = await EphemeraFS.exists('/home/user/file.txt');

// Get file stats
const stat = await EphemeraFS.stat('/home/user/file.txt');
```

#### File Management

```javascript
// Delete file or directory (moves entry to Trash)
await EphemeraFS.delete('/home/user/oldfile.txt');

// Move/rename file
await EphemeraFS.move('/home/user/old.txt', '/home/user/new.txt');

// Copy file
await EphemeraFS.copy('/home/user/source.txt', '/home/user/dest.txt');

// Restore files via the built-in Trash app.
```

#### Utility Methods

```javascript
// Get file extension
const ext = EphemeraFS.getExtension('/path/to/file.txt'); // 'txt'

// Get filename without extension
const name = EphemeraFS.getBasename('/path/to/file.txt'); // 'file'

// Check if text file
const isText = EphemeraFS.isTextFile('/path/to/file.js'); // true

// Search files
const results = await EphemeraFS.search('query');

// Get icon SVG for file type
const icon = EphemeraFS.getIcon(file);
```

---

### EphemeraStorage - Key-Value Storage

Persistent key-value storage with optional encryption.

#### Basic Usage

```javascript
// Store value
await EphemeraStorage.put('metadata', { 
    key: 'myapp.settings', 
    value: JSON.stringify({ theme: 'dark' })
});

// Retrieve value
const data = await EphemeraStorage.get('metadata', 'myapp.settings');
const settings = data ? JSON.parse(data.value) : null;

// Delete value
await EphemeraStorage.delete('metadata', 'myapp.settings');

// Get all values in a store
const all = await EphemeraStorage.getAll('metadata');
```

#### Stores

| Store | Purpose |
|-------|---------|
| `files` | File content (auto-encrypted) |
| `apps` | App code (auto-encrypted) |
| `metadata` | General key-value data |

#### Encryption

When a user is logged in with a password, sensitive data is automatically encrypted:

```javascript
// Sensitive keys are auto-encrypted when user is logged in
await EphemeraStorage.put('metadata', {
    key: 'myapp.apiKey',  // Contains 'ApiKey' - will be encrypted
    value: 'secret-key-here'
});
```

---

### EphemeraState - Global State

Shared application state that persists across sessions.

```javascript
// Read settings
const theme = EphemeraState.settings.theme;
const proxyUrl = EphemeraState.settings.proxyUrl;

// Update setting (auto-saves)
EphemeraState.updateSetting('myapp.option', 'value');

// Access user info
const userName = EphemeraState.user.name;
const userDir = EphemeraState.user.homeDir;

// Direct access
EphemeraState.settings.myCustomSetting = 'value';
EphemeraState.save(); // Manual save
```

#### Available State

```javascript
EphemeraState = {
    settings: {
        proxyUrl: string,
        proxyEnabled: boolean,
        theme: 'dark' | 'light',
        notifications: boolean,
        accentColor: string,
        sounds: boolean,
        // ... custom app settings
    },
    user: {
        name: string,
        homeDir: string
    },
    wallpaper: string,
    // ... other state
}
```

---

## System APIs

### EphemeraWM - Window Manager

Control windows and open other applications.

#### Opening Windows

```javascript
// Open app by ID
EphemeraWM.open('notepad');

// Open with options
EphemeraWM.open('files', { 
    startPath: '/home/user/Documents' 
});

// Open app with file
EphemeraWM.open('notepad', { 
    filePath: '/home/user/notes.txt' 
});
```

#### Window Control

```javascript
// Close specific window
EphemeraWM.close(windowId);

// Minimize window
EphemeraWM.minimize(windowId);

// Maximize/restore
EphemeraWM.toggleMaximize(windowId);

// Focus window
EphemeraWM.focus(windowId);

// Get window info
const info = EphemeraWM.getWindow(windowId);
```

#### App Information

```javascript
// Get registered app
const app = EphemeraApps.get('notepad');

// Get all apps
const allApps = EphemeraApps.getAll();

// Check if app exists
const exists = EphemeraApps.has('myapp');
```

---

### EphemeraNetwork - HTTP Client

Make HTTP requests with automatic CORS proxy support.

#### GET Requests

```javascript
// Simple GET
const html = await EphemeraNetwork.get('https://example.com');

// GET JSON
const data = await EphemeraNetwork.getJSON('https://api.example.com/data');

// With options
const response = await EphemeraNetwork.get('https://api.example.com', {
    headers: { 'Authorization': 'Bearer token' },
    timeout: 10000
});
```

#### POST Requests

```javascript
// POST JSON
const result = await EphemeraNetwork.post('https://api.example.com', {
    title: 'Hello',
    body: 'World'
});

// POST with options
const result = await EphemeraNetwork.post(url, data, {
    headers: { 'Content-Type': 'application/json' }
});
```

#### Raw Fetch

```javascript
// Get Response object
const response = await EphemeraNetwork.fetch('https://example.com/file', {
    method: 'PUT',
    body: fileContent
});

if (response.ok) {
    const text = await response.text();
}
```

---

### EphemeraDialog - Modal Dialogs

Display modal dialogs for user interaction.

```javascript
// Alert dialog
await EphemeraDialog.alert('Operation completed!', 'Success');

// Confirm dialog
const confirmed = await EphemeraDialog.confirm(
    'Are you sure you want to delete this file?',
    'Confirm Delete'
);

if (confirmed) {
    // User clicked OK
}

// Confirm with danger styling
const confirmed = await EphemeraDialog.confirm(
    'This cannot be undone!',
    'Dangerous Action',
    true  // isDanger = true
);

// Prompt for input
const name = await EphemeraDialog.prompt(
    'Enter your name:',
    'Name Required',
    'Default value'
);

if (name !== null) {
    // User entered something (empty string is valid)
}
```

---

### EphemeraNotifications - Toast Notifications

Show non-intrusive notifications.

```javascript
// Success notification
EphemeraNotifications.success('File saved!', 'Success');

// Error notification
EphemeraNotifications.error('Failed to connect', 'Error');

// Info notification
EphemeraNotifications.info('New update available', 'Update');

// Warning notification
EphemeraNotifications.warning('Low disk space', 'Warning');

// With options
EphemeraNotifications.success('Done!', 'Complete', {
    timeout: 5000  // Auto-dismiss after 5 seconds
});
```

---

## UI Components

### Window Styling

Your app runs inside a window with Ephemera's theme. Use CSS variables for consistent styling:

```css
/* Available CSS Variables */
:root {
    --bg-primary: #0a0a0f;
    --bg-secondary: #12121a;
    --bg-tertiary: #1a1a24;
    --fg-primary: #e8e8f0;
    --fg-secondary: #9898a8;
    --fg-muted: #58586a;
    --accent: #00d4aa;
    --accent-hover: #00b894;
    --accent-glow: rgba(0, 212, 170, 0.3);
    --border: rgba(255, 255, 255, 0.08);
    --danger: #ff4d6a;
    --warning: #ffb84d;
    --radius-sm: 6px;
    --radius-md: 10px;
    --radius-lg: 16px;
    --font-mono: 'JetBrains Mono', monospace;
}
```

### Example Styled App

```javascript
function init() {
    container.innerHTML = `
        <style>
            .my-app { 
                height: 100%; 
                display: flex; 
                flex-direction: column; 
                padding: 16px; 
            }
            .my-app h1 { 
                color: var(--fg-primary); 
                margin-bottom: 16px; 
            }
            .my-app input {
                padding: 8px 12px;
                background: var(--bg-tertiary);
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                color: var(--fg-primary);
                margin-bottom: 12px;
            }
            .my-app button {
                padding: 8px 16px;
                background: var(--accent);
                color: var(--bg-primary);
                border: none;
                border-radius: var(--radius-sm);
                cursor: pointer;
            }
            .my-app button:hover {
                background: var(--accent-hover);
            }
        </style>
        <div class="my-app">
            <h1>My App</h1>
            <input type="text" id="input-field" placeholder="Enter text...">
            <button id="submit-btn">Submit</button>
        </div>
    `;
    
    document.getElementById('submit-btn').addEventListener('click', handleSubmit);
}
```

---

## Events

### EphemeraEvents - Pub/Sub System

Communicate between components and apps.

#### Subscribing

```javascript
// Listen for events
const unsubscribe = EphemeraEvents.on('myapp.data_updated', (data) => {
    console.log('Data updated:', data);
});

// Later: stop listening
unsubscribe();
// Or: EphemeraEvents.off('myapp.data_updated', handler);
```

#### Publishing

```javascript
// Emit event
EphemeraEvents.emit('myapp.data_updated', { 
    id: 123,
    changes: ['name', 'email']
});
```

#### Built-in Events

| Event | Data | Description |
|-------|------|-------------|
| `desktop:ready` | - | Desktop initialization complete |
| `window:opened` | `{ windowId, appId }` | Window opened |
| `window:closed` | `{ windowId }` | Window closed |
| `app:installed` | `{ appId }` | App installed |
| `app:uninstalled` | `{ appId }` | App uninstalled |
| `setting:changed` | `{ key, value }` | Setting updated |
| `workspace:changed` | `{ workspace }` | Active workspace changed |
| `file:changed` | `{ path }` | File modified |

#### One-time Events

```javascript
EphemeraEvents.once('myapp.ready', (data) => {
    // Only fires once
});
```

---

## Storage & Files

### App Data Storage Pattern

```javascript
// Store app settings
async function saveSettings(settings) {
    await EphemeraStorage.put('metadata', {
        key: `myapp.settings.${windowId}`,
        value: JSON.stringify(settings)
    });
}

// Load app settings
async function loadSettings() {
    const data = await EphemeraStorage.get('metadata', `myapp.settings.${windowId}`);
    return data ? JSON.parse(data.value) : getDefaultSettings();
}

// Store in app's directory
async function saveAppData(filename, content) {
    const appDir = '/home/user/myapp';
    await EphemeraFS.mkdir(appDir);
    await EphemeraFS.writeFile(`${appDir}/${filename}`, content);
}
```

### Working with Files

```javascript
// File picker pattern
async function openFile() {
    // Open files app to let user pick
    EphemeraWM.open('files');
    
    // Or read from known location
    const recent = await EphemeraStorage.get('metadata', 'myapp.recentFiles');
    return recent ? JSON.parse(recent.value) : [];
}

// Auto-save pattern
let saveTimeout;
function scheduleAutoSave(content) {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        await EphemeraFS.writeFile('/home/user/myapp/autosave.txt', content);
    }, 2000);
}
```

---

## Best Practices

### 1. Initialization

```javascript
// Always use an init function
function init() {
    renderUI();
    loadSavedState();
    attachEventListeners();
}

init();

// Or use async init
async function init() {
    const data = await loadData();
    renderUI(data);
}

init().catch(console.error);
```

### 2. Cleanup

```javascript
// Store event listeners for cleanup
const handlers = [];

function init() {
    const handler = () => doSomething();
    document.getElementById('btn').addEventListener('click', handler);
    handlers.push({ element: document.getElementById('btn'), event: 'click', handler });
    
    // Listen for window close
    const unsub = EphemeraEvents.on('window:closed', ({ windowId: closedId }) => {
        if (closedId === windowId) {
            cleanup();
        }
    });
}

function cleanup() {
    handlers.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
    });
    handlers.length = 0;
}
```

### 3. Error Handling

```javascript
async function loadFile(path) {
    try {
        const content = await EphemeraFS.readFile(path);
        if (content === null) {
            EphemeraNotifications.warning('File not found', 'Error');
            return null;
        }
        return content;
    } catch (error) {
        console.error('Failed to load file:', error);
        EphemeraNotifications.error(`Failed to load: ${error.message}`, 'Error');
        return null;
    }
}
```

### 4. User Input

```javascript
// Always sanitize user input
function displayUserContent(content) {
    const safe = EphemeraSanitize.escapeHtml(content);
    container.innerHTML = `<div>${safe}</div>`;
}

// Validate URLs
function openUrl(url) {
    const safe = EphemeraSanitize.sanitizeUrl(url);
    if (!safe) {
        EphemeraNotifications.error('Invalid URL', 'Error');
        return;
    }
    // Use safe URL
}
```

### 5. Responsive Design

```javascript
// Check window size
function updateLayout() {
    const width = container.clientWidth;
    container.classList.toggle('compact', width < 400);
}

// Use ResizeObserver for responsive apps
const observer = new ResizeObserver(updateLayout);
observer.observe(container);
```

---

## Complete Example: Todo App

```javascript
/**
 * Ephemera App: Todo List
 * 
 * A simple todo list application demonstrating:
 * - UI creation and styling
 * - Event handling
 * - Persistent storage
 * - Window lifecycle management
 */

const STORAGE_KEY = 'todo.items';

let items = [];
let handlers = [];

function init() {
    loadItems();
    render();
    attachEventListeners();
}

function loadItems() {
    const saved = localStorage.getItem(STORAGE_KEY);
    items = saved ? JSON.parse(saved) : [];
}

function saveItems() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function render() {
    container.innerHTML = `
        <style>
            .todo-app {
                height: 100%;
                display: flex;
                flex-direction: column;
                padding: 16px;
            }
            .todo-header {
                display: flex;
                gap: 8px;
                margin-bottom: 16px;
            }
            .todo-input {
                flex: 1;
                padding: 8px 12px;
                background: var(--bg-tertiary);
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                color: var(--fg-primary);
                outline: none;
            }
            .todo-input:focus {
                border-color: var(--accent);
            }
            .todo-add {
                padding: 8px 16px;
                background: var(--accent);
                color: var(--bg-primary);
                border: none;
                border-radius: var(--radius-sm);
                cursor: pointer;
                font-weight: 600;
            }
            .todo-list {
                flex: 1;
                overflow-y: auto;
            }
            .todo-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px 12px;
                background: var(--bg-secondary);
                border-radius: var(--radius-sm);
                margin-bottom: 8px;
            }
            .todo-item.done .todo-text {
                text-decoration: line-through;
                color: var(--fg-muted);
            }
            .todo-checkbox {
                width: 18px;
                height: 18px;
                cursor: pointer;
            }
            .todo-text {
                flex: 1;
                color: var(--fg-primary);
            }
            .todo-delete {
                background: none;
                border: none;
                color: var(--danger);
                cursor: pointer;
                padding: 4px;
                opacity: 0.6;
            }
            .todo-delete:hover {
                opacity: 1;
            }
            .todo-empty {
                color: var(--fg-muted);
                text-align: center;
                padding: 40px;
            }
        </style>
        <div class="todo-app">
            <div class="todo-header">
                <input type="text" class="todo-input" id="todo-input" placeholder="Add a task...">
                <button class="todo-add" id="todo-add">Add</button>
            </div>
            <div class="todo-list" id="todo-list"></div>
        </div>
    `;
    
    renderList();
}

function renderList() {
    const list = document.getElementById('todo-list');
    
    if (items.length === 0) {
        list.innerHTML = '<div class="todo-empty">No tasks yet. Add one above!</div>';
        return;
    }
    
    list.innerHTML = items.map((item, index) => `
        <div class="todo-item ${item.done ? 'done' : ''}" data-index="${index}">
            <input type="checkbox" class="todo-checkbox" ${item.done ? 'checked' : ''}>
            <span class="todo-text">${escapeHtml(item.text)}</span>
            <button class="todo-delete">×</button>
        </div>
    `).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function attachEventListeners() {
    const input = document.getElementById('todo-input');
    const addBtn = document.getElementById('todo-add');
    const list = document.getElementById('todo-list');
    
    const addHandler = () => {
        const text = input.value.trim();
        if (text) {
            items.push({ text, done: false });
            saveItems();
            renderList();
            input.value = '';
        }
    };
    
    addBtn.addEventListener('click', addHandler);
    handlers.push({ element: addBtn, event: 'click', handler: addHandler });
    
    const keyHandler = (e) => {
        if (e.key === 'Enter') addHandler();
    };
    input.addEventListener('keydown', keyHandler);
    handlers.push({ element: input, event: 'keydown', handler: keyHandler });
    
    const listHandler = (e) => {
        const item = e.target.closest('.todo-item');
        if (!item) return;
        
        const index = parseInt(item.dataset.index);
        
        if (e.target.classList.contains('todo-checkbox')) {
            items[index].done = e.target.checked;
            saveItems();
            item.classList.toggle('done', e.target.checked);
        } else if (e.target.classList.contains('todo-delete')) {
            items.splice(index, 1);
            saveItems();
            renderList();
        }
    };
    
    list.addEventListener('click', listHandler);
    handlers.push({ element: list, event: 'click', handler: listHandler });
    
    // Cleanup on window close
    const unsubClose = EphemeraEvents.on('window:closed', ({ windowId: closedId }) => {
        if (closedId === windowId) {
            cleanup();
        }
    });
}

function cleanup() {
    handlers.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
    });
    handlers = [];
}

init();
```

---

## App Lifecycle

### Resource Cleanup with destroy()

Apps should implement a `destroy()` method to clean up resources when the window closes. The window manager automatically calls this method.

```javascript
// In your app's content function
return {
    html: `...`,
    init: () => {
        const handlers = [];
        const intervals = [];

        // Track event listeners
        const clickHandler = () => doSomething();
        document.getElementById('btn').addEventListener('click', clickHandler);
        handlers.push({ element: document.getElementById('btn'), event: 'click', handler: clickHandler });

        // Track intervals
        const timerId = setInterval(updateClock, 1000);
        intervals.push(timerId);

        // Return destroy method
        return {
            destroy: () => {
                // Clean up listeners
                handlers.forEach(({ element, event, handler }) => {
                    element.removeEventListener(event, handler);
                });
                // Clean up intervals
                intervals.forEach(id => clearInterval(id));
            }
        };
    }
};
```

### App Lifecycle Helper

For complex apps, use the `EphemeraLoading` lifecycle helper:

```javascript
import { createAppLifecycle } from '../system/app-lifecycle.js';

return {
    html: `...`,
    init: () => {
        const lifecycle = createAppLifecycle();

        // Automatically tracked cleanup
        lifecycle.addListener(document, 'click', handleClick);
        lifecycle.addInterval(setInterval(pollServer, 5000));
        lifecycle.addSubscription(EphemeraEvents.on('data', handleData));

        return {
            destroy: () => lifecycle.destroy()
        };
    }
};
```

---

## AI Integration

### EphemeraAI - AI Chat API

Integrate AI capabilities into your apps.

```javascript
// Check if AI is configured
const isConfigured = await EphemeraAI.isConfigured();
if (!isConfigured) {
    EphemeraNotifications.warning('Please add an API key in Settings');
    return;
}

// Simple completion
const response = await EphemeraAI.complete('Write a haiku about code');

// Chat with context
const messages = [
    { role: 'system', content: 'You are a helpful coding assistant.' },
    { role: 'user', content: 'How do I center a div?' }
];
const answer = await EphemeraAI.chat(messages, 'openrouter/free');

// Streaming response
await EphemeraAI.chat(messages, model, (chunk, accumulated) => {
    outputEl.textContent = accumulated;
});
```

### Rate Limiting

The AI API has built-in rate limiting (10 requests/minute, 500ms minimum between requests):

```javascript
// Check rate limit status
const status = EphemeraAI.getRateLimitStatus();
if (!status.canRequest) {
    console.log(`Please wait ${Math.ceil(status.waitTimeMs / 1000)} seconds`);
}

// Rate limit errors
try {
    await EphemeraAI.chat(messages, model);
} catch (e) {
    if (e.message.includes('Rate limited')) {
        // Show user a message
    }
}
```

---

## Network & Proxies

### Multi-Proxy System

Ephemera uses multiple CORS proxies with automatic failover:

```javascript
// Enable proxy in settings
EphemeraState.updateSetting('proxyEnabled', true);

// Proxy is used automatically for cross-origin requests
const html = await EphemeraNetwork.get('https://example.com');

// Custom proxy URL
EphemeraState.updateSetting('proxyUrl', 'https://my-proxy.com/?url=');
```

### Proxy Health Checking

The network system automatically:
1. Tries multiple proxies on failure
2. Marks unhealthy proxies and switches to backups
3. Notifies users when switching proxies

```javascript
// Check proxy health
await EphemeraNetwork.checkProxyHealth(proxy);

// Manual health reset
EphemeraNetwork._resetProxyHealth();
```

---

## Cloud Sync

### EphemeraSyncManager - Sync Orchestrator

The sync manager handles bidirectional file sync between the local virtual filesystem and a remote sync server.

```javascript
// Trigger a full sync (push local changes, pull remote changes)
await EphemeraSyncManager.syncAll();

// Test that the configured provider can connect
await EphemeraSyncManager.testConnection();
```

#### Events

| Event | Payload | When |
|-------|---------|------|
| `sync:status` | `{ status, error, lastSyncAt }` | Status changes (idle, syncing, synced, error) |
| `sync:conflict` | `{ path, conflictPath, remoteModifiedAt }` | A local file was saved as a conflict copy before overwrite |

```javascript
EphemeraEvents.on('sync:status', ({ status, error }) => {
    console.log('Sync status:', status, error);
});
```

### Provider Interface

All sync providers implement this interface:

```javascript
class SyncProvider {
    async list()                        // → [{ path, modifiedAt, type }]
    async push(path, content, metadata) // Upload a file
    async pull(path)                    // → { content, mimeType, modifiedAt }
    async delete(path)                  // Remove a file
    async mkdir(path)                   // Create a directory
    async testConnection()              // → true or throws
}
```

### Profile Backup & Restore

```javascript
// Export current profile as encrypted .ephx download (prompts for a passphrase)
await EphemeraDataManagement.exportProfile();

// Import a profile export (.ephx). Prompts for passphrase + new profile name + new password.
await EphemeraDataManagement.importProfile(file);
```

---

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- tests/filesystem.test.js

# Generate coverage
npm test -- --coverage
```

### Writing Tests

Tests use Vitest with jsdom:

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('MyApp', () => {
    beforeEach(() => {
        // Setup test environment
    });

    it('should do something', async () => {
        // Test code
        expect(result).toBe(expected);
    });
});
```

### Mocking Ephemera APIs

```javascript
// In tests/setup.js, mocks are provided for:
// - EphemeraStorage
// - EphemeraFS
// - EphemeraEvents
// - EphemeraState

// Use mocks in tests
vi.mocked(EphemeraFS.readFile).mockResolvedValue('test content');
const result = await EphemeraFS.readFile('/path/to/file');
expect(result).toBe('test content');
```

---

## Contributing

### Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Start dev server: `npm run dev`
4. Run tests: `npm test`

### Code Style

- Use ES6+ JavaScript
- Use `const`/`let` instead of `var`
- Prefer `async/await` over raw promises
- Use CSS variables for theming
- Sanitize all user input with `EphemeraSanitize`

### Pull Request Process

1. Create a feature branch from `master`
2. Make your changes with clear commit messages
3. Add tests for new functionality
4. Ensure all tests pass: `npm test`
5. Submit PR with description of changes

### File Structure

```
js/
├── apps/           # Application modules
├── core/           # Core system (crypto, storage, state)
├── system/         # System services (wm, network, ai)
├── main.js         # Entry point
└── ...

css/
├── core.css        # Base styles and CSS variables
├── desktop.css     # Desktop and icon styles
├── taskbar.css     # Taskbar and start menu
└── windows.css     # Window styles

tests/
├── setup.js        # Test setup and mocks
├── *.test.js       # Test files
└── ...
```

### Security Considerations

- Never bypass `EphemeraSanitize` for user content
- Use `EphemeraSanitize.sanitizeUrl()` for external URLs
- Encrypt sensitive data with `EphemeraStorage`
- Don't expose API keys in client code
- Validate all file paths before operations

### Security Model

Ephemera implements multiple security layers:

#### Encryption
- File content is encrypted using AES-GCM when a user password is set
- `files.content` and `apps.code` are encrypted at rest when the session is unlocked
- `metadata.value` is encrypted for a fixed allowlist of sensitive keys (see `EphemeraStorage.SENSITIVE_METADATA_KEYS` in `js/core/storage.js`)
- Encryption keys are derived from the user's password using PBKDF2

```javascript
// Check whether a key is encrypted by policy
EphemeraStorage.shouldEncrypt('metadata', 'openaiApiKey');      // true
EphemeraStorage.shouldEncrypt('metadata', 'myapp.settings');    // false

// Keys on the sensitive allowlist are auto-encrypted (when session is unlocked)
await EphemeraStorage.put('metadata', {
    key: 'openaiApiKey',
    value: 'secret-value'
});
```

#### Session Management
- Sessions lock after inactivity (configurable in Settings)
- Account lockout after 5 failed password attempts
- Queued writes are deferred until session unlock

#### Content Security
- DOMPurify sanitization on all user HTML
- URL validation blocks javascript: and data: schemes
- CSP headers enforced in production

#### Service Worker Updates
The Service Worker provides offline support and automatic updates:

```javascript
// Users are notified when updates are available
// Clicking "Refresh Now" activates the new version
// The app automatically reloads after update
```

---

## Testing Guidelines

### Test Coverage Requirements

- All new features must have corresponding tests
- Aim for >80% code coverage on core modules
- Test both success and error paths

### Testing Patterns

```javascript
// Test async operations
it('should load file content', async () => {
    vi.mocked(EphemeraFS.readFile).mockResolvedValue('test content');
    const result = await loadFile('/path/to/file');
    expect(result).toBe('test content');
});

// Test error handling
it('should handle file not found', async () => {
    vi.mocked(EphemeraFS.readFile).mockResolvedValue(null);
    const result = await loadFile('/nonexistent');
    expect(result).toBeNull();
});

// Test rate limiting
it('should enforce rate limits', async () => {
    // First request succeeds
    await EphemeraAI.chat([...], model);
    // Exhaust rate limit
    for (let i = 0; i < 10; i++) {
        await EphemeraAI.chat([...], model);
    }
    // Should throw rate limit error
    await expect(EphemeraAI.chat([...], model))
        .rejects.toThrow('Rate limited');
});
```

---

## Getting Help

- **GitHub Issues**: Report bugs or request features
- **Built-in Apps**: Check the Code Editor to see how system apps work
- **Example Apps**: Look in `/home/user/apps/` for examples

---

*Last updated: Ephemera 2.0*
