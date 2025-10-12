Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Set-Location -Path $PSScriptRoot

$workflowDirectory = Join-Path $PSScriptRoot '.github' 'workflows'
if (-not (Test-Path -Path $workflowDirectory)) {
    New-Item -ItemType Directory -Path $workflowDirectory -Force | Out-Null
}

$deployWorkflow = Join-Path $workflowDirectory 'deploy.yml'
if (Test-Path -Path $deployWorkflow) {
    git add $deployWorkflow
} else {
    Write-Host "Warning: $deployWorkflow does not exist."
}

$viteConfigs = Get-ChildItem -Path (Join-Path $PSScriptRoot 'vite.config.*') -File -ErrorAction SilentlyContinue
foreach ($config in $viteConfigs) {
    git add $config.FullName
}
if (-not $viteConfigs) {
    Write-Host 'Warning: No vite.config.* files found to stage.'
}

$gitattributes = Join-Path $PSScriptRoot '.gitattributes'
if (Test-Path -Path $gitattributes) {
    git add $gitattributes
} else {
    Write-Host "Warning: $gitattributes does not exist."
}

git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
    Write-Host 'No changes detected after staging. Nothing to commit.'
    exit 0
}

$commitMessage = 'chore: publish deployment assets'
git commit -m $commitMessage

git push origin main
