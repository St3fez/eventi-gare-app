/// <reference path="../_shared/ide-shims.d.ts" />

import { createClient } from 'npm:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.10.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (payload: Record<string, unknown>, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });

type ComplianceAttachment = {
  kind: 'identity_document' | 'organization_document' | 'payment_authorization_document';
  fileName: string;
  mimeType?: string;
  base64: string;
};

type CompliancePayload = {
  adminEmail?: string;
  organizerEmail?: string;
  organizationName?: string;
  organizationRole?: string;
  organizationRoleLabel?: string;
  legalRepresentative?: string;
  officialPhone?: string;
  fiscalData?: string;
  bankAccount?: string;
  adminContactMessage?: string;
  attachments?: ComplianceAttachment[];
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

const attachmentLabel = (kind: ComplianceAttachment['kind']): string => {
  switch (kind) {
    case 'identity_document':
      return 'Documento identita';
    case 'organization_document':
      return 'Documento ente';
    case 'payment_authorization_document':
      return 'Documento abilitazione quote';
    default:
      return kind;
  }
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return json(
      {
        error: 'Missing required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY',
      },
      500
    );
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return json({ error: 'Missing bearer token' }, 401);
  }

  const accessToken = authHeader.replace('Bearer ', '').trim();
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });
  const userResult = await supabaseAdmin.auth.getUser(accessToken);
  if (userResult.error || !userResult.data.user) {
    return json(
      {
        error: 'Invalid user token',
        detail: userResult.error?.message,
      },
      401
    );
  }

  let payload: CompliancePayload;
  try {
    payload = (await req.json()) as CompliancePayload;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (!payload.organizerEmail) {
    return json(
      {
        error: 'Missing required fields',
        required: ['organizerEmail'],
      },
      400
    );
  }

  const smtpConfigResult = buildSmtpConfig();
  const smtpConfig = smtpConfigResult.ok ? smtpConfigResult.data : null;
  const adminEmail = payload.adminEmail ?? 'profstefanoferrari@gmail.com';

  if (!smtpConfig) {
    return json({
      sent: true,
      mode: 'simulated',
      detail: smtpConfigResult.reason,
    });
  }

  const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];
  const attachmentSummary = attachments
    .map((entry) => `- ${attachmentLabel(entry.kind)}: ${entry.fileName}`)
    .join('\n');

  const subject = `Richiesta verifica organizer - ${payload.organizerEmail}`;

  const bodyText = [
    'Nuova richiesta compliance organizer',
    '',
    `Email organizer: ${payload.organizerEmail}`,
    `Ente: ${payload.organizationName ?? '-'}`,
    `Ruolo: ${payload.organizationRole ?? '-'} ${payload.organizationRoleLabel ?? ''}`.trim(),
    `Legale rappresentante: ${payload.legalRepresentative ?? '-'}`,
    `Telefono ufficiale: ${payload.officialPhone ?? '-'}`,
    `Dati fiscali: ${payload.fiscalData ?? '-'}`,
    `IBAN: ${payload.bankAccount ?? '-'}`,
    '',
    `Messaggio amministratore: ${payload.adminContactMessage ?? '-'}`,
    '',
    'Allegati:',
    attachmentSummary || '- Nessun allegato',
  ].join('\n');

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
      to: [adminEmail],
      subject,
      text: bodyText,
      attachments: attachments.map((entry) => ({
        filename: entry.fileName,
        content: entry.base64,
        encoding: 'base64',
        contentType: entry.mimeType || 'application/octet-stream',
      })),
    });

    return json({
      sent: true,
      mode: 'webhook',
      detail: `Email compliance inviata a ${adminEmail}`,
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
    return json(
      {
        sent: false,
        mode: 'webhook',
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
});
