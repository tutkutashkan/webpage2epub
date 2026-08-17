# Chrome Web Store listing — Convert2EPUB

Drafted against Chrome's [best-listing guidance](https://developer.chrome.com/docs/webstore/best-listing): plain-language title, ≤132-char summary, feature-first description, no superlatives/keyword stuffing.

## Title

Keep it short and literal — this is what shows in search results.

> **Convert2EPUB – Webpage to EPUB Book**

(Alternative, closer to the current manifest name: "Webpage to ePub Book — Convert2EPUB")

## Summary (132 characters max, plain text)

> Collect the pages you're reading into a list, then save them as one EPUB book you can read anywhere.

Character count: 103 — well under the limit, leaves room if you want to add a keyword like "offline."

## Description

```
Turn a stack of open tabs into one EPUB book.

Convert2EPUB lets you build a reading list as you browse — add the article
you're on with one click or a right-click, keep collecting pages over the
next few days, then save the whole list as a single EPUB file with one
chapter per page. Read it later on any e-reader, tablet, or phone.

FEATURES
• Add the current page from the toolbar popup or the right-click menu
• Keep a running reading list — pages stay queued until you're ready to save
• Drag to reorder chapters before you export
• Give the book a custom title, or let it use the first page's title
• Cover image and in-article images are pulled in automatically
• Everything runs locally in your browser — no account, no external server
• Works great with long-form articles, blog posts, and documentation pages

HOW IT WORKS
1. Browse to a page you want to save and click "Add this page" (or use the
   right-click menu)
2. Repeat for every page you want in the book
3. Click "Save as EPUB" — your browser downloads a ready-to-read .epub file

PRIVACY
Convert2EPUB doesn't collect, transmit, or store your browsing data anywhere
outside your own browser. Pages are converted to EPUB locally on your
device. The only optional permission (cross-site image access) is requested
the first time you save a book, and only so article images can be embedded
in the file — without it, the book still builds, just without the images.
```

## Category

