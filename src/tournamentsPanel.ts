// Liquidation Arena panel: prop-firm tournaments (live and upcoming) and a form for firm teams to publish
// their own. Published tournaments live in the page's shared database (`tours/<your id>`, up to 3 each)
// on the published city; elsewhere they stay in this browser. SAMPLE listings fill in until firms publish.
import { getCloud, type Cloud } from './cloud';
import { getPass, onPass, passRole } from './clubPass';
import { FIRMS } from './firms';
import { sampleTournaments, tourStatus, countdown, fmtMoney, type Tournament } from './tournaments';

export type ArenaTab = 'live' | 'upcoming' | 'publish';
export interface TournamentsPanel {
  open: (tab?: ArenaTab) => void;
  close: () => void;
  isOpen: () => boolean;
  list: () => Tournament[];
  onChange: (fn: (list: Tournament[], added: Tournament[]) => void) => void;
}

const esc = (v: string) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const CLOSE = '<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const LOCAL_KEY = 'fundedcity-tours-local';
const KEEP = 3;
const DAY = 86_400_000;

interface Item { id: string; title: string; start: number; end: number; prizePool: number; prizes: string; entry: string; format: string; link?: string }

function cleanItem(v: Record<string, unknown>): Item | null {
  const s = (k: string, n: number) => (typeof v[k] === 'string' ? (v[k] as string).slice(0, n) : '');
  const num = (k: string) => (typeof v[k] === 'number' && Number.isFinite(v[k]) ? (v[k] as number) : NaN);
  const it: Item = { id: s('id', 40), title: s('title', 70), start: num('start'), end: num('end'), prizePool: num('prizePool'), prizes: s('prizes', 200), entry: s('entry', 40), format: s('format', 140), link: s('link', 120) || undefined };
  if (!it.id || !it.title || !Number.isFinite(it.start) || !Number.isFinite(it.end) || !(it.prizePool >= 0)) return null;
  return it;
}

