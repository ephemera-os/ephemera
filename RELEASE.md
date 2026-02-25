# Ephemera 2.0 Release Checklist

## Pre-Release

### Code Quality
- [x] All tests pass (`npm test`)
- [x] Lint passes (`npm run lint`)
- [x] Build succeeds (`npm run build`)
- [x] No TypeScript/ESLint warnings

### Security
- [x] CSP headers reviewed and updated
- [x] No CDN dependencies (CodeMirror bundled via npm)
- [x] DOMPurify sanitization verified on all user HTML
- [x] Account lockout working (5 attempts, 15 min lockout)
- [x] Iframe sandbox set to `allow-scripts` only
- [x] Private IP blocking in network module
- [x] App lifecycle cleanup prevents memory leaks

### Performance
- [x] Virtual scrolling for long lists (terminal, AI chat)
- [x] File tree caching in Code Editor
- [x] IndexedDB search optimization with name index
- [ ] Lighthouse Performance > 80
- [ ] Lighthouse Accessibility > 85
- [ ] Lighthouse Best Practices > 90
- [x] Bundle size < 900KB gzipped (`npm run bundle:size`)
- [x] IndexedDB search < 50ms (200 files) (`npm run test:perf`)

### Functionality
- [x] Boot and login work correctly
- [x] All 32 apps open and close without errors
- [x] File system operations (create, read, update, delete)
- [x] AI integration works with valid API key
- [x] Data export/import works
- [x] Multi-profile support works
- [x] Session lock/unlock works
- [x] Password manager auto-locks
- [x] Drag-and-drop between apps (Files -> Code Editor)
- [x] File System Access API integration
- [x] Multi-proxy CORS fallback
- [ ] Cloud Sync: sync server starts, rejects unauthenticated requests
- [ ] Cloud Sync: test connection, push, pull, and delete via Settings UI
- [ ] Cloud Sync: auto-sync on file write (1.5 s debounce)
- [ ] Cloud Sync: conflict copy created when remote is newer
- [ ] Profile export downloads encrypted `.ephx` (passphrase required)
- [ ] Profile import creates new profile with correct home paths

### Browser Testing
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Edge (latest)
- [ ] Safari (latest)

## Release Process

1. **Version Bump**
   - Update `package.json` version
   - Update README badges

2. **Build**
   ```bash
   npm run build
   ```

3. **Lighthouse Audit**
   ```bash
   npm run preview
   # Run Lighthouse from Chrome DevTools
   # Or use CI: .github/workflows/ci.yml runs Lighthouse automatically
   ```

4. **CI Verification**
   - Ensure CI passes on all checks: lint, test, build, coverage
   - Review bundle size report in CI summary
   - Check Lighthouse scores in CI artifacts

5. **Deploy to Staging**
   - Deploy to staging environment
   - Run smoke tests
   - Monitor for 48 hours

6. **Deploy to Production**
   - Deploy to production environment
   - Verify deployment successful
   - Monitor error rates

## Post-Release

- [ ] Tag release in git
- [ ] Create GitHub release notes
- [ ] Update documentation if needed
- [ ] Monitor error tracking for issues

## Rollback Plan

If critical issues are found:
1. Revert to previous version in deployment platform
2. Restore from backup if data migration occurred
3. Communicate issue to users via notifications

## Version History

| Version | Date | Notes |
|---------|------|-------|
| 2.0.0 | TBD | Initial production release |

### Phase 1-2 Foundation (v2.0.0)
- A1: PWA manifest with installable app support
- A2/A3: CodeMirror via npm with CSP headers
- B1-B3: App lifecycle helper and memory leak fixes
- C1-C2: Multi-user path support and error boundaries
- D1-D2: Service Worker with Workbox and update notifications
- A4-A7: Test infrastructure with coverage thresholds
- B4-B6: Performance optimizations (search, virtual scroll, caching)
- C3-C4: Loading states and AI rate limiting
- D3-D5: Build tooling and coverage enforcement

### Phase 3-4 Enhancements (v2.1.0)
- A8: Clipboard integration with structured data support
- A9: Drag-and-drop between apps (Files -> Code Editor)
- B7: Scientific calculator with full functions
- B8: Password manager polish (strength, categories, auto-lock)
- B9: Responsive breakpoints (1024px, 1440px, 1920px)
- C5: Multi-proxy CORS fallback system
- C6: Markdown files route to Code Editor with preview
- C8: Help system with full documentation
- D6: File System Access API integration
- D7: IndexedDB health check and recovery