**Productivity** (Chrome Web Store's closest fit for reading/export tools).

## Language

English (en).

## Website / support links

- Homepage / support URL: https://github.com/tutkutashkan/webpage2epub
- Support email: tutkutashkan@gmail.com (swap for a dedicated address later if you'd rather not use your personal inbox)

## Screenshots (1–5 required, 1280×800 or 640×400 px, PNG/JPEG)

Capture the real popup UI, not mockups. Suggested shots, in order:

1. **Empty state** — popup showing "No pages yet. Add the page you're reading, then keep adding as you go." on a real article page, to show the entry point.
2. **Reading list with 3–4 items** — showing the drag-to-reorder list and the book-title field, mid-build.
3. **Context menu** — right-click on a page showing "Add page to ePub book" / "Save ePub book now", to show the no-popup workflow.
4. **Saving in progress / done state** — the status line showing a completed save.
5. **The resulting EPUB open in a reader app** (e.g. Apple Books, Calibre, or an e-reader) — proves the output is a real, readable book, not just a UI shot.

## Promotional images (optional but recommended)

- **Small promo tile — 440×280 px**: wordmark ("convert2epub") on the existing brand background/colors from `popup.css` / `tokens.css`, plus a one-line tagline like "Webpages → one EPUB book."
- **Marquee — 1400×560 px**: same branding, wider canvas — e.g. browser tabs on the left flowing into a stacked-book icon on the right.

Use `assets/logo-source.png` and the palette in [tokens.css](../src/styles/tokens.css) so the promo art matches the actual extension UI — reviewers and users notice mismatched branding.

## Store icon

`src/icons/icon128.png` already satisfies the 128×128 store-icon requirement — reuse it, don't create a separate one, so the Store listing matches the installed extension icon.

## Before submitting

- [ ] Fill in real homepage/support URLs above
- [ ] Take the 5 screenshots at 1280×800
- [ ] Build the promo tile + marquee image
- [ ] Fill in the Developer Dashboard's **Privacy practices** tab using the section below
- [ ] Publish a privacy policy page and link it in the dashboard (see below — required because this extension reads website content)

---

## Privacy practices tab (Developer Dashboard)

Checked against Chrome's [program policies](https://developer.chrome.com/docs/webstore/program-policies/policies). This is a separate, mandatory tab in the dashboard — the description text above doesn't satisfy it on its own.

### Single purpose

> Let a user collect web pages they're reading into a list, then export that list as a single EPUB book.

This is a clean single-purpose fit — no bundled unrelated features, nothing to split apart.

### Permission justifications

The dashboard asks for a one- or two-sentence justification per requested permission. Suggested text, matched to what each permission actually does in [manifest.base.json](../src/manifest/manifest.base.json) and [background.ts](../src/background/background.ts):

| Permission | Justification |
|---|---|
| `activeTab` | Needed to read the content of the page the user is currently viewing when they click "Add this page," so it can be turned into a chapter. |
| `scripting` | Needed to run the content-extraction script that pulls readable article content and images out of the active tab. |
| `downloads` | Needed to save the generated `.epub` file to the user's device once they click "Save as EPUB." |
| `contextMenus` | Adds "Add page to ePub book" and "Save ePub book now" to the right-click menu, mirroring the popup's two actions. |
| `storage` | Needed to keep the in-progress reading list (queued pages) between browser sessions until the user saves or clears it. |
| `unlimitedStorage` | A queued reading list can include several full articles and images, which can exceed the default 5MB storage quota; this permission avoids failed saves on longer lists. |
| `<all_urls>` (optional host permission) | Requested only when the user clicks "Save as EPUB," and only to fetch images referenced by the saved pages so they can be embedded in the book. Declined requests still produce a complete book, just without images. Optional (not requested at install) so users opt in explicitly. |

### Data usage disclosure

The dashboard will ask you to check off which data types the extension handles. Based on the code:

- **Website content** — yes. `scripting`/`activeTab` read the HTML of pages the user explicitly adds, to convert them into EPUB chapters. Check this box.
- Personally identifiable information, health info, financial info, authentication info, personal communications, location, web history, user activity — **no**, none of these are collected. The extension never reads browsing history or activity outside pages the user explicitly clicks "Add" on.

For the required certification questions:
- *Is data sold to third parties?* No.
- *Is data used for purposes unrelated to the extension's core functionality?* No — website content is used solely to build the EPUB the user requested.
- *Is data transferred to third parties?* No — per [background.ts](../src/background/background.ts) and [image_host_permission.ts](../src/lib/image_host_permission.ts), everything is processed locally (in a Chrome offscreen document / Firefox background page); the only network activity is fetching images directly from the pages' own origins to embed them, not sending data out.

### Privacy policy

Drafted at [PRIVACY.md](../PRIVACY.md) and pushed to the repo. Use this URL in the dashboard's privacy policy field:

> https://github.com/tutkutashkan/webpage2epub/blob/main/PRIVACY.md

(GitHub's raw markdown rendering is a normal, publicly reachable page — accepted by the Store. If you'd rather have it render without GitHub's chrome around it, enable GitHub Pages for this repo and link the Pages URL instead.)

### Remote code

The extension bundles all its logic (`html2epub`, `jepub`, `jszip`) at build time via esbuild — no `eval`, no remotely fetched scripts. Nothing to disclose here, and this keeps it clear of the policy's restrictions on remotely hosted code.

### Compliance check — no issues found

- **Single purpose**: pass — one clear, narrow purpose.
- **Minimum functionality**: pass — produces a real downloadable file, not just a link-out.
- **Narrowest permissions**: pass — every permission maps to a concrete feature above; the one broad permission (`<all_urls>`) is optional and requested just-in-time rather than at install.
- **Prohibited content/behavior**: not applicable — no ads, no tracking, no monetization, nothing on Chrome's prohibited list.
- **Misleading metadata**: pass — description above matches actual functionality, no keyword stuffing.

The one open item before you can submit is the **privacy policy URL** — that's the only piece that requires action outside this repo.
