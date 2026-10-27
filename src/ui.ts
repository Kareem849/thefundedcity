// HTML overlay: header, stats, selection card, live activity, leaderboard, demo bar, labels.
import {
  CITY_STATS, LEVEL_NAMES, ACTIVITY_SEED, levelProgress, crownBand, LINK_LABEL,
  type Trader, type CommercialSpace, type ActivityItem, type TowerLevel, type Resident, type CrownTier, type LinkKey, SECTOR_LABEL,
} from './data';
import { markSvg, BRAND } from './brand';
import { PUBLIC_SITE } from './where';
import { CATEGORY_LABEL, CATEGORY_COLOR, RESEARCHED_ON, PRICE_NOTE, type Firm } from './firms';

const esc = (v: string) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export const fmtUSD = (n: number) => '$' + Math.round(n).toLocaleString('en-US');
export const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US');
export const fmtM = (n: number) => '$' + (n / 1_000_000).toFixed(2) + 'M';

/** Turn what someone typed for a social link into a safe https URL (or null). */
export function linkHref(key: LinkKey, v: string): string | null {
  const t = v.trim();
  if (!t) return null;
  if (key === 'whatsapp') {
    const digits = t.replace(/[^0-9]/g, '');
    return digits.length >= 7 ? `https://wa.me/${digits}` : null;
  }
  if (/^https?:\/\//i.test(t)) {
    try { const u = new URL(t); return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null; } catch { return null; }
  }
  const h = t.replace(/^@/, '');
  if (!/^[A-Za-z0-9._-]{2,40}$/.test(h)) return key === 'website' && /^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(t) ? `https://${t}` : null;
  const base: Partial<Record<LinkKey, string>> = { youtube: 'https://youtube.com/@', facebook: 'https://facebook.com/', x: 'https://x.com/', instagram: 'https://instagram.com/', telegram: 'https://t.me/', discord: 'https://discord.gg/' };
  return base[key] ? base[key] + h : key === 'website' ? null : null;
}

const ICONS = {
  check: '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M8 0l1.9 1.4 2.3-.2.9 2.2 2.1 1-.4 2.3L16 8l-1.2 1.9.4 2.3-2.1 1-.9 2.2-2.3-.2L8 16l-1.9-1.4-2.3.2-.9-2.2-2.1-1 .4-2.3L0 8l1.2-1.9-.4-2.3 2.1-1 .9-2.2 2.3.2z" fill="currentColor"/><path d="M5 8.2l2 2 4-4.2" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  search: '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><circle cx="9" cy="9" r="6" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M13.5 13.5L17 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  reset: '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M4 10a6 6 0 1 0 1.8-4.3" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M4 3v3.6h3.6" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  rotL: '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M5.5 7.5A6 6 0 1 1 4 11" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M5.8 3.6v4h4" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  rotR: '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M14.5 7.5A6 6 0 1 0 16 11" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M14.2 3.6v4h-4" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  orbit: '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><ellipse cx="10" cy="10" rx="8" ry="3.6" stroke="currentColor" stroke-width="1.6" fill="none"/><circle cx="10" cy="10" r="2.4" fill="currentColor"/><circle cx="17.2" cy="8.6" r="1.4" fill="currentColor"/></svg>',
  sun: '<svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><circle cx="10" cy="10" r="3.6" fill="currentColor"/><path d="M10 1.8v2.4M10 15.8v2.4M1.8 10h2.4M15.8 10h2.4M4.2 4.2l1.7 1.7M14.1 14.1l1.7 1.7M4.2 15.8l1.7-1.7M14.1 5.9l1.7-1.7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  moon: '<svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><path d="M15.8 12.6A6.6 6.6 0 0 1 7.4 4.2a6.6 6.6 0 1 0 8.4 8.4z" fill="currentColor"/></svg>',
  clock: '<svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><circle cx="10" cy="10" r="7.2" stroke="currentColor" stroke-width="1.7" fill="none"/><path d="M10 5.8V10l2.8 1.8" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round"/></svg>',
  edit: '<svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><path d="M13.6 3.4l3 3L7 16H4v-3z" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/></svg>',
  walk: '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><circle cx="11" cy="3.6" r="1.8" fill="currentColor"/><path d="M8 18l2-5.5 2.4 2.2V18M10 12.5l.8-4.6-3 1.4-1.3 2.6M10.8 7.9l2.2 2.4 2.6.9" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  lock: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><rect x="4" y="9" width="12" height="8.5" rx="2" fill="currentColor"/><path d="M6.8 9V6.8a3.2 3.2 0 0 1 6.4 0V9" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>',
  close: '<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  logo: '<svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true"><path d="M16 3l11 6.3v13.4L16 29 5 22.7V9.3z" fill="#2f6bff"/><path d="M16 3l11 6.3L16 15.6 5 9.3z" fill="#7aa5ff"/><path d="M16 15.6V29l11-6.3V9.3z" fill="#1f4fd1"/><path d="M12.5 13.2v8.4M16 15.6v9.6M19.5 13.2v8.4" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".9"/></svg>',
  payout: '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M8 2v12M11.5 4.5H6.8a2 2 0 0 0 0 4h2.4a2 2 0 0 1 0 4H4.5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>',
  join: '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M3 13V6l5-3 5 3v7M6.5 13V9.5h3V13" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/></svg>',
  achievement: '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M8 1.8l1.8 3.7 4 .6-2.9 2.8.7 4L8 11l-3.6 1.9.7-4-2.9-2.8 4-.6z" fill="currentColor"/></svg>',
};

