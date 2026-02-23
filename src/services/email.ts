import { EMAIL_WEBHOOK_URL } from '../constants';
import { EmailResult } from '../types';

export const sendConfirmationEmail = async (payload: {
  participantEmail: string;
  participantName: string;
  eventName: string;
  amount: number;
  registrationCode: string;
  assignedNumber?: number;
  groupParticipantsCount?: number;
}): Promise<EmailResult> => {
  if (!EMAIL_WEBHOOK_URL) {
    return { sent: true, mode: 'simulated', detail: 'Webhook email non configurato.' };
  }

  try {
    const response = await fetch(EMAIL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    let body: { sent?: boolean; mode?: 'simulated' | 'resend' | 'webhook'; detail?: string } = {};
    try {
      body = (await response.json()) as { sent?: boolean; mode?: 'simulated' | 'resend' | 'webhook'; detail?: string };
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
