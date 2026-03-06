param(
  [switch]$Clear,
  [ValidateSet('prod', 'demo')]
  [string]$Channel = 'prod'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$webBuildDir = Join-Path $projectRoot 'web-build'
$distDir = Join-Path $projectRoot 'dist\web'
$zipPath = Join-Path $distDir "events-web-build-$Channel.zip"

$env:NODE_ENV = 'production'
$env:EXPO_PUBLIC_APP_CHANNEL = $Channel

if ($Channel -eq 'demo') {
  $env:EXPO_PUBLIC_ORGANIZER_TEST_MODE = 'true'
  $env:EXPO_PUBLIC_ORGANIZER_SECURITY_ENFORCED = 'false'
  $env:EXPO_PUBLIC_DEMO_ALL_OPEN = 'true'
} else {
  $env:EXPO_PUBLIC_ORGANIZER_TEST_MODE = 'false'
  $env:EXPO_PUBLIC_ORGANIZER_SECURITY_ENFORCED = 'true'
  $env:EXPO_PUBLIC_DEMO_ALL_OPEN = 'false'
}

# Web builds do not require native AdMob plugin wiring.
# Force-disable AdMob to avoid config plugin resolution failures during expo export.
$env:EXPO_PUBLIC_ADMOB_ENABLED = 'false'
$env:EXPO_PUBLIC_ADMOB_TEST_MODE = 'false'
$env:ADMOB_ANDROID_APP_ID = ''
$env:ADMOB_IOS_APP_ID = ''
$env:EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID_ANDROID = ''
$env:EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID_IOS = ''
$env:EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID_ANDROID = ''
$env:EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID_IOS = ''
$env:EXPO_SKIP_ADMOB_PLUGIN = 'true'

Push-Location $projectRoot
try {
  if ($Clear) {
    npm run build:web:clear
  } else {
    npm run build:web
  }
  if ($LASTEXITCODE -ne 0) {
    throw "Web build command failed with exit code $LASTEXITCODE"
  }
}
finally {
  Pop-Location
}

if (-not (Test-Path $webBuildDir)) {
  throw "Web build directory not found: $webBuildDir"
}

New-Item -ItemType Directory -Path $distDir -Force | Out-Null
if (Test-Path $zipPath) {
  Remove-Item -Path $zipPath -Force
}

Compress-Archive -Path (Join-Path $webBuildDir '*') -DestinationPath $zipPath -Force

Write-Host "Web build ready: $webBuildDir"
Write-Host "Zip ready for hosting upload: $zipPath"
Write-Host "Channel: $Channel"
