param(
  [switch]$Clean
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$androidDir = Join-Path $projectRoot 'android'
$bundlePath = Join-Path $androidDir 'app\build\outputs\bundle\release\app-release.aab'
$distDir = Join-Path $projectRoot 'dist\play'

$env:NODE_ENV = 'production'

Push-Location $androidDir
try {
  if ($Clean) {
    .\gradlew.bat :app:clean
  }
  .\gradlew.bat :app:bundleRelease
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

$datedName = "eventi-egare-vc$versionCode-$(Get-Date -Format 'yyyyMMdd-HHmm').aab"
$targetPath = Join-Path $distDir $datedName
Copy-Item -Path $bundlePath -Destination $targetPath -Force

Write-Host "AAB ready: $bundlePath"
Write-Host "Upload copy ready: $targetPath"
