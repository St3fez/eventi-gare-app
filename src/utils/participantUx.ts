import { EventItem } from '../types';
import { cleanText, isValidEmailAddress, toIsoDate, tryToIsoDate } from './format';

export type ParticipantEventAvailability =
  | 'registration_open'
  | 'registration_upcoming'
  | 'registration_closed';

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

  if (todayIso < openDate) {
    return 'registration_upcoming';
  }

  if (
    !event.active ||
    event.visibility !== 'public' ||
    !event.registrationsOpen ||
    Boolean(cleanText(event.closedAt))
  ) {
    return 'registration_closed';
  }

  if (todayIso > closeDate) {
    return 'registration_closed';
  }

  return 'registration_open';
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
