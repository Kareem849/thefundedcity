// Mock data for the FUNDEDCITY POC. No APIs, no backend — everything lives here.
// Firm plans/services/offers live in firms.ts (researched); everything here is mock.

export type SectorId = 'cfd' | 'futures' | 'perps' | 'multi';
export type TowerLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type CrownTier = 'bronze' | 'silver' | 'gold' | 'diamond' | 'platinum';

/* ------------------------------------------------------------------ */
/* Tower rules: the level comes from verified payouts (USD)            */
/* ------------------------------------------------------------------ */
export interface LevelBand { level: TowerLevel; min: number; max: number; name: string }
export const LEVEL_BANDS: LevelBand[] = [
  { level: 1, min: 1, max: 10_000, name: 'Trader Studio' },
  { level: 2, min: 10_000, max: 25_000, name: 'Mid-Rise' },
  { level: 3, min: 25_000, max: 50_000, name: 'Tower' },
  { level: 4, min: 50_000, max: 100_000, name: 'Premium Tower' },
  { level: 5, min: 100_000, max: 250_000, name: 'Landmark Skyscraper' },
  { level: 6, min: 250_000, max: 500_000, name: 'Sky Tower' },
  { level: 7, min: 500_000, max: 750_000, name: 'Summit Tower' },
  { level: 8, min: 750_000, max: 1_000_000, name: 'Pinnacle Tower' },
  { level: 9, min: 1_000_000, max: 1_500_000, name: 'Millionaire Spire' },
  { level: 10, min: 1_500_000, max: 2_000_000, name: 'Supertall' },
];
export interface CrownBand { tier: CrownTier; min: number; max: number; label: string; color: string }
/** After Level 10 the tower keeps Level 10 and earns crowns. */
export const CROWN_BANDS: CrownBand[] = [
  { tier: 'bronze', min: 2_000_000, max: 3_000_000, label: 'Bronze Crown', color: '#b87333' },
  { tier: 'silver', min: 3_000_000, max: 4_000_000, label: 'Silver Crown', color: '#aeb6c2' },
  { tier: 'gold', min: 4_000_000, max: 5_000_000, label: 'Golden Crown', color: '#d4a94a' },
  { tier: 'diamond', min: 5_000_000, max: 10_000_000, label: 'Diamond Crown', color: '#7fd3f7' },
  { tier: 'platinum', min: 10_000_000, max: Infinity, label: 'Platinum Crown', color: '#e5e4e2' },
];
/** 0 = no verified payout yet (a Brooklyn house). */
export function levelFor(payouts: number): TowerLevel | 0 {
  if (!(payouts >= 1)) return 0;
  let lvl: TowerLevel = 1;
  for (const b of LEVEL_BANDS) if (payouts >= b.min) lvl = b.level;
  return lvl;
}
export function crownFor(payouts: number): CrownTier | null {
  let c: CrownTier | null = null;
  for (const b of CROWN_BANDS) if (payouts >= b.min) c = b.tier;
  return c;
}
export const crownBand = (t: CrownTier) => CROWN_BANDS.find((b) => b.tier === t)!;
/** Progress toward the next level or crown. */
export function levelProgress(payouts: number) {
  const level = levelFor(payouts);
  const crown = crownFor(payouts);
  const steps: Array<{ label: string; min: number; max: number }> = [
    ...LEVEL_BANDS.map((b) => ({ label: `Level ${b.level}`, min: b.min, max: b.max })),
    ...CROWN_BANDS.map((b) => ({ label: b.label, min: b.min, max: b.max })),
  ];
  const i = steps.findIndex((s) => payouts >= s.min && payouts < s.max);
  if (i < 0) return { level, crown, pct: 0, nextLabel: 'Level 1', nextAt: 1 };
  const cur = steps[i];
  const next = steps[i + 1];
  if (!next) return { level, crown, pct: 100, nextLabel: '', nextAt: 0 };
  return { level, crown, pct: Math.min(100, ((payouts - cur.min) / (cur.max - cur.min)) * 100), nextLabel: next.label, nextAt: next.min };
}
export function towerTitle(payouts: number) {
  const l = levelFor(payouts);
  const c = crownFor(payouts);
  if (!l) return 'House · no verified payout yet';
  return c ? `Level 10 · ${crownBand(c).label}` : `Level ${l} · ${LEVEL_BANDS[l - 1].name}`;
}

