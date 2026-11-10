const REPOSITORY_ID = 438803890;
const CLIENT_CATALOG_URL = 'https://app.lizardbyte.dev/app-directory/sunshine.json';

/** Return an HTTPS URL, excluding credentials and other URL schemes. */
export function httpsUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

/** Fetch canonical ownership by the transfer-stable GitHub repository ID. */
export async function loadRepository(fetcher = fetch) {
  const response = await fetcher(`https://api.github.com/repositories/${REPOSITORY_ID}`, {
    signal: AbortSignal.timeout(8000), headers: { Accept: 'application/vnd.github+json' }
  });
  if (!response.ok) throw new Error('Repository metadata unavailable');
  const data = await response.json();
  if (data.id !== REPOSITORY_ID || typeof data.full_name !== 'string' ||
      !/^[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+$/.test(data.full_name)) {
    throw new Error('Invalid repository metadata');
  }
  return { fullName: data.full_name, url: `https://github.com/${data.full_name}` };
}

/** Select actual clients rather than tools, validating links before DOM insertion. */
export function clientLinks(data) {
  if (!Array.isArray(data?.apps)) throw new Error('Invalid client catalog');
  const seen = new Set();
  return data.apps.filter(app => app?.category === 'sunshine:client')
    .map(app => ({ id: app.id, name: app.name, official: app.official === true,
      url: httpsUrl(app.links?.download) || httpsUrl(app.links?.website) || httpsUrl(app.links?.github) }))
    .filter(app => {
      if (typeof app.id !== 'string' || typeof app.name !== 'string' || !app.name.trim() ||
          !app.url || seen.has(app.id)) return false;
      seen.add(app.id);
      return true;
    })
    .sort((a, b) => Number(b.official) - Number(a.official) ||
      a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}

/** Enhance working static links; failures never hide downloads or documentation. */
export async function enhanceRepository(doc = document, fetcher = fetch) {
  try {
    const repository = await loadRepository(fetcher);
    for (const link of doc.querySelectorAll('[data-repo-path]')) {
      const route = link.dataset.repoPath;
      if (['', '/releases', '/releases/latest'].includes(route)) link.href = repository.url + route;
    }
    const response = await fetcher(`https://api.github.com/repos/${repository.fullName}/releases/latest`, {
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return;
    const release = await response.json();
    const label = doc.getElementById('release-label');
    if (label && typeof release.tag_name === 'string' && !release.prerelease && !release.draft) {
      label.textContent = `Latest stable: ${release.tag_name}`;
    }
  } catch {
    // Static GitHub links remain useful through redirects and API outages.
  }
}

/** Render the shared client directory without injecting catalog HTML. */
export async function enhanceClients(doc = document, fetcher = fetch) {
  try {
    const response = await fetcher(CLIENT_CATALOG_URL, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return;
    const clients = clientLinks(await response.json());
    const container = doc.getElementById('client-catalog');
    if (!clients.length || !container) return;
    const fragment = doc.createDocumentFragment();
    for (const client of clients) {
      const item = doc.createElement('li');
      const link = doc.createElement('a');
      link.href = client.url;
      link.textContent = client.name;
      const badge = doc.createElement('span');
      badge.className = 'community';
      badge.textContent = client.official ? 'Moonlight ↗' : 'Community ↗';
      link.append(badge);
      item.append(link);
      fragment.append(item);
    }
    container.replaceChildren(fragment);
  } catch {
    // The official Moonlight and app-directory fallback links remain visible.
  }
}

export function setupMenu(doc = document) {
  const button = doc.querySelector('.menu-toggle');
  const nav = doc.getElementById('navigation');
  if (!button || !nav) return;
  function close() {
    nav.classList.remove('is-open');
    button.setAttribute('aria-expanded', 'false');
  }
  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') !== 'true';
    nav.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));
  });
  nav.addEventListener('click', event => { if (event.target.closest('a')) close(); });
  doc.addEventListener('keydown', event => {
    if (event.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') {
      close();
      button.focus();
    }
  });
}

/** Follow the device theme until the visitor chooses and saves a light or dark mode. */
export function setupTheme(doc = document, storage, media = globalThis.matchMedia?.('(prefers-color-scheme: dark)')) {
  const button = doc.querySelector('.theme-toggle');
  if (!button) return;
  if (!storage) {
    try { storage = globalThis.localStorage; } catch { /* Storage can be blocked. */ }
  }
  const root = doc.documentElement;
  function effectiveTheme() {
    if (['light', 'dark'].includes(root.dataset.theme)) return root.dataset.theme;
    return media?.matches ? 'dark' : 'light';
  }
  function sync() {
    const dark = effectiveTheme() === 'dark';
    const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    doc.getElementById('theme-icon')?.setAttribute('href', dark ? '#sun' : '#moon');
    doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#131d1a' : '#f7f6f0');
  }
  button.addEventListener('click', () => {
    const theme = effectiveTheme() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = theme;
    try { storage?.setItem('sunshine-theme', theme); } catch { /* Keep the current-page preference. */ }
    sync();
  });
  media?.addEventListener('change', sync);
  button.hidden = false;
  sync();
}

if (typeof document !== 'undefined') {
  setupTheme();
  setupMenu();
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
  void enhanceRepository();
  void enhanceClients();
}
