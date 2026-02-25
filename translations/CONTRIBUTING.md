# Translation Contribution Guide

This project stores locale dictionaries in `js/i18n/`.

Current locales:
- `en.js` (source baseline)
- `fr.js`
- `de.js`
- `es.js`
- `zh.js`
- `ar.js` (RTL)
- `ja.js`

## Workflow

1. Start from `js/i18n/en.js`.
2. Add the same key path to your target locale file.
3. Keep placeholders exactly as-is (for example: `{name}`, `{count}`, `{index}`).
4. Keep values as plain strings.
5. Save and run tests.

## Key Rules

- Do not rename keys without updating every usage in code.
- Do not remove existing keys unless they are removed from code in the same change.
- Prefer short, UI-friendly wording.
- Keep capitalization consistent with surrounding UI.

## Placeholders

Placeholders are replaced at runtime:

- `Open {name}` -> `Open Terminal`
- `Workspace {index}` -> `Workspace 2`

Never translate the placeholder token itself. Translate only surrounding text.

## RTL Locales

For right-to-left locales (for example Arabic), set:

```js
_meta: {
  rtl: true
}
```

The runtime updates `<html dir="rtl">` automatically.

## Validate

Run:

```bash
npm run lint
npm test
```

For UI checks, switch language in `Settings -> Appearance -> Language & Region` and verify:
- shell labels
- command palette text
- window control labels
- RTL layout (for Arabic)
