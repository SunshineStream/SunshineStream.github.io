import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import vm from 'node:vm';
import { httpsUrl, loadRepository, clientLinks, enhanceRepository, enhanceClients, setupTheme } from '../assets/site.js';

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

function themeFixture(dark = false, preference) {
  const button = new EventTarget();
  const attributes = {};
  button.setAttribute = (name, value) => { attributes[name] = value; };
  button.hidden = true;
  const media = new EventTarget();
  media.matches = dark;
  const dataset = preference ? { theme: preference } : {};
  const screenshot = {};
  const source = { setAttribute: (name, value) => { screenshot[name] = value; } };
  const doc = {
    documentElement: { dataset },
    querySelector: selector => selector === '.theme-toggle' ? button : null,
    getElementById: id => id === 'sunshine-screenshot-dark' ? source : null
  };
  return { button, attributes, media, doc, dataset, screenshot };
}

test('the theme follows device changes until a manual choice overrides them and persists', () => {
  const fixture = themeFixture();
  const writes = [];
  setupTheme(fixture.doc, { setItem: (...args) => writes.push(args) }, fixture.media);
  assert.equal(fixture.button.hidden, false);
  assert.equal(fixture.attributes['aria-label'], 'Switch to dark mode');
  assert.equal(fixture.screenshot.media, 'not all');
  fixture.media.matches = true;
  fixture.media.dispatchEvent(new Event('change'));
  assert.equal(fixture.attributes['aria-label'], 'Switch to light mode');
  assert.equal(fixture.screenshot.media, 'all');
  assert.equal(fixture.dataset.theme, undefined);
  fixture.button.dispatchEvent(new Event('click'));
  assert.equal(fixture.dataset.theme, 'light');
  assert.deepEqual(writes, [['sunshine-theme', 'light']]);
  fixture.media.dispatchEvent(new Event('change'));
  assert.equal(fixture.attributes['aria-label'], 'Switch to dark mode');
  assert.equal(fixture.screenshot.media, 'not all');
});

test('manual theme changes work when browser storage is blocked', () => {
  const fixture = themeFixture(false, 'dark');
  setupTheme(fixture.doc, { setItem() { throw new Error('Storage blocked'); } }, fixture.media);
  assert.equal(fixture.attributes['aria-label'], 'Switch to light mode');
  assert.equal(fixture.screenshot.media, 'all');
  fixture.button.dispatchEvent(new Event('click'));
  assert.equal(fixture.dataset.theme, 'light');
  assert.equal(fixture.screenshot.media, 'not all');
  fixture.button.dispatchEvent(new Event('click'));
  assert.equal(fixture.dataset.theme, 'dark');
  assert.equal(fixture.screenshot.media, 'all');
});

test('the current interface has both theme captures and a system-theme fallback without JavaScript', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const picture = html.match(/<picture>([\s\S]*?)<\/picture>/)[1];
  assert.match(picture, /srcset="\.\/assets\/sunshine-web-ui-dark.jpg" media="\(prefers-color-scheme: dark\)"/);
  assert.match(picture, /<img src="\.\/assets\/sunshine-web-ui-light.jpg" width="1264" height="802"/);
  for (const theme of ['light', 'dark']) {
    await access(new URL(`../assets/sunshine-web-ui-${theme}.jpg`, import.meta.url));
  }
});

test('the early theme bootstrap restores only valid saved choices and tolerates blocked storage', async () => {
  const source = await readFile(new URL('../assets/theme-init.js', import.meta.url), 'utf8');
  for (const value of ['dark', 'light', 'unexpected', null]) {
    const sandbox = { localStorage: { getItem: () => value }, document: { documentElement: { dataset: {} } } };
    vm.runInNewContext(source, sandbox);
    assert.equal(sandbox.document.documentElement.dataset.theme,
      ['light', 'dark'].includes(value) ? value : undefined);
  }
  const blocked = { localStorage: { getItem() { throw new Error('Storage blocked'); } },
    document: { documentElement: { dataset: {} } } };
  assert.doesNotThrow(() => vm.runInNewContext(source, blocked));
});

test('DMGs are the primary macOS action, FreeBSD has a download, and funding links are visible', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const cards = [...html.matchAll(/<article class="download-card">([\s\S]*?)<\/article>/g)].map(match => match[1]);
  assert.equal(cards.length, 4);
  const mac = cards.find(card => card.includes('<h3>macOS</h3>'));
  assert.match(mac, /class="button primary"[^>]+releases\/latest[^>]*>Get macOS DMGs/);
  assert.doesNotMatch(mac, /Homebrew/);
  const alternatives = html.match(/<div class="package-links">([\s\S]*?)<\/div>/)[1];
  assert.match(alternatives, /href="https:\/\/github.com\/LizardByte\/homebrew-homebrew">Homebrew/);
  assert.ok(cards.some(card => card.includes('<h3>FreeBSD</h3>') && card.includes('Get FreeBSD packages')));
  assert.match(html, /href="#donate">Donate/);
  const support = html.match(/<section class="donate wrap"[\s\S]*?<\/section>/)[0];
  assert.match(support, /Buying a libvirtualhid license is the best way to support Sunshine/);
  assert.match(support, /unlocks full controller support on Windows and macOS/);
  assert.match(support, /Donations are welcome, too/);
  assert.match(support, /class="button primary" href="https:\/\/buy.polar.sh\/[^"]+">Buy a libvirtualhid license/);
  assert.equal([...support.matchAll(/class="button donation-secondary"/g)].length, 3);
  assert.match(html, /href="https:\/\/github.com\/sponsors\/LizardByte"/);
  assert.match(html, /href="https:\/\/paypal.me\/ReenigneArcher"/);
  assert.match(html, /href="https:\/\/www.patreon.com\/LizardByte"/);
  assert.ok(html.indexOf('theme-init.js') < html.indexOf('style.css'));
});
