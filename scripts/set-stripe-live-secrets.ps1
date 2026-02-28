param(
  [string]$ProjectRef,
  [string]$StripeSecretKey,
  [string]$StripeWebhookSigningSecret
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Convert-SecureStringToPlainText {
  param([System.Security.SecureString]$SecureValue)

  if ($null -eq $SecureValue) {
    return ''
  }

  $ptr = [System.IntPtr]::Zero
  try {
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  } finally {
    if ($ptr -ne [System.IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
  }
}

function Resolve-ProjectRef {
  param([string]$ExplicitProjectRef)

  $candidate = ''
  if ($null -ne $ExplicitProjectRef) {
    $candidate = $ExplicitProjectRef.Trim()
  }
  if ($candidate) {
    return $candidate
  }

  $linkFile = Join-Path -Path (Get-Location) -ChildPath 'supabase/.temp/project-ref'
  if (Test-Path -Path $linkFile) {
    $linked = (Get-Content -Path $linkFile -Raw).Trim()
    if ($linked) {
      return $linked
    }
  }

  throw "Project ref non trovato. Esegui 'npx supabase link --project-ref <PROJECT_REF>' oppure passa -ProjectRef."
}

function Require-LiveKey {
  param(
    [string]$Value,
    [string]$Prefix,
    [string]$Label
  )

  $trimmed = ''
  if ($null -ne $Value) {
    $trimmed = $Value.Trim()
  }
  if (-not $trimmed) {
    throw "$Label non valorizzata."
  }
  if (-not $trimmed.StartsWith($Prefix, [System.StringComparison]::Ordinal)) {
    throw "$Label deve iniziare con '$Prefix'."
  }

  return $trimmed
}

function Read-Secret {
  param(
    [string]$Prompt,
    [string]$ProvidedValue
  )

  $provided = ''
  if ($null -ne $ProvidedValue) {
    $provided = $ProvidedValue.Trim()
  }
  if ($provided) {
    return $provided
  }

  $secure = Read-Host -Prompt $Prompt -AsSecureString
  return (Convert-SecureStringToPlainText -SecureValue $secure).Trim()
}

if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
  throw "'npx' non disponibile. Installa Node.js prima di continuare."
}

$resolvedProjectRef = Resolve-ProjectRef -ExplicitProjectRef $ProjectRef
$rawStripeSecretKey = Read-Secret -Prompt 'Inserisci STRIPE_SECRET_KEY (sk_live_...)' -ProvidedValue $StripeSecretKey
$rawWebhookSecret = Read-Secret -Prompt 'Inserisci STRIPE_WEBHOOK_SIGNING_SECRET (whsec_...)' -ProvidedValue $StripeWebhookSigningSecret

$liveStripeSecretKey = Require-LiveKey -Value $rawStripeSecretKey -Prefix 'sk_live_' -Label 'STRIPE_SECRET_KEY'
$liveWebhookSecret = Require-LiveKey -Value $rawWebhookSecret -Prefix 'whsec_' -Label 'STRIPE_WEBHOOK_SIGNING_SECRET'

Write-Host "Imposto i secret Stripe live su Supabase project '$resolvedProjectRef'..."
& npx supabase secrets set `
  "STRIPE_SECRET_KEY=$liveStripeSecretKey" `
  "STRIPE_WEBHOOK_SIGNING_SECRET=$liveWebhookSecret" `
  --project-ref $resolvedProjectRef

if ($LASTEXITCODE -ne 0) {
  throw "Aggiornamento secrets fallito."
}

Write-Host ''
Write-Host 'Secret aggiornati. Verifica nomi presenti:'
& npx supabase secrets list --project-ref $resolvedProjectRef

if ($LASTEXITCODE -ne 0) {
  throw "Impossibile verificare la lista secrets."
}

Write-Host ''
Write-Host 'Completato. Ricorda di usare un webhook Stripe in modalita LIVE con relativo whsec_.'
