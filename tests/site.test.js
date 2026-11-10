import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { httpsUrl, loadRepository, clientLinks, enhanceRepository, enhanceClients } from '../assets/site.js';

const ok = body => ({ ok: true, json: async () => body });

test('repository ownership follows the stable ID after a transfer', async () => {
  const requests = [];
  const repo = await loadRepository(async url => {
    requests.push(url);
    return ok({ id: 438803890, full_name: 'SunshineStream/Sunshine' });
  });
  assert.deepEqual(requests, ['https://api.github.com/repositories/438803890']);
  assert.equal(repo.url, 'https://github.com/SunshineStream/Sunshine');
});

test('repository metadata rejects incorrect IDs, malformed owners, and API errors', async () => {
  for (const body of [{ id: 3, full_name: 'Other/Repo' },
    { id: 438803890, full_name: 'https://example.com' }, { id: 438803890 }]) {
    await assert.rejects(loadRepository(async () => ok(body)), /Invalid repository metadata/);
  }
  await assert.rejects(loadRepository(async () => ({ ok: false })), /unavailable/);
});

test('client catalog excludes tools, duplicates, missing fields, and unsafe download links', () => {
  const clients = clientLinks({ apps: [
    { id: 'tool', name: 'Driver', category: 'sunshine:tool', links: { download: 'https://example.com/tool' } },
    { id: 'community', name: 'alpha', category: 'sunshine:client', links: { download: 'https://example.com/alpha' } },
    { id: 'official', name: 'Zebra', category: 'sunshine:client', official: true, links: { download: 'https://example.com/zebra' } },
    { id: 'community', name: 'duplicate', category: 'sunshine:client', links: { download: 'https://example.com/duplicate' } },
    { id: 'unsafe', name: 'Unsafe', category: 'sunshine:client', links: { download: 'javascript:alert(1)' } },
    { id: 'fallback', name: 'Beta', category: 'sunshine:client', links: { download: 'http://insecure.example', website: 'https://example.com/beta' } },
    { id: 'missing', category: 'sunshine:client' }, null
  ] });
  assert.deepEqual(clients.map(client => client.name), ['Zebra', 'alpha', 'Beta']);
  assert.equal(clients.at(-1).url, 'https://example.com/beta');
  assert.throws(() => clientLinks({}), /Invalid client catalog/);
  for (const url of ['javascript:alert(1)', 'http://example.com', 'https://user:password@example.com', undefined]) {
    assert.equal(httpsUrl(url), null);
  }
});

test('canonical repository links update before an unavailable release lookup', async () => {
  const links = [{ dataset: { repoPath: '/releases/latest' }, href: 'fallback' },
    { dataset: { repoPath: '' }, href: 'fallback' }, { dataset: { repoPath: '//elsewhere' }, href: 'keep' }];
  const doc = { querySelectorAll: () => links };
  let calls = 0;
  await enhanceRepository(doc, async () => ++calls === 1
    ? ok({ id: 438803890, full_name: 'SunshineStream/Sunshine' }) : { ok: false });
  assert.equal(links[0].href, 'https://github.com/SunshineStream/Sunshine/releases/latest');
  assert.equal(links[1].href, 'https://github.com/SunshineStream/Sunshine');
  assert.equal(links[2].href, 'keep');
});

test('release metadata uses text content and never labels drafts or prereleases as stable', async () => {
  for (const prerelease of [true, false]) {
    const label = { textContent: 'Latest stable release' };
    const doc = { querySelectorAll: () => [], getElementById: () => label };
    let calls = 0;
    await enhanceRepository(doc, async () => ++calls === 1
      ? ok({ id: 438803890, full_name: 'LizardByte/Sunshine' })
      : ok({ tag_name: '<test>', prerelease }));
    assert.equal(label.textContent, prerelease ? 'Latest stable release' : 'Latest stable: <test>');
  }
});

test('network outages preserve static repository and client fallback links', async () => {
  const link = { dataset: { repoPath: '' }, href: 'https://github.com/LizardByte/Sunshine' };
  let replaced = false;
  const doc = { querySelectorAll: () => [link], getElementById: () => ({ replaceChildren: () => { replaced = true; } }) };
  const unavailable = async () => { throw new Error('offline'); };
  await enhanceRepository(doc, unavailable);
  await enhanceClients(doc, unavailable);
  await enhanceClients(doc, async () => ({ ok: false }));
  await enhanceClients(doc, async () => ok({ apps: [] }));
  assert.equal(link.href, 'https://github.com/LizardByte/Sunshine');
  assert.equal(replaced, false);
});

test('page anchors and local assets resolve and essential actions are static links', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
  for (const match of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(match[1]), `Missing ${match[1]}`);
  for (const match of html.matchAll(/(?:href|src)="\.\/([^"#]+)"/g)) {
    await access(fileURLToPath(new URL('../' + match[1], import.meta.url)));
  }
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /href="https:\/\/github.com\/LizardByte\/Sunshine\/releases\/latest"/);
  assert.match(html, /https:\/\/docs.lizardbyte.dev\/projects\/sunshine\/latest\//);
  assert.match(html, /aria-controls="navigation"/);
});
