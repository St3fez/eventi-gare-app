/// <reference path="../_shared/ide-shims.d.ts" />

// Supabase Edge Function: send-confirmation
// Optional provider: Resend
// Secrets (optional for real email):
// - RESEND_API_KEY
// - EMAIL_FROM (es. no-reply@yourdomain.com)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (payload: Record<string, unknown>, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

type ConfirmationPayload = {
  participantEmail?: string;
  participantName?: string;
  eventName?: string;
  amount?: number;
  registrationCode?: string;
  assignedNumber?: number;
};

const buildHtml = (p: Required<Pick<ConfirmationPayload, 'participantName' | 'eventName' | 'registrationCode'>> & {
  amount?: number;
  assignedNumber?: number;
}) => {
  const amountLine = typeof p.amount === 'number' ? `<p><strong>Quota:</strong> EUR ${p.amount.toFixed(2)}</p>` : '';
  const numberLine = typeof p.assignedNumber === 'number' ? `<p><strong>Numero iscrizione:</strong> ${p.assignedNumber}</p>` : '';

  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0b2a45;">
      <h2>Conferma iscrizione</h2>
      <p>Ciao ${p.participantName},</p>
      <p>la tua iscrizione a <strong>${p.eventName}</strong> e stata registrata con successo.</p>
      <p><strong>Codice iscrizione:</strong> ${p.registrationCode}</p>
      ${numberLine}
      ${amountLine}
      <p>Grazie per aver usato Eventi.</p>
    </div>
  `;
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let payload: ConfirmationPayload;
  try {
    payload = (await req.json()) as ConfirmationPayload;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (!payload.participantEmail || !payload.registrationCode || !payload.eventName) {
    return json(
      {
        error: 'Missing required fields',
        required: ['participantEmail', 'registrationCode', 'eventName'],
      },
      400
    );
  }

  const participantName = payload.participantName ?? 'Partecipante';

  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const emailFrom = Deno.env.get('EMAIL_FROM');

  // Fallback dev mode: if no provider configured, return success-simulated.
  if (!resendApiKey || !emailFrom) {
    return json({
      sent: true,
      mode: 'simulated',
      detail: 'Provider email non configurato (RESEND_API_KEY/EMAIL_FROM mancanti).',
      to: payload.participantEmail,
      registrationCode: payload.registrationCode,
    });
  }

  const subject = `Conferma iscrizione - ${payload.eventName}`;
  const html = buildHtml({
    participantName,
    eventName: payload.eventName,
    registrationCode: payload.registrationCode,
    amount: payload.amount,
    assignedNumber: payload.assignedNumber,
  });

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [payload.participantEmail],
      subject,
      html,
    }),
  });

  const resultText = await response.text();
  if (!response.ok) {
    return json(
      {
        sent: false,
        mode: 'resend',
        error: 'Provider email failed',
        status: response.status,
        detail: resultText,
      },
      502
    );
  }

  return json({
    sent: true,
    mode: 'resend',
    providerResponse: resultText,
  });
});
