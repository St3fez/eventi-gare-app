import { EventItem, OrganizerProfile, RegistrationRecord } from '../types';
import { cleanText } from '../utils/format';
import { supabase } from './supabaseClient';

type SyncResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      reason: string;
    };

const fail = <T>(reason: string): SyncResult<T> => ({
  ok: false,
  reason,
});

const nullableText = (value?: string): string | null => {
  const text = cleanText(value ?? '');
  return text ? text : null;
};

const nullableDate = (value?: string): string | null => {
  const text = cleanText(value ?? '');
  return text ? text : null;
};

export const ensureSupabaseUser = async (): Promise<SyncResult<{ userId: string }>> => {
  if (!supabase) {
    return fail('Supabase non configurato.');
  }

  const sessionResult = await supabase.auth.getSession();
  if (sessionResult.error) {
    return fail(`Lettura sessione fallita: ${sessionResult.error.message}`);
  }

  const existingUser = sessionResult.data.session?.user;
  if (existingUser) {
    return {
      ok: true,
      data: {
        userId: existingUser.id,
      },
    };
  }

  const anonymous = await supabase.auth.signInAnonymously();
  if (anonymous.error || !anonymous.data.user) {
    const rawError = anonymous.error?.message ?? 'errore sconosciuto';
    const isCaptcha = /captcha/i.test(rawError);
    return fail(
      isCaptcha
        ? 'Sessione anonima bloccata da CAPTCHA/Bot Protection. In Supabase disattiva CAPTCHA per test o configura token CAPTCHA lato client.'
        : `Sessione anonima non disponibile: ${
            anonymous.error?.message ?? 'abilita Anonymous Sign-Ins in Supabase Auth'
          }`
    );
  }

  return {
    ok: true,
    data: {
      userId: anonymous.data.user.id,
    },
  };
};

export const upsertOrganizerInSupabase = async (
  organizer: OrganizerProfile
): Promise<SyncResult<{ id: string; email: string }>> => {
  if (!supabase) {
    return fail('Supabase non configurato.');
  }

  const auth = await ensureSupabaseUser();
  if (!auth.ok) {
    return fail(auth.reason);
  }

  const buildPayload = (email: string) => ({
    user_id: auth.data.userId,
    email,
    fiscal_data: nullableText(organizer.fiscalData),
    bank_account: nullableText(organizer.bankAccount),
    verification_status: organizer.verificationStatus,
    payout_enabled: organizer.payoutEnabled,
    risk_score: organizer.riskScore,
    risk_flags: organizer.riskFlags,
    verification_checklist: organizer.verificationChecklist,
  });

  let emailToUse = cleanText(organizer.email).toLowerCase();

  let { data, error } = await supabase
    .from('organizers')
    .upsert(buildPayload(emailToUse), {
      onConflict: 'user_id',
    })
    .select('id,email')
    .single();

  const rawError = error?.message ?? '';
  const isDuplicateEmail = /organizers_email_key|duplicate key value/i.test(rawError);

  if ((error || !data?.id) && isDuplicateEmail) {
    const [localPart, domainPart] = emailToUse.split('@');
    const safeLocal = cleanText(localPart || 'organizer');
    const safeDomain = cleanText(domainPart || 'eventigare.app');
    emailToUse = `${safeLocal}+${auth.data.userId.slice(0, 8)}@${safeDomain}`;

    const retry = await supabase
      .from('organizers')
      .upsert(buildPayload(emailToUse), {
        onConflict: 'user_id',
      })
      .select('id,email')
      .single();

    data = retry.data;
    error = retry.error;
  }

  if (error || !data?.id || !data?.email) {
    const finalError = error?.message ?? 'id/email mancanti';
    if (/organizers_email_key|duplicate key value/i.test(rawError)) {
      return fail(
        'Email organizzatore gia presente in Supabase. Usa un nuovo organizer con email diversa o pulisci i dati demo locali.'
      );
    }
    return fail(`Sync organizer fallita: ${finalError}`);
  }

  return {
    ok: true,
    data: {
      id: data.id,
      email: data.email,
    },
  };
};

export const insertEventInSupabase = async (
  event: EventItem,
  organizerRemoteId: string
): Promise<SyncResult<{ id: string }>> => {
  if (!supabase) {
    return fail('Supabase non configurato.');
  }

  const { data, error } = await supabase
    .from('events')
    .insert({
      organizer_id: organizerRemoteId,
      name: event.name,
      location: event.location,
      event_date: event.date,
      is_free: event.isFree,
      fee_amount: event.feeAmount,
      privacy_text: event.privacyText,
      logo_url: nullableText(event.logoUrl),
      local_sponsor: nullableText(event.localSponsor),
      assign_numbers: event.assignNumbers,
      active: event.active,
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    return fail(`Sync evento fallita: ${error?.message ?? 'id mancante'}`);
  }

  return {
    ok: true,
    data: {
      id: data.id,
    },
  };
};

export const upsertRegistrationInSupabase = async (params: {
  registration: RegistrationRecord;
  organizerRemoteId: string;
  eventRemoteId: string;
}): Promise<SyncResult<{ id: string }>> => {
  if (!supabase) {
    return fail('Supabase non configurato.');
  }

  const auth = await ensureSupabaseUser();
  if (!auth.ok) {
    return fail(auth.reason);
  }

  const paymentStatus =
    params.registration.paymentStatus === 'not_required'
      ? null
      : params.registration.paymentStatus;

  const { data, error } = await supabase
    .from('registrations')
    .upsert(
      {
        event_id: params.eventRemoteId,
        organizer_id: params.organizerRemoteId,
        participant_user_id: auth.data.userId,
        full_name: params.registration.fullName,
        participant_email: cleanText(params.registration.email).toLowerCase(),
        phone: nullableText(params.registration.phone),
        city: nullableText(params.registration.city),
        birth_date: nullableDate(params.registration.birthDate),
        privacy_consent: params.registration.privacyConsent,
        retention_consent: params.registration.retentionConsent,
        assigned_number: params.registration.assignedNumber ?? null,
        registration_code: params.registration.registrationCode,
        registration_status: params.registration.registrationStatus,
        payment_intent_id: null,
        payment_status: paymentStatus,
        payment_amount: params.registration.paymentAmount,
        payment_method: nullableText(params.registration.paymentMethod),
        payment_reference: nullableText(params.registration.paymentReference),
        payment_session_expires_at: params.registration.paymentSessionExpiresAt ?? null,
        payment_captured_at: params.registration.paymentCapturedAt ?? null,
        payment_failed_reason: nullableText(params.registration.paymentFailedReason),
        refunded_at: params.registration.refundedAt ?? null,
        commission_amount: params.registration.commissionAmount,
      },
      {
        onConflict: 'registration_code',
      }
    )
    .select('id')
    .single();

  if (error || !data?.id) {
    return fail(`Sync iscrizione fallita: ${error?.message ?? 'id mancante'}`);
  }

  return {
    ok: true,
    data: {
      id: data.id,
    },
  };
};
