# Contributing

Thank you for helping keep Autobattles 4X Finsauna vibrant!

## Workflow

1. Create a feature branch from `main`.
2. Install dependencies with `npm install`.
3. Run `npm run dev` to iterate on UI changes.
4. Before opening a pull request, execute `npm run build` to ensure the static assets compile and the `docs/` folder is refreshed.
5. Commit both your source changes and the updated `docs/` output. Avoid committing the transient `dist/` directory.

## Git LFS Usage

Only binary assets (PNG, JPG, GIF, MP4, audio files) are tracked with Git LFS. Do **not** add JavaScript, CSS, or HTML files to LFS—GitHub Pages cannot serve them.

## Pull Request Checklist

- [ ] `npm run build` succeeds locally.
- [ ] `docs/` contains the latest production output.
- [ ] Documentation (README or design notes) is updated if behaviour changes.
- [ ] Screenshots are provided for visual updates when possible.

