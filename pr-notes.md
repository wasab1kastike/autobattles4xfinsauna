# Pages deploy (LFS-aware) + custom domain

- PNG assets remain in Git LFS for repository hygiene.
- CI checks out with `lfs: true` and runs `git lfs checkout` to materialize real files before building.
- Vite `base: '/'` because we serve the site at the root of the custom domain (artobest.com).
- The workflow uploads the `dist/` folder as the Pages artifact and deploys via GitHub Actions.
- Any older Pages workflows are disabled to avoid conflicts.
