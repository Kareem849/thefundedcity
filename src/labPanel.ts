// THE LAB panel: live and upcoming experiments with countdowns and conditions, renting a bay to launch
// one (firm teams with a club pass), and the Lab AI that answers questions about them.
// Published experiments live in the page's shared database (`lab/<your id>`, up to 2 each); elsewhere in
// this browser. Clearly labelled SAMPLE experiments fill the bays until firms launch their own.
import { getCloud, type Cloud } from './cloud';
import { getPass, onPass, passRole } from './clubPass';
import { getSample, AI_OFF_CODES, aiErrorNote } from './ai';
import { sampleExperiments, expStatus, releasesLeft, countdownText, type Experiment } from './lab';

export type LabTab = 'experiments' | 'rent' | 'ask';
export interface LabPanel {
  open: (tab?: LabTab) => void;
  close: () => void;
  isOpen: () => boolean;
  list: () => Experiment[];
  /** the four experiments on the bays (live / launching soon first) */
  bays: () => Array<Experiment | null>;
  onChange: (fn: (list: Experiment[], added: Experiment[]) => void) => void;
}

const esc = (v: string) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const CLOSE = '<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const LOCAL = 'fundedcity-lab-local';
const KEEP = 2;
const DAY = 86_400_000;
const PRICE = 1500;

function clean(v: Record<string, unknown>): Omit<Experiment, 'firm' | 'firmId' | 'sample' | 'publishedBy'> | null {
  const s = (k: string, n: number) => (typeof v[k] === 'string' ? (v[k] as string).slice(0, n) : '');
  const n = (k: string) => (typeof v[k] === 'number' && Number.isFinite(v[k]) ? (v[k] as number) : NaN);
  const kind = v.kind === 'releases' ? 'releases' : 'time';
  const e = {
    id: s('id', 24), title: s('title', 70), offer: s('offer', 220), kind: kind as Experiment['kind'], startsAt: n('startsAt'), endsAt: n('endsAt'),
    releasesTotal: kind === 'releases' ? Math.max(1, Math.min(100000, Math.round(n('releasesTotal')) || 1)) : undefined,
    releasesLeft: kind === 'releases' ? Math.max(0, Math.min(100000, Math.round(n('releasesLeft')) || 0)) : undefined,
    conditions: (Array.isArray(v.conditions) ? v.conditions : []).filter((c) => typeof c === 'string').slice(0, 8).map((c) => (c as string).slice(0, 140)),
    code: s('code', 30) || undefined, link: s('link', 120) || undefined,
  };
  if (!e.id || !e.title || !Number.isFinite(e.startsAt) || !Number.isFinite(e.endsAt)) return null;
  return e;
}

