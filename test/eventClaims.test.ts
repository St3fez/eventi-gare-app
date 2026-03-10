import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isPaidEventClaimApproved,
  normalizeEventClaimStatus,
  organizerHasStripeReadyForParticipantPayments,
} from '../src/services/eventClaims';

test('normalizeEventClaimStatus keeps free events as not required', () => {
  assert.equal(normalizeEventClaimStatus('approved', true), 'not_required');
});

test('normalizeEventClaimStatus preserves known paid statuses and defaults legacy paid rows to approved', () => {
  assert.equal(normalizeEventClaimStatus('pending_review', false), 'pending_review');
  assert.equal(normalizeEventClaimStatus(undefined, false), 'approved');
});

test('isPaidEventClaimApproved accepts free or approved paid events only', () => {
  assert.equal(isPaidEventClaimApproved({ isFree: true, claimStatus: 'not_required' }), true);
  assert.equal(isPaidEventClaimApproved({ isFree: false, claimStatus: 'approved' }), true);
  assert.equal(isPaidEventClaimApproved({ isFree: false, claimStatus: 'pending_review' }), false);
});

test('organizerHasStripeReadyForParticipantPayments requires connect account plus charges and payouts', () => {
  assert.equal(
    organizerHasStripeReadyForParticipantPayments({
      stripeConnectAccountId: 'acct_123',
      stripeConnectChargesEnabled: true,
      stripeConnectPayoutsEnabled: true,
      payoutEnabled: true,
    }),
    true
  );
  assert.equal(
    organizerHasStripeReadyForParticipantPayments({
      stripeConnectAccountId: 'acct_123',
      stripeConnectChargesEnabled: true,
      stripeConnectPayoutsEnabled: false,
      payoutEnabled: false,
    }),
    false
  );
});
