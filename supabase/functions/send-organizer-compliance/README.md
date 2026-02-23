# send-organizer-compliance

Edge Function per invio email documentazione organizer a:
- `profstefanoferrari@gmail.com` (default) o `adminEmail` nel payload.

## Metodo
- `POST` JSON

## Payload minimo
```json
{
  "organizerEmail": "organizer@example.com",
  "attachments": []
}
```

## Payload completo
```json
{
  "adminEmail": "profstefanoferrari@gmail.com",
  "organizerEmail": "organizer@example.com",
  "organizationName": "Fondazione XYZ",
  "organizationRole": "presidente_fondazione",
  "organizationRoleLabel": "",
  "legalRepresentative": "Mario Rossi",
  "officialPhone": "+39333...",
  "fiscalData": "P.IVA ...",
  "bankAccount": "IT...",
  "adminContactMessage": "Richiesta verifica evento a quota",
  "attachments": [
    {
      "kind": "identity_document",
      "fileName": "carta_identita.pdf",
      "mimeType": "application/pdf",
      "base64": "<base64>"
    }
  ]
}
```

## Secrets richiesti
- `SMTP_HOST`
- `SMTP_PORT` (default `587`)
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

Se i secret SMTP non sono configurati, la funzione risponde in modalita `simulated`.
