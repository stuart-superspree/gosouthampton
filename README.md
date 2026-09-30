# Southampton RouteLoop: city centre demo

A stakeholder demo of Southampton RouteLoop: tap a Loop point, follow a themed walking trail, see what's on, get help, and (for cruise guests) get back to the ship on time. There is no app to download.

It's a static site with vanilla ES modules and no framework, no build step, no runtime dependencies and no third-party calls. Anything a live server would do (verifying taps, issuing codes, importing sources, storing feedback) is **simulated in the browser**, and it's labelled as a simulation wherever it appears.

## Run it locally

```bash
npm start                  # zero-dependency Node server on $PORT (default 8080)
```

Then open `http://localhost:8080/?demo=1`.

Any static server can serve the `site/` folder from the domain root. Tap URLs (`/t/<id>`) need a rewrite to `index.html`. The Caddyfile and `serve.mjs` both do this. On a host with no rewrites, `site/404.html` redirects `/t/<id>` to `/?t=<id>`, which the app also accepts.

## Demo URLs

| What | URL |
|---|---|
| Visitor app, with the demo panel | `/?demo=1` |
| A browse-mode place link (no stamp) | `/t/k7Qx2` (the Bargate) |
| Simulated date (shows the seasonal Snow Windows Trail) | `/?demo=1&date=2026-12-05` |
| Reset the visitor (shared phone) | `/?reset=1&demo=1` |
| Demo admin | `/admin/` (sections: `#dashboard`, `#tags`, `#trails`, `#legs`, `#sources`, `#content`, `#publish`, `#audit`) |
| Old prototype links (browse mode only) | `/?tag=bargate` |

The **demo panel** (the "Demo panel" button, shown only with `?demo=1`) has these controls:

- **Tap simulator.** Makes a valid secured tap for any Loop point, or replays the last one to show it being rejected.
- **Simulate no signal.** Turns the connection off in the app.
- **Queue counts.** Shows how many feedback items and taps are waiting to send.
- **Simulated date.** Sets the date the app runs on.
- **Staff code check.** Redeems a reward code; codes are single use.

The admin writes to this browser's storage. Open the visitor app in another tab of the **same browser** to see published changes. An open tab offers "Update ready".

## Deploy (GitHub, then Railway)

**Step by step instructions are in [`DEPLOY.md`](DEPLOY.md).** In short:

1. Push this folder to an empty GitHub repository. `publish-to-github.bat` does this with a double-click on Windows.
2. In Railway: **New Project**, then **Deploy from GitHub repo**, then pick the repository.
3. Railway builds the `Dockerfile` (set in `railway.json`). The build:
   - refreshes the generated preload and offline lists (`scripts/sw-manifest.mjs`);
   - copies `site/` into a Caddy 2.11.4 image;
   - checks the Caddyfile.

   There's no npm install and no Node at run time.
4. The Caddyfile listens on `$PORT`, which Railway injects; the port is never hardcoded. It also:
   - serves `site/`;
   - compresses text with zstd or gzip;
   - sets security headers on pages, including a strict Content Security Policy with no inline scripts or styles;
   - makes app code revalidate on every load;
   - rewrites `/t/<id>` to the app.
5. **Settings, then Networking, then Generate Domain.** Use that domain on the tags: `https://<domain>/t/<tagId>?e=...&c=...`

**How it was checked here:**

- The image was built from a fresh clone of the repository.
- It was run with `PORT` set the way Railway sets it.
- The full acceptance suite passed against it: see `tests/out/results-caddy.md`.

The Railway build itself hasn't been run from here.

**Fallback:** `serve.mjs` is a zero-dependency Node server with the same rewrites and headers. Any host that runs Node 20 or later can serve the site with `node serve.mjs`.

## Folder structure