export interface UIHandlers {
  onSearchSelect: (id: string) => void;
  onResetCamera: () => void;
  onSimulate: () => void;
  onResetDemo: () => void;
  onCloseCard: () => void;
  onRotate: (deg: number) => void;
  onToggleOrbit: () => void;
  onWalkTo: (id: string) => void;
  onSkipWalk: () => void;
  onStopWalk: () => void;
  onEditCharacter: () => void;
  onSignup: () => void;
  onMode: (mode: 'day' | 'night' | 'live') => void;
  onPlaceAction?: (id: string) => void;
}

export interface SearchEntry { id: string; name: string; kind: string }
export interface PlaceInfo { id: string; badge: string; title: string; sub: string; text: string; facts: Array<[string, string]>; walk?: boolean; action?: { label: string; id: string } }

export interface UI {
  showTrader: (t: Trader) => void;
  updateTrader: (t: Trader, animate: boolean) => void;
  /** stats: real FUNDEDCITY members who list the firm, and their verified payouts from it */
  showFirm: (f: Firm, unlocked: boolean, stats?: { traders: number; payouts: number }) => void;
  showHouse: (r: Resident | null, id: string) => void;
  showCommercial: (c: CommercialSpace) => void;
  showPlace: (p: PlaceInfo) => void;
  hideCard: () => void;
  currentCardId: () => string | null;
  pushActivity: (item: ActivityItem) => void;
  resetActivity: () => void;
  renderLeaderboard: (traders: Trader[], flashId?: string) => void;
  setVerifiedPayouts: (v: number, animate: boolean) => void;
  setDemoBusy: (busy: boolean) => void;
  setOrbit: (on: boolean) => void;
  setMode: (mode: 'day' | 'night' | 'live') => void;
  setNycTime: (label: string, night: number) => void;
  setPlayer: (p: { name: string; status: 'guest' | 'member'; skin: number; hair: number; outfit: number } | null) => void;
  setDiscovery: (found: number, total: number) => void;
  setPlaces: (places: Array<{ id: string; name: string; group: string; found: boolean }>) => void;
  setWalk: (s: { label: string; remaining: number; eta: number } | null) => void;
  showDiscovery: (name: string, kind: string, found: number, total: number) => void;
  makePlayerPin: (name: string, status: 'guest' | 'member') => HTMLElement;
  setTooltip: (text: string | null, sub?: string, x?: number, y?: number) => void;
  makeDistrictLabel: (name: string, subtitle: string) => HTMLElement;
  makeNamePin: (name: string) => HTMLElement;
  makePayoutToast: (amount: number) => HTMLElement;
  makeLevelUpChip: (level: number, crown?: CrownTier | null) => HTMLElement;
}

