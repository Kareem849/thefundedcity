// THE PLAZA panel: the mall and marketplace. Shop by section, a basket with the 75/25 split, selling (no
// listing fees: 75% of each sale goes to the seller, 25% to the Plaza) and the rules.
// Listings live in the page's shared database (`plaza/<your id>`, up to 8 each); elsewhere in this browser.
// Clearly labelled SAMPLE listings show how the mall works until sellers add their own. Checkout is a demo:
// nothing is charged, and buyers are pointed to the seller's own link.
import { getCloud, type Cloud } from './cloud';
import { SECTIONS, SELLER_TYPES, PLAZA_CUT, type SectionId, type SellerType } from './plaza';
import { uploadImage, imgSrc } from './uploads';

export type PlazaTab = 'shop' | 'basket' | 'sell' | 'rules';
export interface PlazaPanel {
  open: (tab?: PlazaTab, section?: SectionId | 'all') => void;
  close: () => void;
  isOpen: () => boolean;
  /** listings per section (published + sample) */
  counts: () => Record<SectionId, number>;
  onNew: (fn: (l: Listing) => void) => void;
}
export interface Listing {
  id: string;
  section: SectionId;
  title: string;
  desc: string;
  price: number;
  pricing: 'one-time' | 'monthly' | 'free';
  seller: string;
  sellerType: SellerType;
  link?: string;
  img?: string;
  sample: boolean;
  owner?: string;
  mine?: boolean;
  t: number;
}

