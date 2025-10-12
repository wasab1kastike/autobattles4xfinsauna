# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- Exported the playable build to `docs/play/` during `npm run build` so GitHub Pages serves a dedicated demo path.

### Changed
- Updated the supporter call-to-action to launch the demo from the new `/play` endpoint for clarity.
- Elevated the hero playtest CTA with immediate-build messaging and a direct route to the GitHub Pages demo.

### Fixed
- Scoped asset ignore patterns to the local `dist/` output so GitHub Pages bundles remain tracked.
- Ensured supporter cards open securely by adding `noopener` to external links.
- Restored the GitHub Pages custom domain by shipping a persistent `CNAME` file in the build output.

### Documentation
- Recorded the dual-deploy workflow in the README and reminded contributors to validate both the landing page and `/play` build locally.
- Documented how the `artobest.com` domain is managed so future deploys keep the CNAME intact.

## [1.0.0] - 2025-10-12

### Added
- Rebuilt the marketing site using Vite, React, Tailwind CSS, and Framer Motion.
- Implemented high-fidelity hero, feature, roadmap, and community sections.
- Added automation to copy production assets into `docs/` for GitHub Pages deployment.

### Fixed
- Removed Git LFS usage for textual assets so GitHub Pages no longer serves pointer files.

