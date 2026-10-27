// MEDIA DISTRICT data: economic calendar, theater programme, market quotes and headlines.
//
// Everything here is a researched SNAPSHOT (week of 26–30 Oct 2026) behind a small feed interface.
// The published artifact cannot call other websites, so prices "move" with a labelled, indicative
// simulation around the snapshot. To go live, implement `MediaFeed` against your data provider
// (calendar, quotes, headlines) and call `setMediaFeed(myFeed)` — the city, the theater screen,
// the tickers and the Media Center panel all read through it.

export type Impact = 'high' | 'medium' | 'low' | 'none';

export const IMPACT_LABEL: Record<Impact, string> = {
  high: 'High impact',
  medium: 'Medium impact',
  low: 'Low impact',
  none: 'Non-economic',
};
/** ForexFactory-style folder colours: red, orange, yellow, grey. */
export const IMPACT_COLOR: Record<Impact, string> = {
  high: '#e5383b',
  medium: '#f08c2e',
  low: '#f2c230',
  none: '#9aa3b2',
};

export interface CalEvent {
  id: string;
  /** Release time, ms since epoch (UTC). */
  t: number;
  /** Shown as "All day" instead of a clock time. */
  allDay?: boolean;
  cur: string;
  impact: Impact;
  title: string;
  actual?: string;
  forecast?: string;
  previous?: string;
  /** Theater programme id when the event is broadcast. */
  broadcast?: string;
  note?: string;
}

export interface Broadcast {
  id: string;
  title: string;
  host: string;
  /** Scheduled start (ms UTC); omit when times are announced at short notice. */
  t?: number;
  /** Expected length in minutes (for the LIVE window). */
  minutes: number;
  /** Where to watch. `youtube` is a channel live page or a search; `site` is the official page. */
  youtube: string;
  site?: string;
  blurb: string;
}

export type QuoteGroup = 'fx' | 'index' | 'commodity' | 'crypto' | 'rates';
export interface Quote {
  sym: string;
  name: string;
  group: QuoteGroup;
  price: number;
  /** Session reference used for the change figure. */
  open: number;
  decimals: number;
  /** Rough intraday volatility per simulated step (fraction of price). */
  vol: number;
  history: number[];
}

export interface Headline {
  id: string;
  text: string;
  source: string;
  url: string;
  urgent?: boolean;
  /** ms UTC (approximate publication time). */
  t: number;
}

export interface MediaFeed {
  name: string;
  live: boolean;
  calendar(): CalEvent[];
  broadcasts(): Broadcast[];
  quotes(): Quote[];
  headlines(): Headline[];
  /** Advance prices; the snapshot feed simulates, a live feed would poll/stream. */
  tick?(dt: number): void;
}

export const SNAPSHOT_DATE = '26 Oct 2026';

/* ------------------------------------------------------------------ */
/* calendar — times in UTC (US on EDT = UTC−4 this week; UK/EU on winter time) */
/* ------------------------------------------------------------------ */
const u = (iso: string) => Date.parse(iso + ':00Z');