const esc = (v: string) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const CLOSE = '<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const LOCAL = 'fundedcity-plaza-local';
const HIDE = 'fundedcity-plaza-hidden';
const KEEP = 8;
const usd = (n: number) => '$' + (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
const sec = (id: string) => SECTIONS.find((s) => s.id === id) ?? SECTIONS[SECTIONS.length - 1];
const split = (price: number) => ({ seller: Math.round(price * (1 - PLAZA_CUT) * 100) / 100, plaza: Math.round(price * PLAZA_CUT * 100) / 100 });
const priceText = (l: Pick<Listing, 'price' | 'pricing'>) => (l.pricing === 'free' || l.price <= 0 ? 'Free' : `${usd(l.price)}${l.pricing === 'monthly' ? '/mo' : ''}`);

const DAY = 86_400_000;
/** SAMPLE listings from fictional sellers: they show how the mall works and can't be bought. */
function samples(): Listing[] {
  const t0 = Date.now() - 3 * DAY;
  const S = (i: number, section: SectionId, title: string, desc: string, price: number, pricing: Listing['pricing'], sellerType: SellerType): Listing => ({ id: 'sample-' + i, section, title, desc, price, pricing, seller: 'Sample seller', sellerType, sample: true, t: t0 - i * 3_600_000 });
  return [
    S(1, 'firms', '$100K two-step evaluation', 'Two-phase challenge, 8% / 5% targets, 10% max drawdown, bi-weekly payouts after the first 30 days.', 495, 'one-time', 'Prop firm'),
    S(2, 'firms', 'Instant-funded $25K account', 'Start funded on day one with a 6% trailing drawdown and a 70/30 split that scales to 90/10.', 349, 'one-time', 'Prop firm'),
    S(3, 'brokers', 'Raw-spread trading account', 'Raw spreads from 0.0 pips with a flat commission per lot; MT5 and cTrader.', 0, 'free', 'Broker'),
    S(4, 'brokers', 'Futures data bundle (CME)', 'Level-2 market depth for CME index, energy and metals futures.', 39, 'monthly', 'Broker'),
    S(5, 'courses', 'Price Action Foundations', 'Eight video modules on structure, liquidity and trade management, with weekly Q&A.', 199, 'one-time', 'Trader'),
    S(6, 'courses', 'Funded-trader coaching · 4 sessions', 'One-to-one sessions on rules, risk and passing evaluations without breaking drawdown.', 320, 'one-time', 'Trader'),
    S(7, 'tools', 'Session Liquidity indicator', 'Marks Asia, London and New York highs and lows plus the previous day’s range. TradingView.', 29, 'monthly', 'Trader'),
    S(8, 'tools', 'Drawdown guard & risk calculator', 'Position sizing by % risk, daily-loss lock and a prop-rules checklist. MT5 EA.', 59, 'one-time', 'Other'),
    S(9, 'copy', 'Low-drawdown index copy strategy', 'NQ and ES intraday strategy with a 3% max drawdown target. Past results don’t guarantee future returns.', 79, 'monthly', 'Copy-trading firm'),
    S(10, 'copy', 'Gold swing signals room', 'Two to four XAUUSD swing ideas a week with entries, stops and targets.', 49, 'monthly', 'Copy-trading firm'),
    S(11, 'services', 'Trading VPS · London', '2 vCPU, 4 GB RAM, 1 ms to major forex servers, 99.9% uptime.', 25, 'monthly', 'Other'),
    S(12, 'services', 'Stream overlay & logo pack', 'Custom logo, Discord banner and stream overlays for trading educators.', 150, 'one-time', 'Other'),
  ];
}

function clean(v: Record<string, unknown>): Omit<Listing, 'seller' | 'sellerType' | 'sample' | 'owner' | 'mine'> | null {
  const s = (k: string, n: number) => (typeof v[k] === 'string' ? (v[k] as string).trim().slice(0, n) : '');
  const section = SECTIONS.some((x) => x.id === v.section) ? (v.section as SectionId) : null;
  const pricing = v.pricing === 'monthly' ? 'monthly' : v.pricing === 'free' ? 'free' : 'one-time';
  const price = typeof v.price === 'number' && Number.isFinite(v.price) ? Math.max(0, Math.min(1_000_000, v.price)) : 0;
  const it = { id: s('id', 24), section: section!, title: s('title', 80), desc: s('desc', 400), price: pricing === 'free' ? 0 : price, pricing: pricing as Listing['pricing'], link: s('link', 140) || undefined, img: s('img', 200000) || undefined, t: typeof v.t === 'number' ? v.t : 0 };
  if (!it.id || !it.title || !section) return null;
  if (it.img && !imgSrc(it.img)) it.img = undefined;
  return it;
}

export function createPlazaPanel(root: HTMLElement, getName: () => string | null): PlazaPanel {
  root.insertAdjacentHTML(
    'beforeend',
    `<div class="media-overlay plaza-overlay" id="pz-overlay" hidden>
      <section class="media-panel plaza-panel" role="dialog" aria-modal="true" aria-labelledby="pz-title">
        <header class="mp-head">
          <div class="mp-title"><span class="mp-eyebrow pz-eyebrow">MALL · MARKETPLACE · 0 LISTING FEES</span><h2 id="pz-title">THE PLAZA</h2></div>
          <nav class="mp-tabs" role="tablist">
            <button role="tab" data-tab="shop">Shop</button>
            <button role="tab" data-tab="basket">Basket <span class="pz-count" id="pz-bcount" hidden></span></button>
            <button role="tab" data-tab="sell">Sell</button>
            <button role="tab" data-tab="rules">Fees &amp; rules</button>
          </nav>
          <button class="icon-btn sq mp-close" id="pz-close" aria-label="Close THE PLAZA">${CLOSE}</button>
        </header>
        <div class="mp-body" id="pz-body"></div>
        <footer class="mp-foot"><span class="mp-feed" id="pz-feed"></span></footer>
      </section>
    </div>`,
  );
  const overlay = root.querySelector<HTMLElement>('#pz-overlay')!;
  const body = overlay.querySelector<HTMLElement>('#pz-body')!;
  const feed = overlay.querySelector<HTMLElement>('#pz-feed')!;
  const bcount = overlay.querySelector<HTMLElement>('#pz-bcount')!;
  const tabs = [...overlay.querySelectorAll<HTMLButtonElement>('.mp-tabs button')];
  overlay.querySelector('#pz-close')!.addEventListener('click', () => close());
  overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) close(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) close(); });
  tabs.forEach((b) => b.addEventListener('click', () => show(b.dataset.tab as PlazaTab)));

  let tab: PlazaTab = 'shop';
  let section: SectionId | 'all' = 'all';
  let query = '';
  let sort: 'new' | 'low' | 'high' = 'new';
  let cloud: Cloud | null = null;
  let readOnly = false;
  let owner = false;
  let published: Listing[] = [];
  let mine: { seller: string; sellerType: SellerType; items: Array<NonNullable<ReturnType<typeof clean>>> } = { seller: '', sellerType: 'Trader', items: [] };
  const basket: string[] = [];
  let flash = '';
  let checkout: Listing[] | null = null;
  let hidden = new Set<string>();
  try { hidden = new Set(JSON.parse(localStorage.getItem(HIDE) ?? '[]')); } catch { /* none */ }
  const fns: Array<(l: Listing) => void> = [];
  let seen: Set<string> | null = null;

  const all = () => [...published, ...samples()].filter((l) => !hidden.has(l.id));
  function applyDocs(docs: Array<{ id: string; data: Record<string, unknown> }>, uid: string | null) {
    const out: Listing[] = [];
    for (const d of docs) {
      const seller = typeof d.data.seller === 'string' && d.data.seller.trim() ? d.data.seller.trim().slice(0, 40) : 'Seller';
      const sellerType = (SELLER_TYPES as readonly string[]).includes(d.data.sellerType as string) ? (d.data.sellerType as SellerType) : 'Other';
      const items = (Array.isArray(d.data.items) ? d.data.items : []).map((x: unknown) => (x && typeof x === 'object' ? clean(x as Record<string, unknown>) : null)).filter(Boolean) as Array<NonNullable<ReturnType<typeof clean>>>;
      if (d.id === uid) mine = { seller, sellerType, items };
      for (const it of items.slice(0, KEEP)) out.push({ ...it, id: `${d.id}:${it.id}`, seller, sellerType, sample: false, owner: d.id, mine: d.id === uid });
    }
    const added = seen ? out.filter((l) => !seen!.has(l.id) && !l.mine) : [];
    seen = new Set(out.map((l) => l.id));
    published = out.sort((a, b) => b.t - a.t);
    for (const l of added) for (const f of fns) f(l);
    const a = document.activeElement;
    const typing = !!a && body.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
    if (isOpen() && (tab === 'shop' || tab === 'basket') && !typing) render();
  }
  void (async () => {
    cloud = await getCloud();
    readOnly = !!cloud && (cloud.canWrite === false || !cloud.uid);
    if (cloud) {
      try { owner = !!(await cloud.user?.isOwner?.()); } catch { owner = false; }
      cloud.db.collection('plaza').limit(300).onSnapshot(
        (snap: { docs: Array<{ id: string; data(): Record<string, unknown> | undefined }> }) => applyDocs(snap.docs.map((d) => ({ id: d.id, data: d.data() ?? {} })), cloud!.uid),
        () => { /* keep the last view */ },
      );
    } else {
      try { const v = JSON.parse(localStorage.getItem(LOCAL) ?? 'null'); if (v && Array.isArray(v.items)) applyDocs([{ id: 'me', data: v }], 'me'); } catch { /* empty */ }
    }
  })();

  /* ---------------- shop ---------------- */
  const card = (l: Listing) => {
    const s = sec(l.section);
    const sp = split(l.price);
    const img = imgSrc(l.img);
    const inBasket = basket.includes(l.id);
    return `<article class="pz-card" style="--sec:${s.color}">
      ${img ? `<div class="pz-img"><img src="${esc(img)}" alt="" loading="lazy" /></div>` : ''}
      <header><span class="pz-sec">${esc(s.label)}</span><span class="pz-type">${esc(l.sellerType)}</span></header>
      <h3>${esc(l.title)}</h3>
      <span class="pz-seller">${l.sample ? '<b class="tn-tag sample">SAMPLE LISTING</b>' : `by <b>${esc(l.seller)}</b>${l.mine ? ' <em class="you-tag">YOU</em>' : ''}`}</span>
      <p>${esc(l.desc)}</p>
      <div class="pz-price"><b>${priceText(l)}</b>${l.price > 0 ? `<span>Seller gets ${usd(sp.seller)} · Plaza ${usd(sp.plaza)}</span>` : '<span>No fee on free listings</span>'}</div>
      ${l.link ? `<div class="pz-link">Seller’s link: <span class="tn-link">${esc(l.link)}</span></div>` : ''}
      <footer>
        ${l.sample ? '<span class="pz-note">Sample: not for sale</span>' : `<button class="btn ${inBasket ? 'btn-ghost' : 'btn-gold'}" data-add="${esc(l.id)}">${inBasket ? 'In basket ✓' : l.price > 0 ? 'Add to basket' : 'Get it'}</button>`}
        ${l.mine ? `<button class="btn btn-ghost" data-mine="${esc(l.id)}">Remove</button>` : ''}
        ${!l.mine && !l.sample && owner ? `<button class="btn btn-ghost" data-mod="${esc(l.id)}">Take down</button>` : ''}
        ${!l.mine && !l.sample ? `<button class="linkish pz-hide" data-hide="${esc(l.id)}">Hide</button>` : ''}
      </footer>
    </article>`;
  };
  function renderShop() {
    const list = all();
    const n = (id: SectionId) => list.filter((l) => l.section === id).length;
    const q = query.toLowerCase();
    let shown = list.filter((l) => (section === 'all' || l.section === section) && (!q || `${l.title} ${l.desc} ${l.seller}`.toLowerCase().includes(q)));
    shown = shown.sort((a, b) => (sort === 'low' ? a.price - b.price : sort === 'high' ? b.price - a.price : (a.sample ? 1 : 0) - (b.sample ? 1 : 0) || b.t - a.t));
    const realCount = published.length;
    body.innerHTML = (flash ? `<div class="bk-flash">${esc(flash)}</div>` : '') + `
      <div class="pz-hero">
        <div><b>$0</b><span>listing fees</span></div>
        <div><b>75%</b><span>of every sale to the seller</span></div>
        <div><b>${realCount}</b><span>listing${realCount === 1 ? '' : 's'} by sellers${realCount ? '' : ' yet'}</span></div>
      </div>
      <nav class="pz-secs" aria-label="Sections">
        <button data-sec="all" aria-pressed="${section === 'all'}">All <i>${list.length}</i></button>
        ${SECTIONS.map((s) => `<button data-sec="${s.id}" aria-pressed="${section === s.id}" style="--sec:${s.color}"><span class="pz-dot"></span>${esc(s.label)} <i>${n(s.id)}</i></button>`).join('')}
      </nav>
      <div class="pz-tools"><input id="pz-q" type="search" placeholder="Search the mall…" value="${esc(query)}" maxlength="60" /><select id="pz-sort" aria-label="Sort"><option value="new"${sort === 'new' ? ' selected' : ''}>Newest</option><option value="low"${sort === 'low' ? ' selected' : ''}>Price: low to high</option><option value="high"${sort === 'high' ? ' selected' : ''}>Price: high to low</option></select></div>
      ${section !== 'all' ? `<p class="pz-blurb"><b>${esc(sec(section).label)}</b> · ${esc(sec(section).blurb)}</p>` : ''}
      <div class="pz-grid">${shown.map(card).join('') || '<p class="tn-empty">Nothing here yet. Sell something in this section: listing is free.</p>'}</div>`;
    flash = '';
    body.querySelectorAll<HTMLButtonElement>('[data-sec]').forEach((b) => b.addEventListener('click', () => { section = b.dataset.sec as SectionId | 'all'; renderShop(); }));
    const qi = body.querySelector<HTMLInputElement>('#pz-q')!;
    qi.addEventListener('input', () => {
      query = qi.value;
      const pos = qi.selectionStart;
      renderShop();
      const n2 = body.querySelector<HTMLInputElement>('#pz-q')!;
      n2.focus();
      n2.setSelectionRange(pos, pos);
    });
    body.querySelector<HTMLSelectElement>('#pz-sort')!.addEventListener('change', (e) => { sort = (e.target as HTMLSelectElement).value as typeof sort; renderShop(); });
    wireCards();
  }
  function wireCards() {
    body.querySelectorAll<HTMLButtonElement>('[data-add]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.add!;
      if (!basket.includes(id)) basket.push(id);
      updateCount();
      flash = 'Added to your basket.';
      render();
    }));
    body.querySelectorAll<HTMLButtonElement>('[data-mine]').forEach((b) => b.addEventListener('click', async () => {
      const id = b.dataset.mine!.split(':').pop();
      mine = { ...mine, items: mine.items.filter((x) => x.id !== id) };
      await save();
      flash = 'Listing removed.';
      render();
    }));
    body.querySelectorAll<HTMLButtonElement>('[data-hide]').forEach((b) => b.addEventListener('click', () => {
      hidden.add(b.dataset.hide!);
      try { localStorage.setItem(HIDE, JSON.stringify([...hidden].slice(-200))); } catch { /* ignore */ }
      flash = 'Hidden for you. City Hall’s owner can take listings down for everyone.';
      render();
    }));
    body.querySelectorAll<HTMLButtonElement>('[data-mod]').forEach((b) => b.addEventListener('click', async () => {
      const [docId, itemId] = b.dataset.mod!.split(':');
      if (!cloud || !docId || !itemId) return;
      try {
        const ref = cloud.db.doc('plaza/' + docId);
        const snap = await ref.get();
        const d = snap.data() ?? {};
        await ref.set({ ...d, items: (Array.isArray(d.items) ? d.items : []).filter((x: { id?: string }) => x?.id !== itemId), updatedAt: Date.now() });
        flash = 'Listing taken down.';
      } catch { flash = 'Couldn’t take it down: only the city’s owner can.'; }
      render();
    }));
  }

  /* ---------------- basket ---------------- */
  const updateCount = () => { bcount.hidden = !basket.length; bcount.textContent = String(basket.length); };
  function renderBasket() {
    if (checkout) {
      const total = checkout.reduce((a, l) => a + l.price, 0);
      const sp = split(total);
      body.innerHTML = `<div class="pz-done">
        <span class="tn-tag sample">DEMO CHECKOUT · NOTHING CHARGED</span>
        <h3>Order summary: ${usd(total)}</h3>
        <p>No payment was taken. In the live Plaza a payment provider would charge ${usd(total)}, pay sellers ${usd(sp.seller)} (75%) and keep ${usd(sp.plaza)} (25%) for the Plaza. There are no listing fees.</p>
        <ul class="pz-lines">${checkout.map((l) => `<li><b>${esc(l.title)}</b><span>${esc(l.seller)}</span><em>${priceText(l)}</em>${l.link ? `<small>Buy from the seller: <span class="tn-link">${esc(l.link)}</span></small>` : '<small>The seller hasn’t added a link yet.</small>'}</li>`).join('')}</ul>
        <div class="bk-actions"><button class="btn btn-gold" id="pz-again">Keep shopping</button></div>
      </div>`;
      body.querySelector('#pz-again')!.addEventListener('click', () => { checkout = null; show('shop'); });
      return;
    }
    const items = basket.map((id) => all().find((l) => l.id === id)).filter(Boolean) as Listing[];
    if (!items.length) {
      body.innerHTML = '<div class="tn-locked"><h3>Your basket is empty</h3><p>Walk the sections and add products, courses, tools or services. Every sale splits 75% to the seller and 25% to the Plaza.</p><button class="btn btn-gold" id="pz-go">Go shopping</button></div>';
      body.querySelector('#pz-go')!.addEventListener('click', () => show('shop'));
      return;
    }
    const total = items.reduce((a, l) => a + l.price, 0);
    const sp = split(total);
    const monthly = items.some((l) => l.pricing === 'monthly');
    body.innerHTML = `<ul class="pz-lines">${items.map((l) => `<li style="--sec:${sec(l.section).color}"><b>${esc(l.title)}</b><span>${esc(sec(l.section).label)} · ${esc(l.seller)}</span><em>${priceText(l)}</em><button class="linkish" data-rm="${esc(l.id)}">Remove</button></li>`).join('')}</ul>
      <div class="pz-total">
        <div><span>Total${monthly ? ' (first month)' : ''}</span><b>${usd(total)}</b></div>
        <div><span>To sellers · 75%</span><b>${usd(sp.seller)}</b></div>
        <div><span>To the Plaza · 25%</span><b>${usd(sp.plaza)}</b></div>
      </div>
      <p class="bk-fine">Demo checkout: nothing is charged here. You’ll see each seller’s own link to complete the purchase with them.</p>
      <div class="bk-actions"><button class="btn btn-gold" id="pz-checkout">Checkout (demo)</button><button class="btn btn-ghost" id="pz-clear">Empty basket</button></div>`;
    body.querySelectorAll<HTMLButtonElement>('[data-rm]').forEach((b) => b.addEventListener('click', () => { basket.splice(basket.indexOf(b.dataset.rm!), 1); updateCount(); renderBasket(); }));
    body.querySelector('#pz-clear')!.addEventListener('click', () => { basket.length = 0; updateCount(); renderBasket(); });
    body.querySelector('#pz-checkout')!.addEventListener('click', () => { checkout = items; basket.length = 0; updateCount(); renderBasket(); });
  }

  /* ---------------- sell ---------------- */
  let pendingImg: string | undefined;
  function renderSell() {
    if (readOnly) { body.innerHTML = '<p class="tn-empty">You have view-only access to this city, so you can’t list here.</p>'; return; }
    const name = getName();
    body.innerHTML = `
      ${flash ? `<div class="bk-flash">${esc(flash)}</div>` : ''}
      <form class="bk-form tn-form pz-form" id="pz-sell">
        <p class="bk-lead">Anyone can sell in THE PLAZA: prop firms, brokers, traders, copy-trading firms and everyone else. <b>No listing fees.</b> When something sells, <b>75% goes to you</b> and 25% to the Plaza. Up to ${KEEP} listings at a time.</p>
        <label>Seller / brand name<input name="seller" required maxlength="40" value="${esc(mine.seller || name || '')}" placeholder="e.g. your firm or trading name" /></label>
        <label>You are a<select name="sellerType">${SELLER_TYPES.map((t) => `<option${t === mine.sellerType ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
        <label>Section<select name="section">${SECTIONS.map((s) => `<option value="${s.id}"${s.id === section ? ' selected' : ''}>${esc(s.label)}</option>`).join('')}</select></label>
        <label>Pricing<select name="pricing"><option value="one-time">One-time price</option><option value="monthly">Monthly subscription</option><option value="free">Free</option></select></label>
        <label class="wide">What you’re selling<input name="title" required maxlength="80" placeholder="e.g. Session-levels indicator for TradingView" /></label>
        <label class="wide">Description<textarea name="desc" rows="3" maxlength="400" placeholder="What buyers get, platforms, duration, refund terms…"></textarea></label>
        <label class="pz-pricein">Price (USD)<input name="price" inputmode="decimal" placeholder="e.g. 49" /></label>
        <label>Where to buy (shown as text)<input name="link" maxlength="140" placeholder="https://… or @handle" /></label>
        <label class="wide">Picture (optional)<input name="img" type="file" accept="image/png,image/jpeg,image/webp,image/gif" /></label>
        <div class="pz-earn wide" id="pz-earn"></div>
        <div class="bk-actions"><button class="btn btn-gold" type="submit">List it free</button><span id="pz-msg"></span></div>
      </form>
      ${mine.items.length ? `<h4 class="tn-sub">Your listings</h4><ul class="tn-mine">${mine.items.map((it) => `<li><b>${esc(it.title)}</b><span>${esc(sec(it.section).label)} · ${priceText(it)}</span><button class="btn btn-ghost" data-del="${esc(it.id)}">Remove</button></li>`).join('')}</ul>` : ''}`;
    flash = '';
    const form = body.querySelector<HTMLFormElement>('#pz-sell')!;
    const msg = body.querySelector<HTMLElement>('#pz-msg')!;
    const earn = body.querySelector<HTMLElement>('#pz-earn')!;
    const priceIn = form.querySelector<HTMLInputElement>('[name=price]')!;
    const pricingIn = form.querySelector<HTMLSelectElement>('[name=pricing]')!;
    const upd = () => {
      const free = pricingIn.value === 'free';
      priceIn.disabled = free;
      const p = Number(priceIn.value.replace(/[^0-9.]/g, ''));
      if (free) earn.innerHTML = '<span>Free listing</span><b>No fee at all</b>';
      else if (p > 0) { const s = split(p); earn.innerHTML = `<span>On a ${usd(p)} sale${pricingIn.value === 'monthly' ? ' (each month)' : ''}</span><b>You get ${usd(s.seller)}</b><em>Plaza ${usd(s.plaza)} · listing fee $0</em>`; }
      else earn.innerHTML = '<span>Set a price to see your share</span><b>75% to you · 25% to the Plaza</b>';
    };
    priceIn.addEventListener('input', upd);
    pricingIn.addEventListener('change', upd);
    upd();
    const fileIn = form.querySelector<HTMLInputElement>('[name=img]')!;
    fileIn.addEventListener('change', async () => {
      pendingImg = undefined;
      const f = fileIn.files?.[0];
      if (!f) return;
      msg.textContent = 'Preparing the picture…';
      const r = await uploadImage(f, { shared: !!cloud });
      if ('error' in r) { msg.textContent = r.error; fileIn.value = ''; return; }
      pendingImg = r.ref;
      msg.textContent = r.local ? 'Picture ready (kept in this browser).' : 'Picture uploaded.';
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(form);
      const s = (k: string) => String(f.get(k) ?? '').trim();
      const pricing = (s('pricing') || 'one-time') as Listing['pricing'];
      const price = pricing === 'free' ? 0 : Math.round(Number(s('price').replace(/[^0-9.]/g, '')) * 100) / 100;
      if (!s('seller') || !s('title')) { msg.textContent = 'Add your seller name and what you’re selling.'; return; }
      if (pricing !== 'free' && !(price > 0)) { msg.textContent = 'Enter a price, or choose Free.'; return; }
      if (/guarantee[ds]?\s+(profit|return|pass)|pass(ing)?\s+(your|the)\s+(challenge|evaluation)\s+for\s+you|account\s+passing/i.test(`${s('title')} ${s('desc')}`)) { msg.textContent = 'Listings can’t promise guaranteed profits or offer to pass evaluations for someone else (see Fees & rules).'; return; }
      const it = { id: Math.random().toString(36).slice(2, 10), section: s('section') as SectionId, title: s('title').slice(0, 80), desc: s('desc').slice(0, 400), price, pricing, link: s('link').slice(0, 140) || undefined, img: pendingImg, t: Date.now() };
      mine = { seller: s('seller').slice(0, 40), sellerType: (SELLER_TYPES as readonly string[]).includes(s('sellerType')) ? (s('sellerType') as SellerType) : 'Other', items: [it, ...mine.items].slice(0, KEEP) };
      const ok = await save();
      if (ok) { pendingImg = undefined; flash = `“${it.title}” is live in ${sec(it.section).label}. No listing fee.`; section = it.section; show('shop'); }
      else msg.textContent = 'Couldn’t list it: you may not have permission to write to this city.';
    });
    body.querySelectorAll<HTMLButtonElement>('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      mine = { ...mine, items: mine.items.filter((x) => x.id !== b.dataset.del) };
      await save();
      flash = 'Listing removed.';
      renderSell();
    }));
  }
  async function save() {
    const doc = { seller: mine.seller, sellerType: mine.sellerType, items: mine.items, updatedAt: Date.now() };
    if (cloud && cloud.uid) {
      try { await cloud.db.doc('plaza/' + cloud.uid).set(doc); return true; } catch { return false; }
    }
    try { localStorage.setItem(LOCAL, JSON.stringify(doc)); } catch { /* storage full: keep in memory */ }
    applyDocs([{ id: 'me', data: doc }], 'me');
    return true;
  }

  /* ---------------- rules ---------------- */
  function renderRules() {
    const ex = split(100);
    body.innerHTML = `<div class="bk-rules pz-rules">
      <div class="bk-free"><h3>No listing fees. 75% to the seller.</h3><p>Listing in THE PLAZA is free for everyone. When something sells, the seller keeps <b>75%</b> and the Plaza keeps <b>25%</b>: on a $100 sale that’s <b>${usd(ex.seller)}</b> to the seller and ${usd(ex.plaza)} to the Plaza. Free products cost nothing to list or get.</p></div>
      <div><h3>Who can sell</h3><ul><li>Prop firms: challenges, instant funding, scaling plans, promotions.</li><li>Brokers: accounts, platforms, data.</li><li>Traders: courses, mentoring, indicators, templates, journals.</li><li>Copy-trading firms: copy strategies and signal rooms.</li><li>Anyone else: VPS, design, coding, services for traders.</li></ul></div>
      <div><h3>Sections</h3><ul>${SECTIONS.map((s) => `<li><b>${esc(s.label)}</b>: ${esc(s.blurb)}</li>`).join('')}</ul></div>
      <div><h3>House rules</h3><ul><li>No guaranteed-profit claims, and no services that pass evaluations or trade funded accounts for someone else.</li><li>Show past performance honestly; it doesn’t guarantee future results.</li><li>Sellers are responsible for what they sell, refunds and support. Check the seller before you buy.</li><li>Anyone can hide a listing for themselves; the city’s owner can take listings down for everyone.</li></ul></div>
      <p class="bk-fine">This is a demo marketplace: checkout doesn’t take payments, and buyers complete purchases through the seller’s own link. SAMPLE listings are examples from fictional sellers and can’t be bought.</p>
    </div>`;
  }

  function render() {
    tabs.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    feed.innerHTML = `<b>0 listing fees</b> · 75% seller / 25% Plaza. ${cloud ? 'Listings are shared with everyone in this city.' : 'Preview: shared listings open at launch, so for now yours stay in this browser.'} SAMPLE listings are examples, not for sale.`;
    if (tab === 'shop') renderShop();
    else if (tab === 'basket') renderBasket();
    else if (tab === 'sell') renderSell();
    else renderRules();
  }
  function show(t: PlazaTab) { tab = t; if (t !== 'basket') checkout = null; render(); }
  function open(t: PlazaTab = tab, s?: SectionId | 'all') {
    if (s) section = s;
    overlay.hidden = false;
    document.body.classList.add('media-open');
    show(t);
  }
  function close() {
    overlay.hidden = true;
    document.body.classList.remove('media-open');
  }
  function isOpen() { return !overlay.hidden; }
  return {
    open, close, isOpen,
    counts: () => Object.fromEntries(SECTIONS.map((s) => [s.id, all().filter((l) => l.section === s.id).length])) as Record<SectionId, number>,
    onNew: (fn) => { fns.push(fn); },
  };
}
