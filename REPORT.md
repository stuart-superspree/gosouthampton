# Southampton RouteLoop city centre demo: build report

30 September 2026. Version 2.0.0.

**Latest update (same day).** Two things changed in the last update:

- **Facts corrected.** The wrong facts in the prototype text have been corrected in English and German. See "Fact corrections".
- **Ready to deploy.** The site now deploys to Railway from a Dockerfile. See `DEPLOY.md` for the step by step guide.

## Summary

The cruise prototype (v1.0.5, one 168 KB HTML file) is rebuilt as a static site of small ES modules, with every piece of content in JSON. It proves the six claims in the brief, as follows:

1. **Trail-first guidance from legs.** A graph search handles rejoin, return and detours.
2. **Verified taps.** Simulated, and a replayed tap is rejected.
3. **Registers built from several sources.** Old records expire, duplicates merge, and each record links back to its source.
4. **Anonymous one-tap feedback.** It's queued while offline and sent later.
5. **The level 0 quiet-time nudge.**
6. **An admin** that edits content, closes legs, adds sources, publishes and rolls back.

**Results**

| Check | Result |
|---|---|
| Acceptance tests (Chromium, 390 × 844) on the Node server | **17 of 17 pass** (`tests/out/results.md`) |
| The same tests on the production Docker image (Caddy 2.11.4, run with `PORT` set as Railway sets it) | **17 of 17 pass** (`tests/out/results-caddy.md`) |
| Unit tests | 18 of 18 pass |
| `npm run check` | All pass. One warning: all 40 legs are "Not yet walked" because they're demo legs. |
| axe-core on 13 visitor views and 2 admin views | No violations of any level |

## What was kept

- **All 15 screens and their order:**
  - welcome, language, all-aboard time, home;
  - arrived, trail overview, trail step, return to ship;
  - what's on, passport, help;
  - the four Snow Windows Trail screens.
- **Brand tokens:** colours, Inter and Playfair Display, radii, gradients and card styles. Only text colours were darkened, for contrast.
- **Mechanics.** These all work as before:
  - the all-aboard countdown with its amber and red states;
  - the warning rule (warn when minutes left are at or below walk-back plus 15);
  - stamps at the same 8 places, with rewards at 3, 5 and 8;
  - the passport;
  - the Snow Windows Trail with two routes, window stamps and a prize entry;
  - the help screen (lost, safe spots, Ask for Angela, buddy link, after dusk, emergency);
  - the step-free option, English and German, Web NFC on Android, and old `?tag=` links (now browse mode).
- **Tone and copy.** Every existing string is kept as written, apart from the three spelling fixes and the fact corrections below. `docs/prototype-content-map.md` shows where each piece of prototype content went and what wasn't used.

## What changed

The full list is in `CHANGELOG.md`. In short:

- **Legs, not decks.** 14 Loop points and 40 directed legs. The prototype's walk and return decks became legs, word for word where they existed.
  - Trails are ordered legs.
  - Rejoin, carry on, return to ship and detours are shortest chains of legs.
  - Walk-back times now come from the graph, so a closure changes them.
- **Taps.** A secured tap URL is checked by a mock edge function: a replayed or forged tap is refused. A valid tap gives a 10-minute signed token, and only a token earns stamps, codes, prize entries or feedback. A plain link is browse mode.
- **Registers.** What's on (Today, This week) and Things to do come from an importer over six fixture formats:
  - CSV, iCal and JSON;
  - three HTML recipes.

  The importer handles expiry, de-duplication across sources, venue matching, source health and links out. It keeps the last good copy when a source fails.
- **New visitor features:**
  - one-tap feedback;
  - the quiet-time nudge;
  - notices, which can close legs;
  - an "I'm not on a cruise today" option that hides every ship feature;
  - the offline banner and an "Update ready" prompt;
  - a shared phone reset;
  - a daily rotating anonymous session key.
- **Demo admin** at `/admin/`:
  - roles, drafts, publish checks, versioned publish and rollback;
  - tag registry, trail builder with preview, leg editor with Closed switch and detour preview;
  - source registry with preview, mapping and health;
  - events and notices, a dashboard of sample data, and an audit log.
