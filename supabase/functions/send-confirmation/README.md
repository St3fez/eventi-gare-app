# send-confirmation edge function

Path: `supabase/functions/send-confirmation/index.ts`

Deploy consigliato:
```bash
supabase functions deploy send-confirmation --no-verify-jwt
```

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

## Secrets consigliati (invio reale via SMTP)
- `SMTP_HOST`
- `SMTP_PORT` (default `587`)
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

## Fallback opzionale (Resend)
- `RESEND_API_KEY`
- `EMAIL_FROM` (es: `no-reply@yourdomain.com`)

Priorita provider:
1. SMTP
2. Resend (se SMTP fallisce/non configurato)
3. Simulato (`sent: true, mode: simulated`)