export interface Trader {
  id: string;
  name: string;
  initials: string;
  country: string;
  verified: boolean;
  payouts: number; // verified payouts, USD (≥ $1 = tower; $0 = house)
  payoutCount: number;
  highestAllocation: number;
  worldRank: number;
  countryRank: number;
  level: TowerLevel;
  crown: CrownTier | null;
  sector: SectorId;
  /** assigned by the city layout */
  plot: { x: number; z: number };
  signature?: boolean; // the hero tower (Kareem Capital)
  /** sample data that ships with the demo city (not a registered person) */
  demo?: boolean;
  /** a registered FUNDEDCITY trader (shared profile) */
  profile?: TraderProfilePublic;
  /** the viewer's own tower */
  mine?: boolean;
}

export type LinkKey = 'website' | 'discord' | 'youtube' | 'facebook' | 'x' | 'instagram' | 'telegram' | 'whatsapp';
export const LINK_LABEL: Record<LinkKey, string> = {
  website: 'Website', discord: 'Discord', youtube: 'YouTube', facebook: 'Facebook', x: 'X (Twitter)', instagram: 'Instagram', telegram: 'Telegram', whatsapp: 'WhatsApp',
};
export type PayoutStatus = 'verified' | 'rejected' | 'pending';
export interface PayoutRecord {
  id: string;
  /** a single payout, or a lifetime-total certificate */
  kind: 'single' | 'lifetime';
  amount: number;
  firm: string;
  date: string;
  method: 'code' | 'bank';
  status: PayoutStatus;
  /** what the checks found, in plain words */
  checks: string[];
  at: number;
  /** fingerprint of the proof file, so one document can't be counted twice */
  hash?: string;
}
/** Everything here is public: visible to anyone who can open the city. */
export interface TraderProfilePublic {
  uid: string;
  fullName: string;
  /** name on the tower (defaults to the full name) */
  towerName: string;
  sector: SectorId;
  allocation: number;
  /** self-reported lifetime payouts (not used for the tower) */
  claimedPayouts: number;
  country: string;
  firms: string[];
  links: Partial<Record<LinkKey, string>>;
  services: string;
  /** other traders may go inside your tower or house */
  allowVisitors: boolean;
  payouts: PayoutRecord[];
  joined: number;
  updatedAt: number;
}
/** Tower total: the larger of the best verified lifetime certificate and the sum of verified single payouts. */
export function verifiedTotal(p: Pick<TraderProfilePublic, 'payouts'>) {
  const ok = p.payouts.filter((r) => r.status === 'verified');
  const singles = ok.filter((r) => r.kind === 'single').reduce((a, r) => a + r.amount, 0);
  const lifetime = ok.filter((r) => r.kind === 'lifetime').reduce((a, r) => Math.max(a, r.amount), 0);
  return Math.max(singles, lifetime);
}

/** Registered traders with no verified payout yet: they live in the Houses district. */
export interface Resident {
  id: string;
  name: string;
  country: string;
  joined: string;
  sector: SectorId;
  /** the signed-up user's own house */
  mine?: boolean;
  /** a registered trader (shared profile) living here */
  uid?: string;
}

export interface CommercialSpace {
  id: string;
  name: string;
  kind: 'plot' | 'billboard' | 'hq';
  price: number;
  size: string;
  plot: { x: number; z: number };
}

export const SECTOR_LABEL: Record<SectorId, string> = { cfd: 'CFD', futures: 'Futures', perps: 'Perps', multi: 'Multi-Assets' };

export const LEVEL_NAMES = Object.fromEntries(LEVEL_BANDS.map((b) => [b.level, b.name])) as Record<TowerLevel, string>;

export const KAREEM_ID = 'kareem';

type Seed = Omit<Trader, 'plot' | 'initials' | 'verified' | 'level' | 'crown'> & { initials?: string };
const T = (s: Seed): Trader => ({
  ...s,
  level: (levelFor(s.payouts) || 1) as TowerLevel,
  crown: crownFor(s.payouts),
  demo: true,
  verified: true,
  initials: s.initials ?? s.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase(),
  plot: { x: 0, z: 0 },
});

