param(
  [Parameter(Mandatory = $true)]
  [string]$Url,
  [string]$OutFile = 'dist\web\eventi-e-gare-web-qr.png',
  [int]$Size = 1024
)

$ErrorActionPreference = 'Stop'

if (-not ($Url -match '^https?://')) {
  throw "URL must start with http:// or https://"
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$outPath = Join-Path $projectRoot $OutFile
$outDir = Split-Path -Parent $outPath
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

$encoded = [System.Uri]::EscapeDataString($Url)
$qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=${Size}x${Size}&format=png&margin=20&data=$encoded"

Invoke-WebRequest -Uri $qrUrl -OutFile $outPath

Write-Host "QR generated: $outPath"
Write-Host "Target URL: $Url"
