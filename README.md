# Autobattles 4X Finsauna

A polished landing experience for the Autobattles 4X Finsauna project. The previous repository relied on Git LFS for almost every file, which caused GitHub Pages to serve the Git LFS pointer text instead of actual assets. This rebuild replaces the site with a modern Vite + React stack, ensures all textual assets are tracked directly in Git, and ships a vibrant marketing page that explains the project roadmap.

## Getting Started

```bash
npm install
npm run dev
```

The development server runs on [http://localhost:5173](http://localhost:5173) by default.

## Building & Deploying to GitHub Pages

The project uses the standard Vite static output. The `npm run build` script performs three steps:

1. Generates production assets in `dist/`.
2. Clears any existing `docs/` directory.
3. Copies the fresh build into `docs/` so GitHub Pages can serve it directly.

Always run the build before pushing to `main` to avoid stale assets:

```bash
npm run build
```

Commit both the `dist/` (ignored) and `docs/` (tracked) outputs appropriately. Only `docs/` is committed—`dist/` remains transient. After pushing to `main`, GitHub Pages will update within a few minutes without any LFS placeholders.

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

