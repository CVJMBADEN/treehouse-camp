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

## GitHub Pages

The `.github/workflows/deploy-pages.yml` workflow publishes the ready-to-host `dist/` directory whenever its files change on `main`. It can also be run manually from the Actions tab. It uploads only the static website; the original snapshot and development scripts are not included in the published website.

In repository **Settings → Pages**, choose **GitHub Actions** as the build and deployment source. GitHub Pages must be supported by the organization's plan for this private repository; the workflow does not change repository visibility. No personal access token is stored in the workflow: it uses GitHub's temporary `GITHUB_TOKEN` and deployment identity.

For `CVJMBADEN/treehouse-camp`, the default project address is **https://cvjmbaden.github.io/treehouse-camp/**. The address **https://treehouse-camp.github.io/** requires ownership of an account or organization named `treehouse-camp` and a repository under it named `treehouse-camp.github.io`. A GitHub Pages subdomain cannot be chosen independently of the account or organization name.

The workflow deploys the checked-in export without rebuilding it, so direct edits in `dist/` are published as written. If you edit the saved snapshot or `src/`, run the optional build and checks below and commit the regenerated `dist/` files before deploying.

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
