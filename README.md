# FundedCity · www.thefundedcity.com

## Deploying the website

`npm run build:site` (or `node scripts/build-site.mjs`) builds the public website into **`site/`**: plain static files with hashed assets, icons, a social preview image, `robots.txt`, a 404 page and host settings (`site/vercel.json` for Vercel, `site/_headers` for Netlify or Cloudflare Pages). `site/` is committed, so the host needs no build step.

**Vercel (recommended):**

1. Go to vercel.com and choose *Add New → Project*, then import the GitHub repository.
2. Set **Root Directory** to `site`, set Framework Preset to *Other*, and leave the build command empty. Deploy.
3. Under *Project → Settings → Domains*, add `www.thefundedcity.com` and `thefundedcity.com`, and redirect the bare domain to `www`.
4. At Network Solutions (*My Account → Domains → thefundedcity.com → Manage → DNS*), add the records Vercel shows on each domain card:
   - For `@`: an **A** record (usually `76.76.21.21`).
   - For `www`: a **CNAME** to the project-specific `…vercel-dns…` target.
   - Delete any old A or CNAME records for `@` and `www` that point elsewhere (parking pages).
   - Changes can take up to a couple of hours. Vercel issues the HTTPS certificate on its own.
5. Every later `git push` to the main branch redeploys the site.

**Public preview mode.** The website build sets `__PUBLIC_SITE__` (see `src/where.ts`), which changes four things:
- Nobody gets owner tools, so founders and official news are read-only.
- Shared features (chat, posts, listings, reviews, votes, AI guides) say they open at launch and keep data in the visitor's browser for now.
- The header shows a PREVIEW tag.
- `PREVIEW = true` in `scripts/build-site.mjs` keeps search engines out (`noindex` + `robots.txt`). Set it to `false` at full launch.

**Hidden until launch.** With `HIDDEN = true` in `scripts/build-site.mjs`, www.thefundedcity.com shows a "Coming soon" page, and the city lives at a private link: `/<CITY_PATH>/`. On launch day, set `HIDDEN = false` (and `PREVIEW = false`), run `npm run build:site` and push.

**Frozen demo for prop firm marketing teams:** `https://www.thefundedcity.com/enter-zzty7pf84p/` is a snapshot from 28 Oct 2026. It's kept in `public/enter-zzty7pf84p/` with its own copy of the code, so later builds never change it. New work goes to the private `/<CITY_PATH>/` link.

**Full launch (next):** real accounts and shared data through Supabase (an adapter behind `src/cloud.ts`), and the AI guides through a server function that holds the Anthropic API key. After that, payments for The Plaza.

# FUNDEDCITY — POC

An interactive, isometric 3D city for prop-firm traders, built with **Vite + TypeScript + Three.js**.
Visual/technical proof of concept only — no auth, database, payments, backend or real APIs.

> The question this prototype answers: *"Would a trader see this and want their own tower?"*

## Run it

```bash
npm install
npm run dev        # → http://localhost:5173
npm run build      # type-check + production build into dist/
```

No Vite available (offline machine)? `node scripts/dev-esbuild.mjs serve` runs the same app with esbuild only.

## What's in the city

- **Capital Square** at the centre: fountain plaza, flags, flower beds and the Capital Gardens.
- **Corporate Ring** around the square, 25 prop-firm HQs grouped by category:
  - **CFD row (north):** FTMO, FundedNext, FundingPips, Alpha Capital, TradeifyFX, FTM, Maven, Hola Prime, MFF, E8 Markets
  - **Futures row (south):** FTMO Futures, Alpha Futures, FundedNext Futures, Tradeify, Lucid, MFF (MyFundedFutures), Topstep, TPT, Blue Guardian, E8 Futures
  - **Perps column (east):** Breakout, Vest, MFP, Tradeify Perps, Propr
  - **City Spaces (west):** Premium Plot, Billboard, Firm HQ site (leasable)
  Every HQ has a rotating, two-sided **live signboard** (wordmark + LED ticker with live city stats).
  Walking into an HQ **unlocks** its plans, services and offers (`src/firms.ts`, researched 26 Oct 2026, sources cited in-app).
- **Trader sectors** outside the ring: CFD (north), Futures (south), Perps (east), Multi-Assets (west).
  Traders with any verified payout from $1 get a tower; level depends on payouts.
- **Houses** (south-east): terraced 1-level homes for registered traders without a payout yet.
  Signing up gives your character the free house (gold door and pennant) and a "Walk home" option.
- Central Park (NW), Harbour (NE), Waterfront & Pier (SW), traffic, streetlights, boats.

### Firm logos

Signboards show each firm's name as a wordmark. Official logos are trademarks, so they are not bundled.
Once a firm provides its brand kit, set `logo` on that firm in `src/firms.ts` (a same-origin file such as
`/logos/ftmo.svg` in `public/`, or a data URI) and the rooftop sign and card use it automatically.

