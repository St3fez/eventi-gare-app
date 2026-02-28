param(
  [switch]$SkipEndpointProbes
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $projectRoot '.env'
$packageJsonPath = Join-Path $projectRoot 'package.json'

$checks = New-Object System.Collections.Generic.List[object]
$warnings = New-Object System.Collections.Generic.List[string]
$failures = New-Object System.Collections.Generic.List[string]

function Add-Check {
  param(
    [string]$Name,
    [bool]$Passed,
    [string]$Detail
  )

  $checks.Add([pscustomobject]@{
      Name = $Name
      Passed = $Passed
      Detail = $Detail
    })

  if (-not $Passed) {
    $failures.Add("$Name -> $Detail")
  }
}

function Add-Warning {
  param([string]$Message)
  $warnings.Add($Message)
}

function ConvertFrom-EnvFile {
  param([string]$Path)

  $map = @{}
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) {
      return
    }
    $parts = $line.Split('=', 2)
    if ($parts.Length -eq 2) {
      $key = $parts[0].Trim()
      $value = $parts[1].Trim()
      if (
        ($value.StartsWith('"') -and $value.EndsWith('"')) -or
        ($value.StartsWith("'") -and $value.EndsWith("'"))
      ) {
        $value = $value.Substring(1, $value.Length - 2)
      }
      $map[$key] = $value
    }
  }
  return $map
}

function Get-ProjectRef {
  param([string[]]$Candidates)

  foreach ($candidate in $Candidates) {
    if ([string]::IsNullOrWhiteSpace($candidate)) {
      continue
    }

    $candidateHost = ''
    try {
      $uri = [System.Uri]$candidate
      $candidateHost = $uri.Host
    } catch {
      $candidateHost = $candidate
    }

    if ($candidateHost -match '^([a-zA-Z0-9-]+)\.functions\.supabase\.co$') {
      return $Matches[1]
    }

    if ($candidateHost -match '^([a-zA-Z0-9-]+)\.supabase\.co$') {
      return $Matches[1]
    }

    if ($candidate -match 'https://([a-zA-Z0-9-]+)(?:\.functions)?\.supabase\.co') {
      return $Matches[1]
    }
  }

  return ''
}

function Test-Endpoint {
  param(
    [string]$Name,
    [string]$Url
  )

  if ([string]::IsNullOrWhiteSpace($Url)) {
    Add-Check -Name "$Name endpoint" -Passed:$false -Detail 'URL non configurato'
    return
  }

  try {
    $response = Invoke-WebRequest `
      -Uri $Url `
      -Method POST `
      -Headers @{ 'Content-Type' = 'application/json' } `
      -Body '{}' `
      -TimeoutSec 20 `
      -UseBasicParsing

    Add-Check -Name "$Name endpoint" -Passed:$true -Detail "HTTP $($response.StatusCode)"
  } catch {
    $status = $null
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
      $status = [int]$_.Exception.Response.StatusCode
    }

    if ($status -eq 404) {
      Add-Check -Name "$Name endpoint" -Passed:$false -Detail 'HTTP 404 (function non deployata o URL errato)'
      return
    }

    if ($status -eq 500) {
      Add-Check -Name "$Name endpoint" -Passed:$false -Detail 'HTTP 500 (probabile secret/config server mancanti)'
      return
    }

    if ($status) {
      Add-Check -Name "$Name endpoint" -Passed:$true -Detail "HTTP $status (endpoint raggiungibile)"
      return
    }

    Add-Check -Name "$Name endpoint" -Passed:$false -Detail "Errore rete: $($_.Exception.Message)"
  }
}

if (-not (Test-Path $envPath)) {
  Add-Check -Name '.env presente' -Passed:$false -Detail 'File .env assente'
} else {
  Add-Check -Name '.env presente' -Passed:$true -Detail 'OK'
}

$envMap = @{}
if (Test-Path $envPath) {
  $envMap = ConvertFrom-EnvFile -Path $envPath
}

