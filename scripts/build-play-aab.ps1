param(
  [switch]$Clean,
  [switch]$SkipPrebuild,
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

function Remove-DuplicateAppTheme {
  param([string]$AndroidRoot)

  $stylesPath = Join-Path $AndroidRoot 'app\src\main\res\values\styles.xml'
  if (-not (Test-Path $stylesPath)) {
    return
  }

  $raw = Get-Content $stylesPath -Raw
  $duplicatePattern =
    '(?ms)^\s*<style name="AppTheme" parent="Theme\.AppCompat\.Light\.NoActionBar">.*?^\s*</style>\r?\n?'
  $normalized = [regex]::Replace($raw, $duplicatePattern, '')

  if ($normalized -ne $raw) {
    Set-Content -Path $stylesPath -Value $normalized -Encoding UTF8
    Write-Host "Normalized Android styles.xml (removed duplicate AppTheme)."
  }
}

if ($Channel -eq 'demo') {
  $env:EXPO_PUBLIC_ORGANIZER_TEST_MODE = 'true'
  $env:EXPO_PUBLIC_ORGANIZER_SECURITY_ENFORCED = 'false'
  $env:EXPO_PUBLIC_DEMO_ALL_OPEN = 'true'
  $env:EXPO_PUBLIC_ADMOB_ENABLED = 'false'
  $env:EXPO_PUBLIC_ADMOB_TEST_MODE = 'false'
  $env:EXPO_SKIP_ADMOB_PLUGIN = 'true'
} else {
  $env:EXPO_PUBLIC_ORGANIZER_TEST_MODE = 'false'
  $env:EXPO_PUBLIC_ORGANIZER_SECURITY_ENFORCED = 'true'
  $env:EXPO_PUBLIC_DEMO_ALL_OPEN = 'false'
  Remove-Item Env:EXPO_SKIP_ADMOB_PLUGIN -ErrorAction SilentlyContinue
}

if (-not $SkipPrebuild) {
  Push-Location $projectRoot
  try {
    $env:CI = '1'
    npx expo prebuild --platform android --no-install
    if ($LASTEXITCODE -ne 0) {
      throw "expo prebuild failed with exit code $LASTEXITCODE"
    }
  }
  finally {
    Pop-Location
  }
}

Remove-DuplicateAppTheme -AndroidRoot $androidDir

Push-Location $androidDir
try {
  if ($Clean) {
    .\gradlew.bat :app:clean
    if ($LASTEXITCODE -ne 0) {
      throw "Gradle clean failed with exit code $LASTEXITCODE"
    }
  }
  # Force JS/assets rebundle so demo/prod channel env is always applied.
  .\gradlew.bat :app:bundleRelease --rerun-tasks
  if ($LASTEXITCODE -ne 0) {
    throw "Gradle bundleRelease failed with exit code $LASTEXITCODE"
  }
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
