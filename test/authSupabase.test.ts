import assert from 'node:assert/strict';
import test from 'node:test';

import {
  completeWebAuthFromUrl,
  normalizeWebAuthRedirectUrl,
  parseAuthCallbackUrl,
} from '../src/services/authSupabaseWeb';

const createAuthClient = (overrides?: {
  exchangeError?: {
    message: string;
  } | null;
  sessionError?: {
    message: string;
  } | null;
  verifyError?: {
    message: string;
  } | null;
}) => {
  const calls: {
    code: string | null;
    session:
      | {
          access_token: string;
          refresh_token: string;
        }
      | null;
    verify:
      | {
          token_hash: string;
          type: 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'email';
        }
      | null;
  } = {
    code: null,
    session: null,
    verify: null,
  };

  return {
    calls,
    client: {
      auth: {
        exchangeCodeForSession: async (code: string) => {
          calls.code = code;
          return {
            error: overrides?.exchangeError ?? null,
          };
        },
        setSession: async (session: { access_token: string; refresh_token: string }) => {
          calls.session = session;
          return {
            error: overrides?.sessionError ?? null,
          };
        },
        verifyOtp: async (params: {
          token_hash: string;
          type: 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'email';
        }) => {
          calls.verify = params;
          return {
            error: overrides?.verifyError ?? null,
          };
        },
      },
    },
  };
};

test('normalizeWebAuthRedirectUrl strips static export artifacts from GitHub Pages URLs', () => {
  assert.equal(
    normalizeWebAuthRedirectUrl('https://st3fez.github.io/eventi-gare-app/404.html?code=test'),
    'https://st3fez.github.io/eventi-gare-app'
  );
  assert.equal(
    normalizeWebAuthRedirectUrl('https://st3fez.github.io/eventi-gare-app/index.html'),
    'https://st3fez.github.io/eventi-gare-app'
  );
  assert.equal(
    normalizeWebAuthRedirectUrl('https://st3fez.github.io/eventi-gare-app/'),
    'https://st3fez.github.io/eventi-gare-app'
  );
  assert.equal(normalizeWebAuthRedirectUrl('not-a-url'), undefined);
});

test('parseAuthCallbackUrl detects Supabase auth errors from query parameters', () => {
  const result = parseAuthCallbackUrl(
    'https://app.example.com/eventi?error=access_denied&error_description=User+canceled'
  );

  assert.equal(result.hasAuthCallbackParams, true);
  assert.match(result.errorMessage ?? '', /user canceled/i);
});

test('completeOAuthFromUrl exchanges OAuth codes from query callbacks', async () => {
  const { client, calls } = createAuthClient();

  const result = await completeWebAuthFromUrl(
    'https://app.example.com/eventi-gare-app?code=oauth-code-123',
    client
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data, true);
  }
  assert.equal(calls.code, 'oauth-code-123');
  assert.equal(calls.verify, null);
  assert.equal(calls.session, null);
});

test('completeOAuthFromUrl verifies email token_hash callbacks', async () => {
  const { client, calls } = createAuthClient();

  const result = await completeWebAuthFromUrl(
    'https://app.example.com/eventi-gare-app?token_hash=hash-123&type=magiclink',
    client
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data, true);
  }
  assert.deepEqual(calls.verify, {
    token_hash: 'hash-123',
    type: 'magiclink',
  });
  assert.equal(calls.code, null);
  assert.equal(calls.session, null);
});

test('completeOAuthFromUrl applies sessions from implicit hash callbacks', async () => {
  const { client, calls } = createAuthClient();

  const result = await completeWebAuthFromUrl(
    'https://app.example.com/eventi-gare-app#access_token=access-123&refresh_token=refresh-456',
    client
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data, true);
  }
  assert.deepEqual(calls.session, {
    access_token: 'access-123',
    refresh_token: 'refresh-456',
  });
  assert.equal(calls.code, null);
  assert.equal(calls.verify, null);
});
