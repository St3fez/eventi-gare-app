import { EventItem, RegistrationStatus } from '../types';
import { cleanText, isValidEmailAddress, toIsoDate, tryToIsoDate } from './format';

export type ParticipantEventAvailability =
  | 'registration_open'
  | 'registration_upcoming'
  | 'registration_closed';

export type ParticipantPaymentMethod = 'stripe' | 'cash';

export type ParticipantPaymentSessionState =
  | 'not_set'
  | 'active'
  | 'expiring'
  | 'expired';

export type RegistrationMissingField =
  | 'fullName'
  | 'email'
  | 'phone'
  | 'groupParticipants'
  | 'privacyConsent'
  | 'retentionConsent';

export type RegistrationValidationIssue =
  | RegistrationMissingField
  | 'emailFormat'
  | 'birthDate';

export type ParticipantMessageValidationIssue =
  | 'fullName'
  | 'email'
  | 'emailFormat'
  | 'participantMessage';

export type RegistrationProgressSummary = {
  personalComplete: boolean;
  groupComplete: boolean;
  consentComplete: boolean;
  completedSteps: number;
  totalSteps: number;
};

type EventAvailabilityInput = Pick<
  EventItem,
  | 'active'
  | 'visibility'
  | 'registrationsOpen'
  | 'closedAt'
  | 'registrationOpenDate'
  | 'registrationCloseDate'
  | 'endDate'
  | 'date'
>;

type RegistrationMissingInput = {
  fullName: string;
  email: string;
  phone: string;
  birthDate?: string;
  requiresPhone: boolean;
  groupParticipantsCountInput: string | number | undefined;
  groupParticipants: string[];
  privacyConsent: boolean;
  retentionConsent: boolean;
};

export const parseGroupParticipantsCount = (
  value: string | number | undefined
): number => {
  const parsed =
    typeof value === 'number'
      ? value
      : Number.parseInt(cleanText(value ?? ''), 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }

  return Math.max(1, Math.floor(parsed));
};

export const getParticipantEventAvailability = (
  event: EventAvailabilityInput,
  todayIso = new Date().toISOString().slice(0, 10)
): ParticipantEventAvailability => {
  const openDate = toIsoDate(event.registrationOpenDate || event.date);
  const closeDate = toIsoDate(
    cleanText(event.registrationCloseDate) ||
      cleanText(event.endDate) ||
      cleanText(event.date)
  );

  if (
    !event.active ||
    event.visibility !== 'public' ||
    !event.registrationsOpen ||
    Boolean(cleanText(event.closedAt))
  ) {
    return 'registration_closed';
  }

  if (todayIso < openDate) {
    return 'registration_upcoming';
  }

  if (todayIso > closeDate) {
    return 'registration_closed';
  }

  return 'registration_open';
};

export const getParticipantEventSortWeight = (
  event: EventAvailabilityInput,
  todayIso = new Date().toISOString().slice(0, 10)
): number => {
  const availability = getParticipantEventAvailability(event, todayIso);
  if (availability === 'registration_open') {
    return 0;
  }
  if (availability === 'registration_upcoming') {
    return 1;
  }
  return 2;
};

export const compareParticipantEventsForSearch = (
  first: Pick<EventItem, 'date'> & EventAvailabilityInput,
  second: Pick<EventItem, 'date'> & EventAvailabilityInput,
  todayIso = new Date().toISOString().slice(0, 10)
): number => {
  const availabilityDiff =
    getParticipantEventSortWeight(first, todayIso) -
    getParticipantEventSortWeight(second, todayIso);
  if (availabilityDiff !== 0) {
    return availabilityDiff;
  }
  return toIsoDate(first.date).localeCompare(toIsoDate(second.date));
};

