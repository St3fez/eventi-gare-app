/// <reference path="../_shared/ide-shims.d.ts" />

import nodemailer from 'npm:nodemailer@6.10.0';

// Supabase Edge Function: send-confirmation
// Preferred provider: SMTP
// Optional fallback provider: Resend
// Secrets (optional for real email):
// - SMTP_HOST
// - SMTP_PORT (default 587)
// - SMTP_USER
// - SMTP_PASS
// - SMTP_FROM
// Optional fallback:
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

const escapeHtml = (input: string): string =>
  input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const buildHtml = (p: Required<Pick<ConfirmationPayload, 'participantName' | 'eventName' | 'registrationCode'>> & {
  amount?: number;
  assignedNumber?: number;
}) => {
  const safeName = escapeHtml(p.participantName);
  const safeEventName = escapeHtml(p.eventName);
  const safeRegistrationCode = escapeHtml(p.registrationCode);
  const amountLine = typeof p.amount === 'number' ? `<p><strong>Quota:</strong> EUR ${p.amount.toFixed(2)}</p>` : '';
  const numberLine = typeof p.assignedNumber === 'number' ? `<p><strong>Numero iscrizione:</strong> ${p.assignedNumber}</p>` : '';

  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0b2a45;">
      <h2>Conferma iscrizione</h2>
      <p>Ciao ${safeName},</p>
      <p>la tua iscrizione a <strong>${safeEventName}</strong> e stata registrata con successo.</p>
      <p><strong>Codice iscrizione:</strong> ${safeRegistrationCode}</p>
      ${numberLine}
      ${amountLine}
      <p>Grazie per aver usato Eventi.</p>
    </div>
  `;
};

const buildText = (
  p: Required<Pick<ConfirmationPayload, 'participantName' | 'eventName' | 'registrationCode'>> & {
    amount?: number;
    assignedNumber?: number;
  }
) => {
  const lines = [
    'Conferma iscrizione',
    '',
    `Ciao ${p.participantName},`,
    `la tua iscrizione a ${p.eventName} e stata registrata con successo.`,
    `Codice iscrizione: ${p.registrationCode}`,
  ];

  if (typeof p.assignedNumber === 'number') {
    lines.push(`Numero iscrizione: ${p.assignedNumber}`);
  }

  if (typeof p.amount === 'number') {
    lines.push(`Quota: EUR ${p.amount.toFixed(2)}`);
  }

  lines.push('', 'Grazie per aver usato Eventi.');
  return lines.join('\n');
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

  const smtpHost = Deno.env.get('SMTP_HOST');
  const smtpPort = Number.parseInt(Deno.env.get('SMTP_PORT') ?? '587', 10);
  const smtpUser = Deno.env.get('SMTP_USER');
  const smtpPass = Deno.env.get('SMTP_PASS');
  const smtpFrom = Deno.env.get('SMTP_FROM');
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const emailFrom = Deno.env.get('EMAIL_FROM');
  const smtpConfigured = Boolean(smtpHost && smtpUser && smtpPass && smtpFrom);
  const resendConfigured = Boolean(resendApiKey && emailFrom);

  const subject = `Conferma iscrizione - ${payload.eventName}`;
  const html = buildHtml({
    participantName,
    eventName: payload.eventName,
    registrationCode: payload.registrationCode,
    amount: payload.amount,
    assignedNumber: payload.assignedNumber,
  });
  const text = buildText({
    participantName,
    eventName: payload.eventName,
    registrationCode: payload.registrationCode,
    amount: payload.amount,
    assignedNumber: payload.assignedNumber,
  });

  const sendWithResend = async (): Promise<Response> => {
    if (!resendApiKey || !emailFrom) {
      return json(
        {
          sent: false,
          mode: 'resend',
          detail: 'RESEND_API_KEY/EMAIL_FROM mancanti.',
        },
        502
      );
    }

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
  };

  if (smtpConfigured) {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    try {
      await transporter.sendMail({
        from: smtpFrom,
        to: [payload.participantEmail],
        subject,
        text,
        html,
      });

      return json({
        sent: true,
        mode: 'smtp',
        detail: `Email conferma inviata a ${payload.participantEmail}`,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'SMTP send failed';
      if (resendConfigured) {
        const resendResponse = await sendWithResend();
        if (resendResponse.ok) {
          return resendResponse;
        }
      }
      return json(
        {
          sent: false,
          mode: 'smtp',
          detail,
        },
        502
      );
    }
  }

  if (resendConfigured) {
    return sendWithResend();
  }

  return json({
    sent: true,
    mode: 'simulated',
    detail:
      'Provider email non configurato. Imposta SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM (oppure RESEND_API_KEY/EMAIL_FROM).',
    to: payload.participantEmail,
    registrationCode: payload.registrationCode,
  });
});