- **No third parties.** Photos, fonts and code are all self-hosted. Google Fonts, the hotlinked images and every other external call are gone.
- **Hosting.** A Dockerfile that builds a small Caddy image for Railway, and a zero-dependency Node server with the same rules for local use.

### Changes made in the final passes

- **Heading levels.** Section headings now step down from each screen's h1 without skipping a level. This cleared the last axe findings (heading order on 10 visitor views, and an empty table header in the admin).
- **Admin tables.** Wide tables can now be scrolled with the keyboard.
- **Offline copy.** The service worker now revalidates its offline copy instead of downloading it again. Before, a first visit fetched every app file twice. Now the second request is a 304 "not changed" reply, which cut first-visit data from 438 KB to 244 KB.
- **Security headers.** The Content Security Policy and other page-level headers are now sent only on pages and the service worker, not on every script, font and image. This saves about 400 bytes per request.
- **Node server.** It now follows the Caddyfile's cache rules and answers `If-None-Match` with a 304.
- **Deployment files.** Railway has made Railpack its default builder and deprecated Nixpacks, so the Nixpacks setup was replaced.
  - A `Dockerfile` now pins Caddy 2.11.4. It refreshes the offline lists during the build, so a deploy is never stale, and it checks the Caddyfile.
  - `railway.json` points Railway at the Dockerfile and adds a health check.
  - `.dockerignore` keeps the image to about 25 MB.
  - `publish-to-github.bat` sends the folder to GitHub with a double-click.
  - `DEPLOY.md` explains every step.
  - The image was built from a fresh clone of the repository, and the full acceptance suite passed against it.
- **The admin's phone preview no longer steals the cursor.** The trail builder's live preview is the visitor app in a frame. When it finished loading, it moved focus to its own heading, which could pull the cursor out of whatever field the admin was typing in. In a check typing like a person, 4 of 10 attempts lost text. The visitor app now never moves focus when it's inside another page: 0 of 15 lost. This was also why the publish test failed now and then. That test now types like a person and checks nothing was lost.
- **"Update ready" shows new content at once.** Before, it waited for What's on to be rebuilt first, which could take a few seconds.
- **The iCal demo event no longer depends on the time of day.** Its family trail now runs all week. Before, both of its events for today had finished by 4pm, so the "add a source" demo showed nothing new in the afternoon.
- **Windows and spaces in folder names.** The scripts and the Node server now work on Windows and from a folder with a space in its name, such as "App building". A `.gitattributes` file keeps line endings as LF, so the generated lists still match after a Windows checkout.

## Copy fixes

These are the only changes to existing text.

| # | Where | Before | After | Why |
|---|---|---|---|---|
| 1 | What's on header subtitle and screen label (`brand.subEvents`, `screen.events`) | Whats on today | What's on today | Missing apostrophe. It was hardcoded in the prototype's HTML. |
| 2 | Food trail, stop 1 subtitle | Specialty coffee · Above Bar | Speciality coffee · Above Bar | UK spelling |
| 3 | German, rewards subtitle (`passport.rewardsSub`) | geniessen | genießen | German spelling |

The prototype had no em or en dashes in its copy, so none had to be replaced.

## Fact corrections

Each claim was checked against the sources listed. Only the wrong part was changed, in English and German. The German Titanic text gives no date, so it didn't need changing.