const TRADERS_SEED: Trader[] = [
  // Multi-Assets
  T({ id: KAREEM_ID, name: 'Kareem Capital', initials: 'KC', country: 'Jordan', payouts: 237_500, payoutCount: 34, highestAllocation: 950_000, worldRank: 247, countryRank: 3, sector: 'multi', signature: true }),
  T({ id: 'alphawave', name: 'AlphaWave', initials: 'AW', country: 'Germany', payouts: 96_400, payoutCount: 22, highestAllocation: 600_000, worldRank: 298, countryRank: 6, sector: 'multi' }),
  T({ id: 'macromaya', name: 'MacroMaya', country: 'Brazil', payouts: 71_300, payoutCount: 19, highestAllocation: 400_000, worldRank: 364, countryRank: 4, sector: 'multi' }),
  T({ id: 'assetatlas', name: 'AssetAtlas', country: 'Singapore', payouts: 33_900, payoutCount: 11, highestAllocation: 250_000, worldRank: 812, countryRank: 7, sector: 'multi' }),
  T({ id: 'crosscurrent', name: 'CrossCurrent', country: 'Poland', payouts: 4_200, payoutCount: 3, highestAllocation: 100_000, worldRank: 3_120, countryRank: 22, sector: 'multi' }),
  // CFD
  T({ id: 'snowfx', name: 'SnowFX', initials: 'SF', country: 'United Kingdom', payouts: 6_150_000, payoutCount: 312, highestAllocation: 4_000_000, worldRank: 8, countryRank: 1, sector: 'cfd' }),
  T({ id: 'fxnomad', name: 'FXNomad', initials: 'FN', country: 'Spain', payouts: 812_400, payoutCount: 101, highestAllocation: 1_200_000, worldRank: 27, countryRank: 1, sector: 'cfd' }),
  T({ id: 'londonopen', name: 'LondonOpen', country: 'Ireland', payouts: 82_600, payoutCount: 21, highestAllocation: 400_000, worldRank: 331, countryRank: 2, sector: 'cfd' }),
  T({ id: 'xauqueen', name: 'XAUQueen', country: 'South Africa', payouts: 26_700, payoutCount: 10, highestAllocation: 200_000, worldRank: 958, countryRank: 5, sector: 'cfd' }),
  T({ id: 'samfx', name: 'SamFX', initials: 'SX', country: 'Saudi Arabia', payouts: 19_800, payoutCount: 9, highestAllocation: 200_000, worldRank: 1_164, countryRank: 14, sector: 'cfd' }),
  T({ id: 'pipshunter', name: 'PipsHunter', initials: 'PH', country: 'Egypt', payouts: 9_600, payoutCount: 5, highestAllocation: 100_000, worldRank: 2_408, countryRank: 31, sector: 'cfd' }),
  T({ id: 'swingsmith', name: 'SwingSmith', country: 'Morocco', payouts: 1_250, payoutCount: 1, highestAllocation: 50_000, worldRank: 6_904, countryRank: 40, sector: 'cfd' }),
  // Futures
  T({ id: 'tradez', name: 'TradeZ', initials: 'TZ', country: 'United Arab Emirates', payouts: 2_240_000, payoutCount: 188, highestAllocation: 2_500_000, worldRank: 19, countryRank: 1, sector: 'futures' }),
  T({ id: 'nqking', name: 'NQKing', initials: 'NK', country: 'United States', payouts: 74_900, payoutCount: 31, highestAllocation: 450_000, worldRank: 356, countryRank: 88, sector: 'futures' }),
  T({ id: 'es-sniper', name: 'ES_Sniper', country: 'United States', payouts: 61_200, payoutCount: 26, highestAllocation: 300_000, worldRank: 402, countryRank: 97, sector: 'futures' }),
  T({ id: 'edgetrader', name: 'EdgeTrader', initials: 'ET', country: 'Canada', payouts: 41_300, payoutCount: 18, highestAllocation: 300_000, worldRank: 701, countryRank: 12, sector: 'futures' }),
  T({ id: 'ticktaker', name: 'TickTaker', country: 'Mexico', payouts: 17_400, payoutCount: 8, highestAllocation: 150_000, worldRank: 1_305, countryRank: 6, sector: 'futures' }),
  T({ id: 'orderflowoz', name: 'OrderFlowOz', country: 'Australia', payouts: 3_100, payoutCount: 2, highestAllocation: 50_000, worldRank: 3_877, countryRank: 31, sector: 'futures' }),
  // Perps
  T({ id: 'marketmonk', name: 'MarketMonk', initials: 'MM', country: 'India', payouts: 88_200, payoutCount: 24, highestAllocation: 400_000, worldRank: 312, countryRank: 4, sector: 'perps' }),
  T({ id: 'quantwolf', name: 'QuantWolf', initials: 'QW', country: 'Netherlands', payouts: 38_750, payoutCount: 15, highestAllocation: 250_000, worldRank: 744, countryRank: 3, sector: 'perps' }),
  T({ id: 'fundingrate', name: 'FundingRate', country: 'Vietnam', payouts: 21_900, payoutCount: 12, highestAllocation: 200_000, worldRank: 1_040, countryRank: 2, sector: 'perps' }),
  T({ id: 'perppilot', name: 'PerpPilot', country: 'Turkey', payouts: 6_800, payoutCount: 4, highestAllocation: 100_000, worldRank: 2_710, countryRank: 9, sector: 'perps' }),
  T({ id: 'basisbro', name: 'BasisBro', country: 'Portugal', payouts: 1, payoutCount: 1, highestAllocation: 25_000, worldRank: 9_880, countryRank: 61, sector: 'perps' }),
];

