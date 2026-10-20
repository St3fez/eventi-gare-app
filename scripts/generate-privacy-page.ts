// Writes a static /privacy-policy page into the web export.
// GitHub Pages serves SPA routes through 404.html with HTTP status 404, which Google Play
// rejects for the privacy policy URL; a real file returns 200 and is readable without JS.
// Usage: tsx scripts/generate-privacy-page.ts [outputDir=web-build]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { AppLanguage, translate } from '../src/i18n';

const outputDir = process.argv[2] ?? 'web-build';
const contactEmail = process.env.EXPO_PUBLIC_ADMIN_CONTACT_EMAIL?.trim() || 'profstefanoferrari@gmail.com';
const appUrl = (process.env.EXPO_PUBLIC_EVENT_WEB_BASE_URL?.trim() || 'https://st3fez.github.io/eventi-gare-app').replace(/\/+$/, '');

// Same order as PrivacyPolicyScreen.
const SECTIONS: Array<{ title: string; bodies: string[] }> = [
  { title: 'privacy_policy_scope_title', bodies: ['privacy_policy_scope_body'] },
  {
    title: 'privacy_policy_data_title',
    bodies: ['privacy_policy_data_item_1', 'privacy_policy_data_item_2', 'privacy_policy_data_item_3'],
  },
  { title: 'privacy_policy_purposes_title', bodies: ['privacy_policy_purposes_body'] },
  { title: 'privacy_policy_basis_title', bodies: ['privacy_policy_basis_body'] },
  { title: 'privacy_policy_retention_title', bodies: ['privacy_policy_retention_body'] },
  { title: 'privacy_policy_third_parties_title', bodies: ['privacy_policy_third_parties_body'] },
  { title: 'privacy_policy_ads_title', bodies: ['privacy_policy_ads_body'] },
  { title: 'privacy_policy_security_title', bodies: ['privacy_policy_security_body'] },
  { title: 'privacy_policy_rights_title', bodies: ['privacy_policy_rights_body'] },
  { title: 'privacy_policy_deletion_title', bodies: ['privacy_policy_deletion_body'] },
  { title: 'privacy_policy_disclaimer_title', bodies: ['privacy_policy_disclaimer_body'] },
];

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const renderLanguage = (language: AppLanguage) => {
  const t = (key: string) => escapeHtml(translate(language, key, { email: contactEmail }));
  const sections = SECTIONS.map(
    ({ title, bodies }) =>
      `<h2>${t(title)}</h2>\n${bodies.map((body) => `<p>${t(body)}</p>`).join('\n')}`
  ).join('\n');
  return `<section lang="${language}" id="${language}">
<h1>${t('privacy_policy_page_title')} — Events</h1>
<p class="muted">${t('privacy_policy_page_last_updated')}</p>
<p>${t('privacy_policy_page_intro')}</p>
${sections}
</section>`;
};

const html = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Privacy Policy — Events</title>
<meta name="description" content="Privacy Policy dell'app Events (com.eventi.slash.gare) / Privacy Policy of the Events app.">
<style>
  body { margin: 0; background: #f7f8fa; color: #1b2430; font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 760px; margin: 0 auto; padding: 32px 16px 64px; }
  nav a { margin-right: 16px; color: #0f5d70; }
  h1 { font-size: 1.8rem; line-height: 1.25; margin: 32px 0 4px; }
  h2 { font-size: 1.15rem; margin: 28px 0 6px; }
  .muted { color: #5b6675; margin-top: 0; }
  hr { border: 0; border-top: 1px solid #d8dde4; margin: 48px 0 0; }
  @media (prefers-color-scheme: dark) {
    body { background: #030e1a; color: #e6edf5; }
    nav a { color: #7fd3e0; }
    .muted { color: #9aa8b8; }
    hr { border-top-color: #22344a; }
  }
</style>
</head>
<body>
<main>
<nav><a href="#it">Italiano</a><a href="#en">English</a><a href="${escapeHtml(appUrl)}/">Webapp</a></nav>
${renderLanguage('it')}
<hr>
${renderLanguage('en')}
</main>
</body>
</html>
`;

const pageDir = join(outputDir, 'privacy-policy');
mkdirSync(pageDir, { recursive: true });
writeFileSync(join(pageDir, 'index.html'), html, 'utf8');
writeFileSync(join(outputDir, 'privacy-policy.html'), html, 'utf8');
console.log(`Privacy policy page written to ${join(pageDir, 'index.html')}`);
