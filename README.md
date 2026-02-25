# Ephemera 2.0

A browser-based operating system with virtual file system, app development platform, and AI integration.

![Ephemera](https://img.shields.io/badge/version-2.0.0-00d4aa)
![License](https://img.shields.io/badge/license-MIT-blue)
![CI](https://github.com/ephemera-os/ephemera/actions/workflows/ci.yml/badge.svg)

## Features

- 📁 **Virtual File System** - IndexedDB-based persistent storage
- 💻 **Code Editor** - Syntax highlighting with AI assistance
- 🌐 **Web Browser** - CORS proxy support for external sites
- 📱 **30+ Built-in Apps** - Calculator, Terminal, Files, Paint, and more
- 🔐 **Security** - PBKDF2 passwords, AES-256-GCM encryption
- 🎨 **Customizable** - Themes, accent colors, wallpapers
- 📦 **App Platform** - Build and install custom apps
- 🤖 **AI Integration** - OpenRouter-powered code assistance
- ☁️ **Cloud Sync** - Self-hosted REST sync server for cross-device file sync
- 💾 **Profile Export/Import** - Encrypted `.ephx` exports protected by a passphrase

## Quick Start

```bash
# Clone the repository
git clone https://github.com/ephemera-os/ephemera.git
cd ephemera

# Install dependencies
npm install

# Start development server
npm run dev
```

Open http://localhost:3000 in your browser. On first launch, you'll be prompted to create a local account with a username, password, and avatar.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm test` | Run tests |
| `npm run test:smoke` | Run critical smoke checks (multi-profile, proxy, editor save shortcut) |
| `npm run test:perf` | Run filesystem search performance check (200 files, <50ms) |
| `npm run lint` | Lint code |
| `npm run bundle:size` | Report gzipped JS bundle size against 900KiB target |

## Quick Smoke

Run this before merging critical changes that affect login/profile isolation, network proxy behavior, or editor keyboard handling:

```bash
npm run test:smoke
```

## Project Structure

```
ephemera/
├── js/
│   ├── core/               # Core modules
│   │   ├── crypto.js       # Encryption (PBKDF2, AES-GCM)
│   │   ├── validate.js     # Input validation
│   │   ├── sanitize.js     # XSS protection
│   │   ├── telemetry.js    # Sentry integration
│   │   ├── storage.js      # IndexedDB wrapper
│   │   ├── state.js        # App state
│   │   └── events.js       # Event system
│   ├── system/             # System modules
│   │   ├── filesystem.js   # Virtual FS
│   │   ├── window-manager.js
│   │   ├── app-registry.js # App loader
│   │   ├── login.js        # Local accounts & authentication
│   │   ├── session.js      # Session management
│   │   ├── network.js      # HTTP client
│   │   ├── ai.js           # AI integration
│   │   ├── sync-rest.js    # REST sync provider
│   │   ├── sync-manager.js # Sync orchestrator
│   │   └── data-management.js # Backup & profile export/import
│   ├── apps/               # Built-in apps
│   └── main.js             # Entry point
├── server/                 # Self-hosted sync server (Node.js/Express)
├── css/                    # Stylesheets
├── public/                 # Static assets
├── tests/                  # Test files
└── dist/                   # Build output
```

## Configuration

### Environment Variables (optional)

Create `.env.local` for error tracking:

```bash
# Error Tracking (optional)
VITE_SENTRY_DSN=https://key@sentry.io/project
VITE_SENTRY_ENVIRONMENT=development
# Release label included in Sentry events (defaults to app version)
VITE_SENTRY_RELEASE=2.0.0-local
```

### CI Sourcemap Upload (Sentry)

`CI` uploads hidden Vite sourcemaps from `dist/assets` to Sentry on `main/master` pushes when these repository secrets are configured:

- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

Releases are published as `ephemera@<git-sha>` and the build injects `VITE_SENTRY_RELEASE=<git-sha>` so browser events match uploaded artifacts.

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions on deploying to:

- **Netlify** (recommended) - Automatic builds
- **VPS** - Full control with Nginx, PM2, Let's Encrypt
- **Shared Hosting (Apache)** - `.htaccess`-based deployment for root or subpath hosting

## Security

Ephemera implements multiple security layers:

- **Local Accounts**: Password-protected profiles with avatar selection
- **Password Hashing**: PBKDF2-SHA256 with 600k iterations
- **Data Encryption**: AES-256-GCM for sensitive data
- **Session Lock**: Auto-locks after 30 minutes of inactivity
- **Input Validation**: Comprehensive sanitization
- **CSP Headers**: Content Security Policy enforcement
- **Sandboxed Apps**: User apps run in isolated iframes

## Built-in Apps

Ephemera ships with 30+ built-in apps. Highlights:

| App | Description |
|-----|-------------|
| Files | File manager |
| Code Editor | IDE with AI assistance |
| Terminal | Command-line interface |
| Settings | System configuration |
| App Manager | Install/manage apps |
| Git Panel | Git clone/pull/commit helpers |
| Password Manager | Store passwords locally (encrypted at rest) |
| AI Chat | Chat interface for the configured AI provider |
| PDF Viewer | View PDFs |
| File History | View and restore file snapshots |
| Browser | Web browser with CORS proxy |
| System Monitor | System stats |
| Games | Chess, Minesweeper, Snake, Memory, Tetris, and more |
| Trash | Deleted files |

## API

### EphemeraFS - File System

```javascript
await EphemeraFS.writeFile('/home/user/file.txt', 'content');
const content = await EphemeraFS.readFile('/home/user/file.txt');
const files = await EphemeraFS.readdir('/home/user');
await EphemeraFS.delete('/home/user/file.txt');
```

### EphemeraNetwork - HTTP Client

```javascript
const html = await EphemeraNetwork.get('https://example.com');
const data = await EphemeraNetwork.getJSON('https://api.example.com/data');
await EphemeraNetwork.post('https://api.example.com', { key: 'value' });
```

### EphemeraApps - App Development

```javascript
EphemeraApps.register({
    id: 'my-app',
    name: 'My App',
    icon: '<svg>...</svg>',
    width: 600,
    height: 400,
    content: (windowId) => ({
        html: '<div>Hello World</div>',
        init: () => { /* setup code */ }
    })
});
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -am 'Add my feature'`
4. Push to branch: `git push origin feature/my-feature`
5. Submit a Pull Request

## Author

Mounir IDRASSI

## License

MIT License - see [LICENSE](LICENSE) for details.
Bundled third-party assets are documented in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Acknowledgments

- [CodeMirror](https://codemirror.net/) - Code editor
- [OpenRouter](https://openrouter.ai/) - AI API
- [Sentry](https://sentry.io/) - Error tracking
