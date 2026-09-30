// Service worker for the RouteLoop demo. Caches are named by this worker's
// scope, and entries are keyed by full URL, so two apps on the same origin
// never overwrite each other. A new version waits until the visitor chooses to
// refresh ("Update ready"), so nobody is reloaded mid-journey.
const VERSION = '2.0.1-44a1c08ddd';
const SCOPE = self.registration.scope;
const SHELL = `rl-shell|${SCOPE}|${VERSION}`;
const RUNTIME = `rl-runtime|${SCOPE}`;

// PRECACHE-START (kept in sync by scripts/sw-manifest.mjs; checked by npm run check)
const PRECACHE = [
  '/',
  '/data/busy-calendar.json',
  '/data/campaigns.json',
  '/data/events.json',
  '/data/fixtures/art-gallery-events.html',
  '/data/fixtures/go-southampton-events.json',
  '/data/fixtures/index.json',
  '/data/fixtures/mayflower-whats-on.html',
  '/data/fixtures/museums-galleries.ics',
  '/data/fixtures/vs-events-export.csv',
  '/data/fixtures/vs-things-to-do.html',
  '/data/images.json',
  '/data/legs.json',
  '/data/manual-events.json',
  '/data/notices.json',
  '/data/places.json',
  '/data/rewards.json',
  '/data/safe-places.json',
  '/data/settings.json',
  '/data/sources.json',
  '/data/tags.json',
  '/data/trails.json',
  '/fonts/inter-latin-var.woff2',
  '/fonts/playfair-latin-var.woff2',
  '/img/icons/icon.svg',
  '/img/photos/hero-welcome.webp',
  '/img/photos/whirlwind-tour.webp',
  '/index.html',
  '/manifest.webmanifest',
  '/src/api.js',
  '/src/app.js',
  '/src/bundle.js',
  '/src/clock.js',
  '/src/ctx.js',
  '/src/demo/chip-sim.js',
  '/src/demo/panel.js',
  '/src/graph.js',
  '/src/hmac.js',
  '/src/i18n.js',
  '/src/import-job.js',
  '/src/importer.js',
  '/src/journey.js',
  '/src/markup.js',
  '/src/mini-html.js',
  '/src/mock-edge.js',
  '/src/mock-server.js',
  '/src/nudge.js',
  '/src/outbox.js',
  '/src/registers.js',
  '/src/router.js',
  '/src/session.js',
  '/src/state.js',
  '/src/storage.js',
  '/src/tap.js',
  '/src/time.js',
  '/src/ui/common.js',
  '/src/ui/events.js',
  '/src/ui/feedback.js',
  '/src/ui/help.js',
  '/src/ui/home.js',
  '/src/ui/passport.js',
  '/src/ui/return.js',
  '/src/ui/setup.js',
  '/src/ui/snow.js',
  '/src/ui/trail.js',
  '/strings/de.json',
  '/strings/en.json',
  '/styles/app.css'
];
// PRECACHE-END

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE.map((p) => new Request(p, { cache: 'no-cache' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith(`rl-shell|${SCOPE}|`) && k !== SHELL).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  const msg = event.data || {};
  if (msg.type === 'SKIP_WAITING') self.skipWaiting();
  if (msg.type === 'PRECACHE' && Array.isArray(msg.urls)) {
    event.waitUntil(caches.open(RUNTIME).then((c) => Promise.all(msg.urls.map((u) => c.match(u).then((hit) => hit || c.add(u).catch(() => null))))));
  }
});

async function fromCache(request) {
  const shell = await caches.open(SHELL);
  return (await shell.match(request)) || (await (await caches.open(RUNTIME)).match(request));
}

async function networkFirst(request, fallbackPath) {
  try {
    const res = await fetch(request);
    return res;
  } catch {
    const shell = await caches.open(SHELL);
    return (await shell.match(fallbackPath)) || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cached = await fromCache(request);
  const network = fetch(request).then(async (res) => {
    if (res.ok) (await caches.open(SHELL)).put(request, res.clone());
    return res;
  }).catch(() => null);
  return cached || (await network) || Response.error();
}

async function cacheFirst(request) {
  const cached = await fromCache(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok && res.type === 'basic') (await caches.open(RUNTIME)).put(request, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    const fallback = url.pathname.startsWith('/admin') ? '/admin/index.html' : '/index.html';
    event.respondWith(networkFirst(req, fallback));
    return;
  }
  const bare = new Request(url.origin + url.pathname);
  if (url.pathname.startsWith('/data/') || url.pathname.startsWith('/strings/')) { event.respondWith(staleWhileRevalidate(bare)); return; }
  event.respondWith(cacheFirst(url.search ? req : bare));
});
