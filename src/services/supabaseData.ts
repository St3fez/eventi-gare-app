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

type OrganizerCatalogOrganizerLegacyRow = {
  id: string;
  user_id: string;
  email: string;
  fiscal_data: string | null;
  bank_account: string | null;
  verification_status: OrganizerProfile['verificationStatus'];
  payout_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type OrganizerCatalogOrganizerRow = OrganizerCatalogOrganizerLegacyRow & {
  organization_name?: string | null;
  organization_role?: OrganizerProfile['organizationRole'] | null;
  organization_role_label?: string | null;
  legal_representative?: string | null;
  official_phone?: string | null;
  compliance_documents?: OrganizerProfile['complianceDocuments'] | null;
  compliance_submitted_at?: string | null;
  paid_feature_unlocked?: boolean;
  paid_feature_unlock_requested_at?: string | null;
  paid_feature_unlock_contact?: string | null;
  sponsor_module_enabled?: boolean;
  sponsor_module_activated_at?: string | null;
  sponsor_module_activation_amount?: number;
  stripe_connect_account_id?: string | null;
  stripe_connect_charges_enabled?: boolean;
  stripe_connect_payouts_enabled?: boolean;
  stripe_connect_details_submitted?: boolean;
  stripe_connect_last_sync_at?: string | null;
  risk_score?: number;
  risk_flags?: string[] | null;
  verification_checklist?: OrganizerProfile['verificationChecklist'] | null;
};

type OrganizerCatalogEventLegacyRow = {
  id: string;
  organizer_id: string;
  name: string;
  location: string;
  event_date: string;
  is_free: boolean;
  fee_amount: number;
  privacy_text: string;
  logo_url: string | null;
  local_sponsor: string | null;
  assign_numbers: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type OrganizerCatalogEventRow = OrganizerCatalogEventLegacyRow & {
  event_end_date?: string | null;
  event_time?: string | null;
  participant_auth_mode?: EventItem['participantAuthMode'] | null;
  participant_phone_required?: boolean;
  cash_payment_enabled?: boolean;
  cash_payment_instructions?: string | null;
  cash_payment_deadline?: string | null;
  registrations_open?: boolean;
  closed_at?: string | null;
  definitive_published_at?: string | null;
  season_version?: number;
  last_participants_reset_at?: string | null;
};

const ORGANIZER_CATALOG_SELECT_EXTENDED =
  'id,user_id,email,organization_name,organization_role,organization_role_label,legal_representative,official_phone,fiscal_data,bank_account,compliance_documents,compliance_submitted_at,verification_status,payout_enabled,paid_feature_unlocked,paid_feature_unlock_requested_at,paid_feature_unlock_contact,sponsor_module_enabled,sponsor_module_activated_at,sponsor_module_activation_amount,stripe_connect_account_id,stripe_connect_charges_enabled,stripe_connect_payouts_enabled,stripe_connect_details_submitted,stripe_connect_last_sync_at,risk_score,risk_flags,verification_checklist,created_at,updated_at';

const ORGANIZER_CATALOG_SELECT_LEGACY =
  'id,user_id,email,fiscal_data,bank_account,verification_status,payout_enabled,created_at,updated_at';

const EVENT_CATALOG_SELECT_EXTENDED =
  'id,organizer_id,name,location,event_date,event_end_date,event_time,is_free,fee_amount,privacy_text,logo_url,local_sponsor,assign_numbers,participant_auth_mode,participant_phone_required,cash_payment_enabled,cash_payment_instructions,cash_payment_deadline,registrations_open,closed_at,definitive_published_at,season_version,last_participants_reset_at,active,created_at,updated_at';

const EVENT_CATALOG_SELECT_LEGACY =
  'id,organizer_id,name,location,event_date,is_free,fee_amount,privacy_text,logo_url,local_sponsor,assign_numbers,active,created_at,updated_at';

const REGISTRATION_SELECT_EXTENDED =
  'id,event_id,organizer_id,full_name,participant_email,phone,city,birth_date,privacy_consent,retention_consent,group_participants_count,group_participants,participant_message_to_organizer,assigned_number,registration_code,registration_status,payment_status,payment_amount,payment_method,payment_reference,payment_session_expires_at,payment_captured_at,payment_failed_reason,refunded_at,commission_amount,created_at,updated_at';

const REGISTRATION_SELECT_LEGACY =
  'id,event_id,organizer_id,full_name,participant_email,phone,city,birth_date,privacy_consent,retention_consent,group_participants_count,assigned_number,registration_code,registration_status,payment_status,payment_amount,payment_method,payment_reference,payment_session_expires_at,payment_captured_at,payment_failed_reason,refunded_at,commission_amount,created_at,updated_at';

const isUnsupportedRegistrationFieldError = (message: string): boolean =>
  /participant_message_to_organizer|group_participants/i.test(message);

export type ParticipantRegistrationRow = {
  id: string;
  event_id: string;
  organizer_id: string;
  full_name: string;
  participant_email: string;
  phone: string | null;
  city: string | null;
  birth_date: string | null;
  privacy_consent: boolean;
  retention_consent: boolean;
  group_participants_count: number;
  group_participants?: Array<{
    full_name?: string | null;
    assigned_number?: number | null;
  }> | null;
  participant_message_to_organizer?: string | null;
  assigned_number: number | null;
  registration_code: string;
  registration_status: RegistrationRecord['registrationStatus'];
  payment_status: RegistrationRecord['paymentStatus'] | null;
  payment_amount: number;
  payment_method: string | null;
  payment_reference: string | null;
  payment_session_expires_at: string | null;
  payment_captured_at: string | null;
  payment_failed_reason: string | null;
  refunded_at: string | null;
  commission_amount: number;
  created_at: string;
  updated_at: string;
};

export const listOrganizerCatalogFromSupabase = async (): Promise<
  SyncResult<{
    organizers: OrganizerCatalogOrganizerRow[];
    events: OrganizerCatalogEventRow[];
  }>
> => {
  if (!supabase) {
    return fail('Supabase non configurato.');
  }

  const auth = await ensureSupabaseUser({
    allowAnonymous: !ORGANIZER_SECURITY_ENFORCED,
  });
  if (!auth.ok) {
    return fail(auth.reason);
  }

  let organizersData: OrganizerCatalogOrganizerRow[] = [];
  let organizersError: Error | null = null;

  const organizersExtended = await supabase
    .from('organizers')
    .select(ORGANIZER_CATALOG_SELECT_EXTENDED)
    .order('created_at', { ascending: false });

  if (organizersExtended.error) {
    if (
      /organization_name|organization_role|legal_representative|official_phone|compliance_documents|paid_feature_unlocked|sponsor_module_enabled|stripe_connect_account_id|risk_score|verification_checklist/i.test(
        organizersExtended.error.message
      )
    ) {
      const organizersLegacy = await supabase
        .from('organizers')
        .select(ORGANIZER_CATALOG_SELECT_LEGACY)
        .order('created_at', { ascending: false });
      organizersData = (organizersLegacy.data ?? []) as OrganizerCatalogOrganizerRow[];
      organizersError = organizersLegacy.error;
    } else {
      organizersError = organizersExtended.error;
    }
  } else {
    organizersData = (organizersExtended.data ?? []) as OrganizerCatalogOrganizerRow[];
  }

  if (organizersError) {
    return fail(`Lettura organizer fallita: ${organizersError.message}`);
  }

  const organizerIds = organizersData.map((entry) => entry.id);
  if (!organizerIds.length) {
    return {
      ok: true,
      data: {
        organizers: organizersData,
        events: [],
      },
    };
  }

  let eventsData: OrganizerCatalogEventRow[] = [];
  let eventsError: Error | null = null;

  const eventsExtended = await supabase
    .from('events')
    .select(EVENT_CATALOG_SELECT_EXTENDED)
    .in('organizer_id', organizerIds)
    .order('event_date', { ascending: true });

  if (eventsExtended.error) {
    if (isUnsupportedEventFieldError(eventsExtended.error.message)) {
      const eventsLegacy = await supabase
        .from('events')
        .select(EVENT_CATALOG_SELECT_LEGACY)
        .in('organizer_id', organizerIds)
        .order('event_date', { ascending: true });
      eventsData = (eventsLegacy.data ?? []) as OrganizerCatalogEventRow[];
      eventsError = eventsLegacy.error;
    } else {
      eventsError = eventsExtended.error;
    }
  } else {
    eventsData = (eventsExtended.data ?? []) as OrganizerCatalogEventRow[];
  }

  if (eventsError) {
    return fail(`Lettura eventi fallita: ${eventsError.message}`);
  }

  return {
    ok: true,
    data: {
      organizers: organizersData,
      events: eventsData,
    },
  };
};

export const listPublicEventsFromSupabase = async (): Promise<
  SyncResult<OrganizerCatalogEventRow[]>
> => {
  if (!supabase) {
    return fail('Supabase non configurato.');
  }

  let eventsData: OrganizerCatalogEventRow[] = [];
  let eventsError: Error | null = null;

  const eventsExtended = await supabase
    .from('events')
    .select(EVENT_CATALOG_SELECT_EXTENDED)
    .eq('active', true)
    .order('event_date', { ascending: true });

  if (eventsExtended.error) {
    if (isUnsupportedEventFieldError(eventsExtended.error.message)) {
      const eventsLegacy = await supabase
        .from('events')
        .select(EVENT_CATALOG_SELECT_LEGACY)
        .eq('active', true)
        .order('event_date', { ascending: true });
      eventsData = (eventsLegacy.data ?? []) as OrganizerCatalogEventRow[];
      eventsError = eventsLegacy.error;
    } else {
      eventsError = eventsExtended.error;
    }
  } else {
    eventsData = (eventsExtended.data ?? []) as OrganizerCatalogEventRow[];
  }

  if (eventsError) {
    return fail(`Lettura eventi pubblici fallita: ${eventsError.message}`);
  }

  return {
    ok: true,
    data: eventsData,
  };
};

export const listParticipantRegistrationsFromSupabase = async (): Promise<
  SyncResult<ParticipantRegistrationRow[]>
> => {
  if (!supabase) {
    return fail('Supabase non configurato.');
  }

  const auth = await ensureSupabaseUser({
    allowAnonymous: false,
  });
  if (!auth.ok) {
    return fail(auth.reason);
  }

  let registrationsData: ParticipantRegistrationRow[] = [];
  let registrationsError: Error | null = null;

  const registrationsExtended = await supabase
    .from('registrations')
    .select(REGISTRATION_SELECT_EXTENDED)
    .eq('participant_user_id', auth.data.userId)
    .order('created_at', { ascending: false });

  if (registrationsExtended.error) {
    if (isUnsupportedRegistrationFieldError(registrationsExtended.error.message)) {
      const registrationsLegacy = await supabase
        .from('registrations')
        .select(REGISTRATION_SELECT_LEGACY)
        .eq('participant_user_id', auth.data.userId)
        .order('created_at', { ascending: false });
      registrationsData = (registrationsLegacy.data ?? []) as ParticipantRegistrationRow[];
      registrationsError = registrationsLegacy.error;
    } else {
      registrationsError = registrationsExtended.error;
    }
  } else {
    registrationsData = (registrationsExtended.data ?? []) as ParticipantRegistrationRow[];
  }

  if (registrationsError) {
    return fail(`Lettura iscrizioni partecipante fallita: ${registrationsError.message}`);
  }

  return {
    ok: true,
    data: registrationsData,
  };
};

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
    const providers = Array.isArray(existingUser.app_metadata?.providers)
      ? existingUser.app_metadata.providers
          .map((entry) => String(entry).toLowerCase())
          .filter(Boolean)
      : [];
    const hasEmailIdentity = providers.includes('email') || Boolean(existingUser.email);
    const hasNonAnonymousIdentity = providers.some((provider) => provider !== 'anonymous');
    const isEffectivelyAnonymous =
      Boolean(existingUser.is_anonymous) && !hasEmailIdentity && !hasNonAnonymousIdentity;

    if (!allowAnonymous && isEffectivelyAnonymous) {
      return fail(
        "Per operare come organizzatore e richiesto un account autenticato (Google o email OTP)."
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
      'Nessuna sessione autenticata. Effettua login Google o email OTP.'
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

  let rawError = error?.message ?? '';
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
    rawError = error?.message ?? '';
  }

  if (error || !data?.id || !data?.email) {
    const finalError = error?.message ?? 'id/email mancanti';
    if (/organizers_email_key|duplicate key value/i.test(rawError || finalError)) {
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

export const deleteEventInSupabase = async (
  eventRemoteId: string
): Promise<SyncResult<{ id: string }>> => {
  if (!supabase) {
    return fail('Supabase non configurato.');
  }

  const auth = await ensureSupabaseUser({
    allowAnonymous: false,
  });
  if (!auth.ok) {
    return fail(auth.reason);
  }

  const { data, error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventRemoteId)
    .select('id')
    .maybeSingle<{ id: string }>();

  if (error) {
    return fail(`Eliminazione evento fallita: ${error.message}`);
  }

  if (!data?.id) {
    return fail('Evento non trovato su Supabase o permessi insufficienti.');
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

  const basePayload = {
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
  };

  const extendedPayload = {
    ...basePayload,
    participant_message_to_organizer: nullableText(params.registration.participantMessage),
    group_participants: (params.registration.groupParticipants ?? [])
      .map((participant) => ({
        full_name: cleanText(participant.fullName),
        assigned_number:
          typeof participant.assignedNumber === 'number' ? participant.assignedNumber : null,
      }))
      .filter((participant) => Boolean(participant.full_name)),
  };

  let { data, error } = await supabase
    .from('registrations')
    .upsert(extendedPayload, {
      onConflict: 'registration_code',
    })
    .select('id')
    .single();

  if (
    error &&
    /participant_message_to_organizer|group_participants/i.test(error.message)
  ) {
    const fallback = await supabase
      .from('registrations')
      .upsert(basePayload, {
        onConflict: 'registration_code',
      })
      .select('id')
      .single();
    data = fallback.data;
    error = fallback.error;
  }

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
