import { EMAIL_WEBHOOK_URL } from '../constants';
import { EmailResult } from '../types';

type EmailWebhookResponse = {
  sent?: boolean;
  mode?: 'simulated' | 'resend' | 'webhook' | 'smtp';
  detail?: string;
};

const postEmailWebhook = async (payload: Record<string, unknown>): Promise<EmailResult> => {
  if (!EMAIL_WEBHOOK_URL) {
    return { sent: true, mode: 'simulated', detail: 'Webhook email non configurato.' };
  }

  try {
    const response = await fetch(EMAIL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    let body: EmailWebhookResponse = {};
    try {
      body = (await response.json()) as EmailWebhookResponse;
    } catch {
      // keep defaults
    }

    const mode = body.mode ?? 'webhook';
    const sent = body.sent ?? response.ok;

    return {
      sent,
      mode,
      statusCode: response.status,
      detail: body.detail,
    };
  } catch {
    return {
      sent: false,
      mode: 'webhook',
      detail: 'Errore di rete durante invio webhook email.',
    };
  }
};

export const sendConfirmationEmail = async (payload: {
  participantEmail: string;
  participantName: string;
  eventName: string;
  amount: number;
  registrationCode: string;
  assignedNumber?: number;
  groupParticipantsCount?: number;
}): Promise<EmailResult> =>
  postEmailWebhook(payload as unknown as Record<string, unknown>);

export const sendNotificationEmail = async (payload: {
  toEmail: string;
  recipientName: string;
  subject: string;
  text: string;
  html?: string;
  eventName: string;
  registrationCode: string;
}): Promise<EmailResult> =>
  postEmailWebhook({
    participantEmail: payload.toEmail,
    participantName: payload.recipientName,
    eventName: payload.eventName,
    registrationCode: payload.registrationCode,
    customSubject: payload.subject,
    customText: payload.text,
    customHtml: payload.html,
  });