export function createLabPanel(root: HTMLElement, getName: () => string | null, openClub: () => void): LabPanel {
  root.insertAdjacentHTML(
    'beforeend',
    `<div class="media-overlay lab-overlay" id="lb-overlay" hidden>
      <section class="media-panel lab-panel" role="dialog" aria-modal="true" aria-labelledby="lb-title">
        <header class="mp-head">
          <div class="mp-title"><span class="mp-eyebrow lb-eyebrow">MISSION CONTROL</span><h2 id="lb-title">THE LAB</h2></div>
          <nav class="mp-tabs" role="tablist">
            <button role="tab" data-tab="experiments">Experiments</button>
            <button role="tab" data-tab="ask">Ask the Lab AI</button>
            <button role="tab" data-tab="rent">Rent a bay</button>
          </nav>
          <button class="icon-btn sq mp-close" id="lb-close" aria-label="Close THE LAB">${CLOSE}</button>
        </header>
        <div class="mp-body" id="lb-body"></div>
        <footer class="mp-foot"><span class="mp-feed" id="lb-feed"></span></footer>
      </section>
    </div>`,
  );
  const overlay = root.querySelector<HTMLElement>('#lb-overlay')!;
  const body = overlay.querySelector<HTMLElement>('#lb-body')!;
  const feed = overlay.querySelector<HTMLElement>('#lb-feed')!;
  const tabs = [...overlay.querySelectorAll<HTMLButtonElement>('.mp-tabs button')];
  overlay.querySelector('#lb-close')!.addEventListener('click', () => close());
  overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) close(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) close(); });
  tabs.forEach((b) => b.addEventListener('click', () => show(b.dataset.tab as LabTab)));

  let tab: LabTab = 'experiments';
  let cloud: Cloud | null = null;
  let readOnly = false;
  let published: Experiment[] = [];
  let mine: { firm: string; firmId: string; items: Array<NonNullable<ReturnType<typeof clean>>> } = { firm: '', firmId: '', items: [] };
  const fns: Array<(l: Experiment[], added: Experiment[]) => void> = [];
  let seen: Set<string> | null = null;
  let flash = '';

  const all = () => [...published, ...sampleExperiments()];
  const bays = () => {
    const now = Date.now();
    const order = (e: Experiment) => (e.sample ? 1 : 0) * 10 + (expStatus(e, now) === 'live' ? 0 : 1);
    const pick = all().filter((e) => expStatus(e, now) !== 'ended').sort((a, b) => order(a) - order(b) || a.endsAt - b.endsAt).slice(0, 4);
    const out: Array<Experiment | null> = [...pick];
    while (out.length < 4) out.push(null);
    return out;
  };
  const emit = () => {
    const added = seen ? published.filter((e) => !seen!.has(e.id)) : [];
    seen = new Set(published.map((e) => e.id));
    for (const f of fns) f(all(), added);
  };
  function applyDocs(docs: Array<{ id: string; data: Record<string, unknown> }>, uid: string | null) {
    const out: Experiment[] = [];
    for (const d of docs) {
      const firm = typeof d.data.firm === 'string' ? d.data.firm.slice(0, 40) : 'Prop firm';
      const firmId = typeof d.data.firmId === 'string' ? d.data.firmId.slice(0, 40) : '';
      const name = typeof d.data.name === 'string' ? d.data.name.slice(0, 24) : 'Firm team';
      const items = (Array.isArray(d.data.items) ? d.data.items : []).map((x: unknown) => (x && typeof x === 'object' ? clean(x as Record<string, unknown>) : null)).filter(Boolean) as Array<NonNullable<ReturnType<typeof clean>>>;
      if (d.id === uid) mine = { firm, firmId, items };
      for (const it of items.slice(0, KEEP)) out.push({ ...it, id: `${d.id}:${it.id}`, firm, firmId, sample: false, publishedBy: name });
    }
    published = out;
    emit();
    if (isOpen() && tab !== 'rent' && tab !== 'ask') render();
  }
  void (async () => {
    cloud = await getCloud();
    readOnly = !!cloud && (cloud.canWrite === false || !cloud.uid);
    if (cloud) {
      cloud.db.collection('lab').limit(200).onSnapshot(
        (snap: { docs: Array<{ id: string; data(): Record<string, unknown> | undefined }> }) => applyDocs(snap.docs.map((d) => ({ id: d.id, data: d.data() ?? {} })), cloud!.uid),
        () => { /* keep the last view */ },
      );
    } else {
      try { const v = JSON.parse(localStorage.getItem(LOCAL) ?? 'null'); if (v && Array.isArray(v.items)) applyDocs([{ id: 'me', data: v }], 'me'); else emit(); } catch { emit(); }
    }
  })();

  /* ---------------- experiments ---------------- */
  const fmtDate = (t: number) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).format(t) + ' UTC';
  const card = (e: Experiment, bay: number) => {
    const now = Date.now();
    const st = expStatus(e, now);
    const left = releasesLeft(e, now);
    const big = e.kind === 'releases' ? `${left} <small>of ${e.releasesTotal} left</small>` : countdownText((st === 'soon' ? e.startsAt : e.endsAt) - now);
    return `<article class="lb-card ${st}">
      <header><span class="lb-bay">${bay >= 0 ? `BAY ${'ABCD'[bay]}` : 'IN THE QUEUE'}</span><span class="lb-st ${st}">${st === 'live' ? '<i class="live-dot"></i>LIVE' : st === 'soon' ? 'LAUNCHING SOON' : 'ENDED'}</span></header>
      <span class="lb-firm">${e.sample ? 'SAMPLE · ' : ''}${esc(e.firm)}</span>
      <h3>${esc(e.title)}</h3>
      <p class="lb-offer">${esc(e.offer)}</p>
      <div class="lb-count"><span>${e.kind === 'releases' ? 'Releases left' : st === 'soon' ? 'Launches in' : 'Ends in'}</span><b data-count="${esc(e.id)}">${big}</b></div>
      ${e.conditions.length ? `<div class="lb-cond"><span>Conditions</span><ul>${e.conditions.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></div>` : ''}
      <dl>
        <div><dt>Runs</dt><dd>${fmtDate(e.startsAt)} → ${fmtDate(e.endsAt)}</dd></div>
        ${e.code ? `<div><dt>Code</dt><dd class="lb-code">${esc(e.code)}</dd></div>` : ''}
        ${e.link ? `<div><dt>Join at</dt><dd class="tn-link">${esc(e.link)}</dd></div>` : ''}
      </dl>
      <footer>${e.sample ? '<span class="tn-tag sample">SAMPLE EXPERIMENT</span>' : `<span class="tn-tag">Launched by ${esc(e.publishedBy ?? 'a firm team')} · unverified</span>`}<button class="btn btn-ghost lb-ask" data-ask="${esc(e.id)}">Ask the Lab AI</button></footer>
    </article>`;
  };
  function renderExperiments() {
    const now = Date.now();
    const b = bays();
    const live = all().filter((e) => expStatus(e, now) !== 'ended');
    const onBay = new Set(b.filter(Boolean).map((e) => e!.id));
    const order = [...b.filter(Boolean) as Experiment[], ...live.filter((e) => !onBay.has(e.id))];
    const free = b.filter((e) => !e || e.sample).length;
    body.innerHTML = (flash ? `<div class="bk-flash">${esc(flash)}</div>` : '') + `
      <div class="lb-hero"><div><b>${order.length}</b><span>experiments running or launching</span></div><div><b>${free}</b><span>bays free to rent${free && b.some((e) => e?.sample) ? ' (showing samples)' : ''}</span></div><div><b>${published.length}</b><span>launched by firms</span></div></div>
      <div class="lb-grid">${order.map((e) => card(e, b.findIndex((x) => x?.id === e.id))).join('')}</div>`;
    flash = '';
    body.querySelectorAll<HTMLButtonElement>('[data-ask]').forEach((x) => x.addEventListener('click', () => {
      const e = all().find((y) => y.id === x.dataset.ask);
      show('ask');
      if (e) { const inp = body.querySelector<HTMLInputElement>('#lb-q'); if (inp) { inp.value = `What are the conditions of “${e.title}”?`; inp.focus(); } }
    }));
  }

  /* ---------------- Lab AI ---------------- */
  interface Turn { role: 'user' | 'assistant'; text: string; note?: string }
  const convo: Turn[] = [{ role: 'assistant', text: 'Welcome to THE LAB. Ask me about any experiment: what you get, the conditions, how many releases are left, when it ends, or how a firm can rent a bay.' }];
  let busy = false;
  let aiOff = false;
  const factsJSON = () => JSON.stringify(all().map((e) => ({
    title: e.title, firm: e.firm, sample: e.sample, status: expStatus(e), offer: e.offer, conditions: e.conditions, kind: e.kind,
    startsUTC: new Date(e.startsAt).toISOString(), endsUTC: new Date(e.endsAt).toISOString(), releasesLeft: releasesLeft(e), releasesTotal: e.releasesTotal, code: e.code, link: e.link,
  })));
  const offline = (q: string) => {
    const s = q.toLowerCase();
    const live = all().filter((e) => expStatus(e) !== 'ended');
    const hit = live.find((e) => s.includes(e.title.toLowerCase().split(' ')[0]) || s.includes(e.title.toLowerCase()));
    if (hit) return `${hit.title} (${hit.sample ? 'sample' : hit.firm}): ${hit.offer}.\nConditions:\n${hit.conditions.map((c) => `- ${c}`).join('\n')}\n${hit.kind === 'releases' ? `${releasesLeft(hit)} of ${hit.releasesTotal} left.` : `Ends in ${countdownText(hit.endsAt - Date.now())}.`}`;
    if (/rent|bay|price|launch/.test(s)) return `Firm teams rent a bay for a sample $${PRICE.toLocaleString('en-US')} a week (nothing is charged in this demo). Get a firm pass at the 100K+ Payouts Golf Club gate, then use “Rent a bay”.`;
    return `Running now:\n${live.map((e) => `- ${e.title}: ${e.kind === 'releases' ? `${releasesLeft(e)} left` : `ends in ${countdownText(e.endsAt - Date.now())}`}`).join('\n')}\nAsk about any of them by name.`;
  };
  function renderAsk() {
    body.innerHTML = `<div class="cf-body lb-chat">
      <ol class="cf-msgs gd-msgs" id="lb-msgs" aria-live="polite">${convo.map((t) => `<li class="${t.role === 'user' ? 'mine' : 'guard'}"><span class="cf-who">${t.role === 'user' ? 'You' : 'Lab AI'}</span><p>${esc(t.text) || '<span class="gd-typing"><i></i><i></i><i></i></span>'}</p>${t.note ? `<small>${esc(t.note)}</small>` : ''}</li>`).join('')}</ol>
      <div class="cf-prompts">${['Which experiment ends soonest?', 'How many seats are left?', 'What are the conditions?', 'How can my firm rent a bay?'].map((p) => `<button type="button">${p}</button>`).join('')}</div>
      <form class="cf-form" id="lb-form"><input id="lb-q" maxlength="400" autocomplete="off" placeholder="Ask about an experiment…" /><button class="btn btn-gold" type="submit" ${busy ? 'disabled' : ''}>Ask</button></form>
    </div>`;
    const list = body.querySelector<HTMLOListElement>('#lb-msgs')!;
    list.scrollTop = list.scrollHeight;
    const form = body.querySelector<HTMLFormElement>('#lb-form')!;
    const input = body.querySelector<HTMLInputElement>('#lb-q')!;
    body.querySelectorAll<HTMLButtonElement>('.cf-prompts button').forEach((b) => b.addEventListener('click', () => { input.value = b.textContent ?? ''; form.requestSubmit(); }));
    form.addEventListener('submit', (e) => { e.preventDefault(); const q = input.value.trim(); if (q && !busy) void ask(q); });
  }
  async function ask(q: string) {
    busy = true;
    convo.push({ role: 'user', text: q.slice(0, 400) });
    const reply: Turn = { role: 'assistant', text: '' };
    convo.push(reply);
    if (tab === 'ask') renderAsk();
    const sample = aiOff ? null : await getSample();
    if (!sample) {
      reply.text = offline(q);
      reply.note = 'Preview: the Lab AI opens at launch. These answers come from the experiment notes.';
    } else {
      const prompt = `You are the Lab AI at THE LAB in FUNDEDCITY, a virtual city for prop-firm traders. Firms rent bays here to launch limited-time offers and experiments.
Answer the visitor's latest message in at most about 110 words, plain text, short dash bullets only for lists.
Use only the EXPERIMENTS data below. Experiments marked sample:true are SAMPLE examples, not real offers: say so when you mention them. Published ones are set by firm teams and unverified: tell visitors to confirm on the firm's own site. Never invent offers, prices, codes or dates. No financial advice. Renting a bay costs a sample $${PRICE} a week in this demo; firm teams need a firm pass from the 100K+ Payouts Golf Club gate.
Current time UTC: ${new Date().toISOString()}
EXPERIMENTS (JSON): ${factsJSON()}
CONVERSATION:
${convo.slice(-10, -1).map((t) => `${t.role === 'user' ? 'Visitor' : 'Lab AI'}: ${t.text}`).join('\n')}
Reply as the Lab AI.`;
      try {
        const res = await sample(prompt, { modelTier: 'quick', cache: false, onText: ({ text }: { text: string }) => { reply.text = text; if (tab === 'ask' && isOpen()) { const li = body.querySelector('#lb-msgs li:last-child p'); if (li) li.textContent = text; } } });
        reply.text = res.text.trim();
      } catch (e) {
        const code = (e as { code?: string })?.code ?? 'error';
        if (AI_OFF_CODES.includes(code)) { aiOff = true; reply.text = offline(q); reply.note = 'AI isn’t enabled for this view, so the offline helper answered.'; }
        else { reply.text = (e as { text?: string })?.text ?? ''; reply.note = aiErrorNote(code); }
      }
    }
    busy = false;
    if (tab === 'ask' && isOpen()) renderAsk();
  }

  /* ---------------- rent a bay ---------------- */
  function renderRent() {
    const pass = getPass();
    const firmPass = pass && pass.kind !== 'trader';
    const free = bays().filter((e) => !e || e.sample).length;
    if (!firmPass) {
      body.innerHTML = `<div class="tn-locked">
        <h3>Rent a bay · firm teams</h3>
        <p>Any prop firm can rent one of THE LAB’s four bays to launch a limited-time offer or experiment: a countdown screen on the bay, the conditions, and the Lab AI answering traders’ questions. Sample price: <b>$${PRICE.toLocaleString('en-US')} a week</b> (nothing is charged in this demo).</p>
        <p>${free} of 4 bays are free right now. Get a firm pass (CEO or marketing) at the 100K+ Payouts Golf Club members’ gate first.</p>
        <button class="btn btn-gold" id="lb-pass">Get a firm pass</button>
      </div>`;
      body.querySelector('#lb-pass')!.addEventListener('click', () => { close(); openClub(); });
      return;
    }
    if (readOnly) { body.innerHTML = '<p class="tn-empty">You have view-only access to this city, so you can’t launch here.</p>'; return; }
    const start = new Date(Date.now() + 3_600_000).toISOString().slice(0, 16);
    const end = new Date(Date.now() + 7 * DAY).toISOString().slice(0, 10);
    body.innerHTML = `
      ${flash ? `<div class="bk-flash">${esc(flash)}</div>` : ''}
      <form class="bk-form tn-form" id="lb-rent">
        <p class="bk-lead">Launching as <b>${esc(getName() ?? 'You')}</b> · ${esc(passRole(pass))}. Your experiment takes the next free bay (${free} free) or joins the queue. Sample rent: <b>$${PRICE.toLocaleString('en-US')}/week</b>, nothing is charged in this demo. Up to ${KEEP} at a time.</p>
        <label class="wide">Experiment name<input name="title" required maxlength="70" placeholder="e.g. 48-hour 50% off flash sale" /></label>
        <label class="wide">What traders get<input name="offer" required maxlength="220" placeholder="e.g. 50% off every 2-step challenge, $10K to $200K" /></label>
        <div class="tp-field wide"><span>Countdown</span><div class="tp-seg"><label><input type="radio" name="kind" value="time" checked /><span>Time left</span></label><label><input type="radio" name="kind" value="releases" /><span>Releases left</span></label></div></div>
        <label>Starts (UTC)<input name="start" type="datetime-local" required value="${start}" /></label>
        <label>Ends (UTC)<input name="end" type="date" required value="${end}" /></label>
        <label class="lb-rel" hidden>Number of releases<input name="total" inputmode="numeric" placeholder="e.g. 100" /></label>
        <label class="wide">Conditions (one per line)<textarea name="conditions" rows="4" maxlength="800" placeholder="New accounts only&#10;One per trader&#10;Standard drawdown rules"></textarea></label>
        <label>Discount code (optional)<input name="code" maxlength="30" /></label>
        <label>Where to join (shown as text)<input name="link" maxlength="120" placeholder="https://…" /></label>
        <div class="bk-actions"><button class="btn btn-gold" type="submit">Launch in THE LAB</button><span id="lb-msg"></span></div>
      </form>
      ${mine.items.length ? `<h4 class="tn-sub">Your launches</h4><ul class="tn-mine">${mine.items.map((it) => `<li><b>${esc(it.title)}</b><span>${it.kind === 'releases' ? `${it.releasesLeft} of ${it.releasesTotal} left` : `ends ${fmtDate(it.endsAt)}`}</span>${it.kind === 'releases' ? `<input class="lb-left" data-left="${esc(it.id)}" inputmode="numeric" value="${it.releasesLeft}" aria-label="Releases left" /><button class="btn btn-ghost" data-save="${esc(it.id)}">Update</button>` : ''}<button class="btn btn-ghost" data-del="${esc(it.id)}">End</button></li>`).join('')}</ul>` : ''}`;
    flash = '';
    const form = body.querySelector<HTMLFormElement>('#lb-rent')!;
    const msg = body.querySelector<HTMLElement>('#lb-msg')!;
    form.querySelectorAll<HTMLInputElement>('[name=kind]').forEach((r) => r.addEventListener('change', () => { body.querySelector<HTMLElement>('.lb-rel')!.hidden = r.value !== 'releases' || !r.checked; }));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(form);
      const s = (k: string) => String(f.get(k) ?? '').trim();
      const kind = s('kind') === 'releases' ? 'releases' : 'time';
      const startsAt = Date.parse(s('start') + 'Z');
      const endsAt = Date.parse(s('end') + 'T23:59:00Z');
      const total = Math.round(Number(s('total').replace(/[^0-9]/g, '')));
      if (!s('title') || !s('offer')) { msg.textContent = 'Give it a name and say what traders get.'; return; }
      if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt <= startsAt) { msg.textContent = 'The end date must be after the start.'; return; }
      if (kind === 'releases' && !(total >= 1)) { msg.textContent = 'Enter how many releases there are.'; return; }
      const it = {
        id: Math.random().toString(36).slice(2, 10), title: s('title').slice(0, 70), offer: s('offer').slice(0, 220), kind: kind as Experiment['kind'], startsAt, endsAt,
        releasesTotal: kind === 'releases' ? total : undefined, releasesLeft: kind === 'releases' ? total : undefined,
        conditions: s('conditions').split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 8).map((x) => x.slice(0, 140)), code: s('code').slice(0, 30) || undefined, link: s('link').slice(0, 120) || undefined,
      };
      mine = { firm: pass!.firmName ?? 'Prop firm', firmId: pass!.firmId ?? '', items: [it, ...mine.items].slice(0, KEEP) };
      const ok = await save();
      if (ok) { flash = `Launched “${it.title}”. Watch the rocket.`; show('experiments'); }
      else { msg.textContent = 'Couldn’t launch: you may not have permission to write to this city.'; }
    });
    body.querySelectorAll<HTMLButtonElement>('[data-save]').forEach((b) => b.addEventListener('click', async () => {
      const v = Math.round(Number(body.querySelector<HTMLInputElement>(`[data-left="${b.dataset.save}"]`)?.value ?? 'x'));
      if (!Number.isFinite(v) || v < 0) return;
      mine = { ...mine, items: mine.items.map((x) => (x.id === b.dataset.save ? { ...x, releasesLeft: Math.min(v, x.releasesTotal ?? v) } : x)) };
      await save();
      flash = 'Updated.';
      renderRent();
    }));
    body.querySelectorAll<HTMLButtonElement>('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      mine = { ...mine, items: mine.items.filter((x) => x.id !== b.dataset.del) };
      await save();
      flash = 'Experiment ended and its bay freed.';
      renderRent();
    }));
  }
  async function save() {
    const doc = { name: (getName() ?? 'Firm team').slice(0, 24), firm: mine.firm, firmId: mine.firmId, items: mine.items, updatedAt: Date.now() };
    if (cloud && cloud.uid) {
      try { await cloud.db.doc('lab/' + cloud.uid).set(doc); return true; } catch { return false; }
    }
    try { localStorage.setItem(LOCAL, JSON.stringify(doc)); } catch { /* ignore */ }
    applyDocs([{ id: 'me', data: doc }], 'me');
    return true;
  }

  function render() {
    tabs.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    feed.innerHTML = 'Firms launch their own offers and experiments here; <b>SAMPLE</b> experiments show how it works until they do. Always confirm the details with the firm before you buy.';
    if (tab === 'experiments') renderExperiments();
    else if (tab === 'ask') renderAsk();
    else renderRent();
  }
  function show(t: LabTab) { tab = t; render(); }
  function open(t: LabTab = tab) {
    overlay.hidden = false;
    document.body.classList.add('media-open');
    show(t);
  }
  function close() {
    overlay.hidden = true;
    document.body.classList.remove('media-open');
  }
  const isOpen = () => !overlay.hidden;
  onPass(() => { if (isOpen() && tab === 'rent') render(); });
  // live countdowns on the cards
  setInterval(() => {
    if (!isOpen() || tab !== 'experiments') return;
    const now = Date.now();
    for (const e of all()) {
      const el = body.querySelector<HTMLElement>(`[data-count="${CSS.escape(e.id)}"]`);
      if (!el) continue;
      const st = expStatus(e, now);
      el.innerHTML = e.kind === 'releases' ? `${releasesLeft(e, now)} <small>of ${e.releasesTotal} left</small>` : countdownText((st === 'soon' ? e.startsAt : e.endsAt) - now);
    }
  }, 1000);
  return { open, close, isOpen, list: all, bays, onChange: (fn) => { fns.push(fn); fn(all(), []); } };
}
