# Shared files

## theme.css

Colours and fonts.  Light only.  Load it first on every page:

```html
<link rel="stylesheet" href="/shared/theme.css">
```

To change a colour or font for every app, change it here.

| Variable | Use |
|---|---|
| `--page-plane` | Page background |
| `--surface-1` | Bars, cards, dialogs |
| `--panel-alt`, `--hover-bg` | Light grey fills |
| `--text-primary`, `--text-secondary`, `--text-muted` | Text |
| `--gridline` | Soft lines |
| `--baseline` | Borders on buttons and inputs |
| `--border` | Borders on cards and dialogs |
| `--series-1` to `--series-8` | Accent and chart colours.  `--series-1` is the main blue. |
| `--danger`, `--success` | Red and green |
| `--font-display`, `--font-body`, `--font-mono` | Fonts |

## components.css

Shared look for common parts.  Load it after `theme.css`:

```html
<link rel="stylesheet" href="/shared/components.css">
```

| Class | What it is |
|---|---|
| `.topbar`, `.topbar h1`, `.topbar-actions` | Top bar with title and buttons |
| `.btn`, `.btn-primary` | Buttons |
| `.input` | Text, date and select boxes |
| `.start-date-control` | Label and input side by side |
| `.view-toggle`, `.view-btn` | Button group, one choice active |
| `.zoom-toggle`, `.zoom-btn`, `.zoom-level` | Zoom control |
| `.save-status` | Save and connection text |
| `.dialog` | Dialog card, with styled inputs inside |

It also sets the corner sizes: `--radius-sm` 4px, `--radius` 6px, `--radius-lg` 10px.

## Rules

- Keep app-only styles in the app's own CSS: row heights, bar sizes, data colours.
- Do not add dark mode.
- A page that builds a standalone file (Publish or email export) cannot use these files.  Copy the colour values into that page.
