import { EventClaimStatus, EventItem, OrganizerProfile } from '../types';

export const normalizeEventClaimStatus = (
  value: string | null | undefined,
  isFree: boolean,
  fallback?: EventClaimStatus
): EventClaimStatus => {
  if (isFree) {
    return 'not_required';
  }
  if (
    value === 'pending_review' ||
    value === 'approved' ||
    value === 'rejected'
  ) {
    return value;
  }
  return fallback ?? 'approved';
};

export const isPaidEventClaimApproved = (
  event: Pick<EventItem, 'isFree' | 'claimStatus'>
): boolean => event.isFree || event.claimStatus === 'approved';

export const isPaidEventClaimPending = (
  event: Pick<EventItem, 'isFree' | 'claimStatus'>
): boolean => !event.isFree && event.claimStatus === 'pending_review';

export const isPaidEventClaimRejected = (
  event: Pick<EventItem, 'isFree' | 'claimStatus'>
): boolean => !event.isFree && event.claimStatus === 'rejected';

export const organizerHasStripeReadyForParticipantPayments = (
  organizer: Pick<
    OrganizerProfile,
    | 'stripeConnectAccountId'
    | 'stripeConnectChargesEnabled'
    | 'stripeConnectPayoutsEnabled'
    | 'payoutEnabled'
  >
): boolean =>
  Boolean(
    organizer.stripeConnectAccountId &&
      organizer.stripeConnectChargesEnabled &&
      organizer.stripeConnectPayoutsEnabled &&
      organizer.payoutEnabled
  );

export const paidEventRequiresManualClaim = (
  event: Pick<EventItem, 'isFree'>
): boolean => !event.isFree;
