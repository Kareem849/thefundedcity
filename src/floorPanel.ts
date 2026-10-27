// TRADING FLOOR panel: pick a pit (FX, INDICES, COMMODITIES, CRYPTO, OPTIONS) and talk strategy, entries
// and exits with everyone in it; attach a chart screenshot to any post. Ideas, not advice.
// Posts live in the page's shared database (`floor/<your id>`: your last posts); charts are stored with the
// page's `assets` capability and only ever shown as images. Off the published city: this browser only.
// SAMPLE posts (with drawn sample charts) show how a pit works until traders post.
import { getCloud, type Cloud } from './cloud';
import { ROOMS, type RoomId, type TickerItem } from './plaza';
import { uploadImage, imgSrc } from './uploads';

export interface FloorPanel {
  open: (room?: RoomId) => void;
  close: () => void;
  isOpen: () => boolean;
  onTicker: (fn: (items: TickerItem[]) => void) => void;
  /** posts in the last 24 h per room */
  activity: () => Record<RoomId, number>;
}
type Kind = 'idea' | 'entry' | 'exit' | 'strategy' | 'question';
type Dir = 'long' | 'short' | 'neutral';
interface Post { id: string; t: number; room: RoomId; kind: Kind; sym: string; dir: Dir; text: string; img?: string; name: string; owner: string; mine: boolean; sample?: boolean }

const KINDS: Array<{ id: Kind; label: string }> = [
  { id: 'idea', label: 'Idea' }, { id: 'entry', label: 'Entry' }, { id: 'exit', label: 'Exit' }, { id: 'strategy', label: 'Strategy' }, { id: 'question', label: 'Question' },
];
const esc = (v: string) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const CLOSE = '<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const CLIP = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M13.5 6.5l-5.8 5.8a1.6 1.6 0 002.3 2.3l6-6a3.2 3.2 0 00-4.5-4.5l-6.2 6.2a4.8 4.8 0 006.8 6.8l5-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
const LOCAL = 'fundedcity-floor-local';
const KEEP = 30;
const MAX = 500;
const ago = (t: number) => { const s = Math.max(0, (Date.now() - t) / 1000); return s < 60 ? 'now' : s < 3600 ? `${Math.floor(s / 60)}m` : s < 86400 ? `${Math.floor(s / 3600)}h` : `${Math.floor(s / 86400)}d`; };

