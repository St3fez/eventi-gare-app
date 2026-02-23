param(
  [string]$Site = 'eventi-gare-app',
  [switch]$SkipBuild,
  [ValidateSet('prod', 'demo')]
  [string]$Channel = 'prod'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$webBuildDir = Join-Path $projectRoot 'web-build'

if ([string]::IsNullOrWhiteSpace($env:NETLIFY_AUTH_TOKEN)) {
  throw 'NETLIFY_AUTH_TOKEN non impostato. Crea un Personal Access Token Netlify e impostalo nella shell prima del deploy.'
}

Push-Location $projectRoot
try {
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

  if (-not $SkipBuild) {
    npm run build:web
    if ($LASTEXITCODE -ne 0) {
      throw "Build web fallita con codice $LASTEXITCODE"
    }
  }

  if (-not (Test-Path $webBuildDir)) {
    throw "Cartella web-build non trovata: $webBuildDir"
  }

  npx --yes netlify-cli deploy --prod --dir web-build --site $Site --auth $env:NETLIFY_AUTH_TOKEN --no-build
  if ($LASTEXITCODE -ne 0) {
    throw "Deploy Netlify fallito con codice $LASTEXITCODE"
  }

  Write-Host "Deploy completato sul sito Netlify: $Site"
  Write-Host "Channel: $Channel"
}
finally {
  Pop-Location
}