| # | Where | Was | Now | Source |
|---|---|---|---|---|
| 1 | Titanic Engineers' Memorial (place and trail stop) | "as RMS Titanic went down on 10 April 1912" | "... on 15 April 1912" | The memorial's inscription reads "remaining at their posts 15th April 1912". The ship sailed on 10 April. ([Wikipedia](https://en.wikipedia.org/wiki/Titanic_Engineers%27_Memorial)) |
| 2 | Old Town place name, and the trail stop title | "Old Town · QE2 Anchor", "Town Walls & QE2 Anchor" | "Old Town · Town Walls", "Town Walls" | The QE2 anchor is outside Holyrood Church on the High Street, not at the town walls. ([Historic Southampton](https://historicsouthampton.co.uk/old-town-walk/), [Britain Express](https://www.britainexpress.com/counties/hampshire/churches/holyrood-church.htm)) |
| 3 | Old Town text | "...At their foot, the anchor of the original RMS Queen Elizabeth 2, a liner built in Southampton." | That sentence removed | The anchor isn't there. The QE2 was built on the Clyde, not in Southampton; Southampton was her home port from 1969 to 2008. |
| 4 | Holyrood Church (place and trail stop) | "Plaques mark the Titanic crew, the merchant navy, and the Mayflower's 1620 voyage." | "Memorials mark the Titanic crew and the merchant navy, and outside stands an anchor from the QE2." | No source lists a Mayflower plaque at Holyrood; the Mayflower Memorial is on Western Esplanade. The QE2 anchor was given by Cunard in 2010. ([Wikipedia](https://en.wikipedia.org/wiki/Holyrood_Church), Britain Express, Historic Southampton) |
| 5 | Dancing Man (place, both trails, safe place) | "13th century", "wool merchant's hall" | "14th century", "wool warehouse" | The Wool House was built in the 14th century to store wool for export. ([Wikipedia](https://en.wikipedia.org/wiki/The_Wool_House), [Dancing Man Brewery](https://dancingmanbrewery.co.uk/wool-house-history/)) |
| 6 | Bargate (place and trail stop) | "Look up: the lions and Tudor coat of arms are originals." | "Look out for the lead lions, added in the mid 1700s, and the heraldic shields on the north side." | The lead lions replaced wooden ones in the 18th century, so they aren't originals. The north side carries heraldic shields; no source mentions a Tudor coat of arms. ([Wikipedia](https://en.wikipedia.org/wiki/Bargate)) |
| 7 | Help screen, police line | "Hampshire Police, non emergency." | "Hampshire and Isle of Wight Constabulary, non emergency." | The force's legal name changed in 2022. ([ITV News](https://www.itv.com/news/meridian/2022-11-16/police-force-name-changed-to-hampshire-and-isle-of-wight-constabulary)) |
| 8 | WestQuay place text | "Cineworld" | "Showcase Cinema de Lux" | The cinema at WestQuay Watermark is Showcase Cinema de Lux. ([WestQuay](https://www.westquay.co.uk/see-and-do/showcase-cinema-de-lux)) |
| 9 | Help screen, safe places | "Tourist Information at the Civic Centre... Open weekdays from 10am." | Entry removed | Neither Visit Hampshire nor Visit South East England lists a tourist information centre in Southampton; the only listings found were old directory entries. A safety screen shouldn't send people to an office that may not exist. See open question 12. |
| 10 | Walk, Bargate to Old Town (L010) | "Pass through the Bargate arch and turn right onto Westgate Street." | "From the Bargate, head west along Bargate Street to the town walls." | Westgate Street is at the West Gate, off Bugle Street. Bargate Street runs west from the Bargate along the wall. (Historic Southampton; [Historic England](https://historicengland.org.uk/listing/the-list/list-entry/1340005)) |
| 11 | Walk, Oxford Street to Holyrood (L021) | "To High Street" and "Roofless ruin on your right" | "Then along Bernard Street to the High Street" and "...on your left" | Oxford Street runs from the Bernard Street and Orchard Lane crossing to Terminus Terrace, so it doesn't reach the High Street. Holyrood is on the east side of the High Street, which is on your left heading south. |
| 12 | Walk, Cultural Quarter to Oxford Street (L037) | "Oxford Street branches left after 300m." | "At Holyrood Church turn left into Bernard Street, then follow it to Oxford Street." | As above. This also removes one of the metre distances. |
| 13 | Walk, Holyrood to Oxford Street (L022, written for this build) | "Walk a short way down the High Street and turn left into Oxford Street." | "Walk east along Bernard Street to the Orchard Lane crossing, where Oxford Street begins." | As above. |

Checked and left alone, because the sources support them:

- the Titanic engineers' number (35, per Visit Southampton);
- Holyrood bombed in 1940;
- the Bargate built around 1180;
- the walls "among the best preserved";
- SeaCity's 549 (Encyclopedia Titanica gives 549 Southampton victims);
- SeaCity open daily;
- Mettricks Guildhall, Zizzi and The Real Greek at WestQuay;
- the QE2 Mile.

The corrected walk texts come from maps and written sources, not from walking them. Like every leg, they still need walking before launch.

## Content to check with the client (not changed)

These look risky but can't be settled from here.

1. **Reward 3's web address.** It sends people to `visitsouthampton.co.uk/explorer`. No such page could be found, so the address looks invented.
2. **Taxi ranks.** Help says black taxis queue "at the WestQuay south entrance and beside the Civic Centre". Confirm with the council's list of ranks.
3. **Safe places.** Check WestQuay customer services' location ("ground floor, central concourse") and each venue's agreement to be listed; none are confirmed with the owner yet.
4. **Ask for Angela.** Help says Southampton pubs and bars take part. It's a national scheme, but participation varies by venue.
5. **Snow Windows Trail.** The dates (29 November to 4 January, 10am to 5pm) and the 23 named windows are the prototype's. Confirm them for this year's campaign.
6. **Metre distances.** Two step texts still give distances in metres ("within 200m" and "300m past the ferry terminal"); a third went with fact correction 12. The brief prefers walk minutes; see open question 1.
7. **Business names.** Mettricks, Zizzi, The Real Greek, John Lewis, Apple, and the three reward partners are all named. They're marked demo with "partner offers are examples and not yet agreed", but each business should agree before any public use.
8. **Photos in the wrong places.** The prototype used the Cultural Quarter photo for Holyrood and the Town Quay photo for the Titanic memorial. Both now use drawn placeholders until cleared photos arrive.
9. **Cruise-only lines.** "Before your ship sails" (welcome) and "Your Cruise Day Passport" are cruise-specific. They're kept as written, but non-cruise visitors see them too.
10. **Snow disclaimer.** It names Visit Southampton, but the specification makes the BID the data controller.
11. **German gaps in the prototype:**
    - `events.eyebrow` reads "Heute geöffnet" ("open today") against the English "Happening today".
    - `snow.stopsSub`, `snow.disclaimer` and `snow.confSub` say less than the English.
    - "Hauspale Ale" (food trail) looks like a typo.
12. **New German text.** All German strings written for this build need a native speaker's review.

## Speed and size

### How it was measured

- **Tools:** Playwright with Chromium, in a fresh browser context with the cache disabled.
- **Network:** Chrome DevTools throttling at Lighthouse's "Slow 4G" (150 ms round trip, 1.6 Mbps down, 750 kbps up), with the CPU slowed 4 times.
- **Servers:** both run locally. One is the Node server (gzip). The other is the production Docker image, Caddy 2.11.4 with the production Caddyfile (zstd, which Chromium accepts).
- **Timing:** from just before navigation until the app has set its ready flag and the welcome heading is visible.
- **Bytes:** the transfer size Chromium reports for each response, which includes HTTP/1.1 headers. Body sizes were worked out separately by gzipping each requested file at level 6.
- **Units:** KB means 1,024 bytes.
- **Runs:** each figure below comes from five runs of the final build.

### Results

| Measure | Node server | Docker image (production) |
|---|---|---|
| First useful screen (welcome ready) | 2.22 to 2.38 s | 2.19 to 2.27 s |
| First contentful paint | 1.00 to 1.04 s | 1.08 to 1.14 s |
| Transferred, first page load, excluding images (56 requests, headers included) | 169.6 KB | 178.7 KB |
| Images on the welcome screen | 35.3 KB | 35.3 KB |
| First visit including the offline copy (125 requests; 56 of them are 304s) | not measured | 246.3 KB of bodies |

The acceptance test fails if the first useful screen takes 3 s or more.

**Body sizes (gzip) for the first page load**

| Part | Size |
|---|---|
| App code and markup | 70.0 KB |
| Data | 19.3 KB |
| Strings | 6.0 KB |
| Fonts | 52.8 KB |
| Demo fixtures | 2.8 KB |
| Images | 35.0 KB |

App code, data and strings together come to 95.4 KB, or 148.2 KB with fonts.

**Demo-only code.** About 15.6 KB gzip of the page load is code a live build wouldn't send to phones: the mock server, mock edge, HMAC, the import job, the importer, the recipe reader and the fixtures.

**The prototype, for comparison.** It was 167,685 bytes of HTML, or 36.4 KB gzipped. On top of that it loaded Google Fonts and 32 hotlinked image URLs from other servers, which weren't measured. The rebuild's code, data and strings are about 2.6 times the prototype's file. The extra is the graph, importer, registers, tap verification, offline support and the mock server.

**The offline copy.** The first-visit figure is for the Docker image. It was measured with a small counting proxy, because requests made by the service worker don't show up in the page's DevTools session. It counts bodies only.

**The images in your folder are a little larger.** When the files were saved into your folder, each image gained content-credential (C2PA) metadata. All 32 images got it: about 6 KB on each photo, and 8 KB on the small SVG icon. In total that's 583 KB to 773 KB across the folder. The measurements above were taken before the save. For a site deployed from your folder:

- the welcome-screen photo is 40.6 KB rather than 35.0 KB;
- the first visit with the offline copy is up to about 19 KB larger.

Because the images changed, `scripts/sw-manifest.mjs` was run again in your folder, so the service worker's version matches its files there. The Docker build now also runs it, so a deploy always matches its files.

### Sanity checks

- **Headers.** Bodies add up to 185.9 KB, against 204.9 KB transferred on Node. That leaves 19.0 KB, or about 350 bytes of headers per request, which is normal for HTTP/1.1. On the Docker image it's about 500 bytes a request, because Caddy also sends ETag, Last-Modified and Accept-Ranges.
- **Timing.** At 1.6 Mbps, 205 KB takes about 1 s just to transfer. Add three or four dependency steps of 150 ms each, then the scripts running on the slowed CPU, and 2.2 to 2.4 s is what you'd expect.

### What would have to be true for these to be wrong

- **Real connections are slower to open.** The servers were local. DevTools throttling adds delay to each request but doesn't model DNS lookup, TCP and TLS setup, or packet loss. A real first visit over HTTPS could take roughly 0.5 s longer.
- **The host may be faster than HTTP/1.1.** If Railway serves HTTP/2 or HTTP/3, headers are compressed and 56 requests share one connection. Transfer sizes would then be lower, and time to the first screen probably shorter. I didn't check this on Railway.
- **A slowed desktop CPU isn't a phone.** A four-times-slowed sandbox CPU is only a stand-in for a mid-range Android. Real phones vary a lot.
- **Older browsers get gzip.** Browsers without zstd get gzip from Caddy. For those, the body figures above apply.
- **Screen readers weren't tested.** The accessibility results come from axe-core, which finds only some WCAG problems. The views it checked had no issues. No testing was done with VoiceOver or TalkBack.

## Acceptance tests

Every test passed on both servers. The evidence for each is in `tests/out/results.md`.

| # | Test | What it proves |
|---|---|---|
| 1 | Valid tap | A secured tap verifies, gives a stamp and opens the place |
| 2 | Replay | The same tap again is refused and gives no stamp |
| 3 | Plain link | Browse mode works with no stamp. A forged reward claim is refused. |
| 4 | Trail run | Titanic to Tudor runs from start to finish, leg by leg |
| 5 | Rejoin | Off trail, "Rejoin" and "Carry on" match the graph (12 min, 3 min) |
| 6 | Closed leg | Closing a leg in the admin preview gives the same 23-minute detour as the app. With no alternative, the app says so. |
| 7 | Return to ship | The countdown, the warning, and walk-back from all 14 places. Non-cruise mode hides every ship feature. |
| 8 | Registers | Today shows only today's events in London time. This week covers 7 days. Expired rows are dropped. |
| 9 | Add a source | The iCal fixture previews, approves, adds 4 events and merges 2 duplicates |
| 10 | Quiet nudge | It shows on a busy day and stays hidden after "No thanks", even after a reload |
| 11 | Offline feedback | Feedback is queued while offline and sent when back online |
| 12 | Offline | After one online visit, a reload with no signal still works, including the trail step |
| 13 | Languages | German has every key, and no English shows on German screens |
| 14 | Accessibility | axe-core finds nothing. The keyboard journey works. No home touch target is under 44 px. |
| 15 | Speed and size | See above |
| 16 | Shared phone reset | Language, ship time, stamps and trail are cleared, with a new session key |
| 17 | Publish and rollback | Typing in the trail builder isn't interrupted by the preview. A published title reaches an open tab as "Update ready". Rollback restores it. |

**Screenshots** (390 × 844) are in `tests/out/`. The `screen-*` files cover:

- welcome, home, trail step, what's on;
- return to ship, passport, Snow Windows Trail;
- the admin source registry and trail builder.

The `evidence-*` files show the rejoin, closed-leg detour, nudge, German home, return warning, today's listings and approved source.

## Known gaps

- **Simulation only.**
  - Tap checks, codes, feedback storage and imports all run in the browser. The mock key can be read in `mock-edge.js`, which is labelled as a simulation.
  - Admin changes live in one browser's storage. Publishing reaches other tabs in that browser, not other devices.
- **Not built:**
  - **The reviewer queue.** Each source has a trust setting, but records from "review" sources publish straight away.
  - **The campaign pack** (a nice-to-have). The audit log is built.
  - **Image upload in the admin.** You can pick from the bundled photos.
  - **A deletion job for prize data.** The admin shows the deletion date, but nothing deletes the data.
- **Language.** The admin and the demo panel are English only.
- **Snow answers stay on the phone.** Snow Windows Trail answers aren't sent anywhere; only the prize contact details go to the separate mock store.
- **Retail tour.** It isn't included (see the content map).
- **Testing.**
  - Only Chromium was tested. iOS Safari and Android Chrome need checking on real phones, including real NFC tags.
  - The Railway deploy itself hasn't been run from here. The Docker image was built from a fresh clone of the repository, run with `PORT` set as Railway sets it, and passed the full suite locally.

## Assumptions

There are 26 assumptions. They're listed in `ASSUMPTIONS.md`. The ones most worth reading:

- a fourth, quieter trail was added for the nudge;
- 14 Loop points;
- walk-back times come from the graph;
- the "not on a cruise" option;
- hosting on Caddy, built from a Dockerfile.

## Open questions

**From the brief**

1. **Step-card distances.** Should step cards show distances as well as minutes? Two prototype texts still use metres; everything new uses minutes only.
2. **Session key.** Does the daily anonymous session key need a consent notice under PECR, or does it count as strictly necessary?
3. **Photos.** Which photos are cleared for use? All 25 are marked "licence to confirm" in `data/images.json`. Four places still need a photo:
   - Holyrood Church;
   - Mayflower Theatre;
   - Titanic Engineers' Memorial;
   - the snow windows.
4. **Loop point count.** How many Loop points go into Stage 1, and which ones? The demo has 14 (the specification proposes 30 to 40). The graph and admin don't depend on the count.
5. **More languages.** Which languages come next? Italian, Dutch, Spanish and French are set up but switched off, waiting for translations.

**Raised during the build**

6. **Brand.** Should the header say Visit Southampton (as in the prototype) or Go! Southampton, and does it change for non-cruise visitors?
7. **Data controller.** Who is the named data controller in the privacy and prize text: the BID, as the specification says, or Visit Southampton, as the snow disclaimer says?
8. **Cruise wording.** Should the welcome and passport lines that assume a cruise get a city-centre version?
9. **Photo licences.** Some prototype photos come from the Visit Southampton image library, and some supplied photos look like stock (one carries a photographer's name in its metadata). Who holds the licence for this use?
10. **Retail tour.** Should it come back as a fourth evergreen trail?
11. **Named businesses.** Who confirms the businesses named in trails and rewards, and the offers?
12. **Visitor information.** Is there a staffed visitor information point in the city centre that should be listed on the help screen? (The prototype's Civic Centre tourist office has been removed; see fact correction 9.)
