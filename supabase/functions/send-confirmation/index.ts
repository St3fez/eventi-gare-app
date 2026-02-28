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
  customSubject?: string;
  customText?: string;
  customHtml?: string;
};

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  requireTls: boolean;
  tlsRejectUnauthorized: boolean;
  user: string;
  pass: string;
  from: string;
};

const normalizeSecret = (value: string | undefined): string => {
  const trimmed = (value ?? '').trim();
  if (!trimmed) {
    return '';
  }
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
};

const parseBooleanSecret = (value: string | undefined, defaultValue: boolean): boolean => {
  const normalized = normalizeSecret(value).toLowerCase();
  if (!normalized) {
    return defaultValue;
  }
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return defaultValue;
};

const buildSmtpConfig = (): { ok: true; data: SmtpConfig } | { ok: false; reason: string } => {
  const rawHost = normalizeSecret(Deno.env.get('SMTP_HOST'));
  const rawUser = normalizeSecret(Deno.env.get('SMTP_USER'));
  const rawPass = normalizeSecret(Deno.env.get('SMTP_PASS'));
  const rawFrom = normalizeSecret(Deno.env.get('SMTP_FROM'));
  const rawPort = normalizeSecret(Deno.env.get('SMTP_PORT'));
  const rawSecure = normalizeSecret(Deno.env.get('SMTP_SECURE'));
  const requireTls = parseBooleanSecret(Deno.env.get('SMTP_REQUIRE_TLS'), false);
  const tlsRejectUnauthorized = parseBooleanSecret(
    Deno.env.get('SMTP_TLS_REJECT_UNAUTHORIZED'),
    true
  );

  if (!rawHost || !rawUser || !rawPass || !rawFrom) {
    return {
      ok: false,
      reason: 'SMTP non configurato. Imposta SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.',
    };
  }

  let host = rawHost;
  let derivedPort: number | undefined;
  let derivedSecure: boolean | undefined;

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(host)) {
    try {
      const parsed = new URL(host);
      host = parsed.hostname;
      if (parsed.port) {
        const parsedPort = Number.parseInt(parsed.port, 10);
        if (Number.isFinite(parsedPort) && parsedPort > 0) {
          derivedPort = parsedPort;
        }
      }
      if (parsed.protocol === 'smtps:') {
        derivedSecure = true;
      } else if (parsed.protocol === 'smtp:') {
        derivedSecure = false;
      }
    } catch {
      return {
        ok: false,
        reason: 'SMTP_HOST non valido. Usa host puro (es. smtp.provider.com) o URL smtp://...',
      };
    }
  }

  if (host.includes(':') && !host.startsWith('[')) {
    const maybePort = host.slice(host.lastIndexOf(':') + 1);
    const maybeHost = host.slice(0, host.lastIndexOf(':'));
    const parsedPort = Number.parseInt(maybePort, 10);
    if (maybeHost && Number.isFinite(parsedPort) && parsedPort > 0) {
      host = maybeHost;
      derivedPort = parsedPort;
    }
  }

  host = host.trim();
  if (!host || host.includes(' ') || host.includes('/')) {
    return {
      ok: false,
      reason: 'SMTP_HOST non valido. Inserisci solo hostname SMTP.',
    };
  }

  const configuredPort = Number.parseInt(rawPort || '', 10);
  const secureFromEnv = rawSecure ? parseBooleanSecret(rawSecure, false) : undefined;
  const port =
    (Number.isFinite(configuredPort) && configuredPort > 0 ? configuredPort : undefined) ??
    derivedPort ??
    (secureFromEnv ? 465 : 587);
  const secure = secureFromEnv ?? derivedSecure ?? port === 465;

  return {
    ok: true,
    data: {
      host,
      port,
      secure,
      requireTls,
      tlsRejectUnauthorized,
      user: rawUser,
      pass: rawPass,
      from: rawFrom,
    },
  };
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

const textToHtml = (text: string): string => {
  const escaped = escapeHtml(text);
  return `<div style="font-family:Arial,sans-serif;white-space:pre-wrap;line-height:1.5;color:#0b2a45;">${escaped}</div>`;
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

  if (!payload.participantEmail) {
    return json(
      {
        error: 'Missing required fields',
        required: ['participantEmail'],
      },
      400
    );
  }

  const customSubject = (payload.customSubject ?? '').trim();
  const customText = (payload.customText ?? '').trim();
  const customHtml = (payload.customHtml ?? '').trim();
  const hasCustomTemplate = Boolean(customSubject && (customText || customHtml));

  if (!hasCustomTemplate && (!payload.registrationCode || !payload.eventName)) {
    return json(
      {
        error: 'Missing required fields',
        required: ['participantEmail', 'registrationCode', 'eventName'],
      },
      400
    );
  }

  const participantName = payload.participantName ?? 'Partecipante';

  const smtpConfigResult = buildSmtpConfig();
  const smtpConfig = smtpConfigResult.ok ? smtpConfigResult.data : null;
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const emailFrom = Deno.env.get('EMAIL_FROM');
  const smtpConfigured = Boolean(smtpConfig);
  const resendConfigured = Boolean(resendApiKey && emailFrom);

  const subject = hasCustomTemplate
    ? customSubject
    : `Conferma iscrizione - ${payload.eventName}`;
  const html = hasCustomTemplate
    ? customHtml || textToHtml(customText)
    : buildHtml({
        participantName,
        eventName: payload.eventName!,
        registrationCode: payload.registrationCode!,
        amount: payload.amount,
        assignedNumber: payload.assignedNumber,
      });
  const text = hasCustomTemplate
    ? customText || customSubject
    : buildText({
        participantName,
        eventName: payload.eventName!,
        registrationCode: payload.registrationCode!,
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
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      requireTLS: smtpConfig.requireTls,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass,
      },
      tls: {
        rejectUnauthorized: smtpConfig.tlsRejectUnauthorized,
      },
    });

    try {
      await transporter.sendMail({
        from: smtpConfig.from,
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
      const smtpError = error as
        | (Error & {
            code?: string;
            command?: string;
            errno?: string | number;
            syscall?: string;
            hostname?: string;
            responseCode?: number;
          })
        | undefined;
      const detail = smtpError?.message ?? 'SMTP send failed';
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
          smtp: {
            host: smtpConfig.host,
            port: smtpConfig.port,
            secure: smtpConfig.secure,
            requireTls: smtpConfig.requireTls,
          },
          errorCode: smtpError?.code,
          errorCommand: smtpError?.command,
          errorErrno: smtpError?.errno,
          errorSyscall: smtpError?.syscall,
          errorHostname: smtpError?.hostname,
          errorResponseCode: smtpError?.responseCode,
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
      smtpConfigResult.ok
        ? 'Provider email non configurato. Imposta SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM (oppure RESEND_API_KEY/EMAIL_FROM).'
        : `${smtpConfigResult.reason} (oppure usa RESEND_API_KEY/EMAIL_FROM).`,
    to: payload.participantEmail,
    registrationCode: payload.registrationCode,
  });
});