type Extra = [id: string, name: string, country: string, payouts: number, count: number, alloc: number, level: TowerLevel, sector: SectorId];
/** More verified traders so every sector is built up (50 towers in total). */
const EXTRA: Extra[] = [
  // CFD
  ['goldgrid', 'GoldGrid', 'United Arab Emirates', 4_320_000, 264, 3_000_000, 5, 'cfd'],
  ['pipmaster', 'PipMaster', 'Nigeria', 1_740_000, 152, 2_000_000, 4, 'cfd'],
  ['londonsession', 'LondonSession', 'United Kingdom', 214_500, 48, 800_000, 4, 'cfd'],
  ['carrytrade', 'CarryTrade', 'Japan', 58_300, 20, 400_000, 3, 'cfd'],
  ['eurovision', 'EuroVision', 'France', 44_900, 17, 300_000, 2, 'cfd'],
  ['rangequeen', 'RangeQueen', 'Kenya', 12_700, 6, 150_000, 2, 'cfd'],
  ['gbpguru', 'GBPGuru', 'Pakistan', 5_400, 3, 100_000, 1, 'cfd'],
  ['firstpayout', 'FirstPayout', 'Philippines', 650, 1, 25_000, 1, 'cfd'],
  // Futures
  ['nqnomad', 'NQNomad', 'United States', 3_180_000, 233, 2_500_000, 5, 'futures'],
  ['crudeclarity', 'CrudeClarity', 'Norway', 412_800, 63, 1_000_000, 4, 'futures'],
  ['ymyield', 'YMYield', 'Canada', 176_200, 41, 600_000, 4, 'futures'],
  ['rtyrocket', 'RTYRocket', 'United States', 93_400, 29, 450_000, 3, 'futures'],
  ['cbotcarla', 'CBOTCarla', 'Argentina', 52_100, 22, 300_000, 3, 'futures'],
  ['microminer', 'MicroMiner', 'Chile', 28_600, 13, 150_000, 2, 'futures'],
  ['gcgrinder', 'GCGrinder', 'Italy', 14_300, 7, 150_000, 2, 'futures'],
  ['opendrive', 'OpenDrive', 'Ireland', 2_900, 2, 50_000, 1, 'futures'],
  ['tickone', 'TickOne', 'Greece', 420, 1, 50_000, 1, 'futures'],
  // Perps
  ['deltaneutral', 'DeltaNeutral', 'Switzerland', 1_210_000, 131, 1_500_000, 4, 'perps'],
  ['solsurfer', 'SolSurfer', 'South Korea', 131_500, 35, 500_000, 3, 'perps'],
  ['oiwatcher', 'OIWatcher', 'Thailand', 47_800, 16, 250_000, 2, 'perps'],
  ['markprice', 'MarkPrice', 'Indonesia', 9_100, 5, 100_000, 1, 'perps'],
  ['wickhunter', 'WickHunter', 'Ukraine', 2_250, 2, 50_000, 1, 'perps'],
  // Multi-Assets
  ['globalmacro', 'GlobalMacro', 'Hong Kong', 12_400_000, 540, 6_000_000, 5, 'multi'],
  ['correlationcat', 'CorrelationCat', 'Sweden', 301_700, 59, 1_000_000, 4, 'multi'],
  ['allweather', 'AllWeather', 'Australia', 64_500, 23, 400_000, 3, 'multi'],
  ['riskparity', 'RiskParity', 'Austria', 18_200, 8, 200_000, 2, 'multi'],
  ['hedgehog', 'HedgeHog', 'Lebanon', 3_300, 2, 50_000, 1, 'multi'],
];
for (const [id, name, country, payouts, payoutCount, highestAllocation, , sector] of EXTRA) {
  TRADERS_SEED.push(T({ id, name, country, payouts, payoutCount, highestAllocation, sector, worldRank: 0, countryRank: 1 + (payoutCount % 17) }));
}
// world rank follows verified payouts (roughly spread across the global leaderboard)
[...TRADERS_SEED].sort((a, b) => b.payouts - a.payouts).forEach((t) => {
  if (t.worldRank === 0) t.worldRank = Math.max(3, Math.round(9_000 / (1 + t.payouts / 2_500)) + (t.payoutCount % 13));
});

