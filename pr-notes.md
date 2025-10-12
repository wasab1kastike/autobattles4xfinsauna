# Pages deploy (LFS-aware)

Our GitHub Pages workflow runs `git lfs install` and `git lfs checkout` before invoking the production build. Without materializing the LFS-backed sprites, audio, and configuration bundles, Vite receives pointer files (the three-line `version/oid/size` documents) and the build aborts or produces empty assets. By forcing a full LFS checkout in CI we guarantee that:

- `npm install` can read the real `package.json` instead of the pointer stub.
- Vite copies the actual large binary resources that power the deployed game experience.
- The generated `docs/` artifacts match the authoritative assets committed to the repository.

If a contributor needs to reproduce the Pages build locally, run:

```bash
git lfs install
git lfs fetch --all
git lfs checkout
npm install
npm run build
```

Skipping these steps leaves pointer files in place, which is why CI owns the LFS materialization responsibility for official deployments.
