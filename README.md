# Autobattles 4X Finsauna

A polished landing experience for the Autobattles 4X Finsauna project. The previous repository relied on Git LFS for almost every file, which caused GitHub Pages to serve the Git LFS pointer text instead of actual assets. This rebuild replaces the site with a modern Vite + React stack, ensures all textual assets are tracked directly in Git, and ships a vibrant marketing page that explains the project roadmap.

## Getting Started

```bash
npm install
npm run dev
```

The development server runs on [http://localhost:5173](http://localhost:5173) by default.

## Building & Deploying to GitHub Pages

The project uses the standard Vite static output. The `npm run build` script now performs a multi-target export so both the marketing site and the playable demo stay in sync:

1. Generates production assets in `dist/`.
2. Rebuilds the root `docs/` directory from scratch so the landing experience stays fresh.
3. Publishes the compiled game into `docs/play/`, giving GitHub Pages a dedicated path for the hands-on demo while keeping the custom domain mapping in `docs/CNAME`.

Always run the build before pushing to `main` to avoid stale assets:

```bash
npm run build
```

Commit both the `dist/` (ignored) and `docs/` (tracked) outputs appropriately. Only `docs/` is committed—`dist/` remains transient. After pushing to `main`, GitHub Pages will update within a few minutes without any LFS placeholders. Remember to spot-check both `docs/index.html` and `docs/play/index.html` locally to validate the marketing page and the dedicated game build.

### Custom Domain: artobest.com

- GitHub Pages publishes this site via the `docs/` folder, which now includes a generated `CNAME` file pointing at **artobest.com**.
- The source of truth for that file lives in `public/CNAME`; Vite copies it into the production build automatically so the domain survives every deploy.
- Confirm that your DNS provider has an `ALIAS`/`ANAME`/`A` record to GitHub's Pages IPs **or** a `CNAME` to `your-username.github.io`. GitHub's [custom domain docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site) contain the up-to-date IP list.
- After updating DNS, click **Verify domain** within the repository's **Settings → Pages** section to ensure GitHub recognises the mapping.

### Keeping GitHub Pages Healthy

- Never track JavaScript, CSS, or HTML files with Git LFS.
- The repository only keeps binary media (PNG, JPG, MP3, etc.) in LFS through the simplified `.gitattributes` file.
- If you add new static assets for Pages, confirm they render correctly by opening `docs/index.html` locally before pushing.

## High-Level Architecture

- **React + Tailwind CSS** for declarative UI and fast iteration.
- **Framer Motion** supplies subtle, high-end animations inspired by aurora borealis lighting.
- **Lucide Icons** provide lightweight vector icons that complement the sauna aesthetic.

The site is intentionally content-focused so that contributors can understand the project vision while the core game continues development in separate branches.

## Changelog

### 1.0.0 – Stabilised GitHub Pages (2025-10-12)

- Rebuilt the site with Vite + React to avoid Git LFS pointer issues.
- Introduced an aurora-inspired landing page with roadmap, feature highlights, and community links.
- Added `npm run build` automation that refreshes the `docs/` directory for GitHub Pages.

