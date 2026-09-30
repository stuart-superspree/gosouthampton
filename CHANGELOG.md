# Changelog

## 2.0.1 (30 September 2026): fact corrections and deployment

### Fixed

- **Wrong facts in the prototype text**, corrected in English and German, with sources in `REPORT.md`:
  - the Titanic sinking date;
  - the QE2 anchor's location (it is at Holyrood Church, not the town walls);
  - the Mayflower plaque at Holyrood (there isn't one);
  - the Wool House's century and original use;
  - the Bargate lions;
  - the police force's name;
  - the WestQuay cinema.
- **Route texts.** Four walk texts that sent people the wrong way: Westgate Street, and the way between the High Street and Oxford Street.
- **Safe places.** Removed the Tourist Information entry: no current Southampton tourist office could be found.
- **The admin's phone preview** no longer steals the cursor from the field being typed in.
- **"Update ready"** now shows new content at once instead of waiting for What's on to rebuild.
- **The iCal demo source** no longer depends on the time of day.

### Changed

- **Deployment** now uses a `Dockerfile` (Caddy 2.11.4) instead of Nixpacks, which Railway has deprecated.
  - `railway.json` points at the Dockerfile and adds a health check.
  - The build refreshes the offline lists and validates the Caddyfile.

### Added

- `DEPLOY.md`: a step by step guide for GitHub, then Railway.
- `publish-to-github.bat`.
- `.dockerignore`.

## 2.0.0 (30 September 2026): city centre demo rebuild

This rebuilds the cruise prototype v1.0.5 (one 168 KB HTML file) as a small static site for Southampton city centre.

### Added

- **Leg graph routing.** Trails are ordered authored legs. The phone runs a graph search for rejoin, carry on, return to ship and detours around closed or stepped legs. There is also a step-free preference.
- **Verified taps (simulated).**
  - Secured tap URLs (`/t/<id>?e=&c=`), checked by a mock edge function that rejects replayed and forged taps.
  - Short-lived signed tokens gate stamps, reward codes, prize claims and feedback.
  - Browse mode for plain links.
  - A Tap simulator, with replay, in the demo panel.
- **Registers.**
  - What's on (Today, This week) and Things to do, built by an importer from six fixture formats: CSV, iCal, JSON and three HTML recipes.
  - The importer handles expiry, de-duplication across sources, venue matching, links out, and source health.
- **One-tap feedback** at a Loop point: three faces and a 140-character comment, anonymous, queued offline and sent in batches.
- **Level 0 quiet-time nudge** from a busy-day calendar. It gives a reason, can be skipped, and "No thanks" holds for the day. It honours a share setting.
- **Notices.** Closures and information on the home screen; a notice can close legs.
- **Non-cruise visitors.** One button hides every ship feature.
- **Offline.** A service worker with scope-named caches and full-URL keys, zone image precache, an offline banner, and an "Update ready" prompt that never reloads mid-journey.
- **Privacy.**
  - A daily rotating anonymous session key.
  - Prize details kept only in a separate mock store with a deletion date.
- **Demo admin** (`/admin/`):
  - roles, a draft, and publish checks that block on failure;
  - versioned publish and rollback;
  - tag registry with health;
  - trail builder with phone preview;
  - leg editor with a Closed switch and a detour preview;
  - source registry with preview, field and venue mapping, approve, pause and failure simulation;
  - events and notices editor, dashboard (sample data) and audit log.
- **Photos and fonts.** Self-hosted photos (prototype and supplied), drawn placeholders, and subset fonts.
- **Tests.** 18 unit tests and a 17-case Playwright acceptance suite with screenshots.
- **Checks.** Complete strings, publish checks, walk-back times, `node --check`, no dashes, and current generated lists.
- **Deployment.** Caddy config (validated with Caddy 2.8.4), Nixpacks and Railway config, and a fallback Node server. Nixpacks was replaced by a Dockerfile in 2.0.1.

### Changed

- All content moved from code into `data/*.json` and `strings/en.json`, `strings/de.json`.
- Reward and prize codes are issued by the (mock) server, single use, and expire at the end of the day or campaign.
- Walk-back times come from the leg graph instead of fixed numbers.
- Text-only colour tokens were darkened for WCAG AA contrast; brand fills are unchanged.
- Touch targets are at least 44 px. Pinch zoom is no longer disabled. Each screen's main heading is focused on navigation.
- Section headings step down from each screen's h1 without skipping a level. Wide admin tables can be scrolled with the keyboard.
- The service worker revalidates its offline copy (304s) instead of downloading every file a second time on the first visit.
- Page-level security headers (Content Security Policy and others) are sent on pages and the service worker only, not on every asset. The Node server follows the Caddyfile's cache rules and supports ETag revalidation.
- Scripts and the Node server work on Windows and from folders with spaces in their names. `.gitattributes` keeps LF line endings.

### Removed

- Hotlinked images, Google Fonts and every other third-party call.
- Prize codes made in the browser, and hardcoded reward codes.
- The return screen's calculated "km" figure.
