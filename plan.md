# FundedID City — World Plan

A small, premium, isometric miniature city for prop-firm traders. Bright, clean and architectural —
think a WareTrack-style SaaS world rendered like an architect's scale model, with SimCity's
"I built this" satisfaction. Not cyberpunk, not crypto-neon, not cartoon.

## 1. Visual language

| Element | Treatment |
|---|---|
| Sky / background | Very pale blue-to-white CSS gradient behind a transparent canvas |
| Water | Soft cyan-blue plane, lighter shallow band at the coast |
| Island | Raised white stone slab with rounded corners; sand step below it |
| Roads | Light blue-grey asphalt, white dashed centre lines, white kerbs |
| Pavements | Off-white, slightly raised |
| Landscaping | Fresh greens, faceted low-poly trees (round and conical), hedges |
| Buildings | White / light-grey bodies, blue glass bands per floor, thin floor plates |
| Achievement accent | Subtle gold (trim, crown, sparkles) — used sparingly so it means something |
| Lighting | Bright hemisphere light + warm sun, soft PCF shadows, studio environment reflections |
| UI | White frosted cards, royal blue primary, mint for "live/verified", gold for achievements, Manrope |

Rounded details come from rounded-box geometry on podiums, plazas, cars and planters.

## 2. Layout (top-down, 112 × 92 island, 3 × 3 block grid)

Camera looks from the south-east (+x, +z) towards the centre, so the **south-east** of the island is
closest to the viewer (kept low-rise) and the **north-west** is furthest (tall things are fine there).

```
             N (far)
   ┌──────────────┬──────────────┬──────────────┐
   │ FUTURES      │ PROP FIRM    │ CFD          │
   │ DISTRICT     │ HQ DISTRICT  │ DISTRICT     │
   ├──────────────┼──────────────┼──────────────┤
W  │ CENTRAL PARK │ CAPITAL      │ CRYPTO       │  E
   │ + pond       │ SQUARE       │ DISTRICT     │
   ├──────────────┼──────────────┼──────────────┤
   │ COMMERCIAL / │ WATERFRONT   │ HARBOUR      │
   │ CITY SPACES  │ PROMENADE    │ LOW-RISE     │
   └──────────────┴──────────────┴──────────────┘
             S (near the camera) — coastline, pier, boats
```

Two avenues (x = ±24) and two streets (z = ±18), 5 units wide, with streetlights and moving cars.

## 3. Zones

### Capital Square (centre)
- **Appearance:** circular white-stone plaza, gold inlay ring, tiered fountain with a gold orb,
  four lawns with trees and benches. The four corners hold the city's top trader towers.
- **Label:** "Capital Square · Top Traders".
- Towers: SnowFX (back, L5), FXNomad (left, L4), **Kareem Capital (right, L4)**, AlphaWave (front, L3 so
  it never hides the plaza).

### Futures District (north-west)
- Pale-blue paving accent, NQKing (L3) and EdgeTrader (L2), plus decorative mid-rise offices.
- Label: "Futures District · 2,341 Traders".

### CFD District (north-east)
- Pale-mint paving accent. TradeZ (L4) is the district landmark; SamFX (L2), PipsHunter (L1).
- Label: "CFD District · 1,892 Traders".

### Crypto District (east)
- Soft lavender-grey paving accent (calm, not neon). MarketMonk (L3), QuantWolf (L2), decorative studios.
- Label: "Crypto District · 1,756 Traders".

### Prop Firm HQ District (north)
- Corporate campus row: four HQs with rooftop text signs (no logos): FTMO, FundedNext, Topstep, Lucid.
  Each HQ has a wide glass lobby, horizontal office bands and a coloured accent fin.
- Label: "Prop Firm HQs · 24 Partners".

### City Spaces / commercial (south-west)
- Three leasable spaces: **Premium Plot** (landscaped empty lot with dashed outline and a "FOR LEASE"
  marker), **Billboard** (freestanding billboard facing the square), **Firm HQ** (foundation slab with
  ghosted wireframe massing showing what could be built).
- Label: "City Spaces · 3 Available".

### Decorative
- Central Park (west): pond, paths, ~40 trees. Waterfront promenade (south): low pavilions, café,
  benches, pier with sailboats. Harbour low-rise (south-east): small white residential blocks.

## 4. Trader tower levels (modular, never stretched)

