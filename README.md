# Treehouse Camp — static website

This is a static export of https://treehouse-camp.eu/, downloaded on 19 November 2026. It preserves the existing design, English content, page URLs, diagrams, photos, partner logos, and downloadable documents.

**Upload the contents of `dist/` to any static web host.** No TYPO3, PHP, database, server application, package installation, build step, or CMS is required to run the exported site. JavaScript runs only in visitors' browsers.

## Preview

With Node.js installed:

```sh
node scripts/serve.mjs
```

Open http://127.0.0.1:4173/. Stop the preview with Ctrl+C. This development server is optional and is not part of production hosting.

For a quick look you can also open `dist/index.html` directly. An HTTP preview is recommended for realistic browser behavior.

## Hosting

Set the publish/output directory to `dist`. No build command is needed when uploading these existing files. Preserve the folders and `.html` filenames. Existing page paths continue to work without an SPA fallback or server rewrite rules. All internal links and assets use relative paths, so the export also works under a subdirectory.

The ZIP archive contains the **contents** of `dist/`, with `index.html` at its root. Extract it into your web root. Publishing and changing the domain/DNS are separate from this local conversion; the live website has not been changed.

## Included behavior

- Expandable desktop navigation and an accessible mobile menu.
- Expandable content sections with keyboard support and automatic opening for anchor links.
- Clickable treehouse illustration and legend, using local page links.
- Component filters based on the competency associations already present in the original content. Selecting multiple competencies shows components matching any selected competency. Filtering makes no network requests.
- Photo viewer with previous/next controls and Escape to close.
- Ordinary `mailto:` email links, replacing TYPO3's email obfuscation script.

Core content and navigation remain available without JavaScript. YouTube embeds and outgoing third-party links retain their external destinations; watching embedded videos requires internet access. Embedded videos are not downloaded.

## Files and editing

- `dist/`: complete, ready-to-host website. Edit its HTML directly for one-off content updates.
- `src/app.js` and `src/static.css`: standalone browser behavior and small layout/accessibility fixes.
- `snapshot/pages/`: the original downloaded HTML for reference and reproducibility.
- `snapshot/assets/`: downloaded asset originals.
- `snapshot/manifest.json`: original URL-to-file mapping and download results.
- `migration-report.json`: migration inventory and original unavailable asset URLs.
- `scripts/`: optional download, conversion, preview, and verification tools.

The original HTML references 157 unavailable image variants. These all return HTTP 404 on the source site. Every displayed image's fallback `img` file was successfully downloaded; broken responsive alternatives are omitted from the export. No replacement photos or content were invented. The 55 pages include 15 linked PDF downloads.

The original imprint, privacy text, credits, and `noindex,nofollow` setting are preserved. The standalone application adds no tracking, analytics, cookies, or local storage. To enable search indexing, update the robots meta tag across the HTML pages.

## Optional regeneration and checks

The scripts require Node.js 22 or newer and the development packages in `package.json`. Install with `pnpm install --frozen-lockfile`, or use your preferred compatible package manager.

```sh
node scripts/build.mjs
node scripts/check.mjs
node scripts/test-interactions.mjs
```

`build` regenerates `dist/` from the saved snapshot and `src/`; it overwrites direct edits in the generated files. For repeatable changes, edit the saved page HTML or conversion script before rebuilding. Building works without contacting the original site.

`check` verifies local page, image, stylesheet, font, SVG, PDF, and anchor references; checks that visible page text matches the source; and rejects CMS runtime dependencies. The interaction checks use a simulated DOM; they do not replace visual browser testing.

To refresh the public snapshot intentionally:

```sh
node scripts/download.mjs
```

The downloader reuses files already in `snapshot/`. To fetch a changed original, move its corresponding snapshot file aside before refreshing. Only publicly linked content is included; no CMS admin area, database, or private material is exported.