## Controls

| Action | Input |
|---|---|
| Orbit 360° | left-drag / one-finger drag, or the ⟲ ⟳ and Orbit buttons |
| Pan | right-drag, Shift+drag / two-finger drag |
| Zoom | scroll / pinch |
| Select | click a tower, HQ or city space |
| Deselect | click empty space or ✕ |
| Reset camera | "Reset view" |
| Search | type in the header, ↑/↓ + Enter |

## Your character

On first visit a **character page** opens: pick skin tone, hair style and colour, clothes and colour, an
accessory and a display name, with a live 3D preview you can drag to turn. Then either:

- **Play as guest** — explore straight away; the character lasts for this browser tab only.
- **Sign up & save** — a demo sign-up (display name, email, password, terms). The member profile, character and
  discoveries are kept in this browser's local storage. Nothing is sent to a server and the password is never stored.

Members return straight into the city. The HUD (left) lets you edit the character, sign up later, see
discovery progress and pick a place to walk to.

### Walking and discovery

- Click the ground to walk there, or use **Walk here** on any tower, HQ or city-space card, or the HUD's
  **Walk to** list (which also includes landmarks). WASD / arrow keys walk directly, relative to the camera.
- Routes are found with A* over a walkable grid around building footprints, the fountain, the pond and the
  gazebo, then smoothed. A dashed route and a destination ring show where you are going.
- **Skip walk** jumps to the destination; places you pass on foot are only discovered when you actually walk by.
- 23 places can be discovered (18 buildings and 5 landmarks); each one shows a toast and an activity entry.
- The camera follows while you walk; a blue x-ray silhouette shows your character behind buildings.

## Media District

North-east of the Perps sector, replacing the old harbour.

- **Theater:** an open-air bowl with an audience and a giant screen showing what's next (or LIVE) with a countdown. Under the screen run a **MARKETS** price tape and a red **URGENT** news crawl. Click the screen to open the Theater tab.
- **Media Center:** the newsroom with a rooftop **economic calendar** board (next high- and medium-impact releases, live countdowns).
- **Heads-up pylon:** the next major event and the one after it, counting down.
- **MEDIA chip** in the top bar: the next high-impact event and its countdown; opens the Media Center.
- **Media Center panel** (tabs):
  - *Calendar:* This week / Today, ForexFactory-style impact colours (red high, orange medium, yellow low, grey non-economic), times in your zone, GMT or New York, forecast/previous, and per-row countdowns.
  - *Theater:* the week's broadcasts (FOMC, ECB, BoC, BoJ, UK Budget, White House) with YouTube and official-stream links. You can also paste any YouTube link. When you run the project yourself, it plays inside the theater. The shared artifact page can't embed YouTube, so links open on YouTube instead.
  - *Markets:* FX majors, indices, commodities, crypto, rates and VIX with sparklines.
  - *News:* URGENT items first, each linked to its source, plus links out to ForexFactory, Investing.com, Reuters, Bloomberg, CNN, BBC and Al Jazeera.
- **Heads-up alerts:** a toast 60, 15 and 5 minutes before each high-impact release and at release time, plus one on arrival if a major event is less than 24 hours away.

### Data: snapshot now, live feeds later

`src/media.ts` holds a researched snapshot for the week of 26–30 Oct 2026: calendar, broadcasts, headlines and quote levels, with sources listed in the panel footer. Countdowns run on the real clock. Prices move with a labelled, *indicative* random walk around the snapshot; they are not live quotes.

To go live, implement the `MediaFeed` interface (`calendar()`, `broadcasts()`, `quotes()`, `headlines()`, optional `tick()`) against your provider and call `setMediaFeed(feed)`. The 3D screens, tapes, chip, alerts and panel all read through it. ForexFactory, Investing.com, Reuters and Bloomberg don't offer free browser-side APIs, so a real feed needs a small backend or a licensed data API.

## v23: the official FundedCity logo

The official logo (Oct 2026) is a blue map pin holding an isometric city block. One face has windows, the other has gold rising payout bars, and a gold "verified" check sits on the pin. Beside it is the **FundedCity** wordmark, with "City" in royal blue, and the line THE CITY OF FUNDED TRADERS.

- **Files:**
  - The original artwork is `public/brand/fundedcity-official-logo.png`.
  - `src/brand.ts` holds a vector redraw (`markSvg`, a one-colour `mono` variant, `markDataUrl`) plus `logoTexture()` for 3D signs and flags.
  - Colours: navy `#13213f`, royal `#2f6bff`, gold `#e0ad48`.
- **Where it appears:**
  - The header: the pin plus "Funded**City**" in Sora ExtraBold.
  - The browser-tab icon.
  - The character creator.
  - A welcome sign on Capital Square's south lawn.
  - The gold flags at the square's entrances.

## v21: ride the cable car

`src/cableRide.ts` and `buildCableCar` in `src/founders.ts`.

