// CITY HALL panel: announcements from City Hall, community reviews of the city, votes (polls) and the
// monthly election of the Mayor of FUNDEDCITY.
// Shared through the page's database: `hall/news` and `hall/polls` (the city's owner posts these),
// `reviews/<id>` (one review each), `votes/<id>` (your poll votes and mayor votes). One vote per city account. Off the published city everything stays in this browser.
// Elections: only the five founders (Founders' Summit) can be mayor. Each calendar month (UTC) is a term;
// registered traders vote in the last 7 days of every month, and the founder with the most votes when
// voting closes at month end is mayor for the next month.
import { getCloud, type Cloud } from './cloud';
import type { HallBoard } from './cityHall';
import { foundersStore, revealed, type Founder } from './founders';

export type HallTab = 'news' | 'reviews' | 'votes' | 'mayor' | 'rules';
export interface CityHallPanel {
  open: (tab?: HallTab) => void;
  close: () => void;
  isOpen: () => boolean;
  board: () => HallBoard;
  onChange: (fn: () => void) => void;
  onAnnouncement: (fn: (title: string) => void) => void;
}
interface News { id: string; t: number; title: string; text: string; official?: boolean }
interface Poll { id: string; q: string; options: string[]; endsAt: number; builtIn?: boolean }
interface Review { uid: string; name: string; stars: number; text: string; about: string; t: number; mine: boolean }
interface VoteDoc { polls: Record<string, number>; mayor: Record<string, string> }

const esc = (v: string) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const CLOSE = '<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const LOCAL = 'fundedcity-hall-local';
const ABOUT = ['FUNDEDCITY overall', 'THE PLAZA', 'Trading Floor', 'Bank of Gains', 'THE LAB', 'Sip The Dip Cafe', 'RESET · Touch The Grass Park', 'Liquidation Arena', 'Golf Club'];

/* ---------------- months / terms (UTC) ---------------- */
const cycleOf = (t: number) => new Date(t).toISOString().slice(0, 7);
const monthStart = (c: string) => Date.UTC(Number(c.slice(0, 4)), Number(c.slice(5, 7)) - 1, 1);
const nextCycle = (c: string) => cycleOf(Date.UTC(Number(c.slice(0, 4)), Number(c.slice(5, 7)), 1));
const prevCycle = (c: string) => cycleOf(monthStart(c) - 86_400_000);
const monthName = (c: string) => new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(monthStart(c));
function left(ms: number) {
  if (ms <= 0) return 'closed';
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
}
const fmtDate = (t: number) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(t);

/** City Hall's own announcements (about the city itself) */
const OFFICIAL: News[] = [
  { id: 'o-hall', t: Date.UTC(2026, 9, 27, 9), title: 'City Hall opens on Capital Square', text: 'City Hall is where announcements are posted, community reviews are read, votes are held and the Mayor of FUNDEDCITY is elected every month. One vote per city account.', official: true },
  { id: 'o-founders', t: Date.UTC(2026, 9, 27, 17), title: 'Founders’ Summit opens · only founders can be mayor', text: 'The statues of FUNDEDCITY’s five founders now stand at Founders’ Summit in the mountains between the desert and the forest (cable car from the north-west corner). From now on only founders can be mayor, and registered traders vote in the last 7 days of every month. The rules are in the Rules tab.', official: true },
  { id: 'o-plaza', t: Date.UTC(2026, 9, 27, 8), title: 'THE PLAZA is open: 0 listing fees', text: 'The mall and marketplace on the far side of Brooklyn (free parking out front) is open to prop firms, brokers, traders, copy-trading firms and everyone else. Listing is free; every sale splits 75% to the seller and 25% to the Plaza.', official: true },
  { id: 'o-floor', t: Date.UTC(2026, 9, 27, 7), title: 'The Trading Floor opens five pits', text: 'Next to THE PLAZA: FX, INDICES, COMMODITIES, CRYPTO and OPTIONS. Pick a pit, talk strategy, entries and exits, and upload your charts. Ideas, not advice.', official: true },
  { id: 'o-free', t: Date.UTC(2026, 9, 20, 9), title: 'Building is free for every trader', text: 'Register, upload your verified payouts and your tower grows from Level 1 to Level 10, then crowns from bronze to platinum. The rules are published in the Bank of Gains.', official: true },
];
/** City Hall's standing monthly polls (votes are real; a fresh poll each month) */
function builtInPolls(now = Date.now()): Poll[] {
  const c = cycleOf(now);
  const ends = monthStart(nextCycle(c)) - 1;
  return [
    { id: `next-place-${c}`, q: 'What should FUNDEDCITY build next?', options: ['A trading school', 'A prop firm expo hall', 'A night market', 'A trader hotel', 'A cinema for trading films'], endsAt: ends, builtIn: true },
    { id: `pit-${c}`, q: 'Which Trading Floor pit should get live market-open sessions first?', options: ['FX', 'INDICES', 'COMMODITIES', 'CRYPTO', 'OPTIONS'], endsAt: ends, builtIn: true },
  ];
}

