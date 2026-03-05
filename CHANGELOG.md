# Changelog

All notable changes to Ephemera will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **ChatGPT Plus/Pro provider** - Users can now log in with their OpenAI account and use their ChatGPT subscription instead of a pay-per-use API key. Select "ChatGPT Plus/Pro" in Settings > AI Assistant to get started.
- Session auth manager (`js/system/ai-oauth.js`) with device-code login flow and server-managed session state.
- Production-ready PHP endpoints in `public/api/ai-oauth/` for device auth start/poll, status, logout, model listing, and chat proxying.

### Changed
- ChatGPT model catalogs are now fetched dynamically from the authenticated `/backend-api/codex/models` endpoint (with short session cache), so picker options reflect account/workspace availability.
- ChatGPT refresh-token requests now match Codex auth behavior by omitting the custom scope override from refresh payloads.
