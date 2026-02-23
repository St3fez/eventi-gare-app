import { EventItem, OrganizerProfile, RegistrationRecord } from '../types';
import { cleanText, toIsoTime } from '../utils/format';
import { ORGANIZER_SECURITY_ENFORCED } from '../constants';
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

const nullableTime = (value?: string): string | null => {
  const normalized = toIsoTime(value ?? '');
  return normalized || null;
};

const normalizeOrganizerRole = (value?: string): 'presidente_fondazione' | 'segretario_associazione' | 'altro' => {
  if (value === 'presidente_fondazione' || value === 'segretario_associazione') {
    return value;
  }
  return 'altro';
};

const buildEventLegacyPayload = (event: EventItem, organizerRemoteId: string) => ({
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
});

const buildEventExtendedPayload = (event: EventItem, organizerRemoteId: string) => ({
  ...buildEventLegacyPayload(event, organizerRemoteId),
  event_end_date: event.endDate,
  event_time: nullableTime(event.startTime),
  participant_auth_mode: event.participantAuthMode,
  participant_phone_required: event.participantPhoneRequired,
  cash_payment_enabled: event.cashPaymentEnabled,
  cash_payment_instructions: nullableText(event.cashPaymentInstructions),
  cash_payment_deadline: event.cashPaymentDeadline ?? null,
  registrations_open: event.registrationsOpen,
  closed_at: event.closedAt ?? null,
  definitive_published_at: event.definitivePublishedAt ?? null,
  season_version: event.seasonVersion,
  last_participants_reset_at: event.lastParticipantsResetAt ?? null,
});

const isUnsupportedEventFieldError = (message: string): boolean =>
  /event_end_date|event_time|participant_auth_mode|participant_phone_required|cash_payment_enabled|cash_payment_instructions|cash_payment_deadline|registrations_open|closed_at|definitive_published_at|season_version|last_participants_reset_at/i.test(
    message
  );

