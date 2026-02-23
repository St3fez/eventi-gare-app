param(
  [switch]$Clean,
  [ValidateSet('prod', 'demo')]
  [string]$Channel = 'prod'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$androidDir = Join-Path $projectRoot 'android'
$bundlePath = Join-Path $androidDir 'app\build\outputs\bundle\release\app-release.aab'
$distDir = Join-Path $projectRoot 'dist\play'

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

Push-Location $androidDir
try {
  if ($Clean) {
    .\gradlew.bat :app:clean
  }
  # Force JS/assets rebundle so demo/prod channel env is always applied.
  .\gradlew.bat :app:bundleRelease --rerun-tasks
}
finally {
  Pop-Location
}

if (-not (Test-Path $bundlePath)) {
  throw "AAB not found: $bundlePath"
}

New-Item -ItemType Directory -Path $distDir -Force | Out-Null

$buildGradlePath = Join-Path $androidDir 'app\build.gradle'
$buildGradle = Get-Content $buildGradlePath -Raw
$versionCode = ([regex]::Match($buildGradle, 'versionCode\s+(\d+)')).Groups[1].Value
if (-not $versionCode) {
  $versionCode = 'unknown'
}

$datedName = "events-$Channel-vc$versionCode-$(Get-Date -Format 'yyyyMMdd-HHmm').aab"
$targetPath = Join-Path $distDir $datedName
Copy-Item -Path $bundlePath -Destination $targetPath -Force

Write-Host "AAB ready: $bundlePath"
Write-Host "Upload copy ready: $targetPath"
Write-Host "Channel: $Channel"
