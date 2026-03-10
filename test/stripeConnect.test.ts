import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildStripeConnectCallbackUrl,
  extractStripeConnectActionUrl,
  parseStripeConnectCallbackUrl,
} from '../src/services/stripeConnect';

test('buildStripeConnectCallbackUrl keeps GitHub Pages base path and organizer id', () => {
  const url = buildStripeConnectCallbackUrl({
    action: 'return',
    organizerId: 'org_local_123',
    runtimeUrl: 'https://st3fez.github.io/eventi-gare-app/index.html',
  });

  assert.equal(
    url,
    'https://st3fez.github.io/eventi-gare-app/?stripeConnect=return&organizer=org_local_123'
  );
});

test('parseStripeConnectCallbackUrl reads action and organizer id from callback url', () => {
  const parsed = parseStripeConnectCallbackUrl(
    'https://st3fez.github.io/eventi-gare-app/?stripeConnect=refresh&organizer=org_local_456'
  );

  assert.equal(parsed.hasStripeConnectCallback, true);
  assert.equal(parsed.action, 'refresh');
  assert.equal(parsed.organizerId, 'org_local_456');
});

test('parseStripeConnectCallbackUrl ignores unrelated urls', () => {
  const parsed = parseStripeConnectCallbackUrl(
    'https://st3fez.github.io/eventi-gare-app/?foo=bar'
  );

  assert.equal(parsed.hasStripeConnectCallback, false);
  assert.equal(parsed.action, null);
  assert.equal(parsed.organizerId, null);
});

test('extractStripeConnectActionUrl reads a manual Stripe dashboard url from error text', () => {
  const url = extractStripeConnectActionUrl(
    'Stripe Connect request failed: Completa prima il profilo piattaforma Stripe Connect: apri https://dashboard.stripe.com/settings/connect/platform-profile, conferma le responsabilita e salva.'
  );

  assert.equal(url, 'https://dashboard.stripe.com/settings/connect/platform-profile');
});

test('extractStripeConnectActionUrl returns undefined when no url is present', () => {
  const url = extractStripeConnectActionUrl(
    'Stripe Connect request failed: endpoint not reachable.'
  );

  assert.equal(url, undefined);
});
