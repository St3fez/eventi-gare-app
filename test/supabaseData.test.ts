import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ensureSupabaseUser,
  listPublicEventsFromSupabase,
  upsertOrganizerInSupabase,
  upsertRegistrationInSupabase,
} from '../src/services/supabaseData';
import { OrganizerProfile, RegistrationRecord } from '../src/types';

type QueryRecord = {
  table: string;
  action?: 'upsert' | 'insert' | 'update' | 'delete';
  payload?: unknown;
  options?: unknown;
  select?: string;
  filters: Array<Record<string, unknown>>;
};

type QueryStep = {
  kind: 'single' | 'order' | 'maybeSingle';
  data?: unknown;
  error?: Error | null;
  assertQuery?: (query: QueryRecord) => void;
};

const createQueryClient = (
  steps: QueryStep[],
  authOverrides?: {
    sessionResult?: unknown;
    anonymousResult?: unknown;
  }
) => {
  const remaining = [...steps];

  const resolve = (kind: QueryStep['kind'], query: QueryRecord) => {
    const next = remaining.shift();
    assert.ok(next, `Unexpected ${kind} query on table ${query.table}`);
    assert.equal(next.kind, kind);
    next.assertQuery?.(query);
    return Promise.resolve({
      data: next.data ?? null,
      error: next.error ?? null,
    });
  };

  const defaultSessionResult = {
    data: {
      session: {
        user: {
          id: 'user_test_1234',
          email: 'organizer@example.com',
          is_anonymous: false,
          app_metadata: {
            providers: ['email'],
          },
        },
      },
    },
    error: null,
  };

  const defaultAnonymousResult = {
    data: {
      user: {
        id: 'anon_test_1234',
      },
    },
    error: null,
  };

  return {
    client: {
      auth: {
        getSession: async () => authOverrides?.sessionResult ?? defaultSessionResult,
        signInAnonymously: async () =>
          authOverrides?.anonymousResult ?? defaultAnonymousResult,
      },
      from: (table: string) => {
        const query: QueryRecord = {
          table,
          filters: [],
        };

        const builder = {
          upsert(payload: unknown, options: unknown) {
            query.action = 'upsert';
            query.payload = payload;
            query.options = options;
            return builder;
          },
          insert(payload: unknown) {
            query.action = 'insert';
            query.payload = payload;
            return builder;
          },
          update(payload: unknown) {
            query.action = 'update';
            query.payload = payload;
            return builder;
          },
          delete() {
            query.action = 'delete';
            return builder;
          },
          select(value: string) {
            query.select = value;
            return builder;
          },
          eq(field: string, value: unknown) {
            query.filters.push({
              type: 'eq',
              field,
              value,
            });
            return builder;
          },
          in(field: string, value: unknown[]) {
            query.filters.push({
              type: 'in',
              field,
              value,
            });
            return builder;
          },
          order(field: string, options: Record<string, unknown>) {
            query.filters.push({
              type: 'order',
              field,
              options,
            });
            return resolve('order', query);
          },
          single() {
            return resolve('single', query);
          },
          maybeSingle() {
            return resolve('maybeSingle', query);
          },
        };

        return builder;
      },
    },
    assertDone() {
      assert.equal(remaining.length, 0, `Remaining mocked Supabase steps: ${remaining.length}`);
    },
  };
};

const createOrganizer = (): OrganizerProfile => ({
  id: 'org_local',
  email: 'organizer@example.com',
  organizationName: 'Fondazione Test',
  organizationRole: 'presidente_fondazione',
  organizationRoleLabel: '',
  legalRepresentative: 'Mario Rossi',
  officialPhone: '+393331234567',
  fiscalData: 'P.IVA 01234567890',
  bankAccount: 'IT60X0542811101000000123456',
  complianceDocuments: {
    adminContactMessage: 'Documenti pronti',
  },
  complianceSubmittedAt: '2026-03-05T10:00:00.000Z',
  verificationStatus: 'pending_review',
  payoutEnabled: false,
  paidFeatureUnlocked: false,
  paidFeatureUnlockContact: 'support',
  sponsorModuleEnabled: false,
  sponsorModuleActivationAmount: 25,
  stripeConnectChargesEnabled: false,
  stripeConnectPayoutsEnabled: false,
  stripeConnectDetailsSubmitted: false,
  riskScore: 0,
  riskFlags: [],
  verificationChecklist: {
    emailVerified: false,
    fiscalDataVerified: false,
    ibanOwnershipVerified: false,
    identityVerified: false,
    manualReviewPassed: false,
  },
  createdAt: '2026-03-05T10:00:00.000Z',
  updatedAt: '2026-03-05T10:00:00.000Z',
});

