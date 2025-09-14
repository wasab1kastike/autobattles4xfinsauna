# Changelog

## Unreleased
- Set HTML title to Autobattles4xFinsauna
- Add built site to `docs/` for GitHub Pages deployment
- Output builds directly to `docs/` and remove deprecated `dist` directory
- Add `.nojekyll` to bypass Jekyll on GitHub Pages
- Resolve sprite paths using `import.meta.env.BASE_URL` so builds work from repository subdirectory