/* ---------------- SAMPLE posts with drawn sample charts ---------------- */
const SAMPLE_DEF: Array<[RoomId, Kind, string, Dir, string, number]> = [
  ['fx', 'idea', 'EURUSD', 'long', 'Waiting for a sweep of the Asian low before London. Looking for a long back into the range, stop under the sweep.', 50],
  ['fx', 'question', 'GBPJPY', 'neutral', 'How do you all size GBPJPY on a 2-step? The daily range eats my 5% daily loss limit fast.', 160],
  ['indices', 'entry', 'NQ', 'short', 'Short NQ at the prior-day high rejection, 1:2.5 target at the overnight low. Half off at 1R.', 35],
  ['indices', 'strategy', 'ES', 'neutral', 'Only trading the first 90 minutes after the open, max two trades. Win rate went down, drawdown went down a lot more.', 300],
  ['commodities', 'idea', 'XAUUSD', 'long', 'Gold holding the weekly level. Patient long idea if CPI comes in soft, invalidated below the Thursday low.', 80],
  ['commodities', 'exit', 'CL', 'neutral', 'Closed my crude long before inventories: not holding through the number on a funded account.', 210],
  ['crypto', 'entry', 'BTC', 'long', 'BTC perp long on the reclaim of the range midpoint, stop under the 4h swing.', 25],
  ['crypto', 'question', 'ETH', 'neutral', 'Anyone trade ETH over the weekend on a prop account? Spreads and funding feel brutal.', 240],
  ['options', 'strategy', 'SPX', 'neutral', '0DTE iron condor on quiet days only; skip FOMC, CPI and NFP days entirely.', 70],
  ['options', 'idea', 'QQQ', 'short', 'Put debit spread into earnings week: defined risk, IV already elevated.', 190],
];
const chartCache = new Map<string, string>();
function sampleChart(sym: string, dir: Dir, seed: number) {
  const key = `${sym}:${seed}`;
  const hit = chartCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 360;
  const g = c.getContext('2d')!;
  g.fillStyle = '#0b1220';
  g.fillRect(0, 0, 640, 360);
  g.strokeStyle = 'rgba(255,255,255,0.06)';
  for (let x = 0; x < 640; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 360); g.stroke(); }
  for (let y = 0; y < 360; y += 45) { g.beginPath(); g.moveTo(0, y); g.lineTo(640, y); g.stroke(); }
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const n = 46;
  let p = 180;
  const drift = dir === 'long' ? -1.1 : dir === 'short' ? 1.1 : 0;
  const bars: Array<[number, number, number, number]> = [];
  for (let i = 0; i < n; i++) {
    const o = p;
    const cl = o + (rnd() - 0.5) * 26 + drift;
    const hi = Math.min(o, cl) - rnd() * 12;
    const lo = Math.max(o, cl) + rnd() * 12;
    bars.push([o, hi, lo, cl]);
    p = Math.max(60, Math.min(300, cl));
  }
  bars.forEach(([o, hi, lo, cl], i) => {
    const x = 20 + i * 13;
    const up = cl < o;
    g.strokeStyle = g.fillStyle = up ? '#2bd4a0' : '#ff6b6f';
    g.beginPath(); g.moveTo(x + 4, hi); g.lineTo(x + 4, lo); g.stroke();
    g.fillRect(x, Math.min(o, cl), 8, Math.max(2, Math.abs(cl - o)));
  });
  const lvl = bars[Math.floor(n * 0.6)][2];
  g.strokeStyle = '#f2c14e';
  g.setLineDash([8, 6]);
  g.beginPath(); g.moveTo(20, lvl); g.lineTo(620, lvl); g.stroke();
  g.setLineDash([]);
  g.fillStyle = '#ffffff';
  g.font = '800 22px Manrope, Inter, sans-serif';
  g.fillText(sym, 20, 34);
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.font = '900 30px Manrope, Inter, sans-serif';
  g.fillText('SAMPLE CHART', 410, 340);
  const url = c.toDataURL('image/jpeg', 0.82);
  chartCache.set(key, url);
  return url;
}
function samples(): Post[] {
  const now = Date.now();
  return SAMPLE_DEF.map(([room, kind, sym, dir, text, mins], i) => ({ id: 'sample-' + i, t: now - mins * 60_000, room, kind, sym, dir, text, name: 'Sample trader', owner: '', mine: false, sample: true, img: i % 2 === 0 ? `sample:${sym}:${dir}:${i + 11}` : undefined }));
}
const postImg = (p: Post) => {
  if (!p.img) return null;
  if (p.sample && p.img.startsWith('sample:')) { const [, sym, dir, seed] = p.img.split(':'); return sampleChart(sym, dir as Dir, Number(seed)); }
  return imgSrc(p.img);
};