export function createCityHallPanel(root: HTMLElement, getName: () => string | null, isMember: () => boolean, onSignup: () => void, onFounder: (id: string) => void = () => {}): CityHallPanel {
  root.insertAdjacentHTML(
    'beforeend',
    `<div class="media-overlay hall-overlay" id="ch-overlay" hidden>
      <section class="media-panel hall-panel" role="dialog" aria-modal="true" aria-labelledby="ch-title">
        <header class="mp-head">
          <div class="mp-title"><span class="mp-eyebrow ch-eyebrow">CAPITAL SQUARE</span><h2 id="ch-title">City Hall</h2></div>
          <nav class="mp-tabs" role="tablist">
            <button role="tab" data-tab="news">Announcements</button>
            <button role="tab" data-tab="reviews">Reviews</button>
            <button role="tab" data-tab="votes">Votes</button>
            <button role="tab" data-tab="mayor">Mayor</button>
            <button role="tab" data-tab="rules">Rules</button>
          </nav>
          <button class="icon-btn sq mp-close" id="ch-close" aria-label="Close City Hall">${CLOSE}</button>
        </header>
        <div class="mp-body" id="ch-body"></div>
        <footer class="mp-foot"><span class="mp-feed" id="ch-feed"></span></footer>
      </section>
    </div>`,
  );
  const overlay = root.querySelector<HTMLElement>('#ch-overlay')!;
  const body = overlay.querySelector<HTMLElement>('#ch-body')!;
  const feed = overlay.querySelector<HTMLElement>('#ch-feed')!;
  const tabs = [...overlay.querySelectorAll<HTMLButtonElement>('.mp-tabs button')];
  overlay.querySelector('#ch-close')!.addEventListener('click', () => close());
  overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) close(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) close(); });
  tabs.forEach((b) => b.addEventListener('click', () => show(b.dataset.tab as HallTab)));

  let tab: HallTab = 'news';
  let cloud: Cloud | null = null;
  let readOnly = false;
  let owner = false;
  let news: News[] = [];
  let polls: Poll[] = [];
  let replies: Record<string, string> = {};
  let reviews: Review[] = [];
  const votes = new Map<string, VoteDoc>();
  let myVotes: VoteDoc = { polls: {}, mayor: {} };
  let flash = '';
  const fns: Array<() => void> = [];
  const annFns: Array<(t: string) => void> = [];
  let seenNews: Set<string> | null = null;
  const uid = () => (cloud ? cloud.uid : 'me');
  /** don't wipe a half-typed form when someone else's vote or review arrives */
  const typing = () => { const a = document.activeElement; return !!a && body.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName); };
  const changed = () => { for (const f of fns) f(); if (isOpen() && !typing()) render(); };

  /* ---------------- data in ---------------- */
  const str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
  function applyHall(id: string, d: Record<string, unknown>) {
    if (id === 'news') {
      news = (Array.isArray(d.items) ? d.items : []).map((x: Record<string, unknown>) => ({ id: str(x?.id, 16), t: typeof x?.t === 'number' ? x.t : 0, title: str(x?.title, 100), text: str(x?.text, 1200) })).filter((n: News) => n.id && n.title);
      const fresh = seenNews ? news.filter((n) => !seenNews!.has(n.id)) : [];
      seenNews = new Set(news.map((n) => n.id));
      for (const n of fresh) for (const f of annFns) f(n.title);
    }
    if (id === 'polls') polls = (Array.isArray(d.items) ? d.items : []).map((x: Record<string, unknown>) => ({ id: str(x?.id, 16), q: str(x?.q, 160), options: (Array.isArray(x?.options) ? x.options : []).map((o: unknown) => str(o, 60)).filter(Boolean).slice(0, 8), endsAt: typeof x?.endsAt === 'number' ? x.endsAt : 0 })).filter((p: Poll) => p.id && p.q && p.options.length >= 2);
    if (id === 'replies') replies = Object.fromEntries(Object.entries(d.items && typeof d.items === 'object' ? d.items as Record<string, unknown> : {}).map(([k, v]) => [k, str(v, 500)]).filter(([, v]) => v));
  }
  function applyReview(id: string, d: Record<string, unknown>) {
    const stars = Math.round(Number(d.stars));
    if (!(stars >= 1 && stars <= 5)) return null;
    return { uid: id, name: str(d.name, 24) || 'Trader', stars, text: str(d.text, 600), about: ABOUT.includes(d.about as string) ? (d.about as string) : ABOUT[0], t: typeof d.t === 'number' ? d.t : 0, mine: id === uid() } as Review;
  }
  function applyVote(id: string, d: Record<string, unknown>) {
    const p: Record<string, number> = {};
    if (d.polls && typeof d.polls === 'object') for (const [k, v] of Object.entries(d.polls as Record<string, unknown>)) if (typeof v === 'number' && v >= 0 && v < 10) p[k.slice(0, 40)] = Math.floor(v);
    const m: Record<string, string> = {};
    if (d.mayor && typeof d.mayor === 'object') for (const [k, v] of Object.entries(d.mayor as Record<string, unknown>)) if (/^\d{4}-\d{2}$/.test(k) && typeof v === 'string' && v !== id) m[k] = v.slice(0, 80);
    const doc = { polls: p, mayor: m };
    votes.set(id, doc);
    if (id === uid()) myVotes = { polls: { ...p }, mayor: { ...m } };
  }
  type Snap = { docs: Array<{ id: string; data(): Record<string, unknown> | undefined }> };
  void (async () => {
    cloud = await getCloud();
    readOnly = !!cloud && (cloud.canWrite === false || !cloud.uid);
    if (cloud) {
      try { owner = !!(await cloud.user?.isOwner?.()); } catch { owner = false; }
      const db = cloud.db;
      db.collection('hall').onSnapshot((s: Snap) => { for (const d of s.docs) applyHall(d.id, d.data() ?? {}); if (!seenNews) seenNews = new Set(); changed(); }, () => {});
      db.collection('reviews').limit(500).onSnapshot((s: Snap) => { reviews = s.docs.map((d) => applyReview(d.id, d.data() ?? {})).filter(Boolean) as Review[]; changed(); }, () => {});
      db.collection('votes').limit(2000).onSnapshot((s: Snap) => { votes.clear(); for (const d of s.docs) applyVote(d.id, d.data() ?? {}); changed(); }, () => {});
    } else {
      try {
        const v = JSON.parse(localStorage.getItem(LOCAL) ?? 'null');
        if (v) {
          if (v.review) { const r = applyReview('me', v.review); if (r) reviews = [r]; }
          if (v.votes) applyVote('me', v.votes);
          if (v.news) applyHall('news', v.news);
          if (v.polls) applyHall('polls', v.polls);
        }
      } catch { /* nothing saved */ }
      seenNews = new Set(news.map((n) => n.id));
      changed();
    }
  })();
  const local: Record<string, unknown> = (() => { try { return JSON.parse(localStorage.getItem(LOCAL) ?? '{}') ?? {}; } catch { return {}; } })();
  async function write(path: string, doc: Record<string, unknown>, localKey: string) {
    if (cloud && cloud.uid) {
      try { await cloud.db.doc(path).set(doc); return true; } catch { return false; }
    }
    local[localKey] = doc;
    try { localStorage.setItem(LOCAL, JSON.stringify(local)); } catch { /* keep in memory */ }
    return true;
  }
  async function removeDoc(path: string, localKey: string) {
    if (cloud && cloud.uid) { try { await cloud.db.doc(path).delete(); return true; } catch { return false; } }
    delete local[localKey];
    try { localStorage.setItem(LOCAL, JSON.stringify(local)); } catch { /* ignore */ }
    return true;
  }

  /* ---------------- election maths (founders only, voting in the last week of the month) ---------------- */
  const VOTE_DAYS = 7;
  const fstore = foundersStore();
  const ballot = (): Founder[] => fstore.list().filter(revealed);
  fstore.onChange(() => changed());
  const tally = (cycle: string) => {
    const t = new Map<string, number>();
    const ok = new Set(fstore.list().map((f) => f.id));
    for (const v of votes.values()) { const c = v.mayor[cycle]; if (c && ok.has(c)) t.set(c, (t.get(c) ?? 0) + 1); }
    return t;
  };
  function mayorOf(term: string) {
    // the mayor for `term` won the vote held at the end of the month before it (ties: the earlier founder)
    const t = tally(prevCycle(term));
    let best: Founder | null = null;
    let bestN = 0;
    for (const f of ballot()) { const n = t.get(f.id) ?? 0; if (n > bestN) { best = f; bestN = n; } }
    return best ? { name: best.name, votes: bestN, id: best.id } : null;
  }
  const term = () => cycleOf(Date.now());
  const closesAt = () => monthStart(nextCycle(term()));
  const opensAt = () => closesAt() - VOTE_DAYS * 86_400_000;
  const votingOpen = () => Date.now() >= opensAt() && Date.now() < closesAt();
  const allPolls = () => [...polls, ...builtInPolls()];
  const board = (): HallBoard => {
    const m = mayorOf(term());
    const open = votingOpen();
    return { mayor: m?.name ?? null, term: monthName(term()), candidates: ballot().length, closesIn: left((open ? closesAt() : opensAt()) - Date.now()), open, polls: allPolls().filter((p) => p.endsAt > Date.now()).length };
  };

  /* ---------------- announcements ---------------- */
  function renderNews() {
    const list = [...news, ...OFFICIAL].sort((a, b) => b.t - a.t);
    body.innerHTML = (flash ? `<div class="bk-flash">${esc(flash)}</div>` : '') + `
      ${owner && !readOnly ? `<form class="bk-form tn-form ch-post" id="ch-news"><p class="bk-lead"><b>Post an announcement</b> as City Hall (only the city’s owner can).</p><label class="wide">Title<input name="title" required maxlength="100" /></label><label class="wide">Announcement<textarea name="text" rows="3" maxlength="1200"></textarea></label><div class="bk-actions"><button class="btn btn-gold" type="submit">Announce</button></div></form>` : ''}
      <ol class="ch-news">${list.map((n) => `<li><span class="ch-seal" aria-hidden="true">CH</span><div><time>${fmtDate(n.t)}</time><h3>${esc(n.title)}</h3><p>${esc(n.text)}</p>${owner && !n.official ? `<button class="linkish" data-delnews="${esc(n.id)}">Delete</button>` : ''}</div></li>`).join('')}</ol>`;
    flash = '';
    body.querySelector<HTMLFormElement>('#ch-news')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.target as HTMLFormElement);
      const item = { id: Math.random().toString(36).slice(2, 10), t: Date.now(), title: String(f.get('title') ?? '').trim().slice(0, 100), text: String(f.get('text') ?? '').trim().slice(0, 1200) };
      if (!item.title) return;
      const items = [item, ...news].slice(0, 30);
      if (await write('hall/news', { items }, 'news')) { applyHall('news', { items }); flash = 'Announced.'; } else flash = 'Couldn’t post the announcement.';
      changed();
    });
    body.querySelectorAll<HTMLButtonElement>('[data-delnews]').forEach((b) => b.addEventListener('click', async () => {
      const items = news.filter((n) => n.id !== b.dataset.delnews);
      if (await write('hall/news', { items }, 'news')) applyHall('news', { items });
      changed();
    }));
  }

  /* ---------------- reviews ---------------- */
  const starRow = (n: number) => `<span class="ch-stars" aria-label="${n} out of 5 stars">${'★'.repeat(n)}<i>${'★'.repeat(5 - n)}</i></span>`;
  function renderReviews() {
    const list = reviews.slice().sort((a, b) => b.t - a.t);
    const avg = list.length ? list.reduce((a, r) => a + r.stars, 0) / list.length : 0;
    const dist = [5, 4, 3, 2, 1].map((s) => list.filter((r) => r.stars === s).length);
    const me = list.find((r) => r.mine);
    const name = getName();
    body.innerHTML = (flash ? `<div class="bk-flash">${esc(flash)}</div>` : '') + `
      <div class="ch-rev-top">
        <div class="ch-score"><b>${list.length ? avg.toFixed(1) : '–'}</b>${starRow(Math.round(avg))}<span>${list.length} community review${list.length === 1 ? '' : 's'}</span></div>
        <ul class="ch-dist">${dist.map((n, i) => `<li><span>${5 - i}★</span><i><b style="width:${list.length ? (n / list.length) * 100 : 0}%"></b></i><em>${n}</em></li>`).join('')}</ul>
      </div>
      ${readOnly ? '' : !name ? '<div class="tn-locked"><p>Create your character to leave a review.</p><button class="btn btn-gold" id="ch-signup">Create my character</button></div>' : `
      <form class="bk-form tn-form ch-review" id="ch-review">
        <p class="bk-lead">${me ? 'Update your review' : 'Review FUNDEDCITY'}: what’s working, what isn’t, what we should build. One review per person, signed <b>${esc(name)}</b>.</p>
        <div class="tp-field wide"><span>Rating</span><div class="tp-seg ch-rate">${[1, 2, 3, 4, 5].map((s) => `<label><input type="radio" name="stars" value="${s}"${(me?.stars ?? 5) === s ? ' checked' : ''} /><span>${'★'.repeat(s)}</span></label>`).join('')}</div></div>
        <label class="wide">About<select name="about">${ABOUT.map((a) => `<option${(me?.about ?? ABOUT[0]) === a ? ' selected' : ''}>${esc(a)}</option>`).join('')}</select></label>
        <label class="wide">Your review<textarea name="text" rows="3" maxlength="600" required>${esc(me?.text ?? '')}</textarea></label>
        <div class="bk-actions"><button class="btn btn-gold" type="submit">${me ? 'Update review' : 'Post review'}</button>${me ? '<button class="btn btn-ghost" type="button" id="ch-delrev">Delete mine</button>' : ''}<span id="ch-msg"></span></div>
      </form>`}
      <ol class="ch-reviews">${list.map((r) => `<li class="${r.mine ? 'mine' : ''}"><header><b>${esc(r.name)}</b>${starRow(r.stars)}<span>${esc(r.about)} · ${fmtDate(r.t)}</span></header>${r.text ? `<p>${esc(r.text)}</p>` : ''}${replies[r.uid] ? `<div class="ch-reply"><b>City Hall replied</b><p>${esc(replies[r.uid])}</p></div>` : ''}${owner && !readOnly ? `<div class="ch-mod"><button class="linkish" data-reply="${esc(r.uid)}">${replies[r.uid] ? 'Edit reply' : 'Reply'}</button>${r.mine ? '' : ` · <button class="linkish" data-delrev="${esc(r.uid)}">Remove</button>`}</div>` : ''}</li>`).join('') || '<li class="tn-empty">No reviews yet. Be the first to tell City Hall what you think.</li>'}</ol>`;
    flash = '';
    body.querySelector('#ch-signup')?.addEventListener('click', () => { close(); onSignup(); });
    body.querySelector<HTMLFormElement>('#ch-review')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.target as HTMLFormElement);
      const doc = { name: (getName() ?? 'Trader').slice(0, 24), stars: Number(f.get('stars')), about: String(f.get('about')), text: String(f.get('text') ?? '').trim().slice(0, 600), t: Date.now() };
      if (!doc.text) return;
      if (await write('reviews/' + uid(), doc, 'review')) {
        if (!cloud) { const r = applyReview('me', doc); if (r) reviews = [r]; }
        flash = 'Thanks: City Hall has your review.';
      } else flash = 'Couldn’t save your review: you may not have permission to write here.';
      changed();
    });
    body.querySelector('#ch-delrev')?.addEventListener('click', async () => {
      if (await removeDoc('reviews/' + uid(), 'review')) { if (!cloud) reviews = []; flash = 'Review deleted.'; }
      changed();
    });
    body.querySelectorAll<HTMLButtonElement>('[data-delrev]').forEach((b) => b.addEventListener('click', async () => {
      if (cloud) { try { await cloud.db.doc('reviews/' + b.dataset.delrev).delete(); flash = 'Review removed.'; } catch { flash = 'Couldn’t remove it.'; } }
      changed();
    }));
    body.querySelectorAll<HTMLButtonElement>('[data-reply]').forEach((b) => b.addEventListener('click', () => {
      const li = b.closest('li')!;
      if (li.querySelector('.ch-replyform')) return;
      li.insertAdjacentHTML('beforeend', `<form class="cf-form ch-replyform"><input maxlength="500" placeholder="Reply as City Hall…" value="${esc(replies[b.dataset.reply!] ?? '')}" /><button class="btn btn-gold" type="submit">Reply</button></form>`);
      const form = li.querySelector<HTMLFormElement>('.ch-replyform')!;
      form.querySelector('input')!.focus();
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const v = form.querySelector('input')!.value.trim().slice(0, 500);
        const items = { ...replies, [b.dataset.reply!]: v };
        if (!v) delete items[b.dataset.reply!];
        if (await write('hall/replies', { items }, 'replies')) applyHall('replies', { items });
        changed();
      });
    }));
  }

  /* ---------------- votes (polls) ---------------- */
  function pollCounts(p: Poll) {
    const n = p.options.map(() => 0);
    for (const v of votes.values()) { const i = v.polls[p.id]; if (i !== undefined && i < n.length) n[i]++; }
    return n;
  }
  function renderVotes() {
    const now = Date.now();
    const list = allPolls().sort((a, b) => Number(b.endsAt > now) - Number(a.endsAt > now) || a.endsAt - b.endsAt);
    body.innerHTML = (flash ? `<div class="bk-flash">${esc(flash)}</div>` : '') + `
      <div class="ch-polls">${list.map((p) => {
        const n = pollCounts(p);
        const total = n.reduce((a, b) => a + b, 0);
        const open = p.endsAt > now;
        const my = myVotes.polls[p.id];
        return `<article class="ch-poll${open ? '' : ' closed'}">
          <header><span class="tn-chip ${open ? 'live' : ''}">${open ? `Open · closes in ${left(p.endsAt - now)}` : `Closed ${fmtDate(p.endsAt)}`}</span><span class="ch-by">${p.builtIn ? 'City Hall · monthly' : 'City Hall'}</span></header>
          <h3>${esc(p.q)}</h3>
          <ul>${p.options.map((o, i) => `<li class="${my === i ? 'mine' : ''}"><button ${!open || readOnly ? 'disabled' : ''} data-poll="${esc(p.id)}" data-opt="${i}"><span>${esc(o)}${my === i ? ' <em>your vote</em>' : ''}</span><b>${total ? Math.round((n[i] / total) * 100) : 0}%</b><i style="width:${total ? (n[i] / total) * 100 : 0}%"></i></button></li>`).join('')}</ul>
          <footer>${total} vote${total === 1 ? '' : 's'}${open && !readOnly ? ' · tap an option to vote or change your vote' : ''}${owner && !p.builtIn ? ` · <button class="linkish" data-delpoll="${esc(p.id)}">Delete poll</button>` : ''}</footer>
        </article>`;
      }).join('')}</div>
      ${owner && !readOnly ? `<form class="bk-form tn-form ch-post" id="ch-newpoll"><p class="bk-lead"><b>Start a vote</b> (city owner).</p><label class="wide">Question<input name="q" required maxlength="160" /></label><label class="wide">Options (one per line, 2–8)<textarea name="options" rows="4" maxlength="600"></textarea></label><label>Closes (UTC)<input name="ends" type="date" required value="${new Date(now + 7 * 86_400_000).toISOString().slice(0, 10)}" /></label><div class="bk-actions"><button class="btn btn-gold" type="submit">Open the vote</button></div></form>` : ''}`;
    flash = '';
    body.querySelectorAll<HTMLButtonElement>('[data-poll]').forEach((b) => b.addEventListener('click', async () => {
      if (!getName()) { flash = 'Create your character to vote.'; renderVotes(); return; }
      myVotes = { ...myVotes, polls: { ...myVotes.polls, [b.dataset.poll!]: Number(b.dataset.opt) } };
      await saveVotes();
    }));
    body.querySelector<HTMLFormElement>('#ch-newpoll')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.target as HTMLFormElement);
      const options = String(f.get('options') ?? '').split('\n').map((x) => x.trim().slice(0, 60)).filter(Boolean).slice(0, 8);
      const endsAt = Date.parse(String(f.get('ends')) + 'T23:59:00Z');
      if (options.length < 2 || !Number.isFinite(endsAt)) { flash = 'Give at least two options and a closing date.'; renderVotes(); return; }
      const items = [{ id: Math.random().toString(36).slice(2, 10), q: String(f.get('q') ?? '').trim().slice(0, 160), options, endsAt }, ...polls].slice(0, 20);
      if (await write('hall/polls', { items }, 'polls')) { applyHall('polls', { items }); flash = 'Vote opened.'; } else flash = 'Couldn’t open the vote.';
      changed();
    });
    body.querySelectorAll<HTMLButtonElement>('[data-delpoll]').forEach((b) => b.addEventListener('click', async () => {
      const items = polls.filter((p) => p.id !== b.dataset.delpoll);
      if (await write('hall/polls', { items }, 'polls')) applyHall('polls', { items });
      changed();
    }));
  }
  async function saveVotes() {
    // keep the last three months of mayor votes and only the polls that still exist
    const keepPolls = new Set(allPolls().map((p) => p.id));
    const t = term();
    const keepCycles = new Set([t, prevCycle(t), prevCycle(prevCycle(t))]);
    const doc = { polls: Object.fromEntries(Object.entries(myVotes.polls).filter(([k]) => keepPolls.has(k))), mayor: Object.fromEntries(Object.entries(myVotes.mayor).filter(([k]) => keepCycles.has(k))), t: Date.now() };
    if (await write('votes/' + uid(), doc, 'votes')) { if (!cloud) applyVote('me', doc); flash = 'Vote counted.'; }
    else flash = 'Couldn’t save your vote: you may not have permission to vote here.';
    changed();
  }

  /* ---------------- mayor ---------------- */
  function renderMayor() {
    const t = term();
    const m = mayorOf(t);
    const field = ballot();
    const counts = tally(t);
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    const open = votingOpen();
    const myVote = myVotes.mayor[t];
    const canVote = open && !readOnly && !!getName() && isMember();
    body.innerHTML = (flash ? `<div class="bk-flash">${esc(flash)}</div>` : '') + `
      <div class="ch-mayor">
        <div class="ch-sash">MAYOR OF FUNDEDCITY · ${esc(monthName(t).toUpperCase())}</div>
        <b>${m ? esc(m.name) : 'No mayor yet'}</b>
        <span>${m ? `Elected by traders with ${m.votes} vote${m.votes === 1 ? '' : 's'} at the end of ${esc(monthName(prevCycle(t)))}` : `The first vote ${open ? 'is open now and closes' : 'closes'} ${fmtDate(closesAt())}. The winner is mayor for ${esc(monthName(nextCycle(t)))}.`}</span>
      </div>
      <div class="ch-elect-head"><h3>Vote: mayor for ${esc(monthName(nextCycle(t)))}</h3><span class="tn-chip ${open ? 'live' : ''}">${open ? `Voting open · closes in ${left(closesAt() - Date.now())}` : `Voting opens ${fmtDate(opensAt())} · in ${left(opensAt() - Date.now())}`}</span></div>
      <p class="bk-fine">Only the founders can be mayor. Registered traders vote in the last ${VOTE_DAYS} days of every month (UTC), one vote per account, and can change it until voting closes.</p>
      <ol class="ch-cands">${field.map((f) => {
        const n = counts.get(f.id) ?? 0;
        return `<li class="${myVote === f.id ? 'voted' : ''}"><div class="ch-cand-main"><b>${esc(f.name)}</b><p>${esc(f.role || 'Founder')}${f.handle ? ` · ${esc(f.handle)}` : ''}</p><i class="ch-bar"><b style="width:${total ? (n / total) * 100 : 0}%"></b></i></div><div class="ch-cand-side"><strong>${n}</strong><span>vote${n === 1 ? '' : 's'}</span>${canVote ? `<button class="btn ${myVote === f.id ? 'btn-ghost' : 'btn-gold'}" data-vote="${esc(f.id)}">${myVote === f.id ? 'Your vote ✓' : 'Vote'}</button>` : ''}<button class="linkish" data-profile="${esc(f.id)}">Profile</button></div></li>`;
      }).join('') || '<li class="tn-empty">No founders announced yet.</li>'}</ol>
      ${readOnly || !open ? '' : !getName() || !isMember() ? '<div class="tn-locked"><p>Registered traders vote for the mayor. Sign up (free) to vote.</p><button class="btn btn-gold" id="ch-signup">Sign up free</button></div>' : ''}
      <p class="bk-fine">${5 - field.length} founder statue${5 - field.length === 1 ? ' is' : 's are'} still veiled at Founders’ Summit; they join the ballot when they’re announced.</p>`;
    flash = '';
    body.querySelector('#ch-signup')?.addEventListener('click', () => { close(); onSignup(); });
    body.querySelectorAll<HTMLButtonElement>('[data-profile]').forEach((b) => b.addEventListener('click', () => { close(); onFounder(b.dataset.profile!); }));
    body.querySelectorAll<HTMLButtonElement>('[data-vote]').forEach((b) => b.addEventListener('click', async () => {
      if (!votingOpen()) { flash = 'Voting is closed until the last week of the month.'; renderMayor(); return; }
      myVotes = { ...myVotes, mayor: { ...myVotes.mayor, [t]: b.dataset.vote! } };
      await saveVotes();
    }));
  }

  /* ---------------- rules ---------------- */
  function renderRules() {
    body.innerHTML = `<div class="bk-rules ch-rules">
      <div class="bk-free"><h3>Electing the Mayor of FUNDEDCITY</h3><p>Only the city’s five founders can be mayor. Their statues stand at Founders’ Summit in the mountains between the desert and the forest; click one for the founder’s profile and links.</p></div>
      <div><h3>The mayoral vote</h3><ul>
        <li>Candidates: the founders who have been announced (unveiled statues). Veiled founders join the ballot once they’re announced.</li>
        <li>Who votes: registered FUNDEDCITY traders (sign up free). Guests can watch but not vote.</li>
        <li>When: the last ${VOTE_DAYS} days of every month, UTC. Voting closes at midnight UTC on the 1st.</li>
        <li>One vote per city account. You can change your vote until voting closes.</li>
        <li>Result: the founder with the most votes is mayor for the whole of the next month. If it’s a tie, the earlier-numbered founder wins.</li>
        <li>The current mayor and the live count are shown in the Mayor tab and on the board outside City Hall.</li>
      </ul></div>
      <div><h3>City votes (polls)</h3><ul>
        <li>City Hall opens two votes every month, and the city’s owner can open more.</li>
        <li>One vote per account per poll, changeable until the poll closes. Results are public.</li>
      </ul></div>
      <div><h3>Community reviews</h3><ul>
        <li>One review per trader (1–5 stars), about the city or a place in it. Edit or delete yours any time.</li>
        <li>City Hall can reply. Reviews that break the rules (spam, abuse, personal details) can be removed.</li>
      </ul></div>
      <div><h3>Announcements</h3><ul><li>Only City Hall (the city’s owner) posts announcements.</li></ul></div>
    </div>`;
  }

  function render() {
    tabs.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    feed.innerHTML = cloud
      ? 'Reviews and votes are visible to everyone who can open this city. <b>One vote per city account.</b> Only founders can be mayor.'
      : 'Preview: shared reviews and votes open at launch. For now, they stay in this browser.';
    if (tab === 'news') renderNews();
    else if (tab === 'reviews') renderReviews();
    else if (tab === 'votes') renderVotes();
    else if (tab === 'mayor') renderMayor();
    else renderRules();
  }
  function show(t: HallTab) { tab = t; render(); }
  function open(t: HallTab = tab) {
    overlay.hidden = false;
    document.body.classList.add('media-open');
    show(t);
  }
  function close() {
    overlay.hidden = true;
    document.body.classList.remove('media-open');
  }
  function isOpen() { return !overlay.hidden; }
  return { open, close, isOpen, board, onChange: (fn) => { fns.push(fn); fn(); }, onAnnouncement: (fn) => { annFns.push(fn); } };
}