export const getRegistrationMissingFields = (
  input: RegistrationMissingInput
): RegistrationMissingField[] => {
  const missing: RegistrationMissingField[] = [];
  const groupCount = parseGroupParticipantsCount(input.groupParticipantsCountInput);

  if (!cleanText(input.fullName)) {
    missing.push('fullName');
  }

  if (!cleanText(input.email)) {
    missing.push('email');
  }

  if (input.requiresPhone && !cleanText(input.phone)) {
    missing.push('phone');
  }

  if (
    groupCount > 1 &&
    input.groupParticipants
      .slice(0, groupCount)
      .slice(1)
      .some((entry) => !cleanText(entry))
  ) {
    missing.push('groupParticipants');
  }

  if (!input.privacyConsent) {
    missing.push('privacyConsent');
  }

  if (!input.retentionConsent) {
    missing.push('retentionConsent');
  }

  return missing;
};

export const normalizeBirthDateForStorage = (value: string | undefined): string =>
  tryToIsoDate(value ?? '') || '';

export const isBirthDateInputValid = (
  value: string | undefined,
  todayIso = new Date().toISOString().slice(0, 10)
): boolean => {
  const normalized = normalizeBirthDateForStorage(value);
  if (!cleanText(value ?? '')) {
    return true;
  }
  return Boolean(normalized) && normalized <= todayIso;
};

export const getRegistrationValidationIssues = (
  input: RegistrationMissingInput,
  todayIso = new Date().toISOString().slice(0, 10)
): RegistrationValidationIssue[] => {
  const issues: RegistrationValidationIssue[] = [...getRegistrationMissingFields(input)];

  if (cleanText(input.email) && !isValidEmailAddress(input.email)) {
    issues.push('emailFormat');
  }

  if (!isBirthDateInputValid(input.birthDate, todayIso)) {
    issues.push('birthDate');
  }

  return issues;
};

export const getParticipantMessageValidationIssues = (input: {
  fullName: string;
  email: string;
  participantMessage: string;
}): ParticipantMessageValidationIssue[] => {
  const issues: ParticipantMessageValidationIssue[] = [];

  if (!cleanText(input.fullName)) {
    issues.push('fullName');
  }

  if (!cleanText(input.email)) {
    issues.push('email');
  } else if (!isValidEmailAddress(input.email)) {
    issues.push('emailFormat');
  }

  if (!cleanText(input.participantMessage)) {
    issues.push('participantMessage');
  }

  return issues;
};

export const getRegistrationProgressSummary = (
  input: RegistrationMissingInput
): RegistrationProgressSummary => {
  const missing = new Set(getRegistrationValidationIssues(input));
  const personalComplete =
    !missing.has('fullName') &&
    !missing.has('email') &&
    !missing.has('emailFormat') &&
    !missing.has('phone') &&
    !missing.has('birthDate');
  const groupComplete = !missing.has('groupParticipants');
  const consentComplete =
    !missing.has('privacyConsent') && !missing.has('retentionConsent');

  const completedSteps = [personalComplete, groupComplete, consentComplete].filter(Boolean)
    .length;

  return {
    personalComplete,
    groupComplete,
    consentComplete,
    completedSteps,
    totalSteps: 3,
  };
};

export const getRegistrationTotalAmount = (
  unitAmount: number,
  groupParticipantsCountInput: string | number | undefined
): number => unitAmount * parseGroupParticipantsCount(groupParticipantsCountInput);

export const getPreferredParticipantPaymentMethod = (input: {
  cashPaymentEnabled: boolean;
  registrationStatus: RegistrationStatus;
  paymentMethod?: string;
}): ParticipantPaymentMethod => {
  if (
    input.cashPaymentEnabled &&
    (input.paymentMethod === 'cash' || input.registrationStatus === 'pending_cash')
  ) {
    return 'cash';
  }

  return 'stripe';
};

export const getParticipantPaymentSessionState = (
  expiresAt?: string,
  now = Date.now(),
  expiringWindowMs = 5 * 60 * 1000
): ParticipantPaymentSessionState => {
  const normalizedExpiry = cleanText(expiresAt ?? '');
  if (!normalizedExpiry) {
    return 'not_set';
  }

  const expiryTimestamp = new Date(normalizedExpiry).getTime();
  if (Number.isNaN(expiryTimestamp)) {
    return 'not_set';
  }

  if (expiryTimestamp <= now) {
    return 'expired';
  }

  if (expiryTimestamp - now <= expiringWindowMs) {
    return 'expiring';
  }

  return 'active';
};