```
site/
  index.html               visitor app shell (15 screens)
  admin/index.html         demo admin
  src/                     ES modules, one job each
    app.js router.js state.js storage.js session.js clock.js i18n.js markup.js ctx.js
    tap.js                 tap entry, browse mode, Web NFC
    api.js                 the only gateway to "the server" (swap for fetch() in the live build)
    mock-edge.js           SIMULATION: secured tap check (NTAG 424 DNA style) and signed tokens
    mock-server.js         SIMULATION: stamps, single-use codes, prize claims, feedback
    hmac.js                small SHA-256 and HMAC for the mock
    graph.js journey.js    leg graph, shortest chain, trails, detours, rejoin, return
    importer.js mini-html.js import-job.js   source importer, recipe reader, scheduled-job simulation
    registers.js nudge.js outbox.js time.js bundle.js
    ui/                    one module per screen group
    demo/                  demo panel and chip simulator (only loaded with ?demo=1)
    admin/                 admin screens, draft store, publish checks
  data/                    all content as JSON (see below)
  data/fixtures/           bundled sample files for the six source types
  strings/en.json de.json  interface strings
  img/photos img/places img/icons   self-hosted photos, drawn placeholders, icons
  fonts/                   self-hosted Inter and Playfair Display (subset, OFL)
  styles/app.css admin.css
  sw.js manifest.webmanifest 404.html
scripts/                   checks, importer, list generator
tests/                     unit tests and the Playwright acceptance suite
tests/out/                 latest results (Node server, and the Docker image with Caddy), speed figures and screenshots
docs/                      prototype content map
Dockerfile .dockerignore railway.json Caddyfile   hosting (see DEPLOY.md)
publish-to-github.bat      Windows helper that sends the folder to GitHub
serve.mjs                  zero-dependency Node server for local use and as a fallback
DEPLOY.md REPORT.md CHANGELOG.md ASSUMPTIONS.md
```

`REPORT.md` is the build report: what was kept and changed, copy fixes, content to check, measured speed and size, gaps and open questions.

## Content data (`site/data`)

| File | What it holds |
|---|---|
| `tags.json` | One record per Loop point: opaque id, name, zone, status and image |
| `legs.json` | Authored walks between neighbouring points: step cards in English and German, walk minutes, step-free flag, closed flag |
| `trails.json` | Trails as ordered legs, plus the seasonal campaign trail |
| `campaigns.json` | The Snow Windows Trail routes and windows |
| `notices.json` | Closures and information, which can close legs |
| `busy-calendar.json` | Level 0 quiet-time nudges |
| `rewards.json`, `safe-places.json`, `settings.json` | Rewards, help-screen safe places, and app settings |
| `images.json` | Every photo with its source, credit and licence status |
| `sources.json` | The source registry |
| `manual-events.json` | Events added in the admin |
| `events.json`, `places.json` | Generated by `npm run import`. Don't edit by hand. |

Records invented for the demo carry `"demo": true`, and the app shows "Demo content" where they appear. Dates in demo records and fixtures are written as tokens such as `{{D+2}}` or `{{iso:D+0 19:30}}`. These are resolved against today's London date, so the demo never looks stale.

## Scripts

```bash
npm run check      # strings complete, publish checks, walk-back times, node --check, no dashes, generated lists current
npm run test:unit  # 18 unit tests: time zone and clock changes, crypto, importer, graph, registers, nudge
npm test           # 17 acceptance tests in Chromium at 390 x 844, plus screenshots (tests/out/)
npm run import     # rebuild data/events.json and data/places.json from the fixtures
npm run lists      # refresh the module preload list in index.html and the service worker precache list
```

To run the acceptance suite against another server: `BASE_URL=http://localhost:8080 npm test`.

## Replacing a simulation with the real thing

| Simulated here | Live build |
|---|---|
| `api.js` calls into `mock-server.js` | Replace the bodies with `fetch()` calls to the small API |
| `mock-edge.js` and `hmac.js` | An edge function that verifies NTAG 424 DNA SUN messages. The key must never ship to the client. |
| `import-job.js` runs in the browser over fixtures | A scheduled server job fetching approved sources and publishing `events.json` and `places.json` |
| Admin drafts and versions in `localStorage` | The CMS (Directus or Payload on Postgres) and versioned bundles on the CDN |
| `demo/` panel and chip simulator | Removed |
