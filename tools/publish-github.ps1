# Publishes the BNC plugins (app colour styles) to their own GitHub repository.
#
#   .\tools\publish-github.ps1 -Owner your-github-name             # creates <owner>/bnc-plugins and pushes
#   .\tools\publish-github.ps1 -Owner your-github-name -DryRun     # shows what it would do, changes nothing
#
# Needs: Git (winget install --id Git.Git -e), GitHub CLI (winget install --id GitHub.cli -e) and "gh auth login" done once.
param(
  [Parameter(Mandatory = $true)][string]$Owner,
  [string]$Repo = 'bnc-plugins',
  [string]$DocsRepo = 'bnc-docs',
  [ValidateSet('public', 'private')][string]$Visibility = 'public',
  [switch]$DryRun
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Step($m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
function Run([string]$exe, [string[]]$a) {
  if ($DryRun) { Write-Host "   [dry run] $exe $($a -join ' ')" -ForegroundColor DarkGray; return }
  & $exe @a
  if ($LASTEXITCODE -ne 0) { throw "$exe $($a -join ' ') failed (exit $LASTEXITCODE)" }
}
# run a native command whose failure is an expected answer (not an error); the exit code is left in $LASTEXITCODE
function Quiet([scriptblock]$b) {
  $old = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  try { & $b *>$null } finally { $ErrorActionPreference = $old }
}
$full = "$Owner/$Repo"

Step "Checking tools"
foreach ($t in 'git', 'gh') {
  if (-not (Get-Command $t -ErrorAction SilentlyContinue)) {
    if ($DryRun) { Write-Host "   [dry run] '$t' is not installed (install it before the real run)" -ForegroundColor Yellow }
    else { throw "'$t' is not installed. Run: winget install --id $(if ($t -eq 'git') { 'Git.Git' } else { 'GitHub.cli' }) -e   (then open a NEW PowerShell window)" }
  }
}
if (-not $DryRun) {
  Quiet { gh auth status }
  if ($LASTEXITCODE -ne 0) { throw "You are not logged in to GitHub. Run: gh auth login" }
}

Step "Checking that every style is valid and the packed files match the sources"
if (-not (Test-Path (Join-Path $root 'node_modules\jszip'))) { Run 'npm' @('install') }
if (-not $DryRun) { npm run check; if ($LASTEXITCODE -ne 0) { throw 'Plugin check failed - fix it before publishing.' } }

Step "Filling in your GitHub name ($Owner)"
foreach ($f in 'README.md', 'docs\MAKING-PLUGINS.md') {
  $p = Join-Path $root $f
  if (-not (Test-Path $p)) { continue }
  $txt = [IO.File]::ReadAllText($p)
  $new = $txt.Replace('github.com/OWNER/bnc-plugins', "github.com/$Owner/$Repo").Replace('github.com/OWNER/bnc-docs', "github.com/$Owner/$DocsRepo").Replace('OWNER', $Owner)
  if ($new -ne $txt) {
    Write-Host "   updated $f"
    if (-not $DryRun) { [IO.File]::WriteAllText($p, $new, (New-Object Text.UTF8Encoding($false))) }
  }
}

Step "Creating the git repository and first commit"
if (-not (Test-Path (Join-Path $root '.git'))) { Run 'git' @('init', '-b', 'main') }
Run 'git' @('add', '-A')
if (-not $DryRun) {
  $staged = git diff --cached --name-only
  if ($staged | Where-Object { $_ -match '^node_modules' }) { throw 'node_modules got staged - check .gitignore.' }
  Write-Host "   $(@($staged).Count) files staged"
}
$hasHead = $false
if (-not $DryRun) { Quiet { git rev-parse --verify HEAD }; $hasHead = ($LASTEXITCODE -eq 0) }
if (-not $hasHead) { Run 'git' @('commit', '-m', 'BNC plugins: 10 colour styles for all BNC apps') }
else { git diff --cached --quiet; if ($LASTEXITCODE -ne 0) { Run 'git' @('commit', '-m', 'Update plugins') } }

Step "Creating $Visibility repository $full on GitHub and pushing"
if ($DryRun) { Write-Host "   [dry run] gh repo create $full --$Visibility --source . --remote origin --push" -ForegroundColor DarkGray }
else {
  Quiet { gh repo view $full }
  if ($LASTEXITCODE -eq 0) {
    Write-Host "   $full already exists - pushing to it"
    if (-not (git remote | Where-Object { $_ -eq 'origin' })) { git remote add origin "https://github.com/$full.git" }
    git push -u origin main
    if ($LASTEXITCODE -ne 0) { throw 'git push failed' }
  } else {
    gh repo create $full "--$Visibility" --source . --remote origin --push --description 'App colour styles (.bnctheme) and visualizers for the BNC apps (Docs, Sheets, Presentation, PDF, Ambient)'
    if ($LASTEXITCODE -ne 0) { throw 'gh repo create failed' }
  }
}
Run 'gh' @('repo', 'edit', $full, '--add-topic', 'themes', '--add-topic', 'plugins', '--add-topic', 'bnc', '--add-topic', 'open-source')

Write-Host "`nDone. https://github.com/$full" -ForegroundColor Green
if ($DryRun) { Write-Host '(dry run: nothing was changed or uploaded)' -ForegroundColor Yellow }
