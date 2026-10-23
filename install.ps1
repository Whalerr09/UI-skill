#Requires -Version 5.1
<#
.SYNOPSIS
    Install the ui-motion agent skill.

.DESCRIPTION
    Copies (or links) SKILL.md, references/ and assets/ into your agent's skill
    directory so the agent can build award-grade websites: layered scroll motion,
    masked type reveals, WebGL accents, a token-driven CSS system, and a hard
    performance and accessibility budget.

    Node is optional. With Node the full installer runs (all targets, distilled
    rules files, doctor). Without Node this script copies the skill folder into
    .claude/skills and .qoder/skills directly.

.PARAMETER Target
    Agent to install for: claude, qoder, cursor, windsurf, copilot, agents.
    Repeatable. Default: claude, qoder.

.PARAMETER All
    Install for every known target.

.PARAMETER Project
    Install into the current repository instead of your user home.

.PARAMETER Link
    Symlink the source folder instead of copying (Windows: directory junction).

.PARAMETER Force
    Replace an existing install.

.PARAMETER Dest
    Custom destination directory (single target only).

.PARAMETER Uninstall
    Remove an installed copy.

.PARAMETER List
    Show supported targets.

.PARAMETER Doctor
    Check the payload and report installed copies.

.EXAMPLE
    .\install.ps1

.EXAMPLE
    .\install.ps1 -Target cursor -Project

.EXAMPLE
    irm https://raw.githubusercontent.com/Whalerr09/UI-skill/main/install.ps1 | iex
#>
[CmdletBinding()]
param(
    [string[]] $Target = @(),
    [switch] $All,
    [switch] $Project,
    [switch] $Link,
    [switch] $Force,
    [string] $Dest,
    [switch] $Uninstall,
    [switch] $List,
    [switch] $Doctor
)

$ErrorActionPreference = 'Stop'
$RepoUrl = 'https://github.com/Whalerr09/UI-skill.git'
$RepoZip = 'https://codeload.github.com/Whalerr09/UI-skill/zip/refs/heads/main'
$SkillName = 'ui-motion'

function Write-Step($Text) { Write-Host "  $Text" }
function Write-Ok($Text) { Write-Host "  + $Text" -ForegroundColor Green }
function Write-Warn($Text) { Write-Host "  ! $Text" -ForegroundColor Yellow }
function Write-Fail($Text) { Write-Host "  x $Text" -ForegroundColor Red }

Write-Host ''
Write-Host "  ui-motion" -ForegroundColor White -NoNewline
Write-Host "  agent skill installer" -ForegroundColor DarkGray
Write-Host ''

# ---------------------------------------------------------------- locate payload
# When piped through `irm | iex`, $PSScriptRoot is empty, so fetch a copy.
$Root = $PSScriptRoot
if ([string]::IsNullOrEmpty($Root) -or -not (Test-Path (Join-Path $Root 'SKILL.md'))) {
    $Root = Join-Path ([System.IO.Path]::GetTempPath()) ("ui-skill-" + [guid]::NewGuid().ToString('N').Substring(0, 8))
    Write-Step "Fetching skill into $Root"

    $git = Get-Command git -ErrorAction SilentlyContinue
    if ($git) {
        & git clone --depth 1 --quiet $RepoUrl $Root 2>&1 | Out-Null
    }
    else {
        $zip = "$Root.zip"
        Invoke-WebRequest -Uri $RepoZip -OutFile $zip -UseBasicParsing
        Expand-Archive -Path $zip -DestinationPath $Root -Force
        Remove-Item $zip -Force
        # the archive contains one top-level folder
        $inner = Get-ChildItem $Root -Directory | Select-Object -First 1
        if ($inner) { $Root = $inner.FullName }
    }
}

if (-not (Test-Path (Join-Path $Root 'SKILL.md'))) {
    Write-Fail "SKILL.md not found. Download the repository and run install.ps1 from its root."
    exit 1
}

Write-Ok "using $Root"

# ------------------------------------------------------------------- delegate
$node = Get-Command node -ErrorAction SilentlyContinue
$cli = Join-Path $Root 'bin/ui-skill.mjs'

if ($node -and (Test-Path $cli)) {
    $arguments = @($cli)

    if ($Uninstall) { $arguments += 'uninstall' }
    elseif ($List) { $arguments += 'list' }
    elseif ($Doctor) { $arguments += 'doctor' }
    else { $arguments += 'install' }

    foreach ($name in $Target) { $arguments += @('--target', $name) }
    if ($All) { $arguments += '--all' }
    if ($Project) { $arguments += '--project' }
    if ($Link) { $arguments += '--link' }
    if ($Force) { $arguments += '--force' }
    if ($Dest) { $arguments += @('--dest', $Dest) }

    & node @arguments
    exit $LASTEXITCODE
}

# ------------------------------------------------------- no-node fallback path
Write-Warn 'Node not found - falling back to a plain folder copy (claude, qoder).'
Write-Step 'Install Node 18+ for every target: https://nodejs.org'

$names = if ($All -or $Target.Count -eq 0) { @('claude', 'qoder') } else { $Target }
$payload = @('SKILL.md', 'references', 'assets')

foreach ($name in $names) {
    $base = switch ($name) {
        'claude' { if ($Project) { Join-Path (Get-Location) '.claude/skills' } else { Join-Path $HOME '.claude/skills' } }
        'qoder' { if ($Project) { Join-Path (Get-Location) '.qoder/skills' } else { Join-Path $HOME '.qoder/skills' } }
        default { $null }
    }

    if (-not $base) {
        Write-Warn "$name needs Node (single-file rules target) - skipped"
        continue
    }

    $dest = Join-Path $base $SkillName
    if ((Test-Path $dest) -and -not $Force) {
        Write-Warn "$name already installed at $dest (use -Force to replace)"
        continue
    }
    if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }

    New-Item -ItemType Directory -Path $dest -Force | Out-Null
    foreach ($entry in $payload) {
        $from = Join-Path $Root $entry
        if (-not (Test-Path $from)) { continue }
        Copy-Item $from -Destination $dest -Recurse -Force
    }
    Write-Ok "$name -> $dest"
}

Write-Host ''
Write-Step 'Next: open your agent and ask for a landing page.'
Write-Step '  "Build a landing page for my product with motion level 2."'
Write-Step 'Docs: https://github.com/Whalerr09/UI-skill'
Write-Host ''
