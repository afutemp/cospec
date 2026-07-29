[CmdletBinding()]
param(
    [string]$TargetUrl = 'https://kb.atrust.sangfor.com/',
    [string]$Session = 'atrust-kb',
    [string]$ProfileDir = '',
    [string]$DownloadDir = '',
    [string]$Version = '0.33.1',
    [switch]$NoOpen
)

$ErrorActionPreference = 'Stop'

if (-not $ProfileDir) {
    $ProfileDir = Join-Path (Get-Location) '.agent-browser\atrust-profile'
}
if (-not $DownloadDir) {
    $DownloadDir = Join-Path (Get-Location) 'downloads\atrust-kb'
}

$ProfileDir = [System.IO.Path]::GetFullPath($ProfileDir)
$DownloadDir = [System.IO.Path]::GetFullPath($DownloadDir)

$agentBrowser = Get-Command agent-browser -ErrorAction SilentlyContinue
if (-not $agentBrowser) {
    $npm = Get-Command npm -ErrorAction SilentlyContinue
    if (-not $npm) {
        throw 'agent-browser is missing and npm was not found. Install Node.js/npm first.'
    }
    Write-Host "agent-browser not found. Installing version $Version ..."
    & npm install -g "agent-browser@$Version"
    if ($LASTEXITCODE -ne 0) {
        throw "agent-browser installation failed. npm exit code: $LASTEXITCODE"
    }
    $agentBrowser = Get-Command agent-browser -ErrorAction SilentlyContinue
    if (-not $agentBrowser) {
        throw 'npm completed, but agent-browser is not available on PATH. Reopen the terminal and retry.'
    }
}

$versionOutput = & agent-browser --version
if ($LASTEXITCODE -ne 0) {
    throw 'agent-browser exists, but its version check failed. Run agent-browser doctor.'
}

New-Item -ItemType Directory -Force -Path $ProfileDir | Out-Null
New-Item -ItemType Directory -Force -Path $DownloadDir | Out-Null

Write-Host "agent-browser: $versionOutput"
Write-Host "Session: $Session"
Write-Host "Profile directory: $ProfileDir"
Write-Host "Download directory: $DownloadDir"

if (-not $NoOpen) {
    & agent-browser --headed --profile $ProfileDir --session $Session --download-path $DownloadDir open $TargetUrl
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to open target URL: $TargetUrl"
    }
    & agent-browser --session $Session get url
}

[pscustomobject]@{
    Command = $agentBrowser.Source
    Version = $versionOutput
    Session = $Session
    ProfileDir = $ProfileDir
    DownloadDir = $DownloadDir
    TargetUrl = $TargetUrl
}