const CALENDAR: CalEvent[] = [
  // Mon 26 Oct
  { id: 'cn-plenum', t: u('2026-10-26T00:00'), allDay: true, cur: 'CNY', impact: 'none', title: 'CPC Fifth Plenum (26–29 Oct)' },
  { id: 'de-ifo', t: u('2026-10-26T09:00'), cur: 'EUR', impact: 'medium', title: 'German Ifo Business Climate' },
  { id: 'us-cfnai', t: u('2026-10-26T12:30'), cur: 'USD', impact: 'low', title: 'Chicago Fed National Activity Index' },
  { id: 'us-dallas', t: u('2026-10-26T14:30'), cur: 'USD', impact: 'low', title: 'Dallas Fed Manufacturing Index' },
  { id: 'us-2y', t: u('2026-10-26T17:00'), cur: 'USD', impact: 'low', title: '2-Year Note Auction ($69bn)' },
  // Tue 27 Oct
  { id: 'il-elect', t: u('2026-10-27T00:00'), allDay: true, cur: 'ILS', impact: 'none', title: 'Israel — Knesset election' },
  { id: 'cn-profits', t: u('2026-10-27T01:30'), cur: 'CNY', impact: 'low', title: 'Industrial Profits y/y' },
  { id: 'us-durables', t: u('2026-10-27T12:30'), cur: 'USD', impact: 'high', title: 'Core Durable Goods Orders m/m' },
  { id: 'us-durables-h', t: u('2026-10-27T12:30'), cur: 'USD', impact: 'medium', title: 'Durable Goods Orders m/m' },
  { id: 'us-cs', t: u('2026-10-27T13:00'), cur: 'USD', impact: 'low', title: 'S&P/Case-Shiller Home Prices y/y' },
  { id: 'us-cb', t: u('2026-10-27T14:00'), cur: 'USD', impact: 'high', title: 'CB Consumer Confidence' },
  { id: 'us-nhs', t: u('2026-10-27T14:00'), cur: 'USD', impact: 'medium', title: 'New Home Sales' },
  { id: 'us-rich', t: u('2026-10-27T14:00'), cur: 'USD', impact: 'low', title: 'Richmond Fed Manufacturing Index' },
  { id: 'us-5y', t: u('2026-10-27T17:00'), cur: 'USD', impact: 'low', title: '5-Year Note Auction' },
  { id: 'us-api', t: u('2026-10-27T20:30'), cur: 'USD', impact: 'low', title: 'API Weekly Crude Stocks' },
  // Wed 28 Oct
  { id: 'au-cpi', t: u('2026-10-28T00:30'), cur: 'AUD', impact: 'high', title: 'CPI q/q (Q3)' },
  { id: 'au-tm', t: u('2026-10-28T00:30'), cur: 'AUD', impact: 'high', title: 'Trimmed Mean CPI q/q (Q3)', forecast: '1.0%' },
  { id: 'nz-ocr', t: u('2026-10-28T01:00'), cur: 'NZD', impact: 'high', title: 'RBNZ Official Cash Rate', forecast: '3.00%', previous: '2.75%' },
  { id: 'de-gfk', t: u('2026-10-28T07:00'), cur: 'EUR', impact: 'low', title: 'German GfK Consumer Climate' },
  { id: 'uk-budget', t: u('2026-10-28T12:30'), cur: 'GBP', impact: 'high', title: 'UK Autumn Budget statement', broadcast: 'uk-budget' },
  { id: 'us-goods', t: u('2026-10-28T12:30'), cur: 'USD', impact: 'low', title: 'Advance Goods Trade Balance' },
  { id: 'ca-boc', t: u('2026-10-28T13:45'), cur: 'CAD', impact: 'high', title: 'BoC Rate Statement & Overnight Rate', forecast: '2.50%', previous: '2.25%' },
  { id: 'ca-boc-pc', t: u('2026-10-28T14:30'), cur: 'CAD', impact: 'high', title: 'BoC Press Conference', broadcast: 'boc-pc' },
  { id: 'us-eia', t: u('2026-10-28T14:30'), cur: 'USD', impact: 'low', title: 'EIA Crude Oil Inventories' },
  { id: 'us-fomc', t: u('2026-10-28T18:00'), cur: 'USD', impact: 'high', title: 'FOMC Statement & Federal Funds Rate', forecast: '4.00%', previous: '4.00%', note: 'Target range 3.75–4.00%; hold expected' },
  { id: 'us-fomc-pc', t: u('2026-10-28T18:30'), cur: 'USD', impact: 'high', title: 'FOMC Press Conference', broadcast: 'fomc-pc' },
  { id: 'us-msft', t: u('2026-10-28T20:05'), cur: 'USD', impact: 'none', title: 'Earnings: Microsoft, Alphabet (after close)' },
  // Thu 29 Oct
  { id: 'ez-esi', t: u('2026-10-29T10:00'), cur: 'EUR', impact: 'low', title: 'Eurozone Economic Sentiment' },
  { id: 'us-gdp', t: u('2026-10-29T12:30'), cur: 'USD', impact: 'high', title: 'Advance GDP q/q (Q3)', forecast: '3.0%', previous: '2.2%' },
  { id: 'us-pce', t: u('2026-10-29T12:30'), cur: 'USD', impact: 'high', title: 'Core PCE Price Index m/m', forecast: '0.3%', previous: '0.2%' },
  { id: 'us-pce-y', t: u('2026-10-29T12:30'), cur: 'USD', impact: 'medium', title: 'Core PCE Price Index y/y', forecast: '3.1%', previous: '3.0%' },
  { id: 'us-claims', t: u('2026-10-29T12:30'), cur: 'USD', impact: 'high', title: 'Unemployment Claims' },
  { id: 'us-spend', t: u('2026-10-29T12:30'), cur: 'USD', impact: 'medium', title: 'Personal Income & Spending m/m' },
  { id: 'ez-ecb', t: u('2026-10-29T13:15'), cur: 'EUR', impact: 'high', title: 'ECB Monetary Policy Decision', forecast: 'Hold' },
  { id: 'ez-ecb-pc', t: u('2026-10-29T13:45'), cur: 'EUR', impact: 'high', title: 'ECB Press Conference', broadcast: 'ecb-pc' },
  { id: 'us-7y', t: u('2026-10-29T17:00'), cur: 'USD', impact: 'low', title: '7-Year Note Auction' },
  { id: 'us-amzn', t: u('2026-10-29T20:05'), cur: 'USD', impact: 'none', title: 'Earnings: Amazon (after close)' },
  { id: 'jp-tokyo', t: u('2026-10-29T23:30'), cur: 'JPY', impact: 'medium', title: 'Tokyo Core CPI y/y', previous: '2.7%' },
  { id: 'jp-unemp', t: u('2026-10-29T23:30'), cur: 'JPY', impact: 'low', title: 'Unemployment Rate' },
  // Fri 30 Oct
  { id: 'jp-boj', t: u('2026-10-30T03:00'), cur: 'JPY', impact: 'high', title: 'BoJ Policy Rate & Outlook Report', forecast: '1.25%', previous: '1.25%', note: 'Release time is tentative' },
  { id: 'jp-boj-pc', t: u('2026-10-30T06:30'), cur: 'JPY', impact: 'high', title: 'BoJ Press Conference', broadcast: 'boj-pc' },
  { id: 'fr-gdp', t: u('2026-10-30T06:30'), cur: 'EUR', impact: 'low', title: 'French Prelim GDP q/q' },
  { id: 'btc-exp', t: u('2026-10-30T08:00'), cur: 'BTC', impact: 'none', title: '≈$11bn Bitcoin options expiry' },
  { id: 'de-gdp', t: u('2026-10-30T09:00'), cur: 'EUR', impact: 'medium', title: 'German Prelim GDP q/q' },
  { id: 'ez-gdp', t: u('2026-10-30T10:00'), cur: 'EUR', impact: 'medium', title: 'Eurozone Flash GDP q/q', forecast: '0.3%' },
  { id: 'ca-gdp', t: u('2026-10-30T12:30'), cur: 'CAD', impact: 'medium', title: 'GDP m/m (Aug)' },
  { id: 'us-eci', t: u('2026-10-30T12:30'), cur: 'USD', impact: 'medium', title: 'Employment Cost Index q/q' },
  { id: 'de-cpi', t: u('2026-10-30T13:00'), cur: 'EUR', impact: 'medium', title: 'German Prelim CPI m/m' },
  { id: 'us-chi', t: u('2026-10-30T13:45'), cur: 'USD', impact: 'low', title: 'Chicago PMI' },
  { id: 'us-xom', t: u('2026-10-30T11:00'), cur: 'USD', impact: 'none', title: 'Earnings: Exxon Mobil, Chevron' },
  // next week
  { id: 'dst', t: u('2026-11-01T06:00'), allDay: true, cur: 'USD', impact: 'none', title: 'US clocks go back (Daylight Saving Time ends)' },
  { id: 'us-midterms', t: u('2026-11-03T00:00'), allDay: true, cur: 'USD', impact: 'none', title: 'US midterm elections' },
].sort((a, b) => a.t - b.t) as CalEvent[];