- **Getting on:** walk to the lower station at the main island's north-west corner, next to the Trading Floor. Then press **E** or tap **Ride the cable car up**. Choosing Founders' Summit anywhere (search, Walk to, its card, the founders panel) walks you to the station and boards you.
- **The ride:**
  - Your character stands in a glass gondola, facing the way it travels.
  - The chase camera follows the cabin over the sea, past three pylons and up the foothills (drag to look around). **V** switches to the city view.
  - The bar shows speed, altitude and a line map. **×3** fast-forwards and **Turn back** reverses.
  - About 40 seconds up at about 40 km/h.
- **At the top:** the cabin pulls into the open upper station and you step out among the statues.
  - Leave (or Esc, or **Cable car down**) rides you back down and drops you at the station.
  - If you choose another place while you're up there or still riding, the cabin takes you down first, then you walk on.
- **The line:**
  - Both stations are now open boarding bays with a bullwheel; the closed upper station hall was removed.
  - Two cabins run on separate tracks so they pass each other. When nobody is riding, they shuttle on their own with a pause at each end.

## v20 (updated in v22): FUNDEDCITY Radio

`src/radio.ts`. A **RADIO** button in the header opens the station picker. Choosing a station puts headphones on your character, and **Off** takes them off. The picker has a volume slider, and your last station resumes on your first tap after a reload.

- **MARKETS · Bloomberg Radio:** live global business and markets news, 24/7 and free. It plays the WBBR New York stream through StreamTheWorld.
- **MUSIC · Radio Paradise:** commercial-free, listener-supported music (rock, pop, electronic and world), free and on air since 2000. It plays the `stream.radioparadise.com` AAC 320 and MP3 streams.
  - v22 replaced the generated FUNDEDCITY Chill station with Radio Paradise.

**Why a station can be silent:** some hosts only let a page play audio from its own address. The claude.ai artifact viewer is one of them, so the browser refuses outside streams before they load.

- When that happens, the picker says so. It offers **Listen on bloomberg.com / radioparadise.com**, which opens the station's own player in a new tab that keeps playing while you walk the city, plus **Try again**.
- If you host `fundedcity.html` on your own website, both stations play inside the city.

## v19: clean view, phones, no traffic

- **Clean view:** the eye button under the left toolbar (or the **H** key) hides every panel, card, label and sign so only the city is on screen. Press it again to bring everything back. Panels you open while clean still show, and so does the ride pad.
- **Phones (≤ 760px):**
  - The top bar is compact, and building cards take the full screen below it (the HUD steps aside while a card is open).
  - The player HUD sits at the bottom with the "Walk to" picker.
  - Panels open as a bottom sheet with scrolling tabs.
  - Inside a building, the bar shows only the room and Leave while a panel is open.
  - No sideways scroll at 390px.
- **Traffic removed for now:** the moving cars and buses are gone. Eight parked cars stay at the kerbs (still rideable) so streets aren't empty. The traffic code lives on in `addTraffic` (`src/city.ts`) for when it comes back.

## v18: Founders' Summit and the founders-only mayor

- **Founders' Summit** (`src/founders.ts`, `src/foundersPanel.ts`): a terraced stone plaza cut into the mountains where the desert meets the forest. It has a central obelisk, torches, and five founder statues on pedestals facing the city.
  - **Founder 1:** Kareem Capital, a bronze figure raising a torch. His profile links to https://x.com/kareemcapital and his tower in the city.
  - **Founders 2–5:** veiled statues reading "To be revealed".
- **Profiles:** clicking a statue (or searching for it) opens the founder's profile with all their social links (X, Instagram, YouTube, TikTok, Telegram, Discord, LinkedIn, website; https only). The city's owner can fill in or edit any founder in that panel. Giving a founder a name unveils the statue and puts them on the mayoral ballot. Profiles are stored in `hall/founders`.
- **Getting there:** a cable car with two gondolas runs from a station at the main island's north-west corner up to the summit. Walking to the summit takes you to the lower station and up.
- **Mayor:** only founders can be mayor. Registered traders vote in the last 7 days of every month (UTC), one vote per account, changeable until midnight UTC on the 1st. The founder with the most votes is mayor for the next month; a tie goes to the earlier founder. Standing as a trader candidate has been removed.
- **City Hall's new Rules tab** sets out the mayoral vote, polls, reviews and announcements. The board outside shows "Traders vote now" or "Voting opens in…".

## v17: the mainland

The city isn't only islands any more. Behind the 100K+ Golf Club (west) and the airport (north), new land runs to the horizon, built in `src/terrain.ts`:
- **Plains:** flat desert plains to the west (dunes, cacti) and forest plains to the north (pines and broadleaf trees, with clearings). The two blend into each other, and both are open land for future districts.
- **Edges:** boulder fields in the foothills, then a ring of mountain ranges with rocky slopes and snowy peaks that marks the edge of the map. High country continues beyond them.
- **Coast:** the coast joins the golf club land and the airport island, and the bay between them stays water. The south and east stay open sea; the boats' loop moved there.
- **Getting there:** cars can drive out onto the mainland and follow the ground. Boats can't sail onto it. Walking routes stay on the city's land for now.
- **Camera:** it can pan further west and north and zoom out further to see it all.

