import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import {
  ADMIN_CONTACT_EMAIL,
  ORGANIZER_COMPLIANCE_WEBHOOK_URL,
} from '../constants';
import { EmailResult, OrganizerComplianceAttachment } from '../types';
import { supabase } from './supabaseClient';

const uint8ToBase64 = (bytes: Uint8Array): string => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';

  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const buffer = (first << 16) | (second << 8) | third;

    output += alphabet[(buffer >> 18) & 63];
    output += alphabet[(buffer >> 12) & 63];
    output += index + 1 < bytes.length ? alphabet[(buffer >> 6) & 63] : '=';
    output += index + 2 < bytes.length ? alphabet[buffer & 63] : '=';
  }

  return output;
};

const fileToBase64 = async (attachment: OrganizerComplianceAttachment): Promise<string> => {
  if (Platform.OS === 'web') {
    const response = await fetch(attachment.uri);
    const buffer = await response.arrayBuffer();
    return uint8ToBase64(new Uint8Array(buffer));
  }

  return FileSystem.readAsStringAsync(attachment.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
};

export const sendOrganizerComplianceEmail = async (payload: {
  organizerEmail: string;
  organizationName?: string;
  organizationRole: string;
  organizationRoleLabel?: string;
  legalRepresentative?: string;
  officialPhone?: string;
  fiscalData?: string;
  bankAccount?: string;
  adminContactMessage?: string;
  attachments: OrganizerComplianceAttachment[];
}): Promise<EmailResult> => {
  if (!ORGANIZER_COMPLIANCE_WEBHOOK_URL) {
    return {
      sent: true,
      mode: 'simulated',
      detail: 'Webhook compliance non configurato.',
    };
  }

  if (!supabase) {
    return {
      sent: false,
      mode: 'webhook',
      detail: 'Supabase non configurato.',
    };
  }

  try {
    const sessionResult = await supabase.auth.getSession();
    if (sessionResult.error) {
      return {
        sent: false,
        mode: 'webhook',
        detail: `Sessione utente non disponibile: ${sessionResult.error.message}`,
      };
    }

    const accessToken = sessionResult.data.session?.access_token;
    if (!accessToken) {
      return {
        sent: false,
        mode: 'webhook',
        detail: 'Sessione utente mancante. Effettua login e riprova.',
      };
    }

    const attachmentsPayload = await Promise.all(
      payload.attachments.map(async (entry) => ({
        kind: entry.kind,
        fileName: entry.fileName,
        mimeType: entry.mimeType ?? 'application/octet-stream',
        base64: await fileToBase64(entry),
      }))
    );

    const response = await fetch(ORGANIZER_COMPLIANCE_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        adminEmail: ADMIN_CONTACT_EMAIL,
        ...payload,
        attachments: attachmentsPayload,
      }),
    });

    let body: { sent?: boolean; mode?: 'simulated' | 'webhook' | 'resend'; detail?: string } = {};
    try {
      body = (await response.json()) as {
        sent?: boolean;
        mode?: 'simulated' | 'webhook' | 'resend';
        detail?: string;
      };
    } catch {
      // keep defaults
    }

    return {
      sent: body.sent ?? response.ok,
      mode: body.mode ?? 'webhook',
      statusCode: response.status,
      detail: body.detail,
    };
  } catch {
    return {
      sent: false,
      mode: 'webhook',
      detail: 'Errore rete invio documenti compliance.',
    };
  }
};