/* ------------------------------------------------------------------ */
/* theater programme */
/* ------------------------------------------------------------------ */
const yt = (q: string) => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
const BROADCASTS: Broadcast[] = [
  {
    id: 'uk-budget', title: 'UK Autumn Budget statement', host: 'UK Parliament', t: u('2026-10-28T12:30'), minutes: 75,
    youtube: 'https://www.youtube.com/@UKParliament/streams', site: 'https://parliamentlive.tv/',
    blurb: 'The Chancellor delivers the Budget in the House of Commons. GBP and gilts react live.',
  },
  {
    id: 'boc-pc', title: 'Bank of Canada press conference', host: 'Bank of Canada', t: u('2026-10-28T14:30'), minutes: 60,
    youtube: yt('Bank of Canada press conference live'), site: 'https://www.bankofcanada.ca/press/webcasts/',
    blurb: 'Governor’s remarks and Q&A after the rate decision. A 25 bp hike is expected.',
  },
  {
    id: 'fomc-pc', title: 'FOMC press conference', host: 'Federal Reserve', t: u('2026-10-28T18:30'), minutes: 60,
    youtube: 'https://www.youtube.com/@federalreserve/streams', site: 'https://www.federalreserve.gov/live-broadcast.htm',
    blurb: 'The Fed Chair explains the decision 30 minutes after the 2:00 pm ET statement. The biggest volatility event of the week.',
  },
  {
    id: 'ecb-pc', title: 'ECB press conference', host: 'European Central Bank', t: u('2026-10-29T13:45'), minutes: 60,
    youtube: 'https://www.youtube.com/@EuropeanCentralBank/streams', site: 'https://www.ecb.europa.eu/press/tvservices/webcast/html/index.en.html',
    blurb: 'President’s statement and Q&A, 30 minutes after the 13:15 GMT decision.',
  },
  {
    id: 'boj-pc', title: 'BoJ Governor press conference', host: 'Bank of Japan', t: u('2026-10-30T06:30'), minutes: 60,
    youtube: yt('Bank of Japan governor press conference live'), site: 'https://www.boj.or.jp/en/',
    blurb: 'Usually about three hours after the decision; watch USD/JPY and JGB yields.',
  },
  {
    id: 'whitehouse', title: 'White House: President Trump & press briefings', host: 'The White House', minutes: 45,
    youtube: 'https://www.youtube.com/@WhiteHouse/streams', site: 'https://www.whitehouse.gov/live/',
    blurb: 'Remarks and briefings are announced at short notice. With US–Iran tension in the headlines, these can move oil, gold and the dollar.',
  },
];

