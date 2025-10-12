# Pages deploy (LFS-aware)

- Keep the hand-painted PNG sprites in Git LFS so contributors clone a lightweight repository while Pages still serves lossless art.
- The deployment workflow runs `git lfs install` on the GitHub runner to activate LFS support before the build.
- It executes `git lfs fetch --all` to download every PNG, audio track, and configuration blob required for production.
- The workflow follows with `git lfs checkout`, materializing the real PNGs and other assets in place of the lightweight pointer files.
- Once the PNGs are present on disk, the job proceeds with `npm install` and `npm run build` to generate the publishable site from the fully hydrated asset set.
