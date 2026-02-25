export type EphemeraExtensionType = 'app' | 'system' | 'editor' | 'theme' | 'widget';

export interface EphemeraExtensionAction {
  type?: 'open-app' | 'emit-event' | 'open-url' | 'notify';
  appId?: string;
  options?: Record<string, unknown>;
  event?: string;
  payload?: unknown;
  url?: string;
  title?: string;
  message?: string;
  level?: 'success' | 'error' | 'warning' | 'info';
  [key: string]: unknown;
}

export interface EphemeraExtensionContributes {
  commands?: Array<{
    id?: string;
    title?: string;
    subtitle?: string;
    keywords?: string;
    mode?: 'actions' | 'files' | 'both';
    icon?: string;
    appId?: string;
    action?: EphemeraExtensionAction | string;
    [key: string]: unknown;
  }>;
  shortcuts?: Array<{
    combo?: string;
    shortcut?: string;
    appId?: string;
    action?: EphemeraExtensionAction | string;
    [key: string]: unknown;
  }>;
  taskbar?: Array<{
    id?: string;
    label?: string;
    title?: string;
    icon?: string;
    appId?: string;
    action?: EphemeraExtensionAction | string;
    [key: string]: unknown;
  }>;
  contextMenu?: Array<{
    id?: string;
    label?: string;
    title?: string;
    icon?: string;
    appId?: string;
    action?: EphemeraExtensionAction | string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export interface EphemeraAppManifest {
  id: string;
  name: string;
  icon?: string;
  category?: string;
  version?: string;
  type?: EphemeraExtensionType;
  description?: string;
  permissions?: string[];
  singleton?: boolean;
  window?: {
    width?: number;
    height?: number;
    resizable?: boolean;
    minWidth?: number;
    minHeight?: number;
    [key: string]: unknown;
  };
  contributes?: EphemeraExtensionContributes;
  theme?: {
    tokens?: Record<string, string>;
    css?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface EphemeraWindowState {
  id: number;
  app?: EphemeraAppManifest;
  title?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  minimized?: boolean;
  maximized?: boolean;
  [key: string]: unknown;
}

export interface EphemeraSettings {
  proxyUrl: string;
  proxyEnabled: boolean;
  theme: string;
  locale: string;
  notifications: boolean;
  terminalBackendEnabled: boolean;
  terminalBackendUrl: string;
  aiProvider: string;
  aiModel: string;
  aiMaxTokens: number;
  aiTemperature: number;
  fileHistoryMode: string;
  fileHistoryMaxVersions: number;
  fileHistoryWarnMb: number;
  editorEngine: string;
  [key: string]: unknown;
}

export interface EphemeraUser {
  id: string;
  name: string;
  homeDir: string;
  [key: string]: unknown;
}

export interface EphemeraStateApi {
  windows: EphemeraWindowState[];
  windowIdCounter: number;
  activeWindowId: number | null;
  currentWorkspace: number;
  workspaces: number[][];
  workspaceNames: string[];
  workspaceWallpapers: string[];
  workspaceIconLayouts: Array<{
    order: string[];
    openCategory: string | null;
  }>;
  wallpaper: string;
  bootComplete: boolean;
  settings: EphemeraSettings;
  user: EphemeraUser;
  notifications: unknown[];
  installedApps: EphemeraAppManifest[];
  load(): void;
  save(): void;
  updateSetting(key: string, value: unknown): void;
  [key: string]: unknown;
}

export interface EphemeraFSApi {
  separator: string;
  root: string;
  homeDir: string;
  init(homeDir?: string | null): Promise<void>;
  exists(path: string): Promise<boolean>;
  ensureDir(path: string): Promise<void>;
  mkdir(path: string): Promise<void>;
  readdir(path: string): Promise<unknown[]>;
  stat(path: string): Promise<unknown>;
  readFile(path: string): Promise<unknown>;
  writeFile(path: string, content: unknown, metadata?: Record<string, unknown>): Promise<unknown>;
  delete(path: string): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
  copy(oldPath: string, newPath: string): Promise<void>;
  move(oldPath: string, newPath: string): Promise<void>;
  search(query: string, options?: Record<string, unknown>): Promise<unknown[]>;
  normalizePath(path: string): string;
  getParentDir(path: string): string;
  getBasename(path: string): string;
  getExtension(path: string): string;
  getMimeType(path: string): string;
  isTextFile(path: string): boolean;
  getIcon(entry: unknown): string;
  [key: string]: unknown;
}

export interface EphemeraWMApi {
  open(appId: string, options?: Record<string, unknown>): number | null;
  close(windowId: number): Promise<void>;
  focusWindow(windowId: number): void;
  getWindowWorkspace(windowId: number): number;
  moveToWorkspace(windowId: number, targetWorkspace: number, options?: Record<string, unknown>): boolean;
  setDirty(windowId: number, isDirty: boolean): void;
  isDirty(windowId: number): boolean;
  getWindow(windowId: number): EphemeraWindowState | undefined;
  getWindowsByApp(appId: string): EphemeraWindowState[];
  promptUnsavedChanges(message: string): Promise<string>;
  confirmClose(windowId: number): Promise<boolean>;
  [key: string]: unknown;
}

export interface EphemeraEventsApi {
  on(event: string, callback: (data?: unknown) => void): () => void;
  off(event: string, callback: (data?: unknown) => void): void;
  emit(event: string, data?: unknown): void;
  once(event: string, callback: (data?: unknown) => void): void;
  [key: string]: unknown;
}

export interface EphemeraSanitizeApi {
  escapeHtml(value: unknown): string;
  escapeAttr(value: unknown): string;
  sanitizeHtml(dirty: string, options?: Record<string, unknown>): string;
  sanitizeUrl(url: string): string;
  debounce<T extends (...args: unknown[]) => unknown>(fn: T, ms: number): (...args: Parameters<T>) => void;
  throttle<T extends (...args: unknown[]) => unknown>(fn: T, ms: number): (...args: Parameters<T>) => void;
  [key: string]: unknown;
}

export interface EphemeraTerminalBackendClientApi {
  connect(timeoutMs?: number): Promise<{ ok: boolean; error?: string }>;
  send(data: string | Record<string, unknown>): { ok: boolean; error?: string };
  close(code?: number, reason?: string): void;
  on(event: string, handler: (payload?: unknown) => void): () => void;
  isConnected(): boolean;
  isConnecting(): boolean;
  getUrl(): string;
}

export interface EphemeraTerminalBackendApi {
  validateUrl(url: string): { valid: boolean; url?: string; error?: string };
  getConfig(): { enabled: boolean; url: string };
  isConfigured(): boolean;
  testConnection(url: string, timeoutMs?: number): Promise<{ ok: boolean; error?: string }>;
  createClient(rawUrl?: string | null): EphemeraTerminalBackendClientApi;
  on(event: string, handler: (payload?: unknown) => void): () => void;
  emit(event: string, payload?: unknown): void;
}

export interface EphemeraCryptoWorkerApi {
  isSupported(): boolean;
  init(): boolean;
  encrypt(text: string, key: CryptoKey): Promise<string>;
  decrypt(ciphertext: string, key: CryptoKey): Promise<string | null>;
  terminate(): void;
  _resetForTests(): void;
}

export interface EphemeraFsWorkerApi {
  isSupported(): boolean;
  init(): boolean;
  searchFiles(
    query: string,
    startPath?: string,
    options?: {
      maxResults?: number;
      records?: Array<Record<string, unknown>>;
      dbName?: string;
      dbVersion?: number;
    }
  ): Promise<Array<Record<string, unknown>>>;
  terminate(): void;
  _resetForTests(): void;
}

export interface EphemeraExportWorkerApi {
  isSupported(): boolean;
  init(): boolean;
  serializeExport(
    data: Record<string, unknown>,
    options?: {
      compress?: boolean;
    }
  ): Promise<{
    bytes: Uint8Array;
    compressed: boolean;
    mimeType: string;
    extension: string;
  }>;
  terminate(): void;
  _resetForTests(): void;
}

export interface EphemeraAIStreamWorkerApi {
  isSupported(): boolean;
  init(): boolean;
  createSession(): string;
  parseChunk(
    sessionId: string,
    chunk: string
  ): Promise<Array<{
    type: 'content' | 'usage';
    content?: string;
    usage?: Record<string, unknown>;
  }>>;
  flushSession(sessionId: string): Promise<Array<{
    type: 'content' | 'usage';
    content?: string;
    usage?: Record<string, unknown>;
  }>>;
  closeSession(sessionId: string): Promise<boolean>;
  terminate(): void;
  _resetForTests(): void;
}

export interface EphemeraMotionApi {
  init(): void;
  isReducedMotion(): boolean;
  prefersReducedMotion(): boolean;
  destroy(): void;
  _resetForTests(): void;
}

export interface EphemeraContrastApi {
  init(): void;
  isHighContrast(): boolean;
  prefersHighContrast(): boolean;
  destroy(): void;
  _resetForTests(): void;
}

export interface EphemeraEmbedApi {
  enabled: boolean;
  parentOrigin: string;
  allowedApps: string[];
  capabilities: string[];
  isEnabled(): boolean;
  isAppAllowed(appId: string): boolean;
}

export interface EphemeraStorageQuotaApi {
  WARNING_THRESHOLD: number;
  WARNING_COOLDOWN_MS: number;
  MONITOR_INTERVAL_MS: number;
  formatBytes(bytes: number): string;
  checkQuota(options?: { silent?: boolean; forceWarning?: boolean }): Promise<{
    usageBytes: number;
    quotaBytes: number;
    freeBytes: number;
    usageRatio: number;
    usagePercent: number;
    thresholdRatio: number;
    thresholdPercent: number;
    overThreshold: boolean;
    measuredAt: number;
  }>;
  getLastSummary(): {
    usageBytes: number;
    quotaBytes: number;
    freeBytes: number;
    usageRatio: number;
    usagePercent: number;
    thresholdRatio: number;
    thresholdPercent: number;
    overThreshold: boolean;
    measuredAt: number;
  } | null;
  getStatus(options?: { refresh?: boolean }): Promise<{
    usageBytes: number;
    quotaBytes: number;
    freeBytes: number;
    usageRatio: number;
    usagePercent: number;
    thresholdRatio: number;
    thresholdPercent: number;
    overThreshold: boolean;
    measuredAt: number;
  }>;
  isPersistenceSupported(): boolean;
  isPersisted(): Promise<boolean>;
  requestPersistentStorage(options?: { silent?: boolean }): Promise<{
    supported: boolean;
    granted: boolean;
    persisted: boolean;
    error?: string;
  }>;
  start(): void;
  _resetForTests(): void;
}

export interface EphemeraEditorEngineApi {
  id: string;
  name: string;
  resolveModeForPath(pathOrExt?: string): string;
  getDefaultOptions(overrides?: Record<string, unknown>): Record<string, unknown>;
  createEditor(textarea: HTMLTextAreaElement, options?: Record<string, unknown>): unknown;
  getAvailableBackends(): Array<{
    id: string;
    name: string;
    description?: string;
    backend: string;
    version: string;
    available: boolean;
    reason?: string;
  }>;
  setPreferredBackend(backendId: string, options?: { persist?: boolean }): string;
  registerBackend(backend: Record<string, unknown>): Record<string, unknown>;
  unregisterBackend(backendId: string): boolean;
  getMetadata(): {
    id: string;
    name: string;
    version: string;
    backend: string;
    requested: string;
    availableBackends: Array<{
      id: string;
      name: string;
      description?: string;
      backend: string;
      version: string;
      available: boolean;
      reason?: string;
    }>;
  };
}

declare global {
  interface Window {
    EphemeraState: EphemeraStateApi;
    EphemeraFS: EphemeraFSApi;
    EphemeraWM: EphemeraWMApi;
    EphemeraEvents: EphemeraEventsApi;
    EphemeraSanitize: EphemeraSanitizeApi;
    EphemeraTerminalBackend: EphemeraTerminalBackendApi;
    EphemeraCryptoWorker: EphemeraCryptoWorkerApi;
    EphemeraFsWorker: EphemeraFsWorkerApi;
    EphemeraExportWorker: EphemeraExportWorkerApi;
    EphemeraAIStreamWorker: EphemeraAIStreamWorkerApi;
    EphemeraMotion: EphemeraMotionApi;
    EphemeraContrast: EphemeraContrastApi;
    EphemeraEmbed: EphemeraEmbedApi;
    EphemeraStorageQuota: EphemeraStorageQuotaApi;
    EphemeraEditorEngine: EphemeraEditorEngineApi;
    [key: string]: unknown;
  }

}
