param(
  [string]$Message = "GitHub Pages deploy (LFS-aware) + Vite base for custom domain"
)

Set-Location "$PSScriptRoot"

if (-not (Test-Path ".github\workflows")) {
  New-Item -ItemType Directory -Path ".github\workflows" -Force | Out-Null
}

git add .github\workflows\deploy.yml vite.config.* .gitattributes
if (Test-Path ".github\workflows\pages.yml") { git add ".github\workflows\pages.yml" }
if (Test-Path ".github\workflows\pages.disabled.yml") { git add ".github\workflows\pages.disabled.yml" }

git commit -m $Message
git push origin main
