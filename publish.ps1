[CmdletBinding()]
param(
    [string]$Message = "Configure GitHub Pages deploy (LFS-aware) and Vite base"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Set-Location -Path $PSScriptRoot

$workflowDirectory = Join-Path $PSScriptRoot '.github' 'workflows'
if (-not (Test-Path -Path $workflowDirectory)) {
    New-Item -ItemType Directory -Path $workflowDirectory -Force | Out-Null
}

$pathsToStage = @()

$deployWorkflow = Join-Path $workflowDirectory 'deploy.yml'
if (Test-Path -Path $deployWorkflow) {
    $pathsToStage += $deployWorkflow
}

$viteConfigs = Get-ChildItem -Path (Join-Path $PSScriptRoot 'vite.config.*') -File -ErrorAction SilentlyContinue
if ($viteConfigs) {
    $pathsToStage += $viteConfigs.FullName
}

$gitattributes = Join-Path $PSScriptRoot '.gitattributes'
if (Test-Path -Path $gitattributes) {
    $pathsToStage += $gitattributes
}

if ($pathsToStage.Count -eq 0) {
    Write-Host 'Nothing to stage. Exiting.'
    exit 0
}

foreach ($path in $pathsToStage | Sort-Object -Unique) {
    git add $path
}

git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
    Write-Host 'No changes detected after staging. Nothing to commit.'
    exit 0
}

Write-Host "Committing with message: $Message"
git commit -m $Message

git push origin main