const NAMES = [
  'NovaPips', 'CandleCraft', 'RiskRider', 'BlueCandle', 'ZenScalper', 'MorningGap', 'LotSizeLeo', 'TrendTariq',
  'PivotPia', 'SpreadSage', 'WickWatcher', 'RangeRuby', 'DeltaDan', 'GammaGrace', 'FibFelix', 'VWAPVera',
  'SwapSami', 'HedgeHana', 'BreakevenBo', 'ATRAmir', 'LiquidLuna', 'ScalpSeo', 'MacroMilo', 'TapeTess',
  'OpenRangeOmar', 'GoldGabi', 'NFPNoor', 'PerpPaolo', 'SessionSara', 'BiasBen', 'TickTina',
];
const PRE = ['Alpha', 'Sigma', 'Theta', 'Vega', 'Kappa', 'Omega', 'Pip', 'Lot', 'Trend', 'Gap', 'Range', 'Swing', 'Momentum', 'Carry', 'Spread', 'Order', 'Volume', 'Futures', 'Index', 'Gold'];
const FIRST = ['Ali', 'Lina', 'Omar', 'Sara', 'Leo', 'Maya', 'Noah', 'Zara', 'Ivan', 'Yara', 'Hugo', 'Nia', 'Ines', 'Kofi', 'Mei', 'Rui', 'Aya', 'Sami', 'Dana', 'Tomas'];
/** 99 registered traders without a payout yet (house #100 is kept free for the signed-up user). */
const RESIDENT_NAMES: string[] = (() => {
  const out = [...NAMES];
  for (let k = 0; out.length < 99; k++) {
    const n = PRE[(k * 7) % PRE.length] + FIRST[(k * 3 + Math.floor(k / PRE.length)) % FIRST.length];
    if (!out.includes(n)) out.push(n);
  }
  return out;
})();
const COUNTRIES = ['Jordan', 'UAE', 'Portugal', 'India', 'Nigeria', 'Brazil', 'Spain', 'Egypt', 'Kenya', 'Philippines', 'Germany', 'Morocco', 'Turkey', 'Mexico', 'Pakistan', 'Canada'];
const SECTORS: SectorId[] = ['cfd', 'futures', 'perps', 'multi'];
const MONTHS = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];

export function createResidents(): Resident[] {
  return RESIDENT_NAMES.map((name, i) => ({
    id: `house-${i + 1}`,
    name,
    country: COUNTRIES[(i * 7) % COUNTRIES.length],
    joined: `${MONTHS[i % MONTHS.length]} 2026`,
    sector: SECTORS[(i * 3) % 4],
  }));
}

/** The old City Spaces block is now THE LAB (see lab.ts); lease spaces are rented there as lab bays. */
export const COMMERCIAL_SPACES: CommercialSpace[] = [];

export const CITY_STATS = {
  activeTraders: 12_482,
  verifiedPayouts: 41_600_000,
  totalTraders: 86_521,
  propFirmPartners: 25,
};

export interface ActivityItem {
  text: string;
  kind: 'payout' | 'join' | 'achievement';
  ago: string;
}

export const ACTIVITY_SEED: ActivityItem[] = [
  { text: '<b>Kareem Capital</b> received a verified <b>$8,000</b> payout', kind: 'payout', ago: '2m' },
  { text: '<b>SnowFX</b> received a verified <b>$12,500</b> payout', kind: 'payout', ago: '6m' },
  { text: '<b>TradeZ</b> joined the <b>Futures Sector</b>', kind: 'join', ago: '14m' },
  { text: '<b>SamFX</b> unlocked <b>Consistency King</b>', kind: 'achievement', ago: '21m' },
];

/** Fresh deep copy so "Reset demo" can always return to the original mock state. */
export function createTraders(): Trader[] {
  return TRADERS_SEED.map((t) => ({ ...t, plot: { ...t.plot } }));
}
