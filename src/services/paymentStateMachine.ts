import {
  AppData,
  PaymentIntentStatus,
  PaymentWebhookPayload,
  RegistrationStatus,
} from '../types';

const registrationTransitions: Record<RegistrationStatus, RegistrationStatus[]> = {
  pending_payment: ['pending_cash', 'paid', 'payment_failed', 'cancelled'],
  pending_cash: ['paid', 'payment_failed', 'cancelled'],
  paid: ['refunded'],
  payment_failed: [],
  cancelled: [],
  refunded: [],
};

const paymentTransitions: Record<PaymentIntentStatus, PaymentIntentStatus[]> = {
  pending: ['requires_action', 'authorized', 'captured', 'failed', 'expired', 'cancelled'],
  requires_action: ['authorized', 'captured', 'failed', 'expired', 'cancelled'],
  authorized: ['captured', 'failed', 'cancelled'],
  captured: ['refunded'],
  failed: [],
  expired: [],
  refunded: [],
  cancelled: [],
};

export const canTransitionRegistrationStatus = (
  current: RegistrationStatus,
  next: RegistrationStatus
): boolean => registrationTransitions[current].includes(next);

export const canTransitionPaymentStatus = (
  current: PaymentIntentStatus,
  next: PaymentIntentStatus
): boolean => paymentTransitions[current].includes(next);

export const isPaymentSessionExpired = (expiresAt?: string): boolean => {
  if (!expiresAt) {
    return false;
  }
  return new Date(expiresAt).getTime() < Date.now();
};

export const expirePendingPaymentSessions = (data: AppData): AppData => {
  let changed = false;

  const registrations = data.registrations.map((registration) => {
    if (
      registration.registrationStatus !== 'pending_payment' &&
      registration.registrationStatus !== 'pending_cash'
    ) {
      return registration;
    }
    if (!isPaymentSessionExpired(registration.paymentSessionExpiresAt)) {
      return registration;
    }

    changed = true;
    const expiredReason =
      registration.registrationStatus === 'pending_cash'
        ? 'Scadenza pagamento contanti superata'
        : 'Sessione pagamento scaduta';
    return {
      ...registration,
      registrationStatus: 'payment_failed' as const,
      paymentStatus: 'expired' as const,
      paymentFailedReason: expiredReason,
      updatedAt: new Date().toISOString(),
    };
  });

  const paymentIntents = data.paymentIntents.map((intent) => {
    if (!['pending', 'requires_action', 'authorized'].includes(intent.status)) {
      return intent;
    }
    if (!isPaymentSessionExpired(intent.expiresAt)) {
      return intent;
    }

    changed = true;
    return {
      ...intent,
      status: 'expired' as const,
      failureReason: 'Sessione pagamento scaduta',
      updatedAt: new Date().toISOString(),
    };
  });

  if (!changed) {
    return data;
  }

  return {
    ...data,
    registrations,
    paymentIntents,
  };
};

export const applyPaymentWebhook = (
  data: AppData,
  payload: PaymentWebhookPayload,
  options: { assignNumber: (registrationId: string, eventId: string) => number | undefined }
): { nextData: AppData; applied: boolean; reason?: string; registrationId?: string } => {
  if (data.processedWebhookEventIds.includes(payload.webhookEventId)) {
    return { nextData: data, applied: false, reason: 'Webhook gia processato' };
  }

  const paymentIntentIndex = data.paymentIntents.findIndex(
    (entry) => entry.id === payload.paymentIntentId
  );
  if (paymentIntentIndex < 0) {
    return { nextData: data, applied: false, reason: 'Payment intent non trovato' };
  }

  const paymentIntent = data.paymentIntents[paymentIntentIndex];
  const registrationIndex = data.registrations.findIndex(
    (entry) => entry.id === paymentIntent.registrationId
  );

  if (registrationIndex < 0) {
    return { nextData: data, applied: false, reason: 'Registrazione non trovata' };
  }

  const registration = data.registrations[registrationIndex];
  const nowIso = payload.receivedAt;
  let nextIntentStatus: PaymentIntentStatus = paymentIntent.status;
  let nextRegistrationStatus: RegistrationStatus = registration.registrationStatus;
  let paymentFailedReason: string | undefined;
  let refundedAt: string | undefined;

  switch (payload.type) {
    case 'payment_intent.succeeded': {
      nextIntentStatus = 'captured';
      nextRegistrationStatus = 'paid';
      break;
    }
    case 'payment_intent.failed': {
      nextIntentStatus = 'failed';
      nextRegistrationStatus = 'payment_failed';
      paymentFailedReason = payload.reason ?? 'Pagamento non autorizzato';
      break;
    }
    case 'payment_intent.expired': {
      nextIntentStatus = 'expired';
      nextRegistrationStatus = 'payment_failed';
      paymentFailedReason = payload.reason ?? 'Sessione pagamento scaduta';
      break;
    }
    case 'payment_intent.refunded': {
      nextIntentStatus = 'refunded';
      nextRegistrationStatus = 'refunded';
      refundedAt = nowIso;
      break;
    }
    default:
      return { nextData: data, applied: false, reason: 'Tipo webhook non supportato' };
  }

  if (paymentIntent.status !== nextIntentStatus) {
    if (!canTransitionPaymentStatus(paymentIntent.status, nextIntentStatus)) {
      return {
        nextData: data,
        applied: false,
        reason: `Transizione pagamento non valida: ${paymentIntent.status} -> ${nextIntentStatus}`,
      };
    }
  }

  if (registration.registrationStatus !== nextRegistrationStatus) {
    if (!canTransitionRegistrationStatus(registration.registrationStatus, nextRegistrationStatus)) {
      return {
        nextData: data,
        applied: false,
        reason: `Transizione iscrizione non valida: ${registration.registrationStatus} -> ${nextRegistrationStatus}`,
      };
    }
  }

  const assignedNumber =
    nextRegistrationStatus === 'paid' && registration.assignedNumber === undefined
      ? options.assignNumber(registration.id, registration.eventId)
      : registration.assignedNumber;

  const updatedIntent = {
    ...paymentIntent,
    status: nextIntentStatus,
    providerPaymentIntentId:
      payload.providerPaymentIntentId ?? paymentIntent.providerPaymentIntentId,
    webhookEventId: payload.webhookEventId,
    failureReason: paymentFailedReason,
    updatedAt: nowIso,
  };

  const updatedRegistration = {
    ...registration,
    registrationStatus: nextRegistrationStatus,
    paymentStatus: nextIntentStatus,
    paymentReference: payload.paymentReference ?? registration.paymentReference,
    assignedNumber,
    paymentCapturedAt: nextRegistrationStatus === 'paid' ? nowIso : registration.paymentCapturedAt,
    paymentFailedReason,
    refundedAt,
    updatedAt: nowIso,
  };

  const paymentIntents = [...data.paymentIntents];
  const registrations = [...data.registrations];
  paymentIntents[paymentIntentIndex] = updatedIntent;
  registrations[registrationIndex] = updatedRegistration;

  return {
    nextData: {
      ...data,
      paymentIntents,
      registrations,
      processedWebhookEventIds: [payload.webhookEventId, ...data.processedWebhookEventIds],
    },
    applied: true,
    registrationId: updatedRegistration.id,
  };
};