## v16: swap, access and real firm plans

- **Swap:** the Trading Floor now stands where Touch The Grass Park was (west, beside the golf club, door facing the −68 avenue). Touch The Grass Park, with its pond, gazebo and the RESET yoga deck, moved to THE PLAZA district east of Brooklyn, south of the mall and next to the parking lot.
- **Getting everywhere:** choosing a place from search or "Walk to" while you're inside somewhere now steps you out and goes. If the first approach point is in a pocket the walker can't reach, the character tries points all round the place. The nav grid labels connected regions, so impossible routes fail instantly instead of searching the whole map. An audit walks to all 101 places from five starting points (square, Brooklyn, Plaza, airport, golf gate), and every one is reachable. Every enterable place opens its inside view.
- **Prop firm HQs:** every firm card shows each program with **every account size and its price** (list prices before discount codes), targets, loss limits and split. The source and the date that source last checked the firm's terms are shown per firm. Plans are always visible, with no "visit to unlock". The made-up "FUNDEDCITY traders / payouts tracked" numbers are gone. Cards show real counts instead: members who list the firm in their profile, and their verified payouts from it. Each lobby has two wall screens with the firm's plans and prices by size. The AI support guard answers from the same data.

## THE PLAZA, the Trading Floor and City Hall (v14–v15)

v15 moves: Sip The Dip Cafe to the Waterfront (terrace facing the bay and pier), City Hall into the café's old spot, THE PLAZA district to the east side of Brooklyn with parking; the Bank of Gains now wears City Hall's cream stone and slate (golden dome kept); THE LAB's rocket is blue.


**THE PLAZA** (new land on the far, east side of Brooklyn, past the last avenue, with a free parking lot of painted bays and parked cars out front) is a two-storey mall with a glass barrel-vault atrium and six section storefronts: Prop Firms, Brokers, Courses & Mentoring, Indicators & Tools, Copy Trading, Services & More. Prop firms, brokers, traders, copy-trading firms and anyone else can list products, services, courses and tools.
- **No listing fees.** Every sale splits **75% to the seller, 25% to the Plaza**; the sell form and every card show both amounts.
- Shop by section, search and sort, add to a basket, and check out. Checkout is a **demo**: nothing is charged, and buyers get each seller's own link.
- Listings are shared in the page database (`plaza/<id>`, up to 8 each), with an optional picture (`assets`). Claims of guaranteed profits and challenge-passing services are refused. Anyone can hide a listing for themselves; the city's owner can take listings down.
- Twelve **SAMPLE** listings from fictional sellers show how it works and can't be bought.
- Inside: the atrium with shops on both sides, a gallery level, escalators, and the 0-fees banner. Shoppers walk the square outside.

**The Trading Floor** is the round hall next to the mall, with an LED ticker of the latest ideas wrapped around it.
- Go in, pick the **FX, INDICES, COMMODITIES, CRYPTO** or **OPTIONS** pit, and chat with everyone in it.
- Tag a post as Idea / Entry / Exit / Strategy / Question, with a symbol and long/short, and attach a chart screenshot. Charts go through the `assets` capability and are only ever shown as images; click one to enlarge it.
- Posts live in `floor/<id>` (your last 30). The city's owner can remove posts.
- SAMPLE posts with drawn SAMPLE charts fill each pit. Ideas, not advice.

