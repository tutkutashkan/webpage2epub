# Fonts

The three families the Convert2EPUB design system pins (`tokens/fonts.css`), stored
locally rather than `@import`ed from Google Fonts. An extension popup opens
constantly, and a CDN import would mean a network round-trip on every open, a
request to Google carrying the user's IP each time, and unstyled text offline —
none of which is acceptable for a tool whose whole promise is that it works
locally.

Only the **latin** subset of each is included, which is what the popup renders.

| File | Family | Weights | License |
| --- | --- | --- | --- |
| `newsreader-latin.woff2` | Newsreader (display) | 400–600 variable | SIL Open Font License 1.1 |
| `instrument-sans-latin.woff2` | Instrument Sans (UI/body) | 400–600 variable | SIL Open Font License 1.1 |
| `jetbrains-mono-latin.woff2` | JetBrains Mono (numerics) | 400 | SIL Open Font License 1.1 |

All three are OFL, which permits redistribution inside a bundled application.
Fetched from `fonts.gstatic.com` via the Google Fonts CSS API.

If licensed vendor binaries ever arrive (the design system notes none were
supplied), replace these files and update the `@font-face` blocks in
`src/styles/tokens.css`.