export const ensureSupabaseUser = async (options?: {
  allowAnonymous?: boolean;
}): Promise<SyncResult<{ userId: string }>> => {
  if (!supabase) {
    return fail('Supabase non configurato.');
  }

  const allowAnonymous = options?.allowAnonymous ?? true;

  const sessionResult = await supabase.auth.getSession();
  if (sessionResult.error) {
    return fail(`Lettura sessione fallita: ${sessionResult.error.message}`);
  }

  const existingUser = sessionResult.data.session?.user;
  if (existingUser) {
    if (!allowAnonymous && existingUser.is_anonymous) {
      return fail(
        'Per operare come organizzatore e richiesto login reale (Google/Apple) e verifica telefono SMS.'
      );
    }
    return {
      ok: true,
      data: {
        userId: existingUser.id,
      },
    };
  }

  if (!allowAnonymous) {
    return fail(
      'Nessuna sessione autenticata. Effettua login Google/Apple e verifica telefono SMS.'
    );
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

  const auth = await ensureSupabaseUser({
    allowAnonymous: !ORGANIZER_SECURITY_ENFORCED,
  });
  if (!auth.ok) {
    return fail(auth.reason);
  }

  const basePayload = (email: string) => ({
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

  const extendedPayload = (email: string) => ({
    ...basePayload(email),
    organization_name: nullableText(organizer.organizationName),
    organization_role: normalizeOrganizerRole(organizer.organizationRole),
    organization_role_label: nullableText(organizer.organizationRoleLabel),
    legal_representative: nullableText(organizer.legalRepresentative),
    official_phone: nullableText(organizer.officialPhone),
    compliance_documents: organizer.complianceDocuments ?? {},
    compliance_submitted_at: organizer.complianceSubmittedAt ?? null,
    paid_feature_unlocked: organizer.paidFeatureUnlocked,
    paid_feature_unlock_requested_at: organizer.paidFeatureUnlockRequestedAt ?? null,
    paid_feature_unlock_contact: nullableText(organizer.paidFeatureUnlockContact),
    sponsor_module_enabled: organizer.sponsorModuleEnabled,
    sponsor_module_activated_at: organizer.sponsorModuleActivatedAt ?? null,
    sponsor_module_activation_amount: organizer.sponsorModuleActivationAmount,
  });

  let emailToUse = cleanText(organizer.email).toLowerCase();

  let { data, error } = await supabase
    .from('organizers')
    .upsert(extendedPayload(emailToUse), {
      onConflict: 'user_id',
    })
    .select('id,email')
    .single();

  if (
    error &&
    /organization_name|organization_role|legal_representative|official_phone|compliance_documents|paid_feature_unlocked|sponsor_module_enabled|sponsor_module_activated_at|sponsor_module_activation_amount/i.test(
      error.message
    )
  ) {
    const fallback = await supabase
      .from('organizers')
      .upsert(basePayload(emailToUse), {
        onConflict: 'user_id',
      })
      .select('id,email')
      .single();
    data = fallback.data;
    error = fallback.error;
  }

  const rawError = error?.message ?? '';
  const isDuplicateEmail = /organizers_email_key|duplicate key value/i.test(rawError);

  if ((error || !data?.id) && isDuplicateEmail) {
    const [localPart, domainPart] = emailToUse.split('@');
    const safeLocal = cleanText(localPart || 'organizer');
    const safeDomain = cleanText(domainPart || 'eventigare.app');
    emailToUse = `${safeLocal}+${auth.data.userId.slice(0, 8)}@${safeDomain}`;

    const retry = await supabase
      .from('organizers')
      .upsert(extendedPayload(emailToUse), {
        onConflict: 'user_id',
      })
      .select('id,email')
      .single();

    if (
      retry.error &&
      /organization_name|organization_role|legal_representative|official_phone|compliance_documents|paid_feature_unlocked|sponsor_module_enabled|sponsor_module_activated_at|sponsor_module_activation_amount/i.test(
        retry.error.message
      )
    ) {
      const fallbackRetry = await supabase
        .from('organizers')
        .upsert(basePayload(emailToUse), {
          onConflict: 'user_id',
        })
        .select('id,email')
        .single();
      data = fallbackRetry.data;
      error = fallbackRetry.error;
    } else {
      data = retry.data;
      error = retry.error;
    }
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

  const legacyPayload = buildEventLegacyPayload(event, organizerRemoteId);
  const extendedPayload = buildEventExtendedPayload(event, organizerRemoteId);

  let { data, error } = await supabase
    .from('events')
    .insert(extendedPayload)
    .select('id')
    .single();

  if (error && isUnsupportedEventFieldError(error.message)) {
    const fallback = await supabase.from('events').insert(legacyPayload).select('id').single();
    data = fallback.data;
    error = fallback.error;
  }

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

export const updateEventInSupabase = async (
  event: EventItem,
  organizerRemoteId: string,
  eventRemoteId: string
): Promise<SyncResult<{ id: string }>> => {
  if (!supabase) {
    return fail('Supabase non configurato.');
  }

  const legacyPayload = buildEventLegacyPayload(event, organizerRemoteId);
  const extendedPayload = buildEventExtendedPayload(event, organizerRemoteId);

  let { data, error } = await supabase
    .from('events')
    .update(extendedPayload)
    .eq('id', eventRemoteId)
    .select('id')
    .single();

  if (error && isUnsupportedEventFieldError(error.message)) {
    const fallback = await supabase
      .from('events')
      .update(legacyPayload)
      .eq('id', eventRemoteId)
      .select('id')
      .single();
    data = fallback.data;
    error = fallback.error;
  }

  if (error || !data?.id) {
    return fail(`Update evento fallita: ${error?.message ?? 'id mancante'}`);
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
        group_participants_count: params.registration.groupParticipantsCount,
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