$requiredKeys = @(
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_EMAIL_WEBHOOK_URL',
  'EXPO_PUBLIC_SPONSOR_CHECKOUT_URL',
  'EXPO_PUBLIC_SPONSOR_MODULE_CHECKOUT_URL',
  'EXPO_PUBLIC_STRIPE_CONNECT_URL',
  'EXPO_PUBLIC_STRIPE_CONNECT_SYNC_URL',
  'EXPO_PUBLIC_PARTICIPANT_CHECKOUT_URL',
  'EXPO_PUBLIC_ORGANIZER_COMPLIANCE_WEBHOOK_URL',
  'EXPO_PUBLIC_EVENT_WEB_BASE_URL',
  'EXPO_PUBLIC_PRIVACY_POLICY_URL',
  'EXPO_PUBLIC_APP_CHANNEL',
  'EXPO_PUBLIC_ORGANIZER_TEST_MODE',
  'EXPO_PUBLIC_ORGANIZER_SECURITY_ENFORCED',
  'EXPO_PUBLIC_DEMO_ALL_OPEN',
  'EXPO_PUBLIC_ADMOB_ENABLED',
  'EXPO_PUBLIC_ADMOB_TEST_MODE'
)

foreach ($key in $requiredKeys) {
  $value = $envMap[$key]
  if ([string]::IsNullOrWhiteSpace($value)) {
    Add-Check -Name "ENV $key" -Passed:$false -Detail 'Mancante'
    continue
  }

  if ($value -match '<.+>' -or $value -match 'example\\.org|example\\.com|changeme') {
    Add-Check -Name "ENV $key" -Passed:$false -Detail 'Placeholder non valido per produzione'
    continue
  }

  Add-Check -Name "ENV $key" -Passed:$true -Detail 'OK'
}

