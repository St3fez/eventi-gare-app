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
$mappingPath = Join-Path $androidDir 'app\build\outputs\mapping\release\mapping.txt'
$nativeSymbolsPath = Join-Path $androidDir 'app\build\outputs\native-debug-symbols\release\native-debug-symbols.zip'
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

function Ensure-GradleProperty {
  param(
    [string]$Path,
    [string]$Key,
    [string]$Value
  )

  if (-not (Test-Path $Path)) {
    return
  }

  $raw = Get-Content $Path -Raw
  $pattern = "(?m)^$([regex]::Escape($Key))=.*$"
  $replacement = "$Key=$Value"

  if ($raw -match $pattern) {
    $updated = [regex]::Replace($raw, $pattern, $replacement, 1)
  } else {
    $separator = if ($raw.EndsWith("`n")) { '' } else { "`r`n" }
    $updated = "$raw$separator$replacement`r`n"
  }

  if ($updated -ne $raw) {
    Set-Content -Path $Path -Value $updated -Encoding UTF8
  }
}

function Ensure-ReleaseAndroidConfig {
  param([string]$AndroidRoot)

  $gradlePropertiesPath = Join-Path $AndroidRoot 'gradle.properties'
  Ensure-GradleProperty -Path $gradlePropertiesPath -Key 'android.enableMinifyInReleaseBuilds' -Value 'true'
  Ensure-GradleProperty -Path $gradlePropertiesPath -Key 'android.enableShrinkResourcesInReleaseBuilds' -Value 'true'

  $buildGradlePath = Join-Path $AndroidRoot 'app\build.gradle'
  if (-not (Test-Path $buildGradlePath)) {
    return
  }

  $raw = Get-Content $buildGradlePath -Raw
  if ($raw -match "debugSymbolLevel\s+'SYMBOL_TABLE'") {
    return
  }

  $updated = [regex]::Replace(
    $raw,
    '(?ms)(versionName\s+"[^"]+"\r?\n)',
    "`$1        ndk {`r`n            debugSymbolLevel 'SYMBOL_TABLE'`r`n        }`r`n",
    1
  )

  if ($updated -ne $raw) {
    Set-Content -Path $buildGradlePath -Value $updated -Encoding UTF8
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

Ensure-ReleaseAndroidConfig -AndroidRoot $androidDir
Remove-DuplicateAppTheme -AndroidRoot $androidDir

Push-Location $androidDir
try {
  .\gradlew.bat --stop | Out-Null
  if ($Clean) {
    .\gradlew.bat :app:clean
    if ($LASTEXITCODE -ne 0) {
      throw "Gradle clean failed with exit code $LASTEXITCODE"
    }
  }
  # Force JS/assets rebundle so demo/prod channel env is always applied.
  $env:GRADLE_OPTS =
    '-Dorg.gradle.daemon=false -Dorg.gradle.parallel=false -Dorg.gradle.workers.max=1 -Dkotlin.compiler.execution.strategy=in-process'
  .\gradlew.bat :app:bundleRelease --rerun-tasks --no-daemon --max-workers=1
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

if (Test-Path $mappingPath) {
  $mappingTargetPath = $targetPath -replace '\.aab$', '-mapping.txt'
  Copy-Item -Path $mappingPath -Destination $mappingTargetPath -Force
  Write-Host "Deobfuscation mapping ready: $mappingTargetPath"
} else {
  Write-Warning "mapping.txt not found at $mappingPath"
}

if (Test-Path $nativeSymbolsPath) {
  $symbolsTargetPath = $targetPath -replace '\.aab$', '-native-debug-symbols.zip'
  Copy-Item -Path $nativeSymbolsPath -Destination $symbolsTargetPath -Force
  Write-Host "Native debug symbols ready: $symbolsTargetPath"
} else {
  Write-Warning "Native debug symbols zip not found at $nativeSymbolsPath"
}

Write-Host "AAB ready: $bundlePath"
Write-Host "Upload copy ready: $targetPath"
Write-Host "Channel: $Channel"
