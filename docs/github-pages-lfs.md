# GitHub Pages deployment and Git LFS

This project stores critical build inputs (spritesheets, audio, even `package.json`) in Git LFS. If those objects are not checked out, commands such as `npm install` and `npm run build` read the three-line pointer files that Git creates for large objects, which breaks the toolchain.

Our GitHub Pages workflow therefore performs the following steps before running the Vite build:

1. Checks out the repository with Git LFS objects using `actions/checkout@v4` and the `lfs: true` flag.
2. Verifies the runner can read LFS metadata by logging `git lfs env` output and enumerating the tracked files.
3. Installs dependencies with `npm ci` and runs the production build.
4. Determines the public base path at runtime, defaulting to `/` when a custom domain (`public/CNAME`) is bundled and falling back to a repository-prefixed mount otherwise.
5. Smoke-checks the generated bundle (`dist/index.html` must exist, include a `<title>`, and ship the fallback `dist/404.html`) before handing the artifact to GitHub Pages.

Only after these steps succeed do we upload the Pages artifact and trigger the deployment job. Broken bundles are caught early, and the deployment job simply publishes the previously validated artifact.

For local verification, mirror the CI sequence:

```bash
git lfs install
git lfs fetch --all
git lfs checkout
npm install
npm run build
```

If the LFS objects cannot be fetched (for example when working in a sandboxed environment), expect `npm install` to fail because `package.json` is still an LFS pointer. In that scenario, CI remains the source of truth for deployable artifacts.

## Base path resolution on GitHub Pages

Custom domains change how GitHub Pages mounts the generated site. The Vite configuration now inspects any explicit base overrides (`PUBLIC_BASE_PATH`, `BASE_PATH`, `VITE_BASE_PATH`, or `VITE_BASE`), the `homepage` declared in `package.json`, and the presence of `public/CNAME` to decide which base path to emit. When the homepage points at an absolute URL or a `CNAME` file is bundled, the build defaults to `/` so custom domains serve root-relative assets. Repository-prefixed fallbacks are only used when no custom domain indicators are present, preventing regressions when the domain setup changes.
