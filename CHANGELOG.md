# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Fixed
- Scoped asset ignore patterns to the local `dist/` output so GitHub Pages bundles remain tracked.
- Ensured supporter cards open securely by adding `noopener` to external links.

## [1.0.0] - 2025-10-12

### Added
- Rebuilt the marketing site using Vite, React, Tailwind CSS, and Framer Motion.
- Implemented high-fidelity hero, feature, roadmap, and community sections.
- Added automation to copy production assets into `docs/` for GitHub Pages deployment.

### Fixed
- Removed Git LFS usage for textual assets so GitHub Pages no longer serves pointer files.

