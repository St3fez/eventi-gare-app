import { DISPOSABLE_EMAIL_DOMAINS } from '../constants';
import { AppLanguage, translate } from '../i18n';
import { OrganizerProfile, OrganizerVerificationStatus } from '../types';
import { cleanText } from '../utils/format';

export const organizerCanCreatePaidEvents = (organizer: OrganizerProfile): boolean =>
  organizer.verificationStatus === 'verified' && organizer.payoutEnabled;

export const organizerCanUsePaidSection = (
  organizer: OrganizerProfile,
  testModeEnabled: boolean
): boolean => testModeEnabled || (organizer.paidFeatureUnlocked && organizerCanCreatePaidEvents(organizer));

export const verificationStatusLabel = (
  status: OrganizerVerificationStatus,
  language: AppLanguage = 'it'
): string => {
  switch (status) {
    case 'verified':
      return translate(language, 'verification_verified');
    case 'pending_review':
      return translate(language, 'verification_pending_review');
    case 'rejected':
      return translate(language, 'verification_rejected');
    case 'suspended':
      return translate(language, 'verification_suspended');
    default:
      return status;
  }
};

export const scoreOrganizerRisk = (
  payload: { email: string; fiscalData?: string; bankAccount?: string },
  existingOrganizers: OrganizerProfile[]
): { score: number; flags: string[] } => {
  const flags: string[] = [];
  let score = 0;

  const email = cleanText(payload.email).toLowerCase();
  const domain = email.split('@')[1] ?? '';
  const fiscalData = cleanText(payload.fiscalData ?? '');
  const bankAccount = cleanText(payload.bankAccount ?? '');

  if (!fiscalData) {
    score += 15;
    flags.push('Dati fiscali mancanti');
  }

  if (!bankAccount) {
    score += 20;
    flags.push('IBAN non fornito');
  }

  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    score += 60;
    flags.push('Dominio email temporaneo/rischioso');
  }

  const duplicateEmail = existingOrganizers.some((entry) => entry.email.toLowerCase() === email);
  if (duplicateEmail) {
    score += 100;
    flags.push('Email gia registrata');
  }

  if (bankAccount) {
    const duplicateIban = existingOrganizers.some(
      (entry) => cleanText(entry.bankAccount ?? '').toUpperCase() === bankAccount.toUpperCase()
    );
    if (duplicateIban) {
      score += 45;
      flags.push('IBAN gia usato da altro organizzatore');
    }
  }

  if (score >= 70 && !flags.includes('Richiesta verifica manuale antifrode')) {
    flags.push('Richiesta verifica manuale antifrode');
  }

  return { score, flags };
};
