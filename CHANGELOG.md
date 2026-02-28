# Changelog

All notable changes to Ephemera will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **ChatGPT Plus/Pro provider** - Users can now log in with their OpenAI account and use their ChatGPT subscription instead of a pay-per-use API key. Select "ChatGPT Plus/Pro" in Settings > AI Assistant to get started.
- OAuth token manager (`js/system/ai-oauth.js`) with popup-based login flow, automatic token refresh, and encrypted token storage.
- Vercel serverless functions (`api/ai-oauth/callback.js`, `api/ai-oauth/refresh.js`) for secure server-side OAuth token exchange.