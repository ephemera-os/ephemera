# Ephemera Deployment Guide

This guide covers deploying Ephemera to Netlify, VPS environments, and shared hosting (Apache + `.htaccess`).

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Configuration](#environment-configuration)
3. [Deployment Modes At a Glance](#deployment-modes-at-a-glance)
4. [Deploy to Netlify](#deploy-to-netlify)
5. [Deploy to Shared Hosting (Apache/.htaccess)](#deploy-to-shared-hosting-apachehtaccess)
6. [Deploy to VPS](#deploy-to-vps)
7. [Post-Deployment Checklist](#post-deployment-checklist)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Accounts

None. Ephemera is a static browser application with local profiles.

Optional:
- **Error Tracking**: [Sentry](https://sentry.io/) (if you want error monitoring)
- **Cloud Sync**: self-host the sync server in `server/` (if you want cross-device sync)
- **ChatGPT Plus/Pro session auth**: optional PHP endpoints in `public/api/ai-oauth/` (if you want users to connect their ChatGPT Plus/Pro session without API keys)

### Local Requirements

- Node.js 18+ 
- npm 9+
- Git

---

## Environment Configuration

### 1. Copy Environment Template (Optional)

```bash
cp .env.example .env.local
```

### 2. Configure Sentry (Optional)

1. Create a project at [Sentry.io](https://sentry.io/)
2. Copy the DSN from project settings

```bash
# .env.local
VITE_SENTRY_DSN=https://your-key@o123456.ingest.sentry.io/1234567
VITE_SENTRY_ENVIRONMENT=production
```

### 3. Configure ChatGPT Plus/Pro Session Auth (Optional)

This enables the "ChatGPT Plus/Pro" provider so users can connect a ChatGPT session from Settings without entering an API key.

It uses server-side PHP endpoints in `public/api/ai-oauth/` and device-code style sign-in (`auth.openai.com/codex/device`).

No always-on PHP process is required on shared hosting. The endpoints are regular PHP files executed on-demand per request.

Set variables as needed:

```bash
# Client-side (.env.local or hosting env vars)
VITE_APP_URL=https://your-domain.com
# Optional override if AI auth endpoints are not at /api (root) or <BASE_URL>/api (subpath)
# VITE_AI_OAUTH_API_BASE_PATH=/ephemera/api

# Server-side optional override (PHP env/config)
# OPENAI_CODEX_CLIENT_ID=app_EMoamEEZ73f0CkXaXp7hrann
```

> **Note**: If `OPENAI_CODEX_CLIENT_ID` is omitted, Ephemera uses the Codex public client id by default.

---
## Deployment Modes At a Glance

Use this matrix to pick the right build command and hosting setup.

| Target | Example URL | Build Command | Server Rules |
|--------|-------------|---------------|--------------|
| Netlify / static platform | `https://app.example.com/` | `npm run build` | Platform SPA fallback |
| VPS (Nginx, root path) | `https://example.com/` | `npm run build` | `try_files ... /index.html` |
| VPS (Nginx, subpath) | `https://example.com/ephemera/` | `VITE_BASE_PATH=/ephemera/ npm run build` | `location /ephemera/` with SPA fallback |
| Shared hosting (Apache, root path) | `https://example.com/` | `npm run build` | Upload `dist` contents + `.htaccess` |
| Shared hosting (Apache, subpath) | `https://example.com/ephemera/` | `VITE_BASE_PATH=/ephemera/ npm run build` | Upload to `ephemera/` folder + `.htaccess` |

---

## Deploy to Netlify

Netlify is a convenient deployment method for Ephemera. It handles CDN + HTTPS automatically.

### Method 1: Netlify CLI (Recommended)

#### 1. Install Netlify CLI

```bash
npm install -g netlify-cli
```

#### 2. Login to Netlify

```bash
netlify login
```

#### 3. Initialize Project

```bash
netlify init
```

When prompted:
- **Create & configure a new site** or link existing
- Select your team
- Enter a site name (or use random)
- **Build command**: `npm run build`
- **Publish directory**: `dist`

#### 4. Configure Environment Variables (Optional)

```bash
# Optional (Sentry)
netlify env:set VITE_SENTRY_DSN "your-sentry-dsn"
netlify env:set VITE_SENTRY_ENVIRONMENT "production"

# Optional (ChatGPT Plus/Pro session auth)
# netlify env:set VITE_APP_URL "https://your-domain.com"
# netlify env:set VITE_AI_OAUTH_API_BASE_PATH "/api"
```

Or set them in the Netlify dashboard:
1. Go to **Site settings** → **Environment variables**
2. Add each variable

#### 5. Deploy

```bash
# Deploy to production
netlify deploy --prod
```

### Method 2: Git Integration

#### 1. Push to Git

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/ephemera-os/ephemera.git
git push -u origin main
```

#### 2. Connect to Netlify

1. Go to [Netlify Dashboard](https://app.netlify.com/)
2. Click **Add new site** → **Import an existing project**
3. Select your Git provider
4. Select your repository
5. Configure build:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
6. Click **Deploy site**

#### 3. Add Environment Variables

1. Go to **Site settings** → **Environment variables**
2. Add all variables from `.env.example`
3. Click **Trigger deploy** → **Deploy site**

### Custom Domain on Netlify

1. Go to **Domain settings** → **Add custom domain**
2. Enter your domain
3. Configure DNS:
   - For apex domain: Add A record pointing to Netlify's load balancer
   - For www: Add CNAME record to your Netlify subdomain
4. Enable HTTPS (automatic with Let's Encrypt)

---

## Deploy to Shared Hosting (Apache/.htaccess)

Use this when you deploy to cPanel/shared hosting and only control files + `.htaccess`.

### 1. Build for the correct URL base

For root deployment (`https://example.com/`):

```bash
npm run build
```

For subpath deployment (`https://example.com/ephemera/`):

```bash
VITE_BASE_PATH=/ephemera/ npm run build
```

### 2. Upload build output

- Upload the **contents** of `dist/` (not the `dist` folder itself)
- For root deploy, upload into your web root (e.g. `public_html/`)
- For subpath deploy, upload into the subfolder (e.g. `public_html/ephemera/`)
- Ensure hidden files are uploaded, especially `.htaccess`

### 3. Use the official `.htaccess`

The canonical Apache config is stored in `public/.htaccess` and is copied to `dist/.htaccess` during build.

It includes:

- SPA fallback rewrite to `index.html`
- MIME type for `.webmanifest` and `.wasm`
- No-cache policy for `index.html`, `sw.js`, and `manifest.webmanifest`

If your host disables `mod_headers`, the app still works; only the explicit no-cache headers are skipped.

> Note: `public/_headers` is used by some static hosts (e.g. Netlify) to apply security headers like CSP.
> Apache does **not** read `_headers` automatically. If you want CSP enabled in production on Apache,
> configure equivalent `Content-Security-Policy` + security headers in your vhost (preferred) or `.htaccess`,
> using `public/_headers` as the source of truth. Pay special attention to `/sandbox/*` which requires a
> different CSP (`script-src ... blob:`) so user-created apps can run while the main app stays strict.

### 4. Enable ChatGPT Plus/Pro on shared hosting (optional)

Shared hosting can run ChatGPT session auth using the PHP endpoints bundled in:

- `public/api/ai-oauth/device-start.php`
- `public/api/ai-oauth/device-poll.php`
- `public/api/ai-oauth/status.php`
- `public/api/ai-oauth/logout.php`
- `public/api/ai-oauth/models.php`
- `public/api/ai-oauth/chat.php`
- `public/api/ai-oauth/.htaccess` (extensionless routing)

When you upload `dist/` contents to `public_html/ephemera/`, those files land under:

- `public_html/ephemera/api/ai-oauth/`

Configure ChatGPT session auth:

1. Build-time vars:

```bash
VITE_APP_URL=https://example.com
# Optional explicit override (default for /ephemera builds is already /ephemera/api)
# VITE_AI_OAUTH_API_BASE_PATH=/ephemera/api
```

2. Server-side optional override:
   - Prefer environment variables on your host:
     - `OPENAI_CODEX_CLIENT_ID`
   - If env vars are unavailable, create `public_html/ephemera/api/ai-oauth/config.php`
     from `config.example.php` and set values there.

### 5. If your site root also has rewrites

If your main site already has a global catch-all rewrite, exclude the app subpath first:

```apache
RewriteRule ^ephemera/ - [L]
```

Then keep the app-specific `.htaccess` inside the `ephemera/` folder.

### 6. Post-upload browser refresh

After deploying an update:

1. Open `https://example.com/ephemera/`
2. Hard refresh (`Ctrl+Shift+R`)
3. If needed, unregister old service workers in browser console:

```javascript
navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
});
```

---

## Deploy to VPS

For full control, you can deploy to any VPS provider (DigitalOcean, Linode, AWS EC2, Hetzner, etc.).

### 1. Server Requirements

- **OS**: Ubuntu 22.04 LTS (recommended)
- **RAM**: 1GB minimum, 2GB recommended
- **Storage**: 20GB minimum
- **Ports**: 80, 443 open

### 2. Initial Server Setup

```bash
# SSH into your server
ssh root@your-server-ip

# Update system
apt update && apt upgrade -y

# Create a non-root user
adduser ephemera
usermod -aG sudo ephemera

# Switch to the new user
su - ephemera
```

### 3. Install Dependencies

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Nginx
sudo apt install -y nginx

# Install Certbot for SSL
sudo apt install -y certbot python3-certbot-nginx

# Optional: PM2 for process management (only needed if you run Node processes, e.g. the sync server)
sudo npm install -g pm2
```

### 4. Clone and Build

```bash
# Clone the repository
git clone https://github.com/ephemera-os/ephemera.git
cd ephemera

 # Install dependencies
 npm install
 
 # Optional: production environment file (Sentry)
 nano .env.production
 ```
 
 Ephemera does not require any environment variables for core functionality. If you use Sentry, set:
 
 ```bash
 VITE_SENTRY_DSN=your-sentry-dsn
 VITE_SENTRY_ENVIRONMENT=production
 ```

```bash
# Build for production
npm run build
```

#### Deploying Under a Subpath (e.g. `/ephemera/`)

If your app is hosted at `https://yourdomain.com/ephemera/` instead of a dedicated domain/root path:

```bash
VITE_BASE_PATH=/ephemera/ npm run build
```

Use an Nginx location block for the subpath:

```nginx
location = /ephemera {
    return 301 /ephemera/;
}

location /ephemera/ {
    alias /var/www/ephemera/current/dist/;
    try_files $uri $uri/ /ephemera/index.html;
}
```

Without `VITE_BASE_PATH=/ephemera/`, the browser will request assets from `/assets/...` and you will get 404 errors.

### 5. Configure PM2

Create PM2 ecosystem file:

```bash
nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [{
    name: 'ephemera',
    script: 'npx',
    args: 'serve -s dist -l 3000',
    env_production: {
      NODE_ENV: 'production'
    }
  }]
};
```

Start the application:

```bash
# Start with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Configure PM2 to start on boot
pm2 startup
```

### 6. Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/ephemera
```

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Sandbox pages are framed by Ephemera for user-created apps + terminal `run`.
    # Nginx does not inherit `add_header` directives into locations that define their own,
    # so we explicitly set the full header set here.
    location ^~ /sandbox/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        add_header Content-Security-Policy "default-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'self'; script-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'none'; form-action 'none';" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "no-referrer" always;
        add_header Permissions-Policy "geolocation=(), microphone=(), camera=(), payment=(), usb=()" always;
    }

    # Security headers
    add_header Content-Security-Policy "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self' https: wss: ws:; img-src 'self' data: blob: https:; media-src 'self' blob: https:; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com; worker-src 'self'; manifest-src 'self'; form-action 'self';" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=(), payment=(), usb=()" always;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_min_length 1000;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable the site:

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/ephemera /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### 7. Setup SSL with Let's Encrypt

```bash
# Obtain SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Follow the prompts
# - Enter your email
# - Agree to terms
# - Choose redirect HTTP to HTTPS (recommended)

# Test auto-renewal
sudo certbot renew --dry-run
```

### 8. Configure Firewall

```bash
# Allow SSH, HTTP, HTTPS
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'

# Enable firewall
sudo ufw enable
```

### 9. Setup Automatic Updates (Optional)

```bash
# Install unattended-upgrades
sudo apt install -y unattended-upgrades

# Configure
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

---

## Deploy Sync Server (Optional)

The self-hosted sync server lets users keep files in sync across devices. It runs as a standalone Node.js process alongside (or separately from) the web app.

### 1. Install

```bash
cd server
npm install
```

### 2. Configure

Copy the template and edit:

```bash
cp .env.example .env
```

| Variable | Default | Purpose |
|----------|---------|---------|
| `EPHEMERA_SYNC_TOKEN` | *(required)* | Shared secret — every API request must carry `Authorization: Bearer <token>` |
| `EPHEMERA_SYNC_PORT` | `3001` | Port the server listens on |
| `EPHEMERA_SYNC_DATA_DIR` | `./data` | Directory where synced files are stored on disk |

Generate a strong token:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Run

#### Direct

```bash
EPHEMERA_SYNC_TOKEN=your-token node server.js
```

#### With PM2

```bash
EPHEMERA_SYNC_TOKEN=your-token pm2 start server.js --name ephemera-sync
pm2 save
```

### 4. Reverse Proxy (Nginx)

If the sync server runs on the same VPS as the web app, add a location block:

```nginx
location /sync/ {
    proxy_pass http://localhost:3001/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 50m;
}
```

Users then configure `https://yourdomain.com/sync` as the server URL in Settings → Cloud Sync.

### 5. Verify

```bash
curl -H "Authorization: Bearer your-token" http://localhost:3001/api/ping
# → {"ok":true,"version":"1.0.0"}
```

---

## Post-Deployment Checklist

### Required Steps

- [ ] Verify HTTPS is working (green lock icon)
- [ ] Test file creation and saving
- [ ] Test AI features (if API key configured)
- [ ] Test ChatGPT Plus/Pro connect/disconnect (if configured)
- [ ] Check browser console for errors
- [ ] Verify CSP headers are not blocking resources

### Cloud Sync (if deployed)

- [ ] Sync server responds to `/api/ping` with valid token
- [ ] Sync server rejects requests without token (401)
- [ ] In browser: Settings → Cloud Sync → Test Connection succeeds
- [ ] Create a file, verify it appears in `server/data/ephemera/`
- [ ] Profile export downloads an encrypted `.ephx` file (prompts for a passphrase)
- [ ] Profile import requires an encrypted `.ephx` file + passphrase and creates a new local profile with imported data

### Monitoring Setup

- [ ] If configured: verify Sentry is receiving errors
- [ ] Check PM2 logs: `pm2 logs`
- [ ] Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`

### Performance

- [ ] Enable Gzip compression (included in Nginx config)
- [ ] Configure CDN (optional - Cloudflare)
- [ ] Test page load speed with [PageSpeed Insights](https://pagespeed.web.dev/)

---

## Troubleshooting

### Common Issues

#### "Unable to decrypt export" / "Check the passphrase"

**Cause**: Wrong passphrase or a corrupted/modified `.ephx` export file.

**Solution**:
1. Confirm you're importing the encrypted `.ephx` file produced by Ephemera export
2. Re-enter the passphrase exactly (case-sensitive)
3. If the passphrase is lost, the export cannot be recovered (by design)

#### "CORS Error" in Browser Console

**Cause**: API requests blocked by CORS policy

**Solution**:
1. Ensure proxy is enabled in Settings → Network
2. For VPS: Check Nginx proxy headers configuration
3. For Netlify: Check `_headers` file is deployed

#### Service Worker Not Updating

**Solution**:
```bash
# In browser console:
navigator.serviceWorker.getRegistrations().then(function(registrations) {
    registrations.forEach(function(registration) {
        registration.unregister();
    });
});
# Then hard refresh (Ctrl+Shift+R)
```

#### Build Fails on Deployment

**Common causes**:
1. Missing environment variables
2. Node version mismatch

**Solution**:
```bash
# Check Node version locally
node -v

# For Netlify: Add to netlify.toml
[build.environment]
  NODE_VERSION = "20"

# For VPS: Ensure Node 18+ is installed
```

#### PM2 Process Crashes

**Check logs**:
```bash
pm2 logs ephemera
pm2 describe ephemera
```

**Common fixes**:
- Check port 3000 isn't in use: `lsof -i :3000`
- Verify all dependencies installed: `npm install`
- Check environment variables are set

#### Nginx 502 Bad Gateway

**Causes**:
1. PM2 process not running
2. Wrong port in Nginx config

**Solution**:
```bash
# Check PM2 status
pm2 status

# Check if port is listening
netstat -tlnp | grep 3000

# Restart services
pm2 restart ephemera
sudo systemctl restart nginx
```

---

## Useful Commands

### Netlify CLI

```bash
netlify deploy --prod          # Deploy to production
netlify deploy                 # Deploy preview
netlify env:list               # List environment variables
netlify open:admin             # Open Netlify dashboard
netlify open:site              # Open deployed site
```

### PM2 (VPS)

```bash
pm2 start ecosystem.config.js  # Start application
pm2 stop ephemera              # Stop application
pm2 restart ephemera           # Restart application
pm2 logs ephemera              # View logs
pm2 monit                      # Monitor resources
pm2 status                     # List processes
```

### Nginx

```bash
sudo nginx -t                  # Test configuration
sudo systemctl restart nginx   # Restart Nginx
sudo systemctl status nginx    # Check status
sudo tail -f /var/log/nginx/access.log  # View access logs
sudo tail -f /var/log/nginx/error.log    # View error logs
```

---

## Support

For issues specific to Ephemera:
- Open an issue on GitHub
- Check existing documentation in `/docs`

For deployment issues:
- [Netlify Documentation](https://docs.netlify.com/)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Nginx Documentation](https://nginx.org/en/docs/)
