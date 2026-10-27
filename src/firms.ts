// Prop firm directory for the Corporate Ring.
// Every firm's real, published plans: each program with its account sizes and the price of every size
// (`tiers`), targets, loss limits and split. Researched 26–27 Oct 2026 from the source listed per firm
// (`checked` is the date that source last verified the firm's terms). Prices are list prices before
// discount codes; firms change prices and rules often, so the card always shows the source and asks
// visitors to confirm on the firm's own website. Nothing here is sample data.

export type FirmCategory = 'cfd' | 'futures' | 'perps';

export interface FirmPlan {
  program: string;
  sizes: string;
  price: string;
  target: string;
  dailyLoss: string;
  maxLoss: string;
  split: string;
  /** every account size with its price */
  tiers?: string;
}

export interface FirmOffer {
  code?: string;
  text: string;
  seen?: string;
}

export interface Firm {
  id: string;
  /** Short name shown on the rooftop signboard. */
  sign: string;
  name: string;
  category: FirmCategory;
  tagline: string;
  website: string;
  founded?: string;
  hq?: string;
  status?: 'live' | 'relaunching';
  split: string;
  payouts: string;
  platforms: string[];
  assets: string;
  plans: FirmPlan[];
  services: string[];
  offers: FirmOffer[];
  notes?: string;
  source: { label: string; url: string };
  /** Optional official logo (data: URI or same-origin file). Add once the firm provides a brand kit. */
  logo?: string;
  /** when the source last verified these terms (falls back to RESEARCHED_ON) */
  checked?: string;
}

export const CATEGORY_LABEL: Record<FirmCategory, string> = { cfd: 'CFD', futures: 'Futures', perps: 'Perps' };
export const CATEGORY_COLOR: Record<FirmCategory, number> = { cfd: 0x2f6bff, futures: 0x14a37f, perps: 0x7c5cff };

const PFM = (slug: string) => ({ label: 'PropFirmMap', url: `https://propfirmmap.com/firms/${slug}` });

