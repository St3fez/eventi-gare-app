import assert from 'node:assert/strict';
import test from 'node:test';

import { EventItem } from '../src/types';
import {
  getParticipantEventAvailability,
  getParticipantMessageValidationIssues,
  getRegistrationMissingFields,
  getRegistrationProgressSummary,
  getRegistrationTotalAmount,
  getRegistrationValidationIssues,
  normalizeBirthDateForStorage,
  parseGroupParticipantsCount,
} from '../src/utils/participantUx';

const createEvent = (overrides: Partial<EventItem> = {}): EventItem => ({
  id: 'evt_test',
  organizerId: 'org_test',
  name: 'Trail Demo',
  location: 'Torino',
  date: '2026-04-20',
  endDate: '2026-04-20',
  startTime: '09:00',
  isFree: true,
  feeAmount: 0,
  privacyText: 'privacy',
  logoUrl: '',
  localSponsor: '',
  assignNumbers: true,
  registrationOpenDate: '2026-04-01',
  registrationCloseDate: '2026-04-10',
  registrationsOpen: true,
  visibility: 'public',
  seasonVersion: 1,
  baseFeeAmount: 0,
  feePolicy: 'organizer_absorbs_fees',
  paymentChannel: 'stripe',
  cashPaymentEnabled: false,
  participantAuthMode: 'anonymous',
  participantPhoneRequired: false,
  developerCommissionRate: 0.03,
  providerFeeRate: 0,
  providerFeeFixed: 0,
  organizerNetAmount: 0,
  active: true,
  createdAt: '2026-03-01T10:00:00.000Z',
  ...overrides,
});

test('parseGroupParticipantsCount normalizes invalid values to one', () => {
  assert.equal(parseGroupParticipantsCount(undefined), 1);
  assert.equal(parseGroupParticipantsCount('0'), 1);
  assert.equal(parseGroupParticipantsCount('-3'), 1);
  assert.equal(parseGroupParticipantsCount('3.9'), 3);
});

test('getParticipantEventAvailability detects upcoming, open and closed states', () => {
  const upcoming = createEvent();
  const open = createEvent();
  const closed = createEvent({
    active: false,
  });

  assert.equal(
    getParticipantEventAvailability(upcoming, '2026-03-31'),
    'registration_upcoming'
  );
  assert.equal(
    getParticipantEventAvailability(open, '2026-04-05'),
    'registration_open'
  );
  assert.equal(
    getParticipantEventAvailability(closed, '2026-04-05'),
    'registration_closed'
  );
});

test('getParticipantEventAvailability closes the event after the deadline', () => {
  const event = createEvent();
  assert.equal(
    getParticipantEventAvailability(event, '2026-04-11'),
    'registration_closed'
  );
});

test('getRegistrationMissingFields returns only unmet requirements', () => {
  const result = getRegistrationMissingFields({
    fullName: 'Mario Rossi',
    email: '',
    phone: '',
    requiresPhone: true,
    groupParticipantsCountInput: '3',
    groupParticipants: ['Mario Rossi', 'Luigi Bianchi', ''],
    privacyConsent: true,
    retentionConsent: false,
  });

  assert.deepEqual(result, ['email', 'phone', 'groupParticipants', 'retentionConsent']);
});

test('getRegistrationMissingFields ignores optional phone and complete groups', () => {
  const result = getRegistrationMissingFields({
    fullName: 'Mario Rossi',
    email: 'mario@example.com',
    phone: '',
    requiresPhone: false,
    groupParticipantsCountInput: '2',
    groupParticipants: ['Mario Rossi', 'Luigi Bianchi'],
    privacyConsent: true,
    retentionConsent: true,
  });

  assert.deepEqual(result, []);
});

test('getRegistrationProgressSummary tracks the completion state of each step', () => {
  const result = getRegistrationProgressSummary({
    fullName: 'Mario Rossi',
    email: 'mario@example.com',
    phone: '',
    requiresPhone: true,
    groupParticipantsCountInput: '2',
    groupParticipants: ['Mario Rossi', ''],
    privacyConsent: true,
    retentionConsent: false,
  });

  assert.deepEqual(result, {
    personalComplete: false,
    groupComplete: false,
    consentComplete: false,
    completedSteps: 0,
    totalSteps: 3,
  });
});

test('getRegistrationProgressSummary marks all steps ready when requirements are satisfied', () => {
  const result = getRegistrationProgressSummary({
    fullName: 'Mario Rossi',
    email: 'mario@example.com',
    phone: '',
    birthDate: '1990-01-10',
    requiresPhone: false,
    groupParticipantsCountInput: '1',
    groupParticipants: ['Mario Rossi'],
    privacyConsent: true,
    retentionConsent: true,
  });

  assert.deepEqual(result, {
    personalComplete: true,
    groupComplete: true,
    consentComplete: true,
    completedSteps: 3,
    totalSteps: 3,
  });
});

test('getRegistrationTotalAmount multiplies the fee by normalized group size', () => {
  assert.equal(getRegistrationTotalAmount(18.5, '3'), 55.5);
  assert.equal(getRegistrationTotalAmount(18.5, '0'), 18.5);
});

test('getRegistrationValidationIssues flags invalid email and future birth date', () => {
  const result = getRegistrationValidationIssues(
    {
      fullName: 'Mario Rossi',
      email: 'mario.example.com',
      phone: '',
      birthDate: '31/12/2099',
      requiresPhone: false,
      groupParticipantsCountInput: '1',
      groupParticipants: ['Mario Rossi'],
      privacyConsent: true,
      retentionConsent: true,
    },
    '2026-03-06'
  );

  assert.deepEqual(result, ['emailFormat', 'birthDate']);
});

test('normalizeBirthDateForStorage converts localized dates to ISO', () => {
  assert.equal(normalizeBirthDateForStorage('05/03/1992'), '1992-03-05');
  assert.equal(normalizeBirthDateForStorage('1992-03-05'), '1992-03-05');
  assert.equal(normalizeBirthDateForStorage('31/02/1992'), '');
});

test('getParticipantMessageValidationIssues requires valid contact data and message', () => {
  const result = getParticipantMessageValidationIssues({
    fullName: '',
    email: 'mario.example.com',
    participantMessage: '',
  });

  assert.deepEqual(result, ['fullName', 'emailFormat', 'participantMessage']);
});