/* ------------------------------------------------------------------ */
/* quotes — snapshot ≈ 26 Oct 2026 European session (rounded) */
/* ------------------------------------------------------------------ */
type Q0 = [sym: string, name: string, group: QuoteGroup, price: number, changePct: number, decimals: number, vol: number];
const QUOTES0: Q0[] = [
  ['EUR/USD', 'Euro / US Dollar', 'fx', 1.1220, 0.05, 4, 0.00012],
  ['GBP/USD', 'Pound / US Dollar', 'fx', 1.3370, 0.08, 4, 0.00014],
  ['USD/JPY', 'US Dollar / Yen', 'fx', 157.00, 0.10, 2, 0.00016],
  ['AUD/USD', 'Aussie / US Dollar', 'fx', 0.7070, 0.04, 4, 0.00016],
  ['USD/CAD', 'US Dollar / Loonie', 'fx', 1.3970, -0.03, 4, 0.00010],
  ['USD/CHF', 'US Dollar / Franc', 'fx', 0.8190, 0.02, 4, 0.00012],
  ['NZD/USD', 'Kiwi / US Dollar', 'fx', 0.5760, 0.06, 4, 0.00018],
  ['DXY', 'US Dollar Index', 'fx', 101.50, 0.02, 2, 0.0001],
  ['US500', 'S&P 500', 'index', 7624, -0.5, 1, 0.00022],
  ['US100', 'Nasdaq 100', 'index', 28958, 0.0, 1, 0.00028],
  ['US30', 'Dow Jones 30', 'index', 52215, -1.2, 0, 0.0002],
  ['DE40', 'DAX 40', 'index', 25850, 0.9, 0, 0.00022],
  ['UK100', 'FTSE 100', 'index', 10741, 0.48, 1, 0.00018],
  ['JP225', 'Nikkei 225', 'index', 62435, -0.8, 0, 0.00025],
  ['HK50', 'Hang Seng', 'index', 23215, 0.0, 0, 0.00025],
  ['XAU/USD', 'Gold', 'commodity', 4008, 0.2, 2, 0.0003],
  ['UKOIL', 'Brent crude', 'commodity', 114.9, -1.2, 2, 0.0006],
  ['BTC/USD', 'Bitcoin', 'crypto', 79350, -0.87, 0, 0.0006],
  ['ETH/USD', 'Ethereum', 'crypto', 2294, -1.42, 2, 0.0008],
  ['US10Y', 'US 10-year yield', 'rates', 4.80, -0.4, 3, 0.0004],
  ['VIX', 'Volatility index', 'rates', 19.45, 2.21, 2, 0.0012],
];