Every tower is assembled from stacked **floor modules** (white floor plate + inset blue glass band).
Levels change the *architecture*, not the scale.

| Level | Name | Composition | ≈ Height |
|---|---|---|---|
| 1 | Trader Studio | 2 floors, flat roof, parapet, rooftop AC unit | 4 |
| 2 | Mid-Rise | 4 floors, setback penthouse, roof garden | 8 |
| 3 | Tower | 2-floor podium, 6-floor shaft, corner pilasters, roof rail + plant room | 13 |
| 4 | Premium Tower | wide podium, 9-floor shaft with pilasters, 2-floor setback crown, antenna | 20 |
| 5 | Landmark Skyscraper | L4 + **4-floor sky tier** inserted above the shaft, vertical façade fins, raised crown + spire | 27 |

Level 4 → 5 is the hero animation: the sky tier is *built* floor by floor while the crown section
rises on top of it.

## 5. Important objects

### Kareem Capital (hero tower)
- **Appearance:** L4 premium tower; white + blue glass with **gold** floor trims on the podium and at the
  setback, a gold "KC" sign on the podium facing the camera, a small **gold crown** on the roof, planters,
  hedges and trees at its base. A small gold name pin floats above it so it is noticeable at a glance —
  prominent, not absurdly oversized (shorter than SnowFX until it upgrades).
- **Location:** Capital Square, right-hand corner (x 15, z −9.5).
- **Hover:** pointer cursor, building brightens slightly, name tooltip.
- **Click:** blue selection ring pulses at the base, camera eases toward it, trader card opens.
- **Stats shown:** name, Jordan, Verified Trader, Verified Payouts $112,500, Payout Count 27, Highest
  Allocation $950,000, World Rank #247, Jordan Rank #3, Tower Level 4, 2,340 / 3,000 XP; View Profile,
  Share Tower.
- **Animation:** crown slowly rotates; payout event triggers the L4 → L5 upgrade (section 6).

### Other trader towers (SnowFX, TradeZ, FXNomad, AlphaWave, MarketMonk, NQKing, EdgeTrader, QuantWolf, PipsHunter, SamFX)
- **Appearance:** tower geometry by level; same palette without gold (gold is earned by the hero).
- **Hover / click:** same as Kareem; the same card updates with their mock stats.

### Prop firm HQs (FTMO, FundedNext, Topstep, Lucid)
- **Appearance:** wide low-rise HQ (≈ 8 × 9 footprint, 4–6 floors), glass lobby, coloured accent fin,
  rooftop text sign.
- **Hover:** brighten + tooltip. **Click:** company card — FundedID Traders, Verified Payout Volume,
  Average Payout, "View Firm".

### Commercial spaces
- **Hover:** brighten + tooltip "Available". **Click:** lease card — "This city space can be leased by a
  trader, prop firm or sponsor." From $X/month, "Request Lease" (visual only).

### District labels
- Small frosted pills (CSS2D) floating above each district: name + count.

### Ambient life
- Cars loop the ring roads, boats drift, fountain water shimmers, crown rotates.

## 6. The payout event (L4 → L5)

Triggered by the demo button **SIMULATE +$25K PAYOUT**, ≈ 2.8 s total:

1. `+$25,000 VERIFIED PAYOUT` notification floats up above the tower.
2. Activity feed: "Kareem Capital received a verified $25,000 payout."
3. Camera eases to Kareem Capital.
4. Gold glow blooms at the tower base.
5. Sky tier builds floor by floor (staggered) while the crown section lifts on top; gold fins slide up
   the façade; spire extends.
6. Windows glow warm for a moment.
7. Crown turns and pulses.
8. Restrained gold sparkles drift upward.
9. Card, level, XP bar, header stat and leaderboard update with count-up animations.

Repeat clicks after L5 keep celebrating (payout, XP, sparkles) without adding geometry; the button is
locked while an animation runs. **Reset demo** rebuilds the original L4 tower and data.

## 7. UI shell

- Header: logo + "FundedID City", search ("Search traders, firms or explore the city…"), LIVE CITY pill,
  reset-camera button.
- Four compact stat cards (Active Traders, Verified Payouts, Total Traders, Prop Firm Partners).
- Bottom-left: LIVE ACTIVITY. Bottom-right: TOP TRADERS. Right: selection card. Bottom-centre: demo bar.
- Everything small and translucent so the city dominates.