export function createUI(root: HTMLElement, search: SearchEntry[], h: UIHandlers): UI {
  root.insertAdjacentHTML(
    'beforeend',
    `
  <header class="topbar glass-card">
    <div class="brand" title="FundedCity · ${BRAND.tagline.toLowerCase()}">${markSvg(28, { title: 'FundedCity logo' })}<span>Funded<b>City</b></span>${PUBLIC_SITE ? '<em class="brand-preview" title="Public preview: shared accounts, chat and AI guides open at launch">PREVIEW</em>' : ''}</div>
    <div class="search">
      <span class="search-icon">${ICONS.search}</span>
      <input id="search" type="text" autocomplete="off" spellcheck="false" placeholder="Search traders, firms or explore the city..." />
      <ul class="search-results" id="search-results" hidden></ul>
    </div>
    <div class="topbar-right">
      <span class="live-pill" title="New York City time"><i></i>LIVE CITY<span class="nyc" id="nyc-time"></span></span>
      <div class="mode-switch" role="radiogroup" aria-label="Lighting">
        <button role="radio" id="mode-day" data-mode="day" aria-checked="false" title="Always daytime">${ICONS.sun}<span>Day</span></button>
        <button role="radio" id="mode-night" data-mode="night" aria-checked="false" title="Always night-time">${ICONS.moon}<span>Night</span></button>
        <button role="radio" id="mode-live" data-mode="live" aria-checked="false" title="Day or night based on New York City time">${ICONS.clock}<span>Live</span></button>
      </div>
    </div>
  </header>

  <div class="view-tools glass-card" role="group" aria-label="Camera">
    <button class="icon-btn sq" id="rot-left" title="Rotate left 90°" aria-label="Rotate left 90°">${ICONS.rotL}</button>
    <button class="icon-btn sq" id="orbit" title="Auto-orbit around the city" aria-label="Auto-orbit" aria-pressed="false">${ICONS.orbit}</button>
    <button class="icon-btn sq" id="rot-right" title="Rotate right 90°" aria-label="Rotate right 90°">${ICONS.rotR}</button>
    <button class="icon-btn sq" id="reset-camera" title="Reset view" aria-label="Reset view">${ICONS.reset}</button>
  </div>

  <section class="stats">
    <div class="stat glass-card"><span>Active Traders</span><b>${fmtInt(CITY_STATS.activeTraders)}</b></div>
    <div class="stat glass-card"><span>Verified Payouts</span><b id="stat-payouts">${fmtM(CITY_STATS.verifiedPayouts)}</b></div>
    <div class="stat glass-card"><span>Total Traders</span><b>${fmtInt(CITY_STATS.totalTraders)}</b></div>
    <div class="stat glass-card"><span>Prop Firm Partners</span><b>${CITY_STATS.propFirmPartners}</b></div>
  </section>

  <aside class="info-card glass-card" id="info-card" aria-live="polite"></aside>

  <section class="panel activity glass-card">
    <div class="panel-head"><span class="dot-live"></span>LIVE ACTIVITY</div>
    <ul id="activity"></ul>
  </section>

  <section class="panel leaderboard glass-card">
    <div class="panel-head">TOP TRADERS<span class="muted">Verified payouts</span></div>
    <ol id="leaderboard"></ol>
  </section>

  <div class="demo-bar glass-card">
    <span class="demo-tag">DEMO</span>
    <button class="btn btn-gold" id="simulate">SIMULATE +$25K PAYOUT</button>
    <button class="btn btn-ghost" id="reset-demo">RESET DEMO</button>
  </div>

  <div class="tooltip" id="tooltip" hidden><b></b><span></span></div>
  <div class="hint" id="hint">Drag to orbit 360° · Right-drag or Shift+drag to pan · Scroll to zoom</div>

  <section class="player-hud glass-card" id="player-hud" hidden aria-label="Your character">
    <div class="ph-row">
      <span class="ph-avatar" id="ph-avatar" aria-hidden="true"></span>
      <div class="ph-id">
        <b id="ph-name"></b>
        <span class="ph-status" id="ph-status"></span>
      </div>
      <button class="icon-btn sq" id="ph-edit" title="Edit character" aria-label="Edit character">${ICONS.edit}</button>
    </div>
    <div class="ph-progress">
      <div class="ph-label"><span>Places discovered</span><b id="ph-count"></b></div>
      <div class="bar"><i id="ph-bar"></i></div>
    </div>
    <label class="ph-go" for="ph-places"><span>Walk to</span>
      <select id="ph-places"><option value="">Choose a place…</option></select>
    </label>
    <button class="btn btn-ghost ph-signup" id="ph-signup">Sign up to save your progress</button>
    <button class="btn btn-gold ph-profile" id="ph-profile" hidden>Build my tower · free</button>
  </section>

  <div class="walk-bar glass-card" id="walk-bar" hidden role="status">
    <span class="walk-ico">${ICONS.walk}</span>
    <div class="walk-text"><b id="walk-label"></b><span id="walk-meta"></span></div>
    <button class="btn btn-gold" id="walk-skip">Skip walk</button>
    <button class="icon-btn sq" id="walk-stop" title="Stop walking" aria-label="Stop walking">${ICONS.close}</button>
  </div>

  <div class="discover-toasts" id="discover-toasts" aria-live="polite"></div>
  `,
  );

  const $ = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;
  const card = $<HTMLElement>('#info-card');
  const activity = $<HTMLUListElement>('#activity');
  const leaderboard = $<HTMLOListElement>('#leaderboard');
  const tooltip = $<HTMLDivElement>('#tooltip');
  const statPayouts = $<HTMLElement>('#stat-payouts');
  const simulateBtn = $<HTMLButtonElement>('#simulate');
  let cardId: string | null = null;
  let shownVerified = CITY_STATS.verifiedPayouts;

  $('#reset-camera').addEventListener('click', h.onResetCamera);
  $('#rot-left').addEventListener('click', () => h.onRotate(-90));
  $('#rot-right').addEventListener('click', () => h.onRotate(90));
  const orbitBtn = $<HTMLButtonElement>('#orbit');
  orbitBtn.addEventListener('click', h.onToggleOrbit);
  const modeBtns = [...root.querySelectorAll<HTMLButtonElement>('.mode-switch button')];
  modeBtns.forEach((b) => b.addEventListener('click', () => h.onMode(b.dataset.mode as 'day' | 'night' | 'live')));
  const nycEl = $<HTMLElement>('#nyc-time');
  const hud = $<HTMLElement>('#player-hud');
  const walkBar = $<HTMLElement>('#walk-bar');
  const toasts = $<HTMLElement>('#discover-toasts');
  const hexc = (n: number) => '#' + n.toString(16).padStart(6, '0');
  $('#ph-edit').addEventListener('click', h.onEditCharacter);
  $('#ph-signup').addEventListener('click', h.onSignup);
  $('#walk-skip').addEventListener('click', h.onSkipWalk);
  $('#walk-stop').addEventListener('click', h.onStopWalk);
  const placeSel = $<HTMLSelectElement>('#ph-places');
  placeSel.addEventListener('change', () => {
    if (placeSel.value) h.onWalkTo(placeSel.value);
    placeSel.value = '';
  });
  card.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-walk]');
    if (b) h.onWalkTo(b.dataset.walk!);
  });
  simulateBtn.addEventListener('click', h.onSimulate);
  $('#reset-demo').addEventListener('click', h.onResetDemo);

  /* ---------- search ---------- */
  const input = $<HTMLInputElement>('#search');
  const results = $<HTMLUListElement>('#search-results');
  let active = 0;
  let matches: SearchEntry[] = [];
  const renderResults = () => {
    const q = input.value.trim().toLowerCase();
    matches = q ? search.filter((s) => s.name.toLowerCase().includes(q) || s.kind.toLowerCase().includes(q)).slice(0, 6) : [];
    results.hidden = matches.length === 0;
    active = 0;
    results.innerHTML = matches
      .map((m, i) => `<li data-id="${m.id}" class="${i === active ? 'active' : ''}"><b>${m.name}</b><span>${m.kind}</span></li>`)
      .join('');
  };
  const choose = (id: string) => {
    input.value = '';
    results.hidden = true;
    input.blur();
    h.onSearchSelect(id);
  };
  input.addEventListener('input', renderResults);
  input.addEventListener('keydown', (e) => {
    if (!matches.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length;
      [...results.children].forEach((li, i) => li.classList.toggle('active', i === active));
    } else if (e.key === 'Enter') {
      choose(matches[active].id);
    } else if (e.key === 'Escape') {
      results.hidden = true;
    }
  });
  results.addEventListener('pointerdown', (e) => {
    const li = (e.target as HTMLElement).closest('li');
    if (li?.dataset.id) {
      e.preventDefault();
      choose(li.dataset.id);
    }
  });
  input.addEventListener('blur', () => setTimeout(() => (results.hidden = true), 120));

  /* ---------- card ---------- */
  const openCard = (id: string, html: string, variant = '') => {
    const switching = cardId !== null && cardId !== id;
    cardId = id;
    card.classList.toggle('firm-card', variant === 'firm');
    card.innerHTML = `<button class="card-close" aria-label="Close">${ICONS.close}</button>${html}`;
    card.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((t) =>
      t.addEventListener('click', () => {
        card.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === t)));
        card.querySelectorAll<HTMLElement>('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== t.dataset.tab));
      }),
    );
    card.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((b) =>
      b.addEventListener('click', () => {
        const code = b.dataset.copy!;
        navigator.clipboard?.writeText(code).then(() => {
          b.classList.add('copied');
          setTimeout(() => b.classList.remove('copied'), 1200);
        }).catch(() => {
          const range = document.createRange();
          range.selectNodeContents(b);
          const sel = getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
        });
      }),
    );
    card.querySelector('.card-close')!.addEventListener('click', h.onCloseCard);
    card.querySelectorAll<HTMLButtonElement>('.card-actions [data-place-action]').forEach((b) => b.addEventListener('click', () => h.onPlaceAction?.(b.dataset.placeAction!)));
    card.classList.add('open');
    if (switching) {
      card.classList.remove('swap');
      void card.offsetWidth;
      card.classList.add('swap');
    }
  };

  const levelBoxHTML = (t: Trader) => {
    const lp = levelProgress(t.payouts);
    const title = t.crown ? crownBand(t.crown).label : LEVEL_NAMES[t.level];
    return `<div class="level-row">
        <div><span class="label">Tower Level</span><b data-f="level">Level ${t.level}</b><em data-f="levelname">${esc(title)}</em></div>
        <div class="xp"><span class="label">${lp.nextLabel ? 'Next' : 'Top tier'}</span><b data-f="xp">${lp.nextLabel ? `${esc(lp.nextLabel)} at ${fmtUSD(lp.nextAt)}` : 'Platinum Crown'}</b></div>
      </div>
      <div class="bar"><i data-f="bar" style="width:${lp.pct}%"></i></div>`;
  };
  const profileHTML = (t: Trader) => {
    const p = t.profile;
    if (!p) return '';
    const links = (Object.keys(LINK_LABEL) as LinkKey[])
      .map((k) => [k, p.links[k] ?? ''] as const)
      .filter(([, v]) => v)
      .map(([k, v]) => {
        const href = linkHref(k, v);
        return href ? `<a class="lk" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${LINK_LABEL[k]}</a>` : `<span class="lk">${LINK_LABEL[k]}: ${esc(v)}</span>`;
      }).join('');
    return `<div class="tp-extra">
      ${p.firms.length ? `<div class="tp-row"><span class="label">Prop firms</span><div class="tp-chips">${p.firms.map((f) => `<span>${esc(f)}</span>`).join('')}</div></div>` : ''}
      ${p.services ? `<div class="tp-row"><span class="label">Services</span><p>${esc(p.services)}</p></div>` : ''}
      ${links ? `<div class="tp-row"><span class="label">Links</span><div class="tp-links">${links}</div></div>` : ''}
    </div>`;
  };
  const traderHTML = (t: Trader) => {
    const p = t.profile;
    const pend = p ? p.payouts.filter((r) => r.status === 'pending').length : 0;
    return `
    <div class="card-head">
      <div class="avatar ${t.signature || t.crown ? 'gold' : ''}">${esc(t.initials)}</div>
      <div>
        <div class="card-title">${esc(t.name.toUpperCase())}${t.mine ? ' <em class="you-tag">YOU</em>' : ''}</div>
        <div class="card-sub">${esc(p ? `${p.fullName} · ${t.country}` : t.country)} · ${SECTOR_LABEL[t.sector]}</div>
        ${t.payouts > 0 ? `<div class="verified">${ICONS.check}${p ? 'Payouts verified by FUNDEDCITY checks' : 'Verified Trader'}</div>` : ''}
        ${t.demo ? '<div class="demo-tag">DEMO DATA · sample trader</div>' : ''}
      </div>
    </div>
    <div class="stat-grid">
      <div class="cell wide"><span>Verified Payouts</span><b data-f="payouts">${fmtUSD(t.payouts)}</b></div>
      <div class="cell"><span>Payout count</span><b data-f="count">${t.payoutCount}${pend ? ` <small>+${pend} pending</small>` : ''}</b></div>
      <div class="cell"><span>${p ? 'Current Allocation' : 'Highest Allocation'}</span><b>${fmtUSD(t.highestAllocation)}</b></div>
      <div class="cell"><span>City Rank</span><b data-f="world">#${fmtInt(t.worldRank)}</b></div>
      <div class="cell"><span>${esc(t.country)} Rank</span><b>#${t.countryRank}</b></div>
    </div>
    <div class="level-box ${t.crown ? 'max crown-' + t.crown : ''}" data-f="levelbox">${levelBoxHTML(t)}</div>
    ${profileHTML(t)}
    <button class="btn btn-walk" data-walk="${t.id}">${ICONS.walk}Walk here</button>
    ${t.mine ? '<div class="card-actions"><button class="btn btn-primary" data-place-action="profile:payouts">Upload a payout</button><button class="btn btn-ghost" data-place-action="profile:profile">Edit profile</button></div>' : ''}`;
  };

  const countUp = (el: HTMLElement | null, from: number, to: number, fmt: (n: number) => string, dur = 900) => {
    if (!el) return;
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  };

  /* ---------- activity ---------- */
  const activityRow = (a: ActivityItem, fresh = false) =>
    `<li class="${a.kind} ${fresh ? 'fresh' : ''}"><span class="ico">${ICONS[a.kind]}</span><p>${a.text}</p><time>${a.ago}</time></li>`;
  const resetActivity = () => {
    activity.innerHTML = ACTIVITY_SEED.map((a) => activityRow(a)).join('');
  };
  resetActivity();

  const api: UI = {
    showTrader(t) {
      openCard(t.id, traderHTML(t));
    },
    updateTrader(t, animate) {
      if (cardId !== t.id) return;
      if (!animate) {
        openCard(t.id, traderHTML(t));
        return;
      }
      const q = (f: string) => card.querySelector<HTMLElement>(`[data-f="${f}"]`);
      const prevPay = Number(q('payouts')?.textContent?.replace(/[^0-9]/g, '')) || t.payouts;
      countUp(q('payouts'), prevPay, t.payouts, fmtUSD);
      const cnt = q('count');
      if (cnt) { cnt.textContent = String(t.payoutCount); cnt.classList.remove('flash'); void cnt.offsetWidth; cnt.classList.add('flash'); }
      const world = q('world');
      if (world) { world.textContent = '#' + fmtInt(t.worldRank); world.classList.remove('flash'); void world.offsetWidth; world.classList.add('flash'); }
      const box = q('levelbox');
      if (box) {
        const levelled = q('level')?.textContent !== `Level ${t.level}`;
        box.innerHTML = levelBoxHTML(t);
        box.className = `level-box ${t.crown ? 'max crown-' + t.crown : ''}`;
        if (levelled) { void box.offsetWidth; box.classList.add('levelup'); }
        const xpEl = q('xp');
        xpEl?.classList.add('flash');
      }
    },
    showFirm(f, unlocked, stats) {
      const hexA = '#' + CATEGORY_COLOR[f.category].toString(16).padStart(6, '0');
      const words = f.sign.replace(/[^A-Za-z0-9 ]/g, '').split(' ').filter(Boolean);
      const initials = (words.length > 1 ? words.map((w) => w[0]).join('') : f.sign).slice(0, 2).toUpperCase();
      const site = f.website.replace(/^https?:\/\/(www\.)?/, '');
      const head = `
      <div class="card-head">
        <div class="avatar firm" style="--accent:${hexA}">${f.logo ? `<img src="${f.logo}" alt="" />` : esc(initials)}</div>
        <div>
          <div class="card-title">${esc(f.name.toUpperCase())}</div>
          <div class="card-sub">${esc(f.tagline)}</div>
          <div class="firm-chips"><span class="cat-chip" style="--accent:${hexA}">${CATEGORY_LABEL[f.category]} firm</span>${f.status === 'relaunching' ? '<span class="cat-chip soon">Relaunching</span>' : ''}</div>
        </div>
      </div>
      <div class="stat-grid">
        <div class="cell"><span>City members trading here</span><b>${stats ? fmtInt(stats.traders) : '—'}</b></div>
        <div class="cell"><span>Verified payouts here</span><b>${stats && stats.payouts ? fmtUSD(stats.payouts) : '$0'}</b></div>
      </div>`;
      if (!unlocked) {
        openCard(f.id, `${head}
        <div class="locked">
          <div class="locked-ico">${ICONS.lock}</div>
          <b>Visit the HQ to unlock</b>
          <p>Walk your character to the ${esc(f.name)} building to see its plans, services and current offers.</p>
          <div class="locked-teaser" aria-hidden="true"><i></i><i></i><i></i></div>
        </div>
        <button class="btn btn-walk" data-walk="${f.id}">${ICONS.walk}Walk to ${esc(f.sign)} HQ</button>`, 'firm');
        return;
      }
      const plans = f.plans.length
        ? `<div class="table-wrap"><table class="plans">
            <thead><tr><th>Program</th><th>Sizes</th><th>Price</th><th>Target</th><th>Daily loss</th><th>Max loss</th><th>Split</th></tr></thead>
            <tbody>${f.plans.map((p) => `<tr><td><b>${esc(p.program)}</b></td><td>${esc(p.sizes)}</td><td>${esc(p.price)}</td><td>${esc(p.target)}</td><td>${esc(p.dailyLoss)}</td><td>${esc(p.maxLoss)}</td><td>${esc(p.split)}</td></tr>${p.tiers ? `<tr class="tiers"><td colspan="7"><span>Price by size</span>${p.tiers.split(' · ').map((t) => `<em>${esc(t)}</em>`).join('')}</td></tr>` : ''}`).join('')}</tbody>
          </table></div>
          <p class="fine">${PRICE_NOTE}</p>`
        : `<p class="empty-note">No plans published yet.</p>`;
      const facts = [
        ['Profit split', f.split], ['Payouts', f.payouts], ['Assets', f.assets],
        ...(f.founded ? [['Founded', f.founded]] : []), ...(f.hq ? [['Based in', f.hq]] : []),
      ];
      const services = `
        <dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
        ${f.platforms.length ? `<div class="chip-row">${f.platforms.map((p) => `<span class="mini-chip">${esc(p)}</span>`).join('')}</div>` : ''}
        ${f.services.length ? `<ul class="svc">${f.services.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}`;
      const offers = f.offers.length
        ? `<ul class="offers">${f.offers.map((o) => `<li>${o.code ? `<button class="code" data-copy="${esc(o.code)}" title="Copy code">${esc(o.code)}</button>` : '<span class="code plain">Offer</span>'}<div><b>${esc(o.text)}</b>${o.seen ? `<span>Seen ${esc(o.seen)}</span>` : ''}</div></li>`).join('')}</ul>
           <p class="fine">Codes change often. Check the firm's checkout before you buy.</p>`
        : `<p class="empty-note">No public offer was listed when we researched this firm.</p>`;
      openCard(f.id, `${head}
        <div class="unlocked-note">${ICONS.check}HQ visited · plans unlocked</div>
        <div class="tabs" role="tablist">
          <button role="tab" aria-selected="true" data-tab="plans">Plans</button>
          <button role="tab" aria-selected="false" data-tab="services">Services</button>
          <button role="tab" aria-selected="false" data-tab="offers">Offers${f.offers.length ? ` <em>${f.offers.length}</em>` : ''}</button>
        </div>
        <div class="tab-panels">
          <section data-panel="plans">${plans}</section>
          <section data-panel="services" hidden>${services}</section>
          <section data-panel="offers" hidden>${offers}</section>
        </div>
        ${f.notes ? `<p class="fine">${esc(f.notes)}</p>` : ''}
        <p class="source">Source: <a href="${f.source.url}" target="_blank" rel="noopener">${esc(f.source.label)}</a> · terms checked ${esc(f.checked ?? RESEARCHED_ON)}. Prices and rules change; confirm on <a href="${f.website}" target="_blank" rel="noopener">${esc(site)}</a>.</p>
        <div class="card-actions single"><a class="btn btn-primary as-link" href="${f.website}" target="_blank" rel="noopener">Visit ${esc(site)}</a></div>`, 'firm');
    },
    showHouse(r, id) {
      const mine = !!r?.mine;
      openCard(id, `
      <div class="card-head">
        <div class="avatar house ${mine ? 'gold' : ''}">${r ? esc(r.name.slice(0, 2).toUpperCase()) : '—'}</div>
        <div>
          <div class="card-title">${r ? esc(r.name.toUpperCase()) : 'AVAILABLE HOUSE'}</div>
          <div class="card-sub">${r ? `${esc(r.country)} · joined ${esc(r.joined)}` : 'Brooklyn houses'}</div>
          <div class="verified ${mine ? 'mine' : 'available'}">${mine ? `${ICONS.check}Your house` : r ? '<i></i>Registered trader' : '<i></i>Free for the next member'}</div>
        </div>
      </div>
      <div class="stat-grid">
        <div class="cell"><span>Verified payouts</span><b>$0</b></div>
        <div class="cell"><span>Sector</span><b>${r ? SECTOR_LABEL[r.sector] : '—'}</b></div>
      </div>
      <p class="lease-copy">${r ? 'No verified payout yet. The first verified payout, from $1, moves this trader into a Level 1 tower in their sector.' : 'Sign up to move into this house; your first verified payout upgrades it to a tower.'}</p>
      <button class="btn btn-walk" data-walk="${id}">${ICONS.walk}${mine ? 'Walk home' : 'Walk here'}</button>`);
    },
    showCommercial(c) {
      const kindLabel = c.kind === 'plot' ? 'Empty city plot' : c.kind === 'billboard' ? 'Advertising space' : 'Build-to-suit HQ site';
      openCard(c.id, `
      <div class="card-head">
        <div class="avatar lease">${c.kind === 'billboard' ? 'AD' : c.kind === 'hq' ? 'HQ' : 'P'}</div>
        <div>
          <div class="card-title">${c.name.toUpperCase()}</div>
          <div class="card-sub">${kindLabel}</div>
          <div class="verified available"><i></i>Available</div>
        </div>
      </div>
      <p class="lease-copy">This city space can be leased by a trader, prop firm or sponsor.</p>
      <div class="stat-grid">
        <div class="cell wide price"><span>From</span><b>${fmtUSD(c.price)}<small>/month</small></b></div>
        <div class="cell wide"><span>Location</span><b class="sm">${c.size}</b></div>
      </div>
      <button class="btn btn-walk" data-walk="${c.id}">${ICONS.walk}Walk here</button>
      <div class="card-actions single"><button class="btn btn-primary">Request Lease</button></div>`);
    },
    showPlace(p) {
      openCard(p.id, `
      <div class="card-head">
        <div class="avatar lease">${esc(p.badge)}</div>
        <div>
          <div class="card-title">${esc(p.title.toUpperCase())}</div>
          <div class="card-sub">${esc(p.sub)}</div>
        </div>
      </div>
      <p class="lease-copy">${esc(p.text)}</p>
      <div class="stat-grid">${p.facts.map(([k, v]) => `<div class="cell"><span>${esc(k)}</span><b class="sm">${esc(v)}</b></div>`).join('')}</div>
      ${p.walk ? `<button class="btn btn-walk" data-walk="${esc(p.id)}">${ICONS.walk}Walk here</button>` : ''}
      ${p.action ? `<div class="card-actions single"><button class="btn btn-primary" data-place-action="${esc(p.action.id)}">${esc(p.action.label)}</button></div>` : ''}`);
      card.querySelector<HTMLButtonElement>('[data-place-action]')?.addEventListener('click', (e) => h.onPlaceAction?.((e.currentTarget as HTMLElement).dataset.placeAction!));
    },
    hideCard() {
      cardId = null;
      card.classList.remove('open', 'swap');
    },
    currentCardId: () => cardId,
    pushActivity(item) {
      activity.insertAdjacentHTML('afterbegin', activityRow(item, true));
      while (activity.children.length > 4) activity.lastElementChild!.remove();
    },
    resetActivity,
    renderLeaderboard(traders, flashId) {
      const sorted = [...traders].sort((a, b) => b.payouts - a.payouts);
      const top = sorted.slice(0, 5);
      // always show your own tower ("you") under the top 5 (the demo signature tower until you have one)
      const me = sorted.find((t) => t.mine) ?? sorted.find((t) => t.signature);
      const rows = top.map((t) => [t, sorted.indexOf(t) + 1] as const);
      if (me && !top.includes(me)) rows.push([me, sorted.indexOf(me) + 1]);
      leaderboard.innerHTML = rows
        .map(
          ([t, rank]) => `<li class="${t === me ? 'me' : ''} ${t.id === flashId ? 'flash-row' : ''}${rank > 5 ? ' gap' : ''}" data-id="${t.id}">
            <span class="rank">${rank}</span><span class="name">${esc(t.name)}</span><span class="amt">${fmtUSD(t.payouts)}</span></li>`,
        )
        .join('');
      leaderboard.querySelectorAll('li').forEach((li) =>
        li.addEventListener('click', () => h.onSearchSelect((li as HTMLElement).dataset.id!)),
      );
    },
    setVerifiedPayouts(v, animate) {
      if (animate) countUp(statPayouts, shownVerified, v, fmtM, 1200);
      else statPayouts.textContent = fmtM(v);
      shownVerified = v;
    },
    setDemoBusy(busy) {
      simulateBtn.disabled = busy;
      simulateBtn.classList.toggle('busy', busy);
    },
    setMode(mode) {
      modeBtns.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === mode)));
    },
    setPlayer(p) {
      hud.hidden = !p;
      document.body.classList.toggle('has-player', !!p);
      if (!p) return;
      hud.querySelector('#ph-name')!.textContent = p.name;
      const st = hud.querySelector<HTMLElement>('#ph-status')!;
      st.textContent = p.status === 'member' ? 'Member' : 'Guest';
      st.className = `ph-status ${p.status}`;
      hud.querySelector<HTMLElement>('#ph-avatar')!.style.cssText =
        `--skin:${hexc(p.skin)};--hair:${hexc(p.hair)};--outfit:${hexc(p.outfit)}`;
      hud.querySelector<HTMLElement>('#ph-signup')!.hidden = p.status === 'member';
    },
    setDiscovery(found, total) {
      hud.querySelector('#ph-count')!.textContent = `${found} / ${total}`;
      hud.querySelector<HTMLElement>('#ph-bar')!.style.width = `${(found / Math.max(1, total)) * 100}%`;
    },
    setPlaces(places) {
      const sel = hud.querySelector<HTMLSelectElement>('#ph-places')!;
      const groups = [...new Set(places.map((p) => p.group))];
      sel.innerHTML = '<option value="">Choose a place…</option>' + groups
        .map((g) => `<optgroup label="${g}">${places.filter((p) => p.group === g).map((p) => `<option value="${p.id}">${p.found ? '✓ ' : ''}${p.name}</option>`).join('')}</optgroup>`)
        .join('');
    },
    setWalk(st) {
      walkBar.hidden = !st;
      document.body.classList.toggle('walking', !!st);
      if (!st) return;
      walkBar.querySelector('#walk-label')!.textContent = `Walking to ${st.label}`;
      const secs = Math.max(1, Math.round(st.eta));
      walkBar.querySelector('#walk-meta')!.textContent = `${Math.round(st.remaining * 2.5)} m · about ${secs} s`;
    },
    showDiscovery(placeName, kind, found, total) {
      const t = document.createElement('div');
      t.className = 'discover-toast glass-card';
      t.innerHTML = `<span class="dt-ico">${ICONS.achievement}</span><div><span class="dt-eyebrow">New place discovered · ${found}/${total}</span><b></b><em></em></div>`;
      t.querySelector('b')!.textContent = placeName;
      t.querySelector('em')!.textContent = kind;
      toasts.prepend(t);
      while (toasts.children.length > 3) toasts.lastElementChild!.remove();
      setTimeout(() => t.classList.add('out'), 3200);
      setTimeout(() => t.remove(), 3700);
    },
    makePlayerPin(pinName, status) {
      const el = document.createElement('div');
      el.className = `player-pin ${status}`;
      el.innerHTML = `<b></b><span>${status === 'member' ? 'Member' : 'Guest'}</span>`;
      el.querySelector('b')!.textContent = pinName;
      return el;
    },
    setNycTime(label, night) {
      nycEl.textContent = `NYC ${label}`;
      const live = root.querySelector<HTMLButtonElement>('#mode-live')!;
      live.title = `Live: ${night > 0.5 ? 'night' : night > 0.05 ? 'dusk' : 'day'} in New York (${label})`;
    },
    setOrbit(on) {
      orbitBtn.classList.toggle('on', on);
      orbitBtn.setAttribute('aria-pressed', String(on));
    },
    setTooltip(text, sub, x, y) {
      if (!text) {
        tooltip.hidden = true;
        return;
      }
      tooltip.hidden = false;
      (tooltip.firstElementChild as HTMLElement).textContent = text;
      (tooltip.lastElementChild as HTMLElement).textContent = sub ?? '';
      tooltip.style.transform = `translate(${(x ?? 0) + 14}px, ${(y ?? 0) + 14}px)`;
    },
    makeDistrictLabel(name, subtitle) {
      const el = document.createElement('div');
      el.className = 'district-label';
      el.innerHTML = `<b>${name}</b><span>${subtitle}</span>`;
      return el;
    },
    makeNamePin(name) {
      const el = document.createElement('div');
      el.className = 'name-pin';
      el.innerHTML = `<span class="crown-dot"></span>${name}`;
      return el;
    },
    makePayoutToast(amount) {
      const el = document.createElement('div');
      el.className = 'payout-toast';
      el.innerHTML = `<b>+${fmtUSD(amount)}</b><span>${ICONS.check}VERIFIED PAYOUT</span>`;
      return el;
    },
    makeLevelUpChip(level, crown) {
      const el = document.createElement('div');
      el.className = 'levelup-chip';
      el.textContent = crown ? crownBand(crown).label.toUpperCase() : `LEVEL ${level} · ${LEVEL_NAMES[level as TowerLevel].toUpperCase()}`;
      return el;
    },
  };
  return api;
}
