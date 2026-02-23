# Data Safety Draft (Play Console) - Events

Use this as a draft only. Final declaration must be validated with your legal/privacy advisor.

## Data collected (app behavior)
- Personal info
  - Name
  - Email address
  - Phone (optional)
  - City (optional)
  - Birth date (optional)
- Financial info
  - Payment reference (if payment flow is used)
- App activity
  - Event registration status

## Why data is collected
- App functionality (registration, organizer dashboard)
- Account management (organizer/participant auth)
- Communications (registration confirmation email when enabled)
- Fraud prevention / security (organizer verification, risk scoring)

## Is data encrypted in transit?
- Yes (HTTPS/Supabase/Stripe endpoints)

## Is data deletable?
- Define and expose deletion process in your privacy policy.

## Data sharing
- Service providers used by the app stack:
  - Supabase (backend database/auth)
  - Stripe (payments)
  - Email provider (Resend) when configured

## Ads declaration
- The app shows banner/interstitial ad/sponsor placements in non-home screens.
- Set Ads = Yes in Play Console if monetization is active.
