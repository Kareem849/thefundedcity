// Prop-firm tournaments shown at the Liquidation Arena.
// Firms (people holding a firm club pass) publish their own tournaments; until real ones are published,
// clearly labelled SAMPLE listings fill the screens so the arena never looks empty.

export interface Tournament {
  id: string;
  organizer: string;
  firmId?: string;
  sample: boolean;
  /** character name of whoever published it (real listings) */
  publishedBy?: string;
  title: string;
  start: number;
  end: number;
  prizePool: number;
  prizes: string;
  entry: string;
  format: string;
  link?: string;
  /** sample standings for live sample listings */
  leaders?: Array<{ name: string; pct: number }>;
}

export type TourStatus = 'live' | 'upcoming' | 'ended';

export function tourStatus(t: Tournament, now = Date.now()): TourStatus {
  if (now < t.start) return 'upcoming';
  if (now > t.end) return 'ended';
  return 'live';
}

const DAY = 86_400_000;

/** Sample listings, positioned relative to today so some are always live and some upcoming. */
export function sampleTournaments(now = Date.now()): Tournament[] {
  const d0 = new Date(now);
  d0.setUTCHours(13, 30, 0, 0);
  const at = (days: number) => d0.getTime() + days * DAY;
  return [
    {
      id: 's-nas-sprint', organizer: 'Sample listing', sample: true, title: 'NAS100 Sprint', start: at(-3), end: at(4),
      prizePool: 50_000, prizes: '1st $20,000 funded account · 2nd $10,000 · 3rd $5,000 · top 50 free challenge', entry: 'Free',
      format: '7-day P&L race on a $100K demo · 5% max drawdown', leaders: [{ name: 'NQNomad', pct: 14.2 }, { name: 'GlobalMacro', pct: 11.8 }, { name: 'SnowFX', pct: 9.6 }],
    },
    {
      id: 's-gold-rush', organizer: 'Sample listing', sample: true, title: 'Gold Rush Championship', start: at(-1), end: at(13),
      prizePool: 120_000, prizes: '1st $50,000 · 2nd $25,000 · 3rd $10,000 · 4th–20th funded accounts', entry: '$49',
      format: 'XAUUSD only · two-week leaderboard · consistency rule', leaders: [{ name: 'GoldGrid', pct: 8.4 }, { name: 'Kareem Capital', pct: 7.1 }, { name: 'TradeZ', pct: 6.3 }],
    },
    {
      id: 's-futures-cup', organizer: 'Sample listing', sample: true, title: 'Futures Cup · ES & NQ', start: at(5), end: at(19),
      prizePool: 250_000, prizes: '1st $100,000 · 2nd $50,000 · 3rd $25,000 · top 100 rewards', entry: '$99',
      format: 'CME micro & mini futures · daily loss limit · live leaderboard on the arena screens',
    },
    {
      id: 's-perps-night', organizer: 'Sample listing', sample: true, title: 'Perps Night League', start: at(9), end: at(23),
      prizePool: 30_000, prizes: '1st $12,000 in USDC · 2nd $6,000 · 3rd $3,000', entry: 'Free',
      format: 'BTC & ETH perps · 24/7 · weekly rounds',
    },
    {
      id: 's-rookie', organizer: 'Sample listing', sample: true, title: 'Rookie Challenge Cup', start: at(2), end: at(9),
      prizePool: 15_000, prizes: 'Ten $10K funded accounts and ten $5K funded accounts', entry: 'Free for first-time traders',
      format: 'Forex majors · beginners only · risk-adjusted ranking',
    },
  ];
}

export const fmtMoney = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(n % 1e6 ? 1 : 0)}M` : n >= 1000 ? `$${Math.round(n / 1000)}K` : `$${n}`);

export function countdown(ms: number) {
  if (ms <= 0) return 'now';
  const d = Math.floor(ms / DAY);
  const h = Math.floor((ms % DAY) / 3_600_000);
  if (d >= 1) return `${d}d ${h}h`;
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}