export const FIRMS: Firm[] = [
  /* ============================== CFD ============================== */
  {
    id: 'ftmo', sign: 'FTMO', name: 'FTMO', category: 'cfd', tagline: 'CFD challenges since 2015',
    website: 'https://ftmo.com', founded: '2015', hq: 'Prague, Czech Republic',
    split: 'Up to 90%', payouts: 'Every 14 days · 1–2 business days to process',
    platforms: ['MT4', 'MT5', 'cTrader'], assets: 'Forex, indices, commodities, stocks, crypto',
    plans: [
      { program: '2-Step Challenge', sizes: '$10K–$200K', price: '€89–€1,080', target: '10% / 5%', dailyLoss: '5%', maxLoss: '10% static', split: '80% → 90%', tiers: '10K €89 · 25K €250 · 50K €345 · 100K €540 · 200K €1,080' },
      { program: '1-Step Challenge', sizes: '$10K–$200K', price: '€79–€999', target: '10%', dailyLoss: '3%', maxLoss: '10%', split: '90%', tiers: '10K €79 · 25K €199 · 50K €319 · 100K €499 · 200K €999' },
    ],
    services: ['No activation fee', 'Fee refunded on the first reward ($10K 2-Step)', 'Payouts by crypto, Skrill, card or wire'],
    offers: [{ text: '20% off the $100K 1-Step challenge, no code needed', seen: 'Aug 2026' }],
    source: { label: 'PropFirmsFinder', url: 'https://propfirmsfinder.com/prop-firm/ftmo/challenges/' }, checked: '16 Apr 2026',
  },
  {
    id: 'fundednext', sign: 'FundedNext', name: 'FundedNext', category: 'cfd', tagline: 'Stellar CFD challenges',
    website: 'https://fundednext.com', founded: '2022', hq: 'United States',
    split: 'Up to 95%', payouts: 'First after 21 days, then every 14 days · 24h processing guarantee',
    platforms: ['MT4', 'MT5', 'cTrader', 'Match Trader'], assets: 'Forex, indices, commodities, stocks, crypto',
    plans: [
      { program: 'Stellar 2-Step', sizes: '$6K–$200K', price: '$49.99–$1,049.99', target: '8% / 5%', dailyLoss: '5%', maxLoss: '10% static', split: 'Up to 95%', tiers: '6K $49.99 · 15K $109.99 · 25K $189.99 · 50K $269.99 · 100K $529.99 · 200K $1,049.99' },
      { program: 'Stellar 1-Step', sizes: '$6K–$200K', price: '$55.99–$1,049.99', target: '10%', dailyLoss: '3%', maxLoss: '6% static', split: 'Up to 95%', tiers: '6K $55.99 · 15K $119.99 · 25K $199.99 · 50K $309.99 · 100K $549.99 · 200K $1,049.99' },
      { program: 'Stellar Lite', sizes: '$5K–$200K', price: '$32.99–$798.99', target: '8% / 4%', dailyLoss: '4%', maxLoss: '8% static', split: 'Up to 95%', tiers: '5K $32.99 · 10K $59.99 · 25K $139.99 · 50K $229.99 · 100K $399.99 · 200K $798.99' },
      { program: 'Stellar Instant', sizes: '$2K–$20K', price: '$59.99–$599.99', target: 'None', dailyLoss: 'None', maxLoss: '6% trailing', split: 'Up to 80%', tiers: '2K $59.99 · 5K $149.99 · 10K $299.99 · 20K $599.99' },
    ],
    services: ['$1,000 extra if a payout misses the 24h guarantee', 'Payouts via crypto, Rise, wire or USDC'],
    offers: [
      { code: 'NEW25', text: '25% off Stellar $2K–$50K for new users' },
      { code: 'INSTANT30', text: '30% off Stellar Instant', seen: 'Sep 2026' },
      { code: 'START6K', text: '50% off the Stellar 2-Step $6K' },
    ],
    source: { label: 'PropFirmMap', url: 'https://propfirmmap.com/firms/fundednext' }, checked: '26 Oct 2026',
  },
  {
    id: 'fundingpips', sign: 'FundingPips', name: 'FundingPips', category: 'cfd', tagline: 'Low-cost CFD funding',
    website: 'https://fundingpips.com', founded: '2022', hq: 'United Arab Emirates',
    split: '60–100% depending on plan', payouts: 'Weekly, bi-weekly, monthly or on demand by model · 1–3 working days',
    platforms: ['MT5', 'cTrader', 'Match Trader'], assets: 'Forex, metals, crypto, indices, oil',
    plans: [
      { program: '2-Step Standard', sizes: '$5K–$100K', price: '$39–$529', target: '8% / 5%', dailyLoss: '5%', maxLoss: '10% static', split: '60–100% by payout schedule', tiers: '5K $39 · 10K $66 · 25K $156 · 50K $289 · 100K $529' },
      { program: '2-Step Pro', sizes: '$5K–$200K', price: '$29–$798', target: '6% / 6%', dailyLoss: '3%', maxLoss: '6% static', split: '80%', tiers: '5K $29 · 10K $55 · 25K $109 · 50K $219 · 100K $399 · 200K $798' },
      { program: '1-Step', sizes: '$5K–$100K', price: '$59–$555', target: '10%', dailyLoss: '3%', maxLoss: '6% static', split: '60–100% by payout schedule', tiers: '5K $59 · 10K $99 · 25K $199 · 50K $319 · 100K $555' },
      { program: 'Zero (instant)', sizes: '$5K–$200K', price: '$69–$998', target: 'None', dailyLoss: '3%', maxLoss: '5% trailing', split: '95%', tiers: '5K $69 · 10K $99 · 25K $199 · 50K $299 · 100K $499 · 200K $998' },
    ],
    services: ['Payouts via Rise, crypto or wire', 'Minimum withdrawal 1% of account size'],
    offers: [
      { code: 'FP', text: '10% off for new users, 5% for existing', seen: 'Oct 2026' },
      { code: 'HELLO', text: '20% off your first challenge (excludes $100K)', seen: 'Sep 2026' },
    ],
    source: { label: 'PropFirmsFinder', url: 'https://propfirmsfinder.com/prop-firm/fundingpips/challenges/' }, checked: '20 Oct 2026',
  },
  {
    id: 'alphacapital', sign: 'Alpha Capital', name: 'Alpha Capital Group', category: 'cfd', tagline: 'UK CFD evaluations',
    website: 'https://alphacapitalgroup.uk', founded: '2021', hq: 'United Kingdom',
    split: '80%', payouts: 'Every 14 days ($100 min) or on demand',
    platforms: ['MT5', 'cTrader', 'DXtrade', 'TradeLocker'], assets: 'CFDs',
    plans: [
      { program: 'Alpha One (1-Step)', sizes: '$5K–$200K', price: '$50–$997', target: '10%', dailyLoss: '4%', maxLoss: '6% trailing', split: '80%', tiers: '5K $50 · 10K $97 · 25K $197 · 50K $297 · 100K $497 · 200K $997' },
      { program: 'Alpha Pro (2-Step)', sizes: '$5K–$200K', price: '$50–$997', target: '10% / 5%', dailyLoss: '5%', maxLoss: '10% static', split: '80%', tiers: '5K $50 · 10K $97 · 25K $197 · 50K $297 · 100K $497 · 200K $997' },
      { program: 'Alpha Swing (2-Step)', sizes: '$5K–$200K', price: '$70–$1,097', target: '10% / 5%', dailyLoss: '5%', maxLoss: '10% static', split: '80%', tiers: '5K $70 · 10K $147 · 25K $247 · 50K $357 · 100K $577 · 200K $1,097' },
      { program: 'Alpha Three (3-Step)', sizes: '$10K–$200K', price: '$67–$697', target: '8% / 5% / 3%', dailyLoss: '4%', maxLoss: '6% static', split: '80%', tiers: '10K $67 · 25K $157 · 50K $247 · 100K $397 · 200K $697' },
    ],
    services: ['Payouts via Rise, Wise or wire', 'On-demand payout plans'],
    offers: [
      { code: 'ALPHA20', text: '20% off all evaluations', seen: 'May 2026' },
      { code: '50KFOR97', text: 'Alpha Direct $50K for $97', seen: 'Oct 2026' },
      { code: '100KFOR197', text: 'Alpha Direct $100K for $197', seen: 'Oct 2026' },
    ],
    source: { label: 'PropFirmMap', url: 'https://propfirmmap.com/firms/alphacapitalgroup' }, checked: '27 Oct 2026',
  },
  {
    id: 'tradeifyfx', sign: 'TradeifyFX', name: 'Tradeify FX', category: 'cfd', tagline: 'Forex arm of Tradeify',
    website: 'https://www.tradeifyfx.co', hq: 'Saint Lucia (Tradeify Ventures LTD)',
    split: '80% (90% add-on) · Live Program 90% → 95%', payouts: 'Daily, bi-weekly or on demand by plan · 24h guarantee',
    platforms: ['MT5'], assets: '42 instruments: forex, metals, energies, indices, crypto',
    plans: [
      { program: 'Classic (2-Step)', sizes: '$5K–$100K', price: '$55–$749', target: '5% / 10%', dailyLoss: '3%', maxLoss: '10% static', split: '80%' },
      { program: 'Daily (1-Step)', sizes: '$10K–$100K', price: '$89–$429', target: '10%', dailyLoss: 'None', maxLoss: '5% trailing', split: '80%' },
      { program: 'Direct (instant)', sizes: '$5K–$100K', price: '$85–$999', target: 'None', dailyLoss: '3%', maxLoss: '6% trailing', split: '80%' },
    ],
    services: ['Live Program after 5 payouts', 'Payouts via bank, Rise or USDC', 'Not available to US residents'],
    offers: [{ code: 'MILK', text: '50% off all accounts', seen: 'Oct 2026' }],
    source: { label: 'tradeifyfx.co & PropFirmTrader', url: 'https://propfirmtrader.com/prop-firm/tradeify-fx' },
  },
  {
    id: 'ftm', sign: 'FTM', name: 'Funded Trader Markets', category: 'cfd', tagline: 'Nitro 1-Step & 2-Step Plus',
    website: 'https://fundedtradermarkets.com', founded: '2023', hq: 'UAE (Formed Technologies INT FZCO)',
    split: 'Up to 90%', payouts: 'On demand · 24h guarantee up to $1,000',
    platforms: ['MT5', 'cTrader', 'Match-Trader', 'TradeLocker'], assets: 'Forex, commodities, indices, crypto CFDs',
    plans: [
      { program: '1-Step Nitro', sizes: '$5K–$300K', price: '$80–$1,622', target: '10%', dailyLoss: '4%', maxLoss: '6%', split: '90% of first $10K, then 80%', tiers: '5K $80 · 10K $116 · 25K $236 · 50K $480 · 100K $622 · 200K $1,096 · 300K $1,622' },
      { program: '1-Step Nitro X', sizes: '$25K–$150K', price: '$147–$347', target: '6%', dailyLoss: '3%', maxLoss: '3%', split: 'See site', tiers: '25K $147 · 50K $222 · 100K $297 · 150K $347' },
      { program: '1-Step Infinity Plus', sizes: '$5K–$20K', price: '$34–$129', target: '9%', dailyLoss: '3%', maxLoss: '3%', split: 'See site', tiers: '5K $34 · 10K $69 · 20K $129' },
      { program: '2-Step Plus', sizes: '$5K–$200K', price: '$100–$1,747.50', target: '8% / 5%', dailyLoss: '4%', maxLoss: '10% static', split: '70% (90% with Shield)', tiers: '5K $100 · 10K $152 · 25K $392 · 50K $784 · 100K $997.50 · 200K $1,747.50' },
    ],
    services: ['Payouts in USDT or via Rise', 'Instant Standard and Instant Plus models'],
    offers: [],
    source: { label: 'GodFunded', url: 'https://thegodfunded.com/en/firms/fundedtradermarkets/challenges' }, checked: '27 Oct 2026',
  },
  {
    id: 'maven', sign: 'Maven', name: 'Maven Trading', category: 'cfd', tagline: 'Small-size CFD challenges',
    website: 'https://maventrading.com', founded: '2022', hq: 'United Arab Emirates',
    split: '80%', payouts: 'Every 10 business days · max $10K per 30 days',
    platforms: ['MT5', 'Match Trader'], assets: 'FX, commodities, indices, crypto',
    plans: [
      { program: '1-Step', sizes: '$2K–$100K', price: '$15–$380', target: '8%', dailyLoss: '3%', maxLoss: '5% trailing', split: '80%', tiers: '2K $15 · 5K $19 · 10K $37 · 20K $68 · 50K $170 · 100K $380' },
      { program: '2-Step', sizes: '$2K–$100K', price: '$19–$440', target: '8% / 5%', dailyLoss: '4%', maxLoss: '8% static', split: '80%', tiers: '2K $19 · 5K $22 · 10K $44 · 20K $88 · 50K $220 · 100K $440' },
      { program: '3-Step', sizes: '$2K–$100K', price: '$13–$299', target: '3% each phase', dailyLoss: '2%', maxLoss: '3% static', split: '80%', tiers: '2K $13 · 5K $17 · 10K $38 · 20K $76 · 50K $190 · 100K $299' },
      { program: 'Instant', sizes: '$2K–$100K', price: '$15–$380', target: 'None', dailyLoss: '2%', maxLoss: '3% trailing', split: '80%', tiers: '2K $15 · 5K $19 · 10K $37 · 20K $68 · 50K $170 · 100K $380' },
    ],
    services: ['Fee refunded on the third withdrawal', 'KYC on every payout'],
    offers: [{ code: 'ETERNAL', text: 'Automatic discount on every challenge', seen: 'Oct 2026' }],
    source: { label: 'PropFirmMap', url: 'https://propfirmmap.com/firms/maventrading' }, checked: '27 Oct 2026',
  },
  {
    id: 'holaprime', sign: 'Hola Prime', name: 'Hola Prime', category: 'cfd', tagline: '1-hour payouts',
    website: 'https://holaprime.com', hq: 'Hong Kong',
    split: '80–95% by payout schedule', payouts: 'On demand, bi-weekly or monthly · ~34 min average',
    platforms: ['MT4', 'MT5', 'cTrader', 'DXtrade', 'Match Trader', 'TradeLocker'], assets: 'Forex and futures',
    plans: [
      { program: 'Pro Challenge (2-Step, forex)', sizes: '$5K–$200K', price: '$59–$1,199', target: '8% / 5%', dailyLoss: '5%', maxLoss: '10% static', split: 'Up to 95%' },
      { program: 'Prime Challenge (2-Step, forex)', sizes: '$5K–$200K', price: '$39–$1,079', target: '8% / 5%', dailyLoss: '5%', maxLoss: '8%', split: 'Up to 95%' },
      { program: '1-Step Prime (forex)', sizes: '$5K–$300K', price: '$49–$1,599', target: '10%', dailyLoss: '3%', maxLoss: '6% static', split: 'Up to 95%' },
      { program: 'Direct Account (forex)', sizes: '$5K–$100K', price: '$89–$1,049', target: 'None', dailyLoss: '3%', maxLoss: '5% trailing', split: 'Up to 90%' },
      { program: '1-Step Prime (futures)', sizes: '$5K–$150K', price: '$99–$359', target: '6%', dailyLoss: 'None', maxLoss: '3–4% trailing', split: '90%', tiers: '5K $99 · 25K $99 · 50K $159 · 100K $259 · 150K $359' },
      { program: 'Direct Account (futures)', sizes: '$5K–$150K', price: '$348–$998', target: 'None', dailyLoss: '2.5% soft', maxLoss: '3–4% trailing', split: '90%', tiers: '5K $348 · 25K $348 · 50K $548 · 100K $698 · 150K $998' },
    ],
    services: ['100% fee refund after passing', 'One-to-one coaching', 'Forex programs on holaprime.com'],
    offers: [],
    notes: 'Forex prices are the published range from the smallest to the largest account; confirm the exact price for your size at checkout.',
    source: { label: 'FundedTrading.com & PropFirmMap', url: 'https://propfirmmap.com/firms/holaprime' }, checked: '27 Oct 2026',
  },
  {
    id: 'mff', sign: 'MFF', name: 'MyForexFunds', category: 'cfd', tagline: 'Announced return', status: 'relaunching',
    website: 'https://myforexfunds.com',
    split: 'To be announced', payouts: 'To be announced',
    platforms: [], assets: 'To be announced',
    plans: [],
    services: ['Offline since September 2023', 'Published a roadmap for its return'],
    offers: [],
    notes: 'MyForexFunds has announced a relaunch; plans and pricing were not published when this was researched.',
    source: { label: 'TheTrustedProp', url: 'https://thetrustedprop.com/blogs/my-forex-funds-relaunch-2026-full-details' },
  },
  {
    id: 'e8markets', sign: 'E8 Markets', name: 'E8 Markets', category: 'cfd', tagline: 'E8 One, Signature & Pro',
    website: 'https://e8markets.com', founded: '2021', hq: 'Dallas, United States',
    split: '80% on listed plans', payouts: 'On demand · first payout from 3 days',
    platforms: ['MT4', 'MT5', 'cTrader'], assets: 'Forex, indices, metals, crypto',
    plans: [
      { program: 'E8 One (1-Step)', sizes: '$5K–$500K', price: '$40–$3,597 by drawdown option', target: '9% (with 6% max loss)', dailyLoss: '4%', maxLoss: '4–14% EOD trailing (you choose)', split: '80%', tiers: '6% max-loss option: 5K $48 · 10K $88 · 25K $188 · 50K $288 · 100K $488 · 200K $798 · 400K $1,598 · 500K $1,998' },
      { program: 'E8 Signature', sizes: '$50K–$150K', price: '$130–$390', target: '6%', dailyLoss: '2%', maxLoss: '4% / 3% / 3% EOD', split: '80%', tiers: '50K $130 · 100K $260 · 150K $390' },
    ],
    services: ['E8 Pro pays daily', 'E8 One Crypto program'],
    offers: [{ code: 'E8', text: 'Checkout discount, about $4–$199 off by size', seen: 'Aug 2026' }],
    source: { label: 'PropFirmsFinder', url: 'https://propfirmsfinder.com/prop-firm/e8-markets/challenges/' }, checked: '15 Apr 2026',
  },

  /* ============================ FUTURES ============================ */
  {
    id: 'ftmo-futures', sign: 'FTMO Futures', name: 'FTMO Futures', category: 'futures', tagline: 'Growth & Pro futures accounts',
    website: 'https://ftmo.com', founded: '2015', hq: 'Prague, Czech Republic',
    split: 'Up to 90%', payouts: 'Every 14 days',
    platforms: ['See ftmo.com'], assets: 'Futures',
    plans: [
      { program: 'Growth', sizes: '$50K–$150K', price: '$119–$229 /mo', target: '$3K–$9K', dailyLoss: 'None', maxLoss: '$2K–$5K EOD trailing', split: 'Up to 90%', tiers: '50K $119 · 100K $169 · 150K $229 per month' },
      { program: 'Pro', sizes: '$50K–$150K', price: '$139–$269 /mo', target: '$3K–$9K', dailyLoss: '$1K–$2K', maxLoss: '$3K–$6K EOD trailing', split: 'Up to 90%', tiers: '50K $139 · 100K $199 · 150K $269 per month' },
    ],
    services: ['Subscription pricing', 'Same FTMO payout methods as CFD'],
    offers: [],
    source: { label: 'Trader’s Second Brain', url: 'https://traderssecondbrain.com/guides/ftmo-futures-50k-vs-100k-vs-150k' }, checked: '17 Sep 2026',
  },
  {
    id: 'alpha-futures', sign: 'Alpha Futures', name: 'Alpha Futures', category: 'futures', tagline: 'Zero, Standard, Advanced & Direct',
    website: 'https://alpha-futures.com', founded: '2024', hq: 'United Kingdom',
    split: '90% on all accounts', payouts: 'Up to 4 times a month · within 48 business hours',
    platforms: ['TradingView', 'NinjaTrader', 'Tradovate', 'Quantower', 'WealthCharts', 'DeepCharts'], assets: 'Futures',
    plans: [
      { program: 'Zero Eval', sizes: '$25K–$100K', price: '$89–$279 /mo', target: '$1.5K–$6K', dailyLoss: '2% soft guard', maxLoss: '$1K–$3K EOD', split: '90%' },
      { program: 'Standard Eval', sizes: '$50K–$150K', price: '$129–$349 /mo', target: '$3K–$9K', dailyLoss: 'None', maxLoss: '$2K–$4.5K EOD', split: '90%' },
      { program: 'Advanced Eval', sizes: '$50K–$150K', price: '$209–$489 /mo', target: '$4K–$12K', dailyLoss: 'None', maxLoss: '$1.75K–$5.25K EOD', split: '90%' },
      { program: 'Direct (instant)', sizes: '$25K–$150K', price: '$349–$859', target: '—', dailyLoss: 'Up to $3K', maxLoss: '$1K–$4.5K EOD', split: '90%' },
    ],
    services: ['Payout after every 5 winning days', 'Payouts via Rise, Wise, ACH or wire'],
    offers: [
      { code: 'ALPHA50', text: '50% off Advanced, Standard and Direct', seen: 'Oct 2026' },
      { code: 'ALPHA40', text: '40% off Zero', seen: 'Oct 2026' },
    ],
    source: PFM('alphafutures'),
  },
  {
    id: 'fundednext-futures', sign: 'FundedNext Futures', name: 'FundedNext Futures', category: 'futures', tagline: 'Legacy, Rapid & Flex',
    website: 'https://fundednext.com', founded: '2022', hq: 'United States',
    split: '80–95% by program', payouts: 'Daily (Rapid Daily), 3 days (Rapid Pro), 5 days (Legacy)',
    platforms: ['NinjaTrader', 'Tradovate', 'TradingView'], assets: 'Futures',
    plans: [
      { program: 'Legacy', sizes: '$25K–$100K', price: '$79.99–$239.99', target: '$1.25K–$6K', dailyLoss: 'None', maxLoss: '$1K–$3K EOD', split: '80%', tiers: '25K $79.99 · 50K $199.99 · 100K $239.99' },
      { program: 'Rapid Daily', sizes: '$25K–$100K', price: '$159.98–$499.98', target: '$1.5K–$5K', dailyLoss: '$500–$1,250', maxLoss: '$1K–$2.5K EOD', split: '90%', tiers: '25K $159.98 · 50K $299.98 · 100K $499.98' },
      { program: 'Rapid Pro', sizes: '$25K–$100K', price: '$159.98–$499.98', target: '$1.5K–$5K', dailyLoss: 'None', maxLoss: '$1K–$2.5K EOD', split: '90%', tiers: '25K $159.98 · 50K $299.98 · 100K $499.98' },
      { program: 'Flex', sizes: '$50K–$150K', price: '$133.99–$483.99', target: '$2.5K–$8K', dailyLoss: 'None', maxLoss: '$1.5K–$4K EOD', split: 'Up to 95% (add-on)', tiers: '50K $133.99 · 100K $264.99 · 150K $483.99' },
    ],
    services: ['40% consistency rule on Rapid Pro and Flex'],
    offers: [
      { code: 'RAPID', text: 'Up to 50% off Rapid futures for new users' },
      { code: 'FNFLEX', text: '47% off the first 5 Flex purchases' },
    ],
    source: { label: 'PropFirmMap', url: 'https://propfirmmap.com/firms/fundednext' }, checked: '26 Oct 2026',
  },
  {
    id: 'tradeify', sign: 'Tradeify', name: 'Tradeify', category: 'futures', tagline: 'Select, Growth & Lightning',
    website: 'https://tradeify.co', hq: 'United States',
    split: '90% (100% of first $15K on Growth & Lightning)', payouts: 'Daily (Select Daily) to every 5 winning days · Rise in under 60 min',
    platforms: ['NinjaTrader', 'Tradovate', 'Tradesea', 'WealthCharts'], assets: 'Futures',
    plans: [
      { program: 'Select (1-Step)', sizes: '$50K–$150K', price: '$165–$369', target: '6%', dailyLoss: 'None', maxLoss: '4% / 3% / 3% EOD', split: '90%', tiers: '50K $165 · 100K $265 · 150K $369' },
      { program: 'Growth (1-Step)', sizes: '$50K–$150K', price: '$139–$359', target: '6%', dailyLoss: '2.5%', maxLoss: '4% / 3.5% / 3.33% EOD', split: '90%', tiers: '50K $139 · 100K $249 · 150K $359' },
      { program: 'Lightning (instant)', sizes: '$25K–$150K', price: '$329–$759', target: 'None', dailyLoss: '2.5% (50K and up)', maxLoss: '4% EOD', split: '90%', tiers: '25K $329 · 50K $469 · 100K $629 · 150K $759' },
    ],
    services: ['Payouts via Rise or crypto'],
    offers: [{ code: 'GEMS', text: '30% off Growth, Select and Lightning', seen: 'Oct 2026' }],
    source: { label: 'PropFirmsFinder', url: 'https://propfirmsfinder.com/prop-firm/tradeify/challenges/' }, checked: '20 Oct 2026',
  },
  {
    id: 'lucid', sign: 'Lucid', name: 'Lucid Trading', category: 'futures', tagline: 'On-demand futures payouts',
    website: 'https://lucidtrading.com', hq: 'United States',
    split: '90%', payouts: 'On demand · 2 business days · $500 minimum',
    platforms: ['NinjaTrader', 'Tradovate', 'Quantower', 'MotiveWave', 'Rithmic'], assets: 'Futures',
    plans: [
      { program: 'LucidFlex (1-Step)', sizes: '$25K–$150K', price: '$65–$323', target: '$1.25K–$9K', dailyLoss: 'Optional', maxLoss: '$1K–$4.5K EOD', split: '90%', tiers: '25K $65 · 50K $115 · 100K $215 · 150K $323' },
      { program: 'LucidPro (1-Step)', sizes: '$25K–$150K', price: '$108–$365', target: '$1.25K–$9K', dailyLoss: 'None–$2.7K EOD', maxLoss: '$1K–$4.5K EOD', split: '90%', tiers: '25K $108 · 50K $172 · 100K $272 · 150K $365' },
      { program: 'LucidDaily (1-Step)', sizes: '$25K–$150K', price: '$86–$286', target: '$1.25K–$9K', dailyLoss: 'Optional', maxLoss: '$1K–$4.5K EOD', split: '90%', tiers: '25K $86 · 50K $122 · 100K $200 · 150K $286' },
      { program: 'LucidDirect (instant)', sizes: '$25K–$150K', price: '$329–$836', target: 'None', dailyLoss: 'Up to $3K', maxLoss: '$1K–$5K trailing', split: '90%', tiers: '25K $329 · 50K $515 · 100K $700 · 150K $836' },
    ],
    services: ['No activation fee', '40% consistency rule', 'LucidFlex and LucidDirect programs'],
    offers: [{ code: 'VAULT', text: 'Best-deal checkout coupon', seen: 'Sep 2026' }],
    source: { label: 'PropFirmMap', url: 'https://propfirmmap.com/firms/lucidtrading' }, checked: '26 Oct 2026',
  },
  {
    id: 'mffu', sign: 'MFF', name: 'MyFundedFutures', category: 'futures', tagline: 'Rapid, Builder & Pro',
    website: 'https://myfundedfutures.com', founded: '2023', hq: 'United States',
    split: '80–90% by plan', payouts: 'Daily (Rapid), 48h (Builder), bi-weekly (Pro) · $500 minimum',
    platforms: ['TradingView', 'NinjaTrader', 'Tradovate', 'Quantower', 'ATAS'], assets: 'Futures',
    plans: [
      { program: 'Rapid', sizes: '$25K–$150K', price: '$109–$347 one-time', target: '$1.5K–$9K', dailyLoss: 'None', maxLoss: '$1K–$4.5K EOD', split: '90%', tiers: '25K $109 · 50K $157 · 100K $267 · 150K $347' },
      { program: 'Pro', sizes: '$50K–$150K', price: '$227–$477 one-time', target: '$3K–$9K', dailyLoss: 'See site', maxLoss: 'See site', split: '80%', tiers: '50K $227 · 100K $344 · 150K $477' },
      { program: 'Builder', sizes: '$25K–$150K', price: 'From $105 one-time', target: '$3K (50K)', dailyLoss: '$600–$1K soft pause', maxLoss: '$1.5K or $2K (50K)', split: '80%', tiers: '25K $105 · 50K $153 ($2K max loss) or $125 ($1.5K max loss)' },
    ],
    services: ['Builder add-on accounts'],
    offers: [{ code: 'CLUB', text: '50% off for new users', seen: 'Aug 2026' }],
    source: { label: 'PropTradingVibes', url: 'https://proptradingvibes.com/blog/myfundedfutures-pricing' }, checked: '10 Sep 2026',
  },
  {
    id: 'topstep', sign: 'Topstep', name: 'Topstep', category: 'futures', tagline: 'Trading Combine since 2010',
    website: 'https://topstep.com', founded: '2010', hq: 'Chicago, United States',
    split: '90%', payouts: 'On demand after eligibility · first after 5 days',
    platforms: ['Topstep X'], assets: 'Futures',
    plans: [
      { program: 'Trading Combine', sizes: '$50K–$150K', price: '$49–$149 /mo + $149 activation', target: '$3K–$9K', dailyLoss: 'None on TopstepX', maxLoss: '$2K–$4.5K EOD trailing', split: '90%', tiers: '50K $49 · 100K $99 · 150K $149 per month, plus $149 activation' },
      { program: 'Trading Combine (no activation fee)', sizes: '$50K–$150K', price: '$109–$209 /mo', target: '$3K–$9K', dailyLoss: 'None on TopstepX', maxLoss: '$2K–$4.5K EOD trailing', split: '90%', tiers: '50K $109 · 100K $159 · 150K $209 per month' },
    ],
    services: ['Payouts via Wise, ACH, wire or Aeropay', 'Max $5,000 per payout (standard)'],
    offers: [],
    source: { label: 'PropFirmsFinder', url: 'https://propfirmsfinder.com/prop-firm/topstep/challenges/' }, checked: '25 Oct 2026',
  },
  {
    id: 'tpt', sign: 'TPT', name: 'Take Profit Trader', category: 'futures', tagline: 'PRO and PRO+ funded',
    website: 'https://takeprofittrader.com', hq: 'Orlando, United States',
    split: '80% PRO · 90% PRO+', payouts: 'On demand · 24–48h via Rise',
    platforms: ['NinjaTrader', 'Tradovate', 'TradingView', 'Quantower', 'Sierra Chart', '+8 more'], assets: 'Futures',
    plans: [
      { program: '1-Step Test', sizes: '$25K–$150K', price: '$150–$360', target: '$1.5K–$9K', dailyLoss: 'None', maxLoss: '$1.5K–$4.5K EOD trailing', split: '80% PRO → 90% PRO+', tiers: '25K $150 · 50K $170 · 75K $245 · 100K $330 · 150K $360' },
    ],
    services: ['Payouts from day one after the buffer', 'Wise, PayPal or Plaid'],
    offers: [{ code: 'NOFEE40', text: '40% off for life and no activation fee', seen: 'Oct 2026' }],
    source: { label: 'PropFirmMap', url: 'https://propfirmmap.com/firms/takeprofittrader' }, checked: '8 Oct 2026',
  },
  {
    id: 'blueguardian', sign: 'Blue Guardian', name: 'Blue Guardian Futures', category: 'futures', tagline: 'Standard & Express futures',
    website: 'https://blueguardian.com', founded: '2021', hq: 'Dubai, UAE',
    split: '90/10 futures · 85% CFD', payouts: 'Every 14 days (7-day add-on) · 2% processing fee',
    platforms: ['See blueguardian.com'], assets: 'Futures and CFDs',
    plans: [
      { program: 'Standard', sizes: '$25K–$150K', price: '$116–$318', target: '$1.5K–$9K', dailyLoss: 'Soft, up to $3K', maxLoss: '$1K–$5K EOD', split: '90%' },
      { program: 'Express', sizes: '$25K–$150K', price: '$59.50–$220', target: '$1.5K–$9K', dailyLoss: '$500–$2,250', maxLoss: '$1K–$4.5K EOD', split: '90%' },
    ],
    services: ['24-business-hour payout guarantee', 'CFD Instant, 1-, 2- and 3-Step models'],
    offers: [{ code: 'SPOOKY', text: '25% off all accounts', seen: 'Oct 2026' }],
    source: PFM('blueguardian'),
  },
  {
    id: 'e8-futures', sign: 'E8 Futures', name: 'E8 Futures', category: 'futures', tagline: 'Signature & Zero',
    website: 'https://e8markets.com', founded: '2021', hq: 'Dallas, United States',
    split: '80% (Zero: 80% or 100%)', payouts: 'Daily (Zero) or on demand (Signature) · $100 minimum',
    platforms: ['NinjaTrader', 'Tradovate'], assets: 'Futures',
    plans: [
      { program: 'Signature', sizes: '$25K–$150K', price: '$120–$450', target: '$1.5K–$9K', dailyLoss: '—', maxLoss: '$1K–$4.5K EOD', split: '80%' },
      { program: 'Zero Starter', sizes: '$50K–$200K', price: '$178–$558', target: '$3K–$13.5K', dailyLoss: '—', maxLoss: '$1.5K–$6K EOD', split: '80% / 100%' },
      { program: 'Zero Max', sizes: '$50K–$200K', price: '$328–$1,088', target: '$3K–$13.5K', dailyLoss: '—', maxLoss: '$1.5K–$6K EOD', split: '80% / 100%' },
    ],
    services: ['35% best-day rule on Signature payouts'],
    offers: [{ code: 'DGT', text: '35% off at checkout' }],
    source: { label: 'DamnPropFirms review', url: 'https://damnpropfirms.com/futures-prop-firms/e8-futures/' },
  },

  /* ============================= PERPS ============================= */
  {
    id: 'breakout', sign: 'Breakout', name: 'Breakout Prop', category: 'perps', tagline: 'Crypto funding on Kraken',
    website: 'https://breakoutprop.com', hq: 'Part of Kraken (acquired Sep 2025)',
    split: '80%, up to 90% with add-on', payouts: 'On demand in USDC · $50 minimum',
    platforms: ['Breakout terminal on Kraken infrastructure'], assets: '62 crypto pairs',
    plans: [
      { program: '1-Step Classic', sizes: '$5K–$100K', price: '$60–$999', target: '10%', dailyLoss: '3%', maxLoss: '6% static', split: '80% (90% add-on)', tiers: '5K $60 · 10K $110 · 25K $275 · 50K $550 · 100K $999' },
      { program: '1-Step Pro', sizes: '$5K–$200K', price: '≈$55–$1,700', target: '12%', dailyLoss: '3%', maxLoss: '5% static', split: '80% (90% add-on)', tiers: '5K ≈$55 · 10K ≈$100 · 25K ≈$250 · 50K ≈$475 · 100K ≈$900 · 200K ≈$1,700' },
      { program: '1-Step Turbo', sizes: '$5K–$200K', price: '≈$45–$1,375', target: '9%', dailyLoss: '3%', maxLoss: '3% static', split: '80% (90% add-on)', tiers: '5K ≈$45 · 10K ≈$85 · 25K ≈$200 · 50K ≈$375 · 100K ≈$725 · 200K ≈$1,375' },
      { program: '2-Step Classic', sizes: '$5K–$100K', price: '$50–$725', target: '5% / 10%', dailyLoss: '5%', maxLoss: '8% trailing', split: '80% (90% add-on)', tiers: '5K $50 · 10K $100 · 25K $250 · 50K $475 · 100K $725' },
    ],
    services: ['No time limit or minimum days', 'News and weekend trading allowed', 'Scaling plan', 'Leverage 5:1 BTC/ETH, 2:1 alts'],
    offers: [],
    source: { label: 'PropFirmsFinder', url: 'https://propfirmsfinder.com/prop-firm/breakout/' }, checked: '15 Apr 2026',
  },
  {
    id: 'vest', sign: 'Vest', name: 'Vest Markets', category: 'perps', tagline: '24/7 perps venue',
    website: 'https://vestmarkets.com', hq: 'Vest Labs',
    split: '80% or 90% (plan option)', payouts: 'On demand',
    platforms: ['Vest Markets'], assets: 'Stocks, indices, commodities, FX and crypto perps',
    plans: [
      { program: '1-Step · 10% target · 80% split', sizes: '$5K–$50K', price: '$40–$415 (3% daily loss)', target: '10%', dailyLoss: '3%, 4% or none', maxLoss: '6% static', split: '80%', tiers: '3% daily loss: 5K $40 · 10K $80 · 25K $210 · 50K $415 (4% or no daily loss costs more)' },
      { program: '1-Step · 10% target · 90% split', sizes: '$5K–$25K', price: '$48–$252 (3% daily loss)', target: '10%', dailyLoss: '3%, 4% or none', maxLoss: '6% static', split: '90%', tiers: '3% daily loss: 5K $48 · 10K $96 · 25K $252' },
      { program: '1-Step · 20% target · 80% split', sizes: '$5K–$25K', price: '$25–$130 (3% daily loss)', target: '20%', dailyLoss: '3%, 4% or none', maxLoss: '6% static', split: '80%', tiers: '3% daily loss: 5K $25 · 10K $50 · 25K $130' },
      { program: '1-Step · 20% target · 90% split', sizes: '$5K–$25K', price: '$30–$156 (3% daily loss)', target: '20%', dailyLoss: '3%, 4% or none', maxLoss: '6% static', split: '90%', tiers: '3% daily loss: 5K $30 · 10K $60 · 25K $156' },
      { program: '2-Step', sizes: '$5K–$25K', price: '$15–$90', target: '$500–$2.5K (phase 1)', dailyLoss: '3%', maxLoss: '6% static', split: '80%', tiers: '5K $15 · 10K $35 · 25K $90' },
      { program: 'Instant', sizes: '$500–$50K', price: '$10–$2,000', target: 'None', dailyLoss: 'None', maxLoss: '4% static', split: '95%', tiers: '$500 $10 · 5K $200 · 10K $400 · 25K $1,000 · 50K $2,000' },
    ],
    services: ['Raised $13M (Oct 2026)', 'Never lose more than the evaluation fee', 'Leverage up to 50:1'],
    offers: [{ code: 'LUMI', text: 'Up to 15% off (via Funded.Now)' }],
    source: { label: 'Funded.Now', url: 'https://funded.now/propfirm/vest-markets' }, checked: '23 Oct 2026',
  },
  {
    id: 'mfp', sign: 'MFP', name: 'MyFundedPerps', category: 'perps', tagline: 'From the MyFundedFutures team',
    website: 'https://myfundedperpetuals.com',
    split: '80% (90% upgrade)', payouts: 'Daily (Select/Prime/Signature) or on demand (Elite) via Rise',
    platforms: ['MFFP terminal'], assets: '134 markets: crypto, indices, stocks, forex, commodities',
    plans: [
      { program: '1-Step Select', sizes: '$10K–$100K', price: '$40–$360', target: '9%', dailyLoss: '3%', maxLoss: '3% static', split: '80% (90% upgrade)', tiers: '10K $40 · 25K $100 · 50K $190 · 100K $360' },
      { program: '1-Step Prime', sizes: '$10K–$100K', price: '$60–$595', target: '12%', dailyLoss: '3%', maxLoss: '5% static', split: '80% (90% upgrade)', tiers: '10K $60 · 25K $160 · 50K $300 · 100K $595' },
      { program: '1-Step Signature', sizes: '$10K–$100K', price: '$87–$839', target: '10%', dailyLoss: '3%', maxLoss: '6% static', split: '80% (90% upgrade)', tiers: '10K $87 · 25K $209 · 50K $419 · 100K $839' },
      { program: 'Elite', sizes: '$5K–$50K', price: '$49–$965', target: '10%', dailyLoss: '3% or none', maxLoss: '5% static', split: '80% (90% upgrade)', tiers: '3% daily loss: 5K $49 · 10K $95 · 25K $249 · 50K $495 · no daily loss: $99 · $194 · $482 · $965' },
    ],
    services: ['Store credit gets a 10% boost', 'Leverage up to 50x on FX'],
    offers: [{ code: 'KAGE', text: '30–35% off', seen: 'Oct 2026' }],
    source: { label: 'DamnPropFirms', url: 'https://damnpropfirms.com/?p=29947' }, checked: 'Oct 2026',
  },
  {
    id: 'tradeify-perps', sign: 'Tradeify Perps', name: 'Tradeify Crypto', category: 'perps', tagline: 'APE-X and 1-Step crypto',
    website: 'https://tradeifycrypto.co', hq: 'Saint Lucia (Tradeify Ventures LTD)',
    split: '80%', payouts: 'On demand (APE-X) or 14-day cycle (1-Step) · ~22h average',
    platforms: ['DXtrade', 'TradingView charts'], assets: '100+ crypto pairs, tokenized stocks',
    plans: [
      { program: 'APE-X 1-Step', sizes: '$10K–$100K', price: '$39–$199 + activation', target: '6%', dailyLoss: 'None', maxLoss: '4% EOD trailing', split: '80%', tiers: '10K $39 (+$69) · 25K $49 (+$139) · 50K $99 (+$199) · 100K $199 (+$329)' },
      { program: '1-Step', sizes: '$5K–$100K', price: '$70–$700', target: '12%', dailyLoss: '3%', maxLoss: '6% static', split: '80%', tiers: '5K $70 · 10K $120 · 25K $250 · 50K $420 · 100K $700' },
      { program: '2-Step', sizes: '$5K–$100K', price: '$60–$580', target: '10%', dailyLoss: '3%', maxLoss: '6% static', split: '80%', tiers: '5K $60 · 10K $100 · 25K $200 · 50K $350 · 100K $580' },
      { program: 'Instant', sizes: '$5K–$100K', price: '$110–$1,000', target: 'None', dailyLoss: '3%', maxLoss: '6% intraday', split: '80%', tiers: '5K $110 · 10K $200 · 25K $340 · 50K $580 · 100K $1,000' },
    ],
    services: ['2-Step and Instant Funding also offered', 'Weekend holds allowed'],
    offers: [],
    source: { label: 'PropFirmsFinder', url: 'https://propfirmsfinder.com/prop-firm/tradeifycrpto/challenges/' }, checked: '19 Jul 2026',
  },
  {
    id: 'propr', sign: 'Propr', name: 'Propr', category: 'perps', tagline: 'Onchain prop on Hyperliquid',
    website: 'https://propr.xyz', founded: '2026', hq: 'British Virgin Islands',
    split: '80%', payouts: 'On demand in USDC onchain · within 24h',
    platforms: ['Hyperliquid'], assets: '158+ perps: crypto, equities, indices, commodities, FX',
    plans: [
      { program: 'Classic 1-Step', sizes: '$5K–$200K', price: '$60–$1,998', target: '10%', dailyLoss: '3%', maxLoss: '6% static', split: '80%', tiers: '5K $60 · 10K $110 · 25K $275 · 50K $495 · 100K $999 · 200K $1,998' },
      { program: 'Turbo 1-Step', sizes: '$5K–$200K', price: '$25–$899', target: '9%', dailyLoss: '3%', maxLoss: '3% static', split: '80%', tiers: '5K $25 · 10K $50 · 25K $125 · 50K $245 · 100K $450 · 200K $899' },
      { program: 'Pro 1-Step (listed as coming soon)', sizes: '$5K–$200K', price: '$45–$1,399', target: '12%', dailyLoss: '3%', maxLoss: '5% static', split: '80%', tiers: '5K $45 · 10K $85 · 25K $185 · 50K $355 · 100K $699 · 200K $1,399' },
      { program: 'Classic 2-Step', sizes: '$5K–$200K', price: '$50–$1,499', target: '5% / 10%', dailyLoss: '5%', maxLoss: '8% trailing', split: '80%', tiers: '5K $50 · 10K $100 · 25K $250 · 50K $450 · 100K $749 · 200K $1,499' },
    ],
    services: ['Launched February 2026', 'Full profit sweeps, positions closed first'],
    offers: [],
    source: { label: 'FundedTrading.com', url: 'https://fundedtrading.com/propfirm/propr/' }, checked: '30 Sep 2026',
  },
];

export const RESEARCHED_ON = '26 Oct 2026';
/** list-price note shown under every plan table */
export const PRICE_NOTE = 'List prices before discount codes. Sizes are account balances.';