function makeQuotes(): Quote[] {
  return QUOTES0.map(([sym, name, group, price, chg, decimals, vol]) => {
    const open = price / (1 + chg / 100);
    // seed a short history so sparklines aren't flat on first paint
    const history: number[] = [];
    let p = open;
    for (let i = 0; i < 39; i++) {
      p += (price - p) * 0.08 + (Math.random() - 0.5) * 2 * vol * price;
      history.push(p);
    }
    history.push(price);
    return { sym, name, group, price, open, decimals, vol, history };
  });
}

/* ------------------------------------------------------------------ */
/* headlines (paraphrased) */
/* ------------------------------------------------------------------ */
const SAXO = 'https://www.home.saxo/en-gb/content/articles/macro/market-quick-take---big-week-ahead-as-fomc-ecb-and-boj-all-to-meet---26-october-2026-26102026';
const MKS = 'https://www.marketscreener.com/news/defence-supports-ftse-100-but-oil-majors-fall-ce785cdcda88f024';
const HEADLINES: Headline[] = [
  { id: 'h1', urgent: true, t: u('2026-10-26T06:00'), source: 'Saxo / wires', url: SAXO, text: 'Houthi attacks on Saudi Arabia continue; Riyadh’s main airport reopens after a two-week shutdown' },
  { id: 'h2', urgent: true, t: u('2026-10-26T06:10'), source: 'Saxo / wires', url: SAXO, text: 'Trump says he is close to deciding between another strike on Iran or a deal' },
  { id: 'h3', urgent: true, t: u('2026-10-26T11:00'), source: 'Alliance News via MarketScreener', url: MKS, text: 'Brent eases to about $115 after topping $117 on Friday as oil majors weigh on the FTSE' },
  { id: 'h4', t: u('2026-10-26T05:30'), source: 'Saxo / wires', url: SAXO, text: 'Lula narrowly wins Brazil’s runoff with about 51%; the real falls sharply in futures' },
  { id: 'h5', t: u('2026-10-26T05:40'), source: 'Saxo / wires', url: SAXO, text: 'Moody’s keeps France at Aa3, negative outlook; OAT–Bund spread near its widest since 2011' },
  { id: 'h6', t: u('2026-10-26T11:30'), source: 'Alliance News via MarketScreener', url: MKS, text: 'UK sets a path to 3% of GDP on defence by 2030; FTSE 100 up about 0.5% into Budget week' },
  { id: 'h7', t: u('2026-10-26T06:20'), source: 'Saxo', url: SAXO, text: 'Central bank week: RBNZ and BoC seen hiking 25 bp; Fed, ECB and BoJ expected to hold' },
  { id: 'h8', t: u('2026-10-26T06:30'), source: 'Saxo', url: SAXO, text: 'Spot bitcoin ETFs saw about $773m of net outflows on 22–23 Oct' },
  { id: 'h9', t: u('2026-10-26T06:40'), source: 'Saxo', url: SAXO, text: 'Gold holds above $4,000 after its biggest weekly drop since June' },
  { id: 'h10', t: u('2026-10-26T06:50'), source: 'Saxo', url: SAXO, text: 'UMich consumer sentiment revised to 48.0, still a five-month low; 1-year inflation expectations 4.7%' },
];

/** Outlets to follow for live coverage (outbound links). */
export const NEWS_OUTLETS: Array<{ name: string; url: string }> = [
  { name: 'ForexFactory calendar', url: 'https://www.forexfactory.com/calendar' },
  { name: 'Investing.com calendar', url: 'https://www.investing.com/economic-calendar/' },
  { name: 'Reuters Markets', url: 'https://www.reuters.com/markets/' },
  { name: 'Bloomberg Markets', url: 'https://www.bloomberg.com/markets' },
  { name: 'CNN Business', url: 'https://edition.cnn.com/business' },
  { name: 'BBC Business', url: 'https://www.bbc.com/business' },
  { name: 'Al Jazeera Economy', url: 'https://www.aljazeera.com/economy/' },
];

