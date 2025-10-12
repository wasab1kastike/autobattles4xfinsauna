# GitHub Pages deployment and Git LFS

This project stores critical build inputs (spritesheets, audio, even `package.json`) in Git LFS. If those objects are not checked out, commands such as `npm install` and `npm run build` read the three-line pointer files that Git creates for large objects, which breaks the toolchain.

Our GitHub Pages workflow therefore performs the following steps before running the Vite build:

1. `git lfs install` to ensure the runner supports LFS.
2. `git lfs fetch --all` so every referenced object is available.
3. `git lfs checkout` to replace pointers with the real files.

Only after these steps succeed does the workflow install dependencies and generate the static site.

For local verification, mirror the CI sequence:

```bash
git lfs install
git lfs fetch --all
git lfs checkout
npm install
npm run build
```

If the LFS objects cannot be fetched (for example when working in a sandboxed environment), expect `npm install` to fail because `package.json` is still an LFS pointer. In that scenario, CI remains the source of truth for deployable artifacts.
