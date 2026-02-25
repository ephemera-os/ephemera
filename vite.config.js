import { defineConfig } from 'vite';
import { resolve } from 'path';
import { VitePWA } from 'vite-plugin-pwa';

function normalizeBasePath(raw) {
  const value = String(raw || '/').trim();
  if (!value || value === '/') return '/';
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}

const base = normalizeBasePath(process.env.VITE_BASE_PATH || '/');

export default defineConfig({
  root: '.',
  publicDir: 'public',
  base,

  plugins: [
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'sw.js',
      injectRegister: false,
      manifest: false
    })
  ],

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: 'hidden',
    minify: 'esbuild',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      },
      output: {
        manualChunks: {
          dompurify: ['dompurify'],
          codemirror: ['codemirror']
        }
      }
    },
    target: 'esnext'
  },

  server: {
    port: 3000,
    open: true,
    cors: true
  },

  preview: {
    port: 4173
  },

  define: {
    __SENTRY_RELEASE__: JSON.stringify(process.env.npm_package_version || '2.0.0')
  },

  optimizeDeps: {
    include: ['dompurify', '@sentry/browser'],
    esbuildOptions: {
      target: 'es2020'
    }
  },

  resolve: {
    extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
    alias: {
      '@': resolve(__dirname, 'js'),
      '@core': resolve(__dirname, 'js/core'),
      '@system': resolve(__dirname, 'js/system'),
      '@apps': resolve(__dirname, 'js/apps')
    }
  }
});
