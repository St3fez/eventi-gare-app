# send-confirmation edge function

Path: `supabase/functions/send-confirmation/index.ts`

## Usage
POST JSON:
```json
{
  "participantEmail": "utente@example.com",
  "participantName": "Mario Rossi",
  "eventName": "Trail delle Colline",
  "amount": 25,
  "registrationCode": "TRA-ABCDE",
  "assignedNumber": 21
}
```

## Optional secrets (real email via Resend)
- `RESEND_API_KEY`
- `EMAIL_FROM` (es: `no-reply@yourdomain.com`)

Se i secrets non ci sono, risponde in modalita simulata (`sent: true, mode: simulated`).
