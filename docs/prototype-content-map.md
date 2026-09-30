# Prototype content map

Where each piece of content from the cruise prototype (v1.0.5, one HTML file) ended up in this build, and what was left out. Prototype text is kept word for word. The only changes are:

- the three spelling fixes and the fact corrections listed in `REPORT.md`;
- `<strong>` and `<em>` turned into `**bold**` and `_em_` markup.

Every leg records its origin in its `source` field in `site/data/legs.json`.

## Where things went

| Prototype | This build |
|---|---|
| `I18N.en`, `I18N.de` (146 keys each) | `site/strings/en.json`, `de.json`. The same keys, plus new ones for the new features (343 keys in all). |
| `HUBS` (8 places) | `site/data/tags.json`: the same 8 places with opaque ids, plus 6 new Loop points (Holyrood Church, Tudor House, Southampton City Art Gallery, Mayflower Theatre, Titanic Engineers' Memorial, Bedford Place), marked demo. |
| `HUBS[*].walkBackMin` | Now worked out from the leg graph. `npm run check` confirms the stored value matches the graph. |
| `COLLECTIBLE_HUBS` | `collectible: true` on the same 8 tags. |
| `WALK_DECKS.cruise-terminal` | Legs L001 (cards 1 to 4) and L002 (card 5): the quickest route in from the terminal. |
| `WALK_DECKS.bargate` | Leg L003. |
| `TOURS.history` (Titanic to Tudor) | Trail `history`. Stop titles, subtitles and text go to the trail's `stops`; each stop's directions go to legs L027, L023, L010, L011, L013. `km` 2.3 and `mins` 75 are kept. |
| `TOURS.food` (A Cruiser's Foodie Trail) | Trail `food` (demo). Directions go to legs L037 to L040. `km` 1.8 and `mins` 90 are kept. |
| `TOURS.retail` (Southampton Shopping Loop) | **Not used as a trail** (see below). Stop 2's text is the WestQuay place description. |
| `TOURS.snow-trail` and `SNOW_TRAIL` | Trail `snow` (campaign type) and `site/data/campaigns.json`. The 23 windows keep their names, addresses and numbers. 21 became seasonal tags; the final window on each route is the SeaCity Museum Loop point. |
| `RETURN_DECKS.westquay` | Leg L004. |
| `RETURN_DECKS.old-town` | L007 (card 1) and L006 (cards 2 and 3). |
| `RETURN_DECKS.dancing-man` | L015. |
| `RETURN_DECKS.bargate` | L019 (cards 1 and 2) and L017 (cards 3 and 4). |
| `RETURN_DECKS.oxford-street` | L021 (cards 1 and 2). |
| `RETURN_DECKS.seacity` | L023 (card 1, joined with the history trail's SeaCity to Bargate directions). |
| `REWARDS` (3) | `site/data/rewards.json`. Titles, text, partners and thresholds are kept. The hardcoded codes are gone: codes now come from the (mock) server. |
| `SAFE_SPOTS` (5) | `site/data/safe-places.json`, with `confirmedWithOwner: false` and a review date. The Tourist Information entry was later removed, because no current Southampton tourist office could be found (`REPORT.md`, fact correction 9). |
| Prototype photos (13, hotlinked) | Downloaded once, resized to 480 px WebP, self-hosted in `site/img/photos/`. Listed in `site/data/images.json` with credits where known. |

## Not used, and why

- **The Retail tour** (`TOURS.retail`, "Southampton Shopping Loop": 5 stops, 60 min, 1.4 km). The sample set in the brief names three trails, and this isn't one of them. Its text is still in the prototype and can come back as a trail made from existing legs.
- **Return deck cards that the graph now covers.** These are:
  - `RETURN_DECKS.seacity` cards 2 to 5;
  - all 5 cards of `RETURN_DECKS.cultural-quarter`;
  - `RETURN_DECKS.oxford-street` cards 3 and 4.

  Return routes are now chains of legs. From these places the shortest chain runs through legs that already hold the same streets (for example SeaCity to the Bargate, then the Bargate's return legs), so these cards would have repeated them.
- **`WHATS_ON`.** It was one real Art Gallery exhibition with a hotlinked image. The brief says not to copy from live sites or invent real events. What's on now comes from the importer and fixtures, and is marked demo.
- **`HUBS[*].defaultEntry`, `defaultEntryName`, `defaultEntryMin` and `defaultEntrySteps`.** The home screen's "quickest route in" now comes from `settings.walkIn`, a chain of legs (L001 then L002), so it follows closures.
- **Strings kept but not shown:** `home.eyebrow3`, `home.whatsOnTitle`, `home.whatsOnSub`, `home.whatsOnAll` and `events.sub`.
  - The home What's on block became the "N events on today" link.
  - `events.sub` ("Live from Visit Southampton...") would be untrue above demo listings from several sources.

  They stay in the strings files in case the client wants them back.
- **Two supplied photos aren't placed:**
  - `cruise-terminal.webp` (prototype): the supplied aerial of the terminal is used instead;
  - `ocean-village-aerial.webp` (supplied): Ocean Village has no Loop point in this corridor.

  Both are in `site/img/photos/` and `images.json`, ready to use.

## Photos by place

| Photo | Used for |
|---|---|
| `hero-welcome` (prototype) | Welcome screen |
| `cruise-terminal-aerial` (supplied) | Cruise Terminal place and steps |
| `whirlwind-tour` (prototype) | Home "quickest route in" and three steps |
| `bargate` (prototype) | Titanic to Tudor trail card |
| `bargate-dusk` (supplied) | Bargate place and steps |
| `walls-westquay` (prototype) | Old Town stop on Titanic to Tudor, and steps |
| `walls-watermark` (supplied) | Old Town place and steps |
| `walls-lane-bugle-street` (supplied) | Steps near Bugle Street |
| `westquay-summer` (prototype) | WestQuay stop on the food trail, and steps |
| `westquay-watermark-dusk` (supplied) | WestQuay place and steps |
| `westquay-interior` (supplied) | One WestQuay step |
| `cultural-quarter` (prototype) | Cultural Quarter place and steps |
| `civic-centre-clock-tower` (supplied) | Art Gallery place, Quiet Quarter trail card and steps |
| `seacity-kids` (prototype) | SeaCity Museum place and steps |
| `tudor-house` (supplied) | Tudor House place |
| `dancing-man` (prototype) | Dancing Man place and steps |
| `oxford-street` (prototype) | Oxford Street place and steps |
| `mettricks-coffee` (prototype) | Food trail card and first stop |
| `padharo-meal` (prototype) | Bedford Place place and steps |
| `snow-windows` (prototype) | Snow Windows Trail |
| `victorian-street` (supplied) | Four High Street steps near Holyrood (the photo shows Holyrood Chambers) |
| `ocean-village-harbour`, `stadium-aerial` (supplied) | Things to do cards for places with no Loop point |

Places with no cleared photo use drawn placeholders: Holyrood Church, Mayflower Theatre, Titanic Engineers' Memorial, and the snow windows. In the prototype, Holyrood used the Cultural Quarter photo and the memorial used the Town Quay photo; both were the wrong places.