export function createFloorPanel(root: HTMLElement, getName: () => string | null): FloorPanel {
  root.insertAdjacentHTML(
    'beforeend',
    `<div class="media-overlay floor-overlay" id="fl-overlay" hidden>
      <section class="media-panel cafe-panel floor-panel" role="dialog" aria-modal="true" aria-labelledby="fl-title">
        <header class="mp-head">
          <div class="mp-title"><span class="mp-eyebrow fl-eyebrow">IDEAS, NOT ADVICE</span><h2 id="fl-title">Trading Floor</h2></div>
          <nav class="mp-tabs fl-rooms" role="tablist">${ROOMS.map((r) => `<button role="tab" data-room="${r.id}" style="--room:${r.color}">${r.label}</button>`).join('')}</nav>
          <button class="icon-btn sq mp-close" id="fl-close" aria-label="Close the Trading Floor">${CLOSE}</button>
        </header>
        <div class="fl-bar" id="fl-bar"></div>
        <div class="cf-body">
          <ol class="cf-msgs fl-msgs" id="fl-msgs" aria-live="polite"></ol>
          <form class="fl-form" id="fl-form">
            <div class="fl-row">
              <div class="tp-seg fl-kinds">${KINDS.map((k, i) => `<label><input type="radio" name="kind" value="${k.id}"${i === 0 ? ' checked' : ''} /><span>${k.label}</span></label>`).join('')}</div>
              <input class="fl-sym" name="sym" maxlength="14" placeholder="Symbol" autocomplete="off" aria-label="Symbol" />
              <div class="tp-seg fl-dirs">${(['long', 'short', 'neutral'] as Dir[]).map((d) => `<label><input type="radio" name="dir" value="${d}"${d === 'neutral' ? ' checked' : ''} /><span>${d === 'long' ? '▲ Long' : d === 'short' ? '▼ Short' : 'Neutral'}</span></label>`).join('')}</div>
            </div>
            <div class="fl-row">
              <label class="icon-btn sq fl-attach" title="Attach a chart"><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden />${CLIP}<span class="sr">Attach a chart</span></label>
              <input class="fl-text" name="text" maxlength="${MAX}" autocomplete="off" placeholder="Share your idea, entry or exit…" aria-label="Message" />
              <button class="btn btn-gold" type="submit">Post</button>
            </div>
            <div class="fl-preview" id="fl-preview" hidden></div>
          </form>
        </div>
        <footer class="mp-foot"><span class="mp-feed" id="fl-note"></span></footer>
        <div class="fl-lightbox" id="fl-lightbox" hidden><img alt="Chart" /><button class="icon-btn sq" aria-label="Close chart">${CLOSE}</button></div>
      </section>
    </div>`,
  );
  const overlay = root.querySelector<HTMLElement>('#fl-overlay')!;
  const list = overlay.querySelector<HTMLOListElement>('#fl-msgs')!;
  const bar = overlay.querySelector<HTMLElement>('#fl-bar')!;
  const form = overlay.querySelector<HTMLFormElement>('#fl-form')!;
  const note = overlay.querySelector<HTMLElement>('#fl-note')!;
  const preview = overlay.querySelector<HTMLElement>('#fl-preview')!;
  const fileIn = overlay.querySelector<HTMLInputElement>('.fl-attach input')!;
  const lightbox = overlay.querySelector<HTMLElement>('#fl-lightbox')!;
  const tabs = [...overlay.querySelectorAll<HTMLButtonElement>('.fl-rooms button')];
  overlay.querySelector('#fl-close')!.addEventListener('click', () => close());
  overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) close(); });
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !isOpen()) return;
    if (!lightbox.hidden) { lightbox.hidden = true; e.stopImmediatePropagation(); return; }
    close();
  });
  lightbox.addEventListener('click', () => (lightbox.hidden = true));
  tabs.forEach((b) => b.addEventListener('click', () => { room = b.dataset.room as RoomId; render(); }));

  let room: RoomId = 'fx';
  let cloud: Cloud | null = null;
  let readOnly = false;
  let owner = false;
  let rows: Post[] = [];
  let mine: Array<Omit<Post, 'name' | 'owner' | 'mine'>> = [];
  let pending: { ref: string; local: boolean } | null = null;
  let busy = false;
  const tickFns: Array<(items: TickerItem[]) => void> = [];

  const all = () => [...rows, ...samples()];
  const emitTicker = () => {
    const real = rows.slice().sort((a, b) => b.t - a.t).slice(0, 8);
    const src = real.length ? real : samples().slice(0, 6);
    const items = src.map((p) => ({ room: p.room, text: `${p.sample ? 'SAMPLE · ' : ''}${p.sym ? p.sym + ' ' : ''}${p.dir !== 'neutral' ? (p.dir === 'long' ? '▲ ' : '▼ ') : ''}${p.text}` }));
    for (const f of tickFns) f(items);
  };
  function apply(docs: Array<{ id: string; data: Record<string, unknown> }>, uid: string | null) {
    const out: Post[] = [];
    for (const d of docs) {
      const name = typeof d.data.name === 'string' && d.data.name.trim() ? d.data.name.trim().slice(0, 24) : 'Trader';
      const msgs = Array.isArray(d.data.msgs) ? d.data.msgs : [];
      const clean: typeof mine = [];
      for (const m of msgs.slice(-KEEP)) {
        if (!m || typeof m !== 'object') continue;
        const r = m as Record<string, unknown>;
        if (!ROOMS.some((x) => x.id === r.room) || typeof r.text !== 'string' || typeof r.t !== 'number') continue;
        const p = {
          id: typeof r.id === 'string' ? r.id.slice(0, 16) : String(r.t), t: r.t, room: r.room as RoomId,
          kind: (KINDS.some((k) => k.id === r.kind) ? r.kind : 'idea') as Kind, sym: typeof r.sym === 'string' ? r.sym.slice(0, 14).toUpperCase() : '',
          dir: (r.dir === 'long' || r.dir === 'short' ? r.dir : 'neutral') as Dir, text: r.text.slice(0, MAX), img: typeof r.img === 'string' && imgSrc(r.img) ? r.img : undefined,
        };
        clean.push(p);
        out.push({ ...p, id: `${d.id}:${p.id}`, name, owner: d.id, mine: d.id === uid });
      }
      if (d.id === uid) mine = clean;
    }
    rows = out.filter((p) => p.t <= Date.now() + 60_000).sort((a, b) => a.t - b.t);
    emitTicker();
    if (isOpen()) renderMsgs();
  }
  void (async () => {
    cloud = await getCloud();
    readOnly = !!cloud && (cloud.canWrite === false || !cloud.uid);
    if (cloud) {
      try { owner = !!(await cloud.user?.isOwner?.()); } catch { owner = false; }
      cloud.db.collection('floor').limit(300).onSnapshot(
        (snap: { docs: Array<{ id: string; data(): Record<string, unknown> | undefined }> }) => apply(snap.docs.map((d) => ({ id: d.id, data: d.data() ?? {} })), cloud!.uid),
        () => { /* keep the last view */ },
      );
    } else {
      try { const v = JSON.parse(localStorage.getItem(LOCAL) ?? 'null'); if (v && Array.isArray(v.msgs)) apply([{ id: 'me', data: v }], 'me'); else emitTicker(); } catch { emitTicker(); }
    }
    if (isOpen()) render();
  })();

  function renderMsgs() {
    const r = ROOMS.find((x) => x.id === room)!;
    const posts = all().filter((p) => p.room === room).sort((a, b) => a.t - b.t).slice(-150);
    const real = rows.filter((p) => p.room === room);
    const people = new Set(real.map((p) => p.owner)).size;
    const day = real.filter((p) => Date.now() - p.t < 86_400_000).length;
    bar.innerHTML = `<span class="fl-pit" style="--room:${r.color}">${r.label} PIT</span><span>${esc(r.examples)}</span><span class="fl-stat"><b>${day}</b> posts today · <b>${people}</b> trader${people === 1 ? '' : 's'}</span>`;
    list.innerHTML = posts.length ? posts.map((p) => {
      const src = postImg(p);
      return `<li class="${p.mine ? 'mine' : ''}${p.sample ? ' fl-sample' : ''}">
        <span class="cf-who">${esc(p.name)}${p.sample ? ' <b class="tn-tag sample">SAMPLE</b>' : ''}</span>
        <div class="fl-tags"><span class="fl-kind ${p.kind}">${esc(KINDS.find((k) => k.id === p.kind)!.label)}</span>${p.sym ? `<span class="fl-sym-chip">${esc(p.sym)}</span>` : ''}${p.dir !== 'neutral' ? `<span class="fl-dir ${p.dir}">${p.dir === 'long' ? '▲ LONG' : '▼ SHORT'}</span>` : ''}</div>
        <p>${esc(p.text)}</p>
        ${src ? `<button class="fl-chart" data-img="${esc(p.id)}" aria-label="Open chart"><img src="${esc(src)}" alt="Chart shared by ${esc(p.name)}" loading="lazy" /></button>` : ''}
        <time>${ago(p.t)}${p.mine || (owner && !p.sample) ? ` · <button class="linkish" data-del="${esc(p.id)}">${p.mine ? 'Delete' : 'Remove'}</button>` : ''}</time>
      </li>`;
    }).join('') : `<li class="cf-empty">The ${esc(r.label)} pit is quiet. Post the first idea.</li>`;
    list.scrollTop = list.scrollHeight;
    // an upload from outside your organization may not load for you: show a placeholder instead
    list.querySelectorAll<HTMLImageElement>('.fl-chart img').forEach((im) => im.addEventListener('error', () => im.parentElement?.classList.add('fl-noimg'), { once: true }));
    list.querySelectorAll<HTMLButtonElement>('[data-img]').forEach((b) => b.addEventListener('click', () => {
      const p = all().find((x) => x.id === b.dataset.img);
      const src = p && postImg(p);
      if (!src) return;
      lightbox.querySelector('img')!.src = src;
      lightbox.hidden = false;
    }));
    list.querySelectorAll<HTMLButtonElement>('[data-del]').forEach((b) => b.addEventListener('click', () => void removePost(b.dataset.del!)));
  }
  function render() {
    tabs.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.room === room)));
    overlay.querySelector<HTMLElement>('.floor-panel')!.style.setProperty('--room', ROOMS.find((x) => x.id === room)!.color);
    form.hidden = readOnly;
    note.innerHTML = readOnly
      ? 'You have view-only access to this city: you can read the pits but not post.'
      : `${cloud ? 'Posts and charts are visible to everyone who can open this city' : 'Preview: shared posting opens at launch, so for now posts stay in this browser'}. <b>Ideas, not financial advice.</b> Don’t share account logins or personal details.`;
    renderMsgs();
  }
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files?.[0];
    fileIn.value = '';
    if (!f) return;
    preview.hidden = false;
    preview.innerHTML = '<span class="tp-spin"></span> Preparing your chart…';
    const r = await uploadImage(f, { shared: !!cloud });
    if ('error' in r) { pending = null; preview.textContent = r.error; return; }
    pending = r;
    const src = imgSrc(r.ref);
    preview.innerHTML = `${src ? `<img src="${esc(src)}" alt="Chart to post" />` : ''}<span>Chart attached${r.local ? ' (this browser only)' : ''}</span><button type="button" class="linkish" id="fl-unattach">Remove</button>`;
    preview.querySelector('#fl-unattach')!.addEventListener('click', () => { pending = null; preview.hidden = true; });
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    const f = new FormData(form);
    const text = String(f.get('text') ?? '').trim();
    if (!text && !pending) return;
    busy = true;
    const p = {
      id: Math.random().toString(36).slice(2, 10), t: Date.now(), room, kind: String(f.get('kind') ?? 'idea') as Kind,
      sym: String(f.get('sym') ?? '').trim().toUpperCase().replace(/[^A-Z0-9./!-]/g, '').slice(0, 14), dir: String(f.get('dir') ?? 'neutral') as Dir,
      text: (text || 'Chart').slice(0, MAX), img: pending?.ref,
    };
    mine = [...mine, p].slice(-KEEP);
    const ok = await save();
    busy = false;
    if (!ok) { note.textContent = 'Couldn’t post: you may not have permission to write to this city.'; mine = mine.filter((x) => x.id !== p.id); return; }
    (form.querySelector('[name=text]') as HTMLInputElement).value = '';
    pending = null;
    preview.hidden = true;
  });
  async function save() {
    const doc = { name: (getName() ?? 'Trader').slice(0, 24), msgs: mine, updatedAt: Date.now() };
    if (cloud && cloud.uid) {
      try { await cloud.db.doc('floor/' + cloud.uid).set(doc); return true; } catch { return false; }
    }
    try { localStorage.setItem(LOCAL, JSON.stringify(doc)); } catch { /* storage full: keep in memory */ }
    apply([{ id: 'me', data: doc }], 'me');
    return true;
  }
  async function removePost(id: string) {
    const [docId, pid] = id.split(':');
    const p = rows.find((x) => x.id === id);
    if (!p) return;
    if (p.mine) { mine = mine.filter((x) => x.id !== pid); await save(); return; }
    if (!owner || !cloud) return;
    try {
      const ref = cloud.db.doc('floor/' + docId);
      const d = (await ref.get()).data() ?? {};
      await ref.set({ ...d, msgs: (Array.isArray(d.msgs) ? d.msgs : []).filter((m: { id?: string }) => m?.id !== pid), updatedAt: Date.now() });
    } catch { note.textContent = 'Couldn’t remove that post.'; }
  }

  function open(r?: RoomId) {
    if (r) room = r;
    overlay.hidden = false;
    document.body.classList.add('media-open');
    render();
  }
  function close() {
    overlay.hidden = true;
    lightbox.hidden = true;
    document.body.classList.remove('media-open');
  }
  function isOpen() { return !overlay.hidden; }
  return {
    open, close, isOpen,
    onTicker: (fn) => { tickFns.push(fn); emitTicker(); },
    activity: () => Object.fromEntries(ROOMS.map((r) => [r.id, rows.filter((p) => p.room === r.id && Date.now() - p.t < 86_400_000).length])) as Record<RoomId, number>,
  };
}
