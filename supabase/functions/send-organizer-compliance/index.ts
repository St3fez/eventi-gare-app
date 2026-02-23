/// <reference path="../_shared/ide-shims.d.ts" />

import nodemailer from 'npm:nodemailer@6.10.0';

const json = (payload: Record<string, unknown>, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
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
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
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

  const smtpHost = Deno.env.get('SMTP_HOST');
  const smtpPort = Number.parseInt(Deno.env.get('SMTP_PORT') ?? '587', 10);
  const smtpUser = Deno.env.get('SMTP_USER');
  const smtpPass = Deno.env.get('SMTP_PASS');
  const smtpFrom = Deno.env.get('SMTP_FROM');
  const adminEmail = payload.adminEmail ?? 'profstefanoferrari@gmail.com';

  if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom) {
    return json({
      sent: true,
      mode: 'simulated',
      detail:
        'SMTP non configurato. Imposta SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.',
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
    const detail = error instanceof Error ? error.message : 'SMTP send failed';
    return json(
      {
        sent: false,
        mode: 'webhook',
        detail,
      },
      502
    );
  }
});
