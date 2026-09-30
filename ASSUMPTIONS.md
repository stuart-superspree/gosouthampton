# Assumptions

Where the brief was ambiguous or two instructions pulled against each other, I took the simpler, calmer option and listed it here.

## Scope and content

1. **The one-pager wasn't attached.** I worked from the prototype source, the technical specification and the executive summary.
2. **Four trails, not three.** The sample set asks for Titanic to Tudor, a food and drink trail (marked demo) and the Snow Windows Trail. The level 0 nudge needs a quieter authored route to suggest, so I added a short fourth trail, **The Quiet Quarter** (marked demo), which avoids the Old Town. That makes three evergreen trails, matching the prototype's "Three curated walks" line.
3. **The prototype's Retail tour isn't in the sample set.** Its text is listed in `docs/prototype-content-map.md` so it can come back as a trail.
4. **14 Loop points and 40 directed legs**, within the brief's 30 to 40. The 23 Snow windows are also tags (21 new ones, with SeaCity Museum as the final window on both routes), because a window stamp and the prize now need a verified tap.
5. **Leg walk minutes and step texts for new legs are invented** and every leg is marked "Not yet walked (demo)". Where the prototype had text for a walk, that text is used word for word.
6. **Walk-back times now come from the leg graph** (shortest chain to the terminal), so a closure changes them. For the Bargate this gives 12 minutes rather than the prototype's 16, and 21 rather than 26 for SeaCity. The warning rule is kept exactly: warn when minutes left are at or below walk-back plus 15.
7. **Collectible stamps stay at the prototype's eight places**, so the thresholds of 3, 5 and 8 and "All stamps collected" still read correctly.
8. **Reward partners and the food trail name real businesses.** This is the client's prototype content, so I kept it, marked demo, with the note "partner offers are examples and not yet agreed".

## Visitor experience

9. **Cruise or not.** I added one button, "I'm not on a cruise today", to the all-aboard screen. This keeps the prototype's "Step 2 of 2". A visitor who picks it never sees the countdown, the Back to ship button, the return route or the "Lost or stranded" help section. A home-screen link lets them switch to cruise mode later.
10. **Brand lockup.** The header keeps "Visit Southampton" from the prototype. The subline reads "Cruise Day Out" for cruise visitors and "City Centre" for everyone else. The client's brand for this product is an open question.
11. **The What's on subtitle.** The prototype's "Live from Visit Southampton..." would be untrue above demo listings drawn from several sources. The string is kept in the strings file but not shown; a new neutral line is shown instead.
12. **The return-screen distance** ("... km") was dropped. The prototype worked it out as minutes × 0.08 rather than measuring it, and the brief asks for walk minutes only on route overviews.
13. **Arrival.** A verified tap at the next stop advances the trail and gives a stamp. The prototype's "I'm here. What's next?" button still works as a fallback for a broken tag, but it gives no stamp.
14. **"Try this quieter route"** opens the quieter trail's overview, so the visitor sees why and chooses to start it. It never switches their route without asking.
15. **The buddy link** shares the trail, the stop and the cruise all-aboard time. It carries no personal data and grants no stamps. The receiver keeps their own language.
16. **Prize draw.** Personal details go only to the separate mock prize store, with a deletion date shown (campaign end plus 90 days, set in data). I added an "18 or over" line because the specification requires it.

## Simulation and technical

17. **Taps are verified by a mock edge function in the browser.** The demo key is therefore visible in `mock-edge.js`, which is labelled. This proves the behaviour, not the security; the live build moves it to a real edge function.
18. **The events register is rebuilt in the browser** from the fixtures, standing in for the server's scheduled import. Fixture dates are relative to today, so the demo never looks stale. `data/events.json` and `data/places.json` are the importer's snapshots and the fallback.
19. **iCal and JSON fixtures are new-source candidates, not starting sources.** None of the six starting sources publishes a feed, so they map to a CSV export (Visit Southampton events) and three page recipes (things to do, art gallery, Mayflower). The iCal ("museums and galleries") and JSON ("city centre events") fixtures show a Tier 1 feed being added in the admin. Two of their events deliberately duplicate existing ones, to show de-duplication.
20. **Pausing a source hides its records.** This is the safe reading if permission is withdrawn.
21. **Admin changes live in this browser** (`localStorage`). Publishing reaches a visitor tab in the same browser, not other devices.
22. **Roles.** Author: edit drafts. Reviewer: edit, publish, roll back, manage sources. BID admin: all of those plus tag status. Council viewer: read only.
23. **Hosting is Caddy on Railway, built from a Dockerfile.** Railway has made Railpack its default builder and deprecated Nixpacks, and it always uses a Dockerfile when one is present. So the site ships as a pinned Caddy image (2.11.4), which doesn't depend on either builder. This is a new Railway service, separate from the cruise demo. A zero-dependency Node server (`serve.mjs`) with the same rewrites and headers is the local runner and the fallback. The site must be served from the domain root (all paths are absolute, so `/t/<id>` works).
24. **Photos.** The 13 prototype photos and the 12 supplied are self-hosted, resized to 480 px WebP and credited where a credit is known. All are marked "licence to confirm" in `data/images.json`. Places with no photo use drawn placeholders.
25. **Fonts** are self-hosted from the OFL releases (via Fontsource), cut down to Latin characters and the weights used.
26. **The demo panel and the admin are English only.** They're presenter tools, not visitor screens.