**City Hall** stands on Capital Square's west side (the café's old spot), facing the Bank of Gains across the fountain: white stone, a portico, a clock tower showing live NYC time, and a board by the steps with the mayor and election status. Inside is the council chamber. The panel has four tabs:
- **Announcements:** from City Hall (the city's owner posts in `hall/news`).
- **Community reviews:** one per person, 1–5 stars, about the city or a place. No sample reviews. The owner can reply or remove them.
- **Votes:** two monthly City Hall polls plus owner-created polls (`hall/polls`), one vote each in `votes/<id>`, changeable until close.
- **Mayor:** every month (UTC) registered traders can stand (`candidates/<id>`) and everyone votes (not for themselves). The winner is Mayor of FUNDEDCITY for the following month.

## THE LAB and RESET (v13)

**THE LAB** replaces the old City Spaces block, across the road from Kareem Capital. It's a NASA-style campus where prop firms launch limited-time offers and experiments.
- **Campus:** mission control with a roof sign, a geodesic dome with an orbit-ring hologram, a rocket on its launch pad, a tracking dish, and four **launch bays** with live countdown screens. A bay counts down either the time left or the releases left (seats/accounts).
- **Panel:**
  - **Experiments:** every running or upcoming one, with the countdown, what traders get, conditions, code and where to join.
  - **Ask the Lab AI:** Claude answers from the experiments data on the published page; an offline helper answers elsewhere.
  - **Rent a bay:** firm teams with a firm pass (from the golf club gate) launch their own, stored in `lab/<id>`, up to 2 each. The sample price is $1,500/week and nothing is charged. They can update releases left or end it. Each launch fires the rocket.
- **Samples:** clearly labelled SAMPLE experiments fill the bays until firms launch; firm launches take the bays first.
- **Inside:** a mission-control room with consoles, a holo-globe, and the four bay screens on the wall.

**RESET** is a yoga & mindset deck at the north end of Touch The Grass Park.
- **The deck:** a timber deck under a shade sail, with traders on mats breathing with the instructor and a breath orb that swells and settles (4 in · 4 hold · 6 out). Inside you sit on a mat in the class.
- **Mindset session:** talk through a losing trade with **Reset, the AI mindset guide**.
  - **Private:** stays on the device, isn't saved, and is sent to Claude only to answer.
  - **Group circle:** shared in `circle/<id>`. Each person's posts and the guide's replies to them are visible to everyone who can open the city.
- **Listening:** *Go quiet & listen* asks the guide for a short guided reflection and reads it aloud (browser speech) while the breathing guide runs. *Read replies aloud* speaks every reply.
- **Safety:** the guide is framed as an AI guide, **not a therapist**. It doesn't give trade calls, and it points people to a crisis line, gambling support, a doctor or emergency services when someone mentions self-harm, unaffordable losses or not being able to stop.

## Inside views (v12)

Reaching a place takes you inside. Walk there (click, the *Walk to* menu, or a card's **Go inside** button), or click it while standing at the door.
- **Inside:** drag to look around, scroll to zoom, and leave with **Leave** / **Esc** (back to the city view at the door).
- **Panels:** open docked on the right so the room stays in view.

| Place | Where you sit |
|---|---|
| Your home (Brooklyn) | On the sofa; the TV shows your stats |
| Your tower | On the sofa of the top floor, looking out over the real city through the glass (the tower shell hides while you're in) |
| Sip The Dip Cafe | At a terrace table with your coffee; the chat opens docked |
| Bank of Gains | A dark-wood trading floor: giant LED wall with the live payout ranking and ticker, a MarketSite-style ticker pillar, trading desks |
| Firm HQs | The lobby: firm wall sign, reception desk with the AI support guard, *Ask AI support* and *Plans & offers* |
| Airport terminal | The departures hall facing the apron (real planes at the gates), with live flight boards |
| Control tower | The cab: consoles, live radar, the airport and the city below |
| Liquidation Arena | In the crowd, facing the tournament screens |
| Media Theater | A seat facing the big screen |
| Golf clubhouse | The terrace over the members' lawn (members only) |
| Set For Life Statue / Marina / Port | The crown over the bay / the Marina Club deck / a gantry crane cab |

**Visiting:** you can always go into your own tower or house. Other registered traders' properties open only if they tick *Let other traders visit* in their profile. Demo towers and sample houses are open as show properties.

The **Bank of Gains** building is now dark brown stone with gold capitals and a golden dome.

## Join, build and verify (v11)

The city now runs on real registrations. It's free, with no subscription.

1. **Enter:** create your character, then play as a guest or sign up.
2. **Trader profile:** members go straight on to their profile (or use *Build my tower* on the player card).
   - Public: full name, name on the tower, country, what you trade (CFD / Futures / Perps / Multi-Assets), current allocation, estimated payouts, prop firms traded with, website / Discord / YouTube / Facebook / X / Instagram / Telegram / WhatsApp, and services offered (courses, mentoring...).
   - Private: email and phone go to the viewer's private space (`data/users/<id>/contact`), never shown.
3. **Building:** no verified payout gives you a house in Brooklyn. Verified payouts give you a tower in your sector, with your name on it. Other registered traders appear too (`traders/<id>`, shared). A demo tower makes way when a sector is full.
4. **Payouts** (single payouts, or one lifetime-total certificate):
   - The QR code or barcode is read in the browser: the built-in reader where available, otherwise jsQR, loaded from jsDelivr only when needed.
   - A code linking to the firm's official website is **verified**. A code linking anywhere else is **rejected**.
   - With no code, a **bank transfer proof** is required.
   - On the published page, Claude reads each document: amount (fees up to 10% allowed on bank proofs), firm, name, document type and signs of editing. A mismatch is rejected; the same document can't be used twice.
   - A check that can't run here leaves the payout **pending**.
   - Documents are never stored, only the result and the checks.
   - Tower total = max(best verified lifetime certificate, sum of verified singles).
5. **Levels:**
   - L1 $1–10K, L2 10–25K, L3 25–50K, L4 50–100K, L5 100–250K, L6 250–500K, L7 500–750K, L8 750K–1M, L9 1–1.5M, L10 1.5–2M.
   - Then crowns: bronze 2–3M, silver 3–4M, gold 4–5M, diamond 5–10M, platinum 10M+.
   - Each level is a taller, wider tower (sky tiers, fins, lantern, spires). The crowns are modelled on top.
6. **Bank of Gains → Rules** publishes all of the above. The max-single ranking now includes verified single payouts.

Honest limits: the checks catch wrong links, mismatched amounts or names, edited-looking and reused documents. They can't confirm a payout with the prop firm itself, and in a page-only app a determined user could write their own record, so a backend should re-verify before anything official. The 50 sample traders are tagged *Demo data*.

## Changes in v10

- **Views:** walk, drive, sail and fly views (third-person cameras) alongside the city view.
  - Riding any vehicle starts in its own view (Drive / Sail / Fly). **V** or the bar's button switches to the city view and back. Getting out always returns to the city view.
  - On foot, press **V** or the walking-figure button in the left rail for the walk view: **W/S** walk, **A/D** turn, drag to look around, scroll to zoom. **V** or **Esc** goes back to the city view.
- **Touch The Grass Park** is back to its original size inside the main island (pond and gazebo, north-west). The large park land and the kids' area are gone.
- **100K+ Payouts Golf Club** is now a smaller, fenced 9-hole course on the west coast next to the park.
  - The only way in is the **members' gate**, where the entry conditions are posted: traders with $100,000+ verified payouts, prop firm CEOs, and prop firm marketing & partnerships teams.
  - At the gate you get a club pass. Traders are checked against FUNDEDCITY's verified payout records. Firm roles are self-declared and marked unverified in this demo; real verification needs a backend.
  - Without a pass, walking or driving in turns you back at the gate (golf carts too).
  - The **members' lawn** has a group for every firm's CEO and marketing team (illustrative role figures, no named individuals), mixed with the 100K+ traders. Name tags appear when you zoom in or walk past.
  - The **members' lounge** chat is shared on the published page (`golf/<user id>`) and shows each member's club role.
- **Liquidation Arena** now hosts prop firm tournaments only (no football).
  - The pitch is a tournament stage with competitor desks, and the arena screens rotate live and upcoming tournaments with their prize pools.
  - The panel has Live, Upcoming and Publish tabs. Firm teams (with a firm pass) publish their own tournaments, stored in `tours/<user id>`, up to three each. Everyone sees them on the screens and in the list, labelled unverified.
  - Until firms publish, clearly labelled **SAMPLE** listings fill the arena.
- **Aircraft:** both helicopters are parked on their helipads, and the small planes are parked at the hangars. All of them are still rideable. Only the two banner planes fly, towing much bigger banners that read correctly from both sides. Airliners still land and depart.
- **AI customer service guard** outside every prop firm HQ (25 guards, each with an "Ask AI" podium).
  - Click a guard's tag, or walk up and press **Q**, to chat.
  - On the published page, answers come from Claude using FUNDEDCITY's research notes on that firm, with a reminder to confirm on the firm's website. The guard says it isn't an official firm channel.
  - Anywhere else, an offline helper answers from the same notes.
- **Ad spaces:** clickable "YOUR AD HERE" boards and hull ads, each with a sample monthly price and a *Request this spot (demo)* button (nothing is booked or charged). Placements:
  - nine city billboards (shores, the bridge approach, arena plaza, airport road, Brooklyn)
  - the Yacht Club breakwater board
  - four golf course boards
  - hull panels on both container ships and both superyachts
  - the existing aircraft liveries and banners
  Edit placements in `src/ads.ts`.

## Ride anything

Your character can board **any vehicle in the city**: the city cars, golf carts, the cruising and moored yachts,
superyachts, sailboats, the river runabout, both container ships, every airliner (parked at a gate, taxiing or in
the air), the small planes, banner planes and both (parked) helicopters.

- **Board:** walk up to a vehicle and press **E** (a prompt appears), or click any vehicle and press *Drive / Sail / Fly / Pilot it*.
- **Controls:** **W/S** throttle, **A/D** steer or bank, **Space** climb, **Shift** descend, **E** to get out. On touch screens an on-screen pad appears.
- **Cars and carts** stay on land and stop at buildings; they can cross the Rat Race Exit Bridge and the airport causeway.
- **Boats** stay on the water: the bay, the river and round the islands.
- **Planes** need speed to climb (they stall and sink if too slow) and can't taxi into the sea, but if you reach flying speed at the end of the runway you lift off. Fly too far and the plane banks back toward the city.
- **Helicopters** hover and land anywhere.
- Getting out of an aircraft in the air means a parachute landing on the nearest dry land; getting off a boat puts you on the nearest shore.
- While you ride you keep discovering places you pass, and the camera follows you (and rises with aircraft).
- The HUD shows speed in km/h and altitude in feet (1 world unit ≈ 1.25 m). Other traffic keeps running around you; the vehicle you take leaves its route and returns to it when you get out.

## Airport, café, bank and park

- **FUNDEDCITY International Airport** sits on its own island north of the city, linked by a causeway. It has a runway with lights, a taxiway, a curved-roof terminal with six gates and jet bridges, a control tower with a blinking beacon, a rotating radar and radome, hangars with small planes, a helipad and a fuel farm.
- **Live air traffic** is simulated in real time and runs like the cars.
  - Four airliners (Boeing 777, Boeing 747, Airbus A350, Airbus A320) loop through approach → landing → taxi → gate → boarding → pushback → take-off → climb-out, with runway use spaced 25 seconds apart.
  - Two more jets are parked at the gates. The two helicopters and the small planes stay parked, and two banner planes tow advertising banners over the islands.
- **Every aircraft is ad space**: fuselage liveries, banners and helicopter tail booms. The airport panel has three tabs:
  - **Radar**: a live scope with blips and altitudes.
  - **Flights**: arrivals and departures with times, gates and status.
  - **Advertise**: every ad slot with mock prices.
  Edit the liveries in `src/airport.ts`.
- **Sip The Dip Cafe** (Capital Square, west) has a terrace, umbrellas, people at the tables and a steaming rooftop cup.
  - Click it to chat with the traders there. The latest message floats over the café.
  - On the published page, chat is shared through the page's database (`cafe/<user id>` holds each person's last 30 messages, and everyone writes only their own).
  - Anywhere else, it stays in that browser.
- **Bank of Gains** (Capital Square, east) is a classical bank with a gold dome and a board showing the city's top single payout.
  - Traders register only their single largest payout (one entry each, stored in `bank/<user id>`).
  - The bank ranks every max single payout (city records plus self-reported entries) and ranks traders by total verified payouts.
- **Touch The Grass Park** is the park in the north-west of the main island: pond, gazebo and quiet paths.
- **Renamed**:
  - The Brooklyn Bridge is now the **Rat Race Exit Bridge** (with plaques on its towers).
  - The Statue of Liberty is now the **Set For Life Statue** (with plaques on its pedestal).
  - The stadium is now **Liquidation Arena**.

## Brooklyn, the bridge and the waterfront

- **Brooklyn** is a second island across the river with **100 detached houses**: each has its own plot, a front door with porch and path, an attached garage with driveway, a hedged front garden and a fenced back garden. Registered traders without a payout live here (house #100, nearest the bridge, is kept for the signed-up user). There's also a park, Brooklyn Commons.
- **Brooklyn Bridge** carries the −40 avenue across the river: gothic stone towers with pointed arches, four main cables, suspenders, diagonal stays, a timber promenade and cable lights that glow at night. You can walk or drive across.
- **Yacht Marina**: pontoons with moored yachts, two superyachts and a breakwater light.
- **Container Port**: a pier with three gantry cranes, a container yard and a container ship at the quay.
- Boats circle the islands: a container ship, yachts and sailboats, plus a runabout in the river.
- The **Statue of Liberty** stands on a star-fort island in the bay to the south-west, and her torch lights up at night.

## 50 trader towers

There are 50 verified traders, from $420 to $1.48M in payouts, at Levels 1–5 across the CFD, Futures, Perps and Multi-Assets sectors. The leaderboard shows the top 5 plus your own row.

## Liquidation Arena

An elliptical bowl with a crowd, floodlights, a central tournament stage with competitor desks, and big screens that rotate the live and upcoming prop firm tournaments. Click it, or walk there, to open the tournaments panel (see *Latest changes*).

## Live NYC weather and sun

- **Live mode** follows the real sun over Lower Manhattan. Day, dusk and night come from the sun's elevation, shadows follow its compass direction, and sunrises and sunsets glow warm.
- **Weather** comes live from Open-Meteo (free, no key) when the page can reach it. Rain, drizzle, snow (with snow on the ground and roofs), thunderstorms (with lightning) and fog are all rendered, and overcast skies dim the sun.
- The shared artifact page can't make outside requests, so there it shows a researched snapshot (sunny, 13 °C) and says so.
- The weather button in the top bar shows the conditions, sunrise and sunset, and lets you pin a condition to preview.

## Day, Night and Live

The header switch sets the lighting: **Day**, **Night**, or **Live** (default), which follows the real sun
in New York City. Sunrise and sunset are taken from a month-by-month table and blended over ~35 minutes at dusk and dawn.
At night office windows light up in a random pattern, streetlights cast warm pools, car head/tail lights,
signs and the plaza's gold inlay glow, and the UI switches to a dark theme. The choice is remembered per browser.

## The payout demo

**SIMULATE +$25K PAYOUT** adds a payout to the demo tower Kareem Capital ($237,500 → $262,500). The first click
crosses $250,000, so the tower grows from **Level 5 to Level 6**: the bigger tower rises out of the old one,
windows glow and gold sparkles drift up. The card, header stat, activity feed and leaderboard all update.
A registered trader's own verified payout runs the same animation. **RESET DEMO** restores the demo tower.

## Code map

| File | Purpose |
|---|---|
| `src/data.ts` | All mock traders, firms, spaces, districts, stats, activity |
| `src/buildings.ts` | Procedural modular buildings: floor sections, tower levels 1–5, crown, HQs, lease spaces |
| `src/city.ts` | Island, water, roads, districts, plaza, park, trees (instanced), traffic, placement |
| `src/camera.ts` | City view (orthographic isometric camera, damped controls, focus / reset) and the walk / drive / sail / fly chase camera |
| `src/interactions.ts` | Raycast hover/click, highlight, selection ring |
| `src/payout.ts` | Payout sequence + L4 → L5 construction animation and effects |
| `src/ui.ts` | Header, stats, info cards, activity, leaderboard, demo bar, 3D-anchored labels |
| `src/avatar.ts` | Customisable avatar (options, build, walk/idle animation) |
| `src/creator.ts` | Character page: preview, options, guest or demo sign-up, edit |
| `src/navigation.ts` | Walkable grid, A* path-finding, path smoothing |
| `src/player.ts` | The walking character: routes, keyboard, follow camera, skip, discovery |
| `src/lighting.ts` | Day / Night / Live modes, NYC sunrise-sunset logic, light blending |
| `src/anim.ts` | Tiny tween engine on the render clock |
| `src/media.ts` | Media District data + `MediaFeed` interface (calendar, broadcasts, quotes, headlines), snapshot feed |
| `src/mediaDistrict.ts` | 3D theater, screen, price tape, URGENT crawl, calendar board, countdown pylon |
| `src/mediaPanel.ts` | Media Center panel (Calendar / Theater / Markets / News), MEDIA chip, heads-up alerts |
| `src/landmarks.ts` | Statue of Liberty, Brooklyn Bridge |
| `src/harbour.ts` | Yacht marina, container port, ships, boat routes |
| `src/stadium.ts` / `src/tournaments.ts` / `src/tournamentsPanel.ts` | Liquidation Arena 3D, tournament data + SAMPLE listings, tournaments panel with publishing |
| `src/weather.ts` / `src/weatherUi.ts` | Solar position, NYC weather feed, rain/snow/fog/lightning, header control |
| `src/airport.ts` / `src/aircraft.ts` / `src/airportPanel.ts` | Airport island, aircraft models + ad liveries, air-traffic sim, radar/flights/ads panel |
| `src/civic.ts` / `src/chatPanel.ts` / `src/bankPanel.ts` / `src/cloud.ts` | Sip The Dip Cafe, shared chat rooms (café + golf lounge), Bank of Gains + rankings, shared-storage wrapper |
| `src/golf.ts` / `src/golfPanel.ts` / `src/clubPass.ts` | 100K+ Payouts Golf Club: fenced course, members' gate + conditions, members' lawn, carts; gate panel, lounge, club pass |
| `src/guards.ts` / `src/guardPanel.ts` | AI customer-service guards at the firm HQs and their chat (Claude on the published page, offline helper elsewhere) |
| `src/ads.ts` | Ad-space slots, sample prices and the billboard model |
| `src/vehicles.ts` | Registry of every rideable vehicle |
| `src/ride.ts` | Ride controller: boarding, driving / sailing / flying physics, HUD and touch pad |
| `src/profile.ts` / `src/profilePanel.ts` / `src/verify.ts` | Registered trader profiles (shared + private contact), the profile / payouts / building panel, payout verification (code reading, firm-link check, Claude document read) |
| `src/interiors.ts` | Inside views: rooms built on the spot or off-map, seat cameras, live screens |
| `src/plaza.ts` | THE PLAZA district: land, mall, Trading Floor (ticker), shoppers, sections + pits |
| `src/plazaPanel.ts` | Mall panel: shop by section, basket + demo checkout (75/25), sell, rules |
| `src/floorPanel.ts` | Trading Floor pits chat with chart uploads |
| `src/cityHall.ts` / `src/cityHallPanel.ts` | City Hall building (clock, board) + announcements, reviews, votes, mayor |
| `src/uploads.ts` | Image uploads via the `assets` capability (re-encoded, shown only as images) |
| `src/lab.ts` / `src/labPanel.ts` | THE LAB campus, experiments + samples, panel (experiments, Lab AI, rent a bay) |
| `src/reset.ts` / `src/resetPanel.ts` / `src/ai.ts` | RESET yoga deck, AI mindset guide (private / group, listen mode), shared Claude access |
| `src/bake.ts` | Merges static meshes per material (keeps draw calls low) |
| `scripts/build-single.mjs` | Builds the single-file `dist/fundedcity.html` |
| `plan.md` | World design plan |

Performance notes: shared geometry/material caches, instanced trees/lights/road markings, VSM soft
shadows re-rendered only periodically (every frame during the payout animation), moving props don't cast
shadows.