export function createTournamentsPanel(root: HTMLElement, getName: () => string | null, openClub: () => void): TournamentsPanel {
  root.insertAdjacentHTML(
    'beforeend',
    `<div class="media-overlay arena-overlay" id="tn-overlay" hidden>
      <section class="media-panel arena-panel" role="dialog" aria-modal="true" aria-labelledby="tn-title">
        <header class="mp-head">
          <div class="mp-title"><span class="mp-eyebrow tn-eyebrow">LIQUIDATION ARENA</span><h2 id="tn-title">Prop firm tournaments</h2></div>
          <nav class="mp-tabs" role="tablist">
            <button role="tab" data-tab="live">Live</button>
            <button role="tab" data-tab="upcoming">Upcoming</button>
            <button role="tab" data-tab="publish">Publish</button>
          </nav>
          <button class="icon-btn sq mp-close" id="tn-close" aria-label="Close arena">${CLOSE}</button>
        </header>
        <div class="mp-body" id="tn-body"></div>
        <footer class="mp-foot"><span class="mp-feed" id="tn-feed"></span></footer>
      </section>
    </div>`,
  );
  const overlay = root.querySelector<HTMLElement>('#tn-overlay')!;
  const body = overlay.querySelector<HTMLElement>('#tn-body')!;
  const feed = overlay.querySelector<HTMLElement>('#tn-feed')!;
  const tabs = [...overlay.querySelectorAll<HTMLButtonElement>('.mp-tabs button')];
  overlay.querySelector('#tn-close')!.addEventListener('click', () => close());
  overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) close(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) close(); });
  tabs.forEach((b) => b.addEventListener('click', () => show(b.dataset.tab as ArenaTab)));

  let tab: ArenaTab = 'live';
  let cloud: Cloud | null = null;
  let readOnly = false;
  let published: Tournament[] = [];
  let mine: { firmId: string; firm: string; items: Item[] } = { firmId: '', firm: '', items: [] };
  const fns: Array<(list: Tournament[], added: Tournament[]) => void> = [];
  let seen = new Set<string>();
  let flash = '';

  const all = () => [...published, ...sampleTournaments()];
  const emit = () => {
    const list = all();
    const added = published.filter((t) => !seen.has(t.id));
    const first = seen.size === 0;
    seen = new Set(published.map((t) => t.id));
    for (const f of fns) f(list, first ? [] : added);
  };

  const toTour = (uid: string, name: string, firmId: string, firm: string, it: Item): Tournament => ({
    id: `${uid}:${it.id}`, organizer: firm || 'Prop firm', firmId, sample: false, publishedBy: name, title: it.title, start: it.start, end: it.end,
    prizePool: it.prizePool, prizes: it.prizes, entry: it.entry || 'See organiser', format: it.format, link: it.link,
  });

  function applyDocs(docs: Array<{ id: string; data: Record<string, unknown> }>, uid: string | null) {
    const out: Tournament[] = [];
    for (const d of docs) {
      const name = typeof d.data.name === 'string' ? d.data.name.slice(0, 24) : 'Someone';
      const firm = typeof d.data.firm === 'string' ? d.data.firm.slice(0, 40) : '';
      const firmId = typeof d.data.firmId === 'string' ? d.data.firmId.slice(0, 40) : '';
      const items = (Array.isArray(d.data.items) ? d.data.items : []).map((x: unknown) => (x && typeof x === 'object' ? cleanItem(x as Record<string, unknown>) : null)).filter(Boolean) as Item[];
      if (d.id === uid) mine = { firmId, firm, items };
      for (const it of items.slice(0, KEEP)) out.push(toTour(d.id, name, firmId, firm, it));
    }
    published = out;
    emit();
    if (isOpen()) render();
  }

  async function connect() {
    cloud = await getCloud();
    readOnly = !!cloud && (cloud.canWrite === false || !cloud.uid);
    if (cloud) {
      cloud.db.collection('tours').limit(200).onSnapshot(
        (snap: { docs: Array<{ id: string; data(): Record<string, unknown> | undefined }> }) => applyDocs(snap.docs.map((d) => ({ id: d.id, data: d.data() ?? {} })), cloud!.uid),
        () => { /* keep the last view */ },
      );
    } else {
      try {
        const v = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? 'null');
        if (v && Array.isArray(v.items)) applyDocs([{ id: 'me', data: v }], 'me');
        else emit();
      } catch { emit(); }
    }
  }
  void connect();

  const fmtDate = (t: number) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).format(t) + ' UTC';
  const card = (t: Tournament) => {
    const now = Date.now();
    const st = tourStatus(t, now);
    const chip = st === 'live' ? `<span class="tn-chip live"><i class="live-dot"></i>LIVE · ends in ${countdown(t.end - now)}</span>` : st === 'upcoming' ? `<span class="tn-chip soon">Starts in ${countdown(t.start - now)}</span>` : '<span class="tn-chip">Ended</span>';
    const who = t.sample ? '<span class="tn-tag sample">SAMPLE LISTING</span>' : `<span class="tn-tag">Published by ${esc(t.publishedBy ?? 'a firm team')} · unverified</span>`;
    const leaders = st === 'live' && t.leaders?.length
      ? `<ol class="tn-leaders">${t.leaders.map((l) => `<li><b>${esc(l.name)}</b><span>+${l.pct.toFixed(1)}%</span></li>`).join('')}</ol>`
      : '';
    return `<article class="tn-card ${st}">
      <header><span class="tn-org">${esc(t.sample ? 'Sample firm' : t.organizer)}</span>${chip}</header>
      <h3>${esc(t.title)}</h3>
      <div class="tn-prize"><b>${fmtMoney(t.prizePool)}</b><span>prize pool</span></div>
      <p class="tn-prizes">${esc(t.prizes)}</p>
      <dl><div><dt>Entry</dt><dd>${esc(t.entry)}</dd></div><div><dt>Format</dt><dd>${esc(t.format)}</dd></div><div><dt>Dates</dt><dd>${fmtDate(t.start)} → ${fmtDate(t.end)}</dd></div>${t.link ? `<div><dt>Sign up</dt><dd class="tn-link">${esc(t.link)}</dd></div>` : ''}</dl>
      ${leaders}
      <footer>${who}${t.sample && st === 'live' ? '<span class="tn-tag sample">Sample standings</span>' : ''}</footer>
    </article>`;
  };

  function renderList(which: 'live' | 'upcoming') {
    const now = Date.now();
    const list = all().filter((t) => tourStatus(t, now) === which).sort((a, b) => (a.sample ? 1 : 0) - (b.sample ? 1 : 0) || (which === 'live' ? a.end - b.end : a.start - b.start));
    body.innerHTML = (flash ? `<div class="bk-flash">${esc(flash)}</div>` : '') + (list.length
      ? `<div class="tn-grid">${list.map(card).join('')}</div>`
      : `<p class="tn-empty">No ${which} tournaments right now.</p>`);
    flash = '';
  }

  function renderPublish() {
    const pass = getPass();
    const firmPass = pass && pass.kind !== 'trader';
    if (!firmPass) {
      body.innerHTML = `<div class="tn-locked">
        <h3>Firm teams only</h3>
        <p>Prop firm CEOs and marketing teams publish their tournaments, prizes and dates on the arena screens. Get a firm pass at the 100K+ Payouts Golf Club members’ gate first.</p>
        <button class="btn btn-gold" id="tn-get-pass">Get a firm pass</button>
      </div>`;
      body.querySelector('#tn-get-pass')!.addEventListener('click', () => { close(); openClub(); });
      return;
    }
    if (readOnly) {
      body.innerHTML = '<p class="tn-empty">You have view-only access to this city, so you can’t publish. Ask the owner for Contributor access.</p>';
      return;
    }
    const firm = FIRMS.find((f) => f.id === pass!.firmId);
    const today = new Date(Date.now() + DAY).toISOString().slice(0, 10);
    const end = new Date(Date.now() + 8 * DAY).toISOString().slice(0, 10);
    body.innerHTML = `
      ${flash ? `<div class="bk-flash">${esc(flash)}</div>` : ''}
      <form class="bk-form tn-form" id="tn-form">
        <p class="bk-lead">Publishing as <b>${esc(getName() ?? 'You')}</b> · ${esc(passRole(pass))}. Your tournament appears on the arena screens and in this list for everyone who can open the city. You can keep up to ${KEEP} at a time.</p>
        <label>Tournament name<input name="title" required maxlength="70" placeholder="e.g. ${esc(firm?.sign ?? 'Firm')} Summer Cup" /></label>
        <label>Prize pool (USD)<input name="prize" required inputmode="numeric" placeholder="100000" /></label>
        <label>Starts (UTC)<input name="start" type="date" required value="${today}" /></label>
        <label>Ends (UTC)<input name="end" type="date" required value="${end}" /></label>
        <label class="wide">Prizes<input name="prizes" maxlength="200" placeholder="1st $50,000 · 2nd $25,000 · 3rd $10,000" /></label>
        <label>Entry<input name="entry" maxlength="40" placeholder="Free / $49" /></label>
        <label>Sign-up link (shown as text)<input name="link" maxlength="120" placeholder="${esc(firm?.website ?? 'https://…')}" /></label>
        <label class="wide">Format & rules<input name="format" maxlength="140" placeholder="Instruments, account size, drawdown, ranking" /></label>
        <div class="bk-actions"><button class="btn btn-gold" type="submit">Publish to the arena</button><span id="tn-msg"></span></div>
        <p class="bk-fine">${cloud ? 'Listings are labelled with your character name and marked unverified.' : 'Preview: shared listings open at launch. For now, they stay in this browser.'}</p>
      </form>
      ${mine.items.length ? `<h4 class="tn-sub">Your published tournaments</h4><ul class="tn-mine">${mine.items.map((it) => `<li><b>${esc(it.title)}</b><span>${fmtMoney(it.prizePool)} · ${fmtDate(it.start)}</span><button class="btn btn-ghost" data-del="${esc(it.id)}">Remove</button></li>`).join('')}</ul>` : ''}`;
    const form = body.querySelector<HTMLFormElement>('#tn-form')!;
    const msg = body.querySelector<HTMLElement>('#tn-msg')!;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(form);
      const prize = Math.round(Number(String(f.get('prize') ?? '').replace(/[^0-9.]/g, '')));
      const start = Date.parse(String(f.get('start')) + 'T13:30:00Z');
      const endT = Date.parse(String(f.get('end')) + 'T21:00:00Z');
      if (!Number.isFinite(prize) || prize <= 0 || prize > 50_000_000) { msg.textContent = 'Enter the prize pool in dollars.'; return; }
      if (!Number.isFinite(start) || !Number.isFinite(endT) || endT <= start) { msg.textContent = 'The end date must be after the start.'; return; }
      const it: Item = {
        id: Math.random().toString(36).slice(2, 10), title: String(f.get('title') ?? '').trim().slice(0, 70), start, end: endT, prizePool: prize,
        prizes: String(f.get('prizes') ?? '').trim().slice(0, 200), entry: String(f.get('entry') ?? '').trim().slice(0, 40) || 'See organiser',
        format: String(f.get('format') ?? '').trim().slice(0, 140), link: String(f.get('link') ?? '').trim().slice(0, 120) || undefined,
      };
      if (!it.title) { msg.textContent = 'Give the tournament a name.'; return; }
      mine = { firmId: pass!.firmId ?? '', firm: pass!.firmName ?? 'Prop firm', items: [it, ...mine.items].slice(0, KEEP) };
      await save();
      flash = `Published “${it.title}”: it’s on the arena screens now.`;
      show(tourStatus(toTour('me', '', '', '', it)) === 'live' ? 'live' : 'upcoming');
    });
    body.querySelectorAll<HTMLButtonElement>('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      mine = { ...mine, items: mine.items.filter((x) => x.id !== b.dataset.del) };
      await save();
      flash = 'Removed.';
      renderPublish();
    }));
  }

  async function save() {
    const doc = { name: (getName() ?? 'Firm team').slice(0, 24), firm: mine.firm, firmId: mine.firmId, items: mine.items, updatedAt: Date.now() };
    if (cloud && cloud.uid) {
      try { await cloud.db.doc('tours/' + cloud.uid).set(doc); }
      catch (e) { const code = (e as { code?: string })?.code; if (code === 'invalid_argument' || code === 'permission_denied') { readOnly = true; } flash = 'Couldn’t publish: you may not have permission to write to this city.'; }
    } else {
      try { localStorage.setItem(LOCAL_KEY, JSON.stringify(doc)); } catch { /* ignore */ }
      applyDocs([{ id: 'me', data: doc }], 'me');
    }
  }

  function render() {
    tabs.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    if (tab === 'publish') renderPublish();
    else renderList(tab);
    feed.innerHTML = 'Prop firms publish their own tournaments here and on the arena screens. <b>SAMPLE</b> listings show how it looks until firms publish theirs. Always confirm prizes and rules with the organising firm.';
  }
  function show(t: ArenaTab) { tab = t; render(); }
  function open(t: ArenaTab = 'live') {
    overlay.hidden = false;
    document.body.classList.add('media-open');
    show(t);
  }
  function close() {
    overlay.hidden = true;
    document.body.classList.remove('media-open');
  }
  const isOpen = () => !overlay.hidden;
  onPass(() => { if (isOpen() && tab === 'publish') render(); });
  // keep countdowns fresh while open
  setInterval(() => { if (isOpen() && tab !== 'publish') render(); }, 30_000);
  return { open, close, isOpen, list: all, onChange: (fn) => { fns.push(fn); fn(all(), []); } };
}
