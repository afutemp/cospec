[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ContentId,
    [Parameter(Mandatory = $true)]
    [string]$FileName,
    [string]$OutputDir = '',
    [string]$Session = 'atrust-kb',
    [int]$TimeoutSeconds = 180
)

$ErrorActionPreference = 'Stop'

if (-not $OutputDir) {
    $OutputDir = Join-Path (Get-Location) 'downloads\atrust-kb'
}
$OutputDir = [System.IO.Path]::GetFullPath($OutputDir)
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

if (-not (Get-Command agent-browser -ErrorAction SilentlyContinue)) {
    throw 'agent-browser was not found. Run setup-agent-browser.ps1 first.'
}
if ($ContentId -notmatch '^[A-Za-z0-9_-]+$') {
    throw 'ContentId contains unsupported characters.'
}

$safeName = [System.IO.Path]::GetFileName($FileName)
if (-not $safeName -or $safeName -ne $FileName) {
    throw 'FileName must be a plain file name without directory components.'
}

$defaultDownloads = Join-Path ([Environment]::GetFolderPath('UserProfile')) 'Downloads'
$started = Get-Date
$endpoint = "/admin/DemandViewApi/getDownFile?contentid=$ContentId"
$endpointJson = $endpoint | ConvertTo-Json -Compress
$fileJson = $safeName | ConvertTo-Json -Compress
$js = "(async()=>{const r=await fetch($endpointJson,{credentials:'include'});if(!r.ok)throw new Error('HTTP '+r.status);const b=await r.blob();const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=$fileJson;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),30000);return {status:r.status,size:b.size,type:b.type};})()"
$jsBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($js))

$resultText = & agent-browser --session $Session eval -b $jsBase64 --json
if ($LASTEXITCODE -ne 0) {
    throw 'Authenticated page fetch failed.'
}
$result = $resultText | ConvertFrom-Json
if (-not $result.success -or $result.data.result.status -ne 200 -or $result.data.result.size -le 0) {
    throw 'The attachment response was empty or unsuccessful.'
}

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$candidate = $null
do {
    foreach ($dir in @($OutputDir, $defaultDownloads)) {
        if (-not (Test-Path -LiteralPath $dir)) { continue }
        $base = [System.IO.Path]::GetFileNameWithoutExtension($safeName)
        $ext = [System.IO.Path]::GetExtension($safeName)
        $candidate = Get-ChildItem -LiteralPath $dir -File -ErrorAction SilentlyContinue |
            Where-Object {
                $_.LastWriteTime -ge $started.AddSeconds(-2) -and
                $_.Extension -ne '.crdownload' -and
                ($_.Name -eq $safeName -or $_.Name -like "$base (*)$ext")
            } |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 1
        if ($candidate) { break }
    }
    if (-not $candidate) { Start-Sleep -Milliseconds 500 }
} while (-not $candidate -and (Get-Date) -lt $deadline)

if (-not $candidate) {
    throw "Download did not complete within $TimeoutSeconds seconds."
}

$target = Join-Path $OutputDir $safeName
if ($candidate.FullName -ne $target) {
    if (Test-Path -LiteralPath $target) {
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $target = Join-Path $OutputDir ("{0}-{1}{2}" -f [System.IO.Path]::GetFileNameWithoutExtension($safeName), $stamp, [System.IO.Path]::GetExtension($safeName))
    }
    Move-Item -LiteralPath $candidate.FullName -Destination $target
}

$file = Get-Item -LiteralPath $target
if ($file.Length -le 0) {
    throw 'Downloaded file is empty.'
}
$head = [System.IO.File]::ReadAllBytes($file.FullName)[0..([Math]::Min(15, $file.Length - 1))]
$headText = [System.Text.Encoding]::ASCII.GetString($head)
if ($headText -match '^\s*<(html|!DOCTYPE)') {
    throw 'Downloaded content is an HTML page, not an attachment.'
}

[pscustomobject]@{
    Path = $file.FullName
    Size = $file.Length
    ContentId = $ContentId
    MimeType = $result.data.result.type
}