const createRegistration = (): RegistrationRecord => ({
  id: 'reg_local',
  eventId: 'evt_local',
  organizerId: 'org_local',
  fullName: 'Mario Rossi',
  email: ' Mario@Example.com ',
  phone: ' 3331234567 ',
  city: ' Torino ',
  birthDate: '31/12/1990',
  privacyConsent: true,
  retentionConsent: true,
  groupParticipantsCount: 3,
  participantMessage: ' Serve parcheggio ',
  groupParticipants: [
    { fullName: 'Mario Rossi' },
    { fullName: ' ' },
    { fullName: 'Luigi Bianchi', assignedNumber: 12 },
  ],
  assignedNumber: 7,
  registrationCode: 'TRA-12345',
  registrationStatus: 'paid',
  paymentIntentId: undefined,
  paymentStatus: 'not_required',
  paymentAmount: 0,
  paymentMethod: undefined,
  paymentReference: undefined,
  paymentSessionExpiresAt: undefined,
  paymentCapturedAt: '2026-03-06T09:00:00.000Z',
  paymentFailedReason: undefined,
  refundedAt: undefined,
  commissionAmount: 0,
  createdAt: '2026-03-06T09:00:00.000Z',
  updatedAt: '2026-03-06T09:00:00.000Z',
});

test('ensureSupabaseUser blocks anonymous sessions when authenticated access is required', async () => {
  const { client } = createQueryClient([], {
    sessionResult: {
      data: {
        session: {
          user: {
            id: 'anon_only',
            email: '',
            is_anonymous: true,
            app_metadata: {
              providers: ['anonymous'],
            },
          },
        },
      },
      error: null,
    },
  });

  const result = await ensureSupabaseUser(
    {
      allowAnonymous: false,
    },
    {
      client,
    }
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.reason, /account autenticato/i);
  }
});

test('ensureSupabaseUser reports CAPTCHA issues during anonymous sign-in', async () => {
  const { client } = createQueryClient([], {
    sessionResult: {
      data: {
        session: null,
      },
      error: null,
    },
    anonymousResult: {
      data: {
        user: null,
      },
      error: new Error('CAPTCHA validation failed'),
    },
  });

  const result = await ensureSupabaseUser(undefined, {
    client,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.reason, /captcha/i);
  }
});

test('listPublicEventsFromSupabase falls back to legacy query when extended columns are unavailable', async () => {
  const { client, assertDone } = createQueryClient([
    {
      kind: 'order',
      error: new Error('column events.event_end_date does not exist'),
      assertQuery: (query) => {
        assert.equal(query.table, 'events');
        assert.ok(query.select?.includes('event_end_date'));
        assert.deepEqual(query.filters, [
          { type: 'eq', field: 'active', value: true },
          { type: 'order', field: 'event_date', options: { ascending: true } },
        ]);
      },
    },
    {
      kind: 'order',
      data: [
        {
          id: 'evt_remote',
          organizer_id: 'org_remote',
          name: 'Trail Test',
          location: 'Torino',
          event_date: '2026-04-20',
          is_free: true,
          fee_amount: 0,
          privacy_text: 'privacy',
          logo_url: null,
          local_sponsor: null,
          assign_numbers: true,
          active: true,
          created_at: '2026-03-01T10:00:00.000Z',
          updated_at: '2026-03-01T10:00:00.000Z',
        },
      ],
      assertQuery: (query) => {
        assert.equal(query.table, 'events');
        assert.ok(!query.select?.includes('event_end_date'));
      },
    },
  ]);

  const result = await listPublicEventsFromSupabase({
    client,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.length, 1);
    assert.equal(result.data[0].name, 'Trail Test');
  }
  assertDone();
});