export const MEDIA_SOURCES: Array<{ name: string; url: string }> = [
  { name: 'Federal Reserve — October 2026 calendar', url: 'https://www.federalreserve.gov/newsevents/2026-october.htm' },
  { name: 'Newsquawk — Week in focus 26–30 Oct', url: 'https://www.newsquawk.com/headlines/week-in-focus-26-30th-october-2026-fomc-boc-rbnz-ecb-boj-policy-decisions-us-pce' },
  { name: 'eoption — Weekly event calendar', url: 'https://www.eoption.com/weekly-event-calendar-10-26-2026-10-30-2026/' },
  { name: 'Saxo — Market Quick Take, 26 Oct', url: SAXO },
  { name: 'NordFX — Market pulse, 26 Oct', url: 'https://nordfx.com/market-news/market-pulse-october-26-2026' },
  { name: 'MarketScreener / Alliance News — FTSE, Brent', url: MKS },
  { name: 'IC Markets — Technical outlook, 26 Oct', url: 'https://www.icmarkets.com.au/blog/monday-26th-october-2026-technical-outlook-and-review/' },
];

/* ------------------------------------------------------------------ */
/* snapshot feed with indicative price simulation */
/* ------------------------------------------------------------------ */
function createSnapshotFeed(): MediaFeed {
  const quotes = makeQuotes();
  const anchor = new Map(quotes.map((q) => [q.sym, q.price]));
  let acc = 0;
  return {
    name: `Snapshot ${SNAPSHOT_DATE}`,
    live: false,
    calendar: () => CALENDAR,
    broadcasts: () => BROADCASTS,
    quotes: () => quotes,
    headlines: () => HEADLINES,
    tick(dt) {
      acc += dt;
      if (acc < 1.5) return;
      acc = 0;
      for (const q of quotes) {
        // mean-reverting random walk so prices stay near the researched snapshot
        const drift = (anchor.get(q.sym)! - q.price) * 0.01;
        q.price = Math.max(q.price * 0.5, q.price + drift + (Math.random() - 0.5) * 2 * q.vol * q.price);
        q.history.push(q.price);
        if (q.history.length > 60) q.history.shift();
      }
    },
  };
}

let feed: MediaFeed = createSnapshotFeed();
const listeners: Array<() => void> = [];
export function getMediaFeed(): MediaFeed {
  return feed;
}
/** Plug in a live provider; every Media District view re-reads through it. */
export function setMediaFeed(f: MediaFeed) {
  feed = f;
  for (const l of listeners) l();
}
export function onMediaFeedChange(fn: () => void) {
  listeners.push(fn);
}

/* ------------------------------------------------------------------ */
/* helpers */
/* ------------------------------------------------------------------ */
export function fmtPrice(q: Quote) {
  return q.price.toLocaleString('en-US', { minimumFractionDigits: q.decimals, maximumFractionDigits: q.decimals });
}
export function changePct(q: Quote) {
  return (q.price / q.open - 1) * 100;
}

/** "2d 04:12:09" / "04:12:09" / "12:09" */
export function fmtCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  if (d > 0) return `${d}d ${p(h)}:${p(m)}:${p(sec)}`;
  if (h > 0) return `${p(h)}:${p(m)}:${p(sec)}`;
  return `${p(m)}:${p(sec)}`;
}

/** Upcoming (or just-started) events, soonest first. */
export function upcoming(events: CalEvent[], now: number, impacts: Impact[] = ['high'], limit = 4): CalEvent[] {
  const seen = new Set<string>();
  return events
    .filter((e) => !e.allDay && impacts.includes(e.impact) && e.t > now - 60_000)
    .filter((e) => {
      // collapse simultaneous releases into one countdown (e.g. GDP + PCE at 12:30)
      const k = `${e.t}-${e.cur}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, limit);
}

/** Broadcast currently on air, or the next scheduled one. */
export function nowShowing(list: Broadcast[], now: number): { b: Broadcast | null; live: boolean } {
  for (const b of list) if (b.t && now >= b.t && now < b.t + b.minutes * 60_000) return { b, live: true };
  const next = list.filter((b) => b.t && b.t > now).sort((a, b) => a.t! - b.t!)[0];
  return { b: next ?? null, live: false };
}

/** Extract a YouTube video id from a pasted link. */
export function youtubeId(url: string): string | null {
  try {
    const x = new URL(url.trim());
    if (x.hostname === 'youtu.be') return x.pathname.slice(1).split('/')[0] || null;
    if (/(^|\.)youtube(-nocookie)?\.com$/.test(x.hostname)) {
      if (x.searchParams.get('v')) return x.searchParams.get('v');
      const m = x.pathname.match(/\/(embed|live|shorts)\/([\w-]{6,})/);
      if (m) return m[2];
    }
  } catch { /* not a URL */ }
  return null;
}