$privacyPolicyUrl = [string]$envMap['EXPO_PUBLIC_PRIVACY_POLICY_URL']
Add-Check `
  -Name 'Privacy policy URL HTTPS' `
  -Passed:($privacyPolicyUrl -match '^https://') `
  -Detail "Valore attuale: '$privacyPolicyUrl'"

$channel = ([string]$envMap['EXPO_PUBLIC_APP_CHANNEL']).ToLowerInvariant()
$testMode = ([string]$envMap['EXPO_PUBLIC_ORGANIZER_TEST_MODE']).ToLowerInvariant()
$security = ([string]$envMap['EXPO_PUBLIC_ORGANIZER_SECURITY_ENFORCED']).ToLowerInvariant()
$demoAllOpen = ([string]$envMap['EXPO_PUBLIC_DEMO_ALL_OPEN']).ToLowerInvariant()

Add-Check -Name 'Channel prod' -Passed:($channel -eq 'prod') -Detail "Valore attuale: '$channel'"
Add-Check -Name 'Organizer test mode OFF' -Passed:($testMode -eq 'false') -Detail "Valore attuale: '$testMode'"
Add-Check -Name 'Organizer security ON' -Passed:($security -eq 'true') -Detail "Valore attuale: '$security'"
Add-Check -Name 'Demo all open OFF' -Passed:($demoAllOpen -eq 'false') -Detail "Valore attuale: '$demoAllOpen'"

$admobEnabled = ([string]$envMap['EXPO_PUBLIC_ADMOB_ENABLED']).ToLowerInvariant()
$admobTestMode = ([string]$envMap['EXPO_PUBLIC_ADMOB_TEST_MODE']).ToLowerInvariant()

if ($admobEnabled -eq 'true') {
  if ($admobTestMode -eq 'true') {
    Add-Warning 'AdMob test mode attivo: verifica ID produzione prima del go-live.'
  }
  $admobAppIdRequired = @(
    'ADMOB_ANDROID_APP_ID',
    'ADMOB_IOS_APP_ID'
  )

  foreach ($key in $admobAppIdRequired) {
    $value = $envMap[$key]
    if ([string]::IsNullOrWhiteSpace($value)) {
      Add-Check -Name "ENV $key" -Passed:$false -Detail 'Mancante (AdMob attivo)'
      continue
    }

    if ($value -notmatch '^ca-app-pub-[0-9]{16}~[0-9]{10}$') {
      Add-Check -Name "ENV $key" -Passed:$false -Detail 'Formato App ID AdMob non valido'
      continue
    }

    if ($value -match '^ca-app-pub-3940256099942544~') {
      Add-Warning "AdMob in test mode: $key usa App ID di test."
    }

    Add-Check -Name "ENV $key" -Passed:$true -Detail 'OK'
  }

  $admobRequired = @(
    'EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID_ANDROID',
    'EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID_IOS',
    'EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID_ANDROID',
    'EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID_IOS'
  )

  foreach ($key in $admobRequired) {
    $value = $envMap[$key]
    if ([string]::IsNullOrWhiteSpace($value)) {
      Add-Check -Name "ENV $key" -Passed:$false -Detail 'Mancante (AdMob attivo)'
      continue
    }
    if ($value -match 'ca-app-pub-3940256099942544') {
      Add-Warning "AdMob in test mode: $key usa ID di test."
    }
    Add-Check -Name "ENV $key" -Passed:$true -Detail 'OK'
  }
} else {
  Add-Warning 'AdMob disattivato: nessun banner/interstitial di rete ads.'
}

$supabaseUrl = $envMap['EXPO_PUBLIC_SUPABASE_URL']
$projectRef = Get-ProjectRef -Candidates @(
  $supabaseUrl,
  $envMap['EXPO_PUBLIC_EMAIL_WEBHOOK_URL'],
  $envMap['EXPO_PUBLIC_SPONSOR_CHECKOUT_URL'],
  $envMap['EXPO_PUBLIC_SPONSOR_MODULE_CHECKOUT_URL'],
  $envMap['EXPO_PUBLIC_STRIPE_CONNECT_URL'],
  $envMap['EXPO_PUBLIC_STRIPE_CONNECT_SYNC_URL'],
  $envMap['EXPO_PUBLIC_PARTICIPANT_CHECKOUT_URL'],
  $envMap['EXPO_PUBLIC_ORGANIZER_COMPLIANCE_WEBHOOK_URL']
)

if ([string]::IsNullOrWhiteSpace($projectRef)) {
  $joinedCandidates = @(
    $supabaseUrl,
    $envMap['EXPO_PUBLIC_EMAIL_WEBHOOK_URL'],
    $envMap['EXPO_PUBLIC_SPONSOR_CHECKOUT_URL'],
    $envMap['EXPO_PUBLIC_SPONSOR_MODULE_CHECKOUT_URL'],
    $envMap['EXPO_PUBLIC_STRIPE_CONNECT_URL'],
    $envMap['EXPO_PUBLIC_STRIPE_CONNECT_SYNC_URL'],
    $envMap['EXPO_PUBLIC_PARTICIPANT_CHECKOUT_URL'],
    $envMap['EXPO_PUBLIC_ORGANIZER_COMPLIANCE_WEBHOOK_URL']
  ) -join ' '
  if ($joinedCandidates -match 'https://([a-zA-Z0-9-]+)(?:\.functions)?\.supabase\.co') {
    $projectRef = $Matches[1]
  }
}

if ($projectRef) {
  Add-Check -Name 'Project ref derivabile da SUPABASE_URL' -Passed:$true -Detail "project ref: $projectRef"
} else {
  Add-Warning 'Project ref Supabase non derivabile automaticamente da .env (possibile dominio custom).'
  Add-Check -Name 'Project ref derivabile da SUPABASE_URL' -Passed:$true -Detail 'Non derivabile automaticamente (controllo non bloccante)'
}

if (-not $SkipEndpointProbes) {
Test-Endpoint -Name 'send-confirmation' -Url $envMap['EXPO_PUBLIC_EMAIL_WEBHOOK_URL']
Test-Endpoint -Name 'sponsor-checkout' -Url $envMap['EXPO_PUBLIC_SPONSOR_CHECKOUT_URL']
Test-Endpoint -Name 'sponsor-module-checkout' -Url $envMap['EXPO_PUBLIC_SPONSOR_MODULE_CHECKOUT_URL']
Test-Endpoint -Name 'stripe-connect' -Url $envMap['EXPO_PUBLIC_STRIPE_CONNECT_URL']
Test-Endpoint -Name 'stripe-connect-sync' -Url $envMap['EXPO_PUBLIC_STRIPE_CONNECT_SYNC_URL']
Test-Endpoint -Name 'participant-checkout' -Url $envMap['EXPO_PUBLIC_PARTICIPANT_CHECKOUT_URL']
Test-Endpoint -Name 'send-organizer-compliance' -Url $envMap['EXPO_PUBLIC_ORGANIZER_COMPLIANCE_WEBHOOK_URL']

  if ($projectRef) {
    $stripeWebhookUrl = "https://$projectRef.functions.supabase.co/stripe-webhook"
    Test-Endpoint -Name 'stripe-webhook' -Url $stripeWebhookUrl
  } else {
    Add-Warning 'Probe stripe-webhook saltata: project ref non derivabile automaticamente.'
    Add-Check -Name 'stripe-webhook endpoint' -Passed:$true -Detail 'Probe saltata (non bloccante)'
  }
} else {
  Add-Warning 'Endpoint probes saltati con -SkipEndpointProbes'
}

if (-not (Test-Path $packageJsonPath)) {
  Add-Check -Name 'package.json presente' -Passed:$false -Detail 'File mancante'
} else {
  Add-Check -Name 'package.json presente' -Passed:$true -Detail 'OK'
  $pkg = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
  $depNames = @()
  if ($pkg.dependencies) { $depNames += $pkg.dependencies.PSObject.Properties.Name }
  if ($pkg.devDependencies) { $depNames += $pkg.devDependencies.PSObject.Properties.Name }

  $adSdkCandidates = @(
    'react-native-google-mobile-ads',
    'expo-ads-admob',
    '@react-native-admob/admob',
    'react-native-admob-native-ads'
  )
  $foundAdSdks = $adSdkCandidates | Where-Object { $depNames -contains $_ }
  if ($foundAdSdks.Count -gt 0) {
    Add-Check -Name 'Ads SDK installato' -Passed:$true -Detail ($foundAdSdks -join ', ')
  } else {
    Add-Warning 'Nessun Ads SDK rilevato: attualmente usi solo sponsor/banner interni (non rete ads esterna).'
  }
}

if (Test-Path (Join-Path $projectRoot 'README.md')) {
  $readmeText = Get-Content (Join-Path $projectRoot 'README.md') -Raw
  if ($readmeText -match 'base tecnica' -and $readmeText -match 'consulente legale/privacy') {
    Add-Warning 'I testi legali sono marcati come base tecnica: serve validazione legale prima del go-live.'
  }
}

Write-Host ''
Write-Host '=== Preflight PROD Readiness ==='
foreach ($check in $checks) {
  $icon = if ($check.Passed) { '[OK]' } else { '[FAIL]' }
  Write-Host "$icon $($check.Name) -> $($check.Detail)"
}

if ($warnings.Count -gt 0) {
  Write-Host ''
  Write-Host 'Warnings:'
  foreach ($warning in $warnings) {
    Write-Host "- $warning"
  }
}

Write-Host ''
Write-Host "Result: $($checks.Count - $failures.Count)/$($checks.Count) check passed"

if ($failures.Count -gt 0) {
  Write-Host ''
  Write-Host 'Failing checks:'
  foreach ($failure in $failures) {
    Write-Host "- $failure"
  }
  exit 1
}

exit 0