test('upsertOrganizerInSupabase falls back to legacy payload when the schema is older', async () => {
  const organizer = createOrganizer();
  const { client, assertDone } = createQueryClient([
    {
      kind: 'single',
      error: new Error('column organization_name does not exist'),
      assertQuery: (query) => {
        assert.equal(query.table, 'organizers');
        assert.equal(query.action, 'upsert');
        assert.equal((query.payload as Record<string, unknown>).organization_name, 'Fondazione Test');
        assert.deepEqual(query.options, { onConflict: 'user_id' });
      },
    },
    {
      kind: 'single',
      data: {
        id: 'org_remote',
        email: 'organizer@example.com',
      },
      assertQuery: (query) => {
        const payload = query.payload as Record<string, unknown>;
        assert.deepEqual(Object.keys(payload).sort(), [
          'bank_account',
          'email',
          'fiscal_data',
          'user_id',
        ]);
      },
    },
  ], {
    sessionResult: {
      data: {
        session: {
          user: {
            id: 'user_12345678',
            email: 'organizer@example.com',
            is_anonymous: false,
            app_metadata: {
              providers: ['email'],
            },
          },
        },
      },
      error: null,
    },
  });

  const result = await upsertOrganizerInSupabase(organizer, {
    client,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.id, 'org_remote');
  }
  assertDone();
});

test('upsertOrganizerInSupabase retries with an email alias on duplicate email errors', async () => {
  const organizer = createOrganizer();
  const { client, assertDone } = createQueryClient([
    {
      kind: 'single',
      error: new Error('duplicate key value violates unique constraint "organizers_email_key"'),
    },
    {
      kind: 'single',
      data: {
        id: 'org_remote_alias',
        email: 'organizer+abc12345@example.com',
      },
      assertQuery: (query) => {
        const payload = query.payload as Record<string, unknown>;
        assert.equal(payload.email, 'organizer+abc12345@example.com');
      },
    },
  ], {
    sessionResult: {
      data: {
        session: {
          user: {
            id: 'abc12345xyz987',
            email: 'organizer@example.com',
            is_anonymous: false,
            app_metadata: {
              providers: ['email'],
            },
          },
        },
      },
      error: null,
    },
  });

  const result = await upsertOrganizerInSupabase(organizer, {
    client,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.email, 'organizer+abc12345@example.com');
  }
  assertDone();
});

test('upsertRegistrationInSupabase normalizes payloads and falls back when extended fields are missing', async () => {
  const registration = createRegistration();
  const { client, assertDone } = createQueryClient([
    {
      kind: 'single',
      error: new Error('column group_participants does not exist'),
      assertQuery: (query) => {
        const payload = query.payload as Record<string, unknown>;
        assert.equal(query.table, 'registrations');
        assert.equal(payload.participant_email, 'mario@example.com');
        assert.equal(payload.birth_date, '1990-12-31');
        assert.equal(payload.payment_status, null);
        assert.deepEqual(payload.group_participants, [
          { full_name: 'Mario Rossi', assigned_number: null },
          { full_name: 'Luigi Bianchi', assigned_number: 12 },
        ]);
        assert.equal(payload.participant_message_to_organizer, 'Serve parcheggio');
      },
    },
    {
      kind: 'single',
      data: {
        id: 'reg_remote',
      },
      assertQuery: (query) => {
        const payload = query.payload as Record<string, unknown>;
        assert.equal(payload.birth_date, '1990-12-31');
        assert.ok(!Object.hasOwn(payload, 'group_participants'));
        assert.ok(!Object.hasOwn(payload, 'participant_message_to_organizer'));
      },
    },
  ]);

  const result = await upsertRegistrationInSupabase(
    {
      registration,
      organizerRemoteId: 'org_remote',
      eventRemoteId: 'evt_remote',
    },
    {
      client,
      ensureUser: async () => ({
        ok: true,
        data: {
          userId: 'participant_user_1',
        },
      }),
    }
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.id, 'reg_remote');
  }
  assertDone();
});
