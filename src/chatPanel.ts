// Shared chat rooms (Sip The Dip Cafe, the golf club lounge).
// On the published page messages live in the page's shared database (`<collection>/<your id>` holds your
// last 30 messages, so everyone writes only their own document); elsewhere it falls back to this
// browser only. Names are the in-game character names people chose; an optional role tag rides along.
import { getCloud, type Cloud } from './cloud';

export interface ChatPanel {
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
  /** Latest message, for the speech bubble over the café. */
  onLatest: (fn: (m: { name: string; text: string } | null) => void) => void;
}

interface Msg { t: number; text: string }
interface Row { uid: string; name: string; role: string; t: number; text: string; mine: boolean }

export interface ChatConfig {
  prefix: string;
  collection: string;
  overlayClass: string;
  eyebrow: string;
  title: string;
  placeholder: string;
  prompts: string[];
  localKey: string;
  noun: string;
  /** role tag stored with your messages (e.g. "CEO · FTMO") */
  getRole?: () => string;
  /** gate posting (null = allowed) */
  postBlock?: () => string | null;
}

const esc = (v: string) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const MAX_LEN = 280;
const KEEP = 30;
const CLOSE = '<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

export function createChatPanel(root: HTMLElement, getName: () => string | null, cfg: ChatConfig): ChatPanel {
  const P = cfg.prefix;
  const LOCAL_KEY = cfg.localKey;
  root.insertAdjacentHTML(
    'beforeend',
    `<div class="media-overlay ${cfg.overlayClass}" id="${P}-overlay" hidden>
      <section class="media-panel cafe-panel" role="dialog" aria-modal="true" aria-labelledby="${P}-title">
        <header class="mp-head">
          <div class="mp-title"><span class="mp-eyebrow cf-eyebrow">${esc(cfg.eyebrow)}</span><h2 id="${P}-title">${esc(cfg.title)}</h2></div>
          <span class="cf-here" id="${P}-here"></span>
          <button class="icon-btn sq mp-close" id="${P}-close" aria-label="Close chat">${CLOSE}</button>
        </header>
        <div class="cf-body">
          <ol class="cf-msgs" id="${P}-msgs" aria-live="polite"></ol>
          <div class="cf-prompts" id="${P}-prompts">${cfg.prompts.map((p) => `<button type="button">${esc(p)}</button>`).join('')}</div>
          <form class="cf-form" id="${P}-form">
            <input id="${P}-input" maxlength="${MAX_LEN}" autocomplete="off" placeholder="${esc(cfg.placeholder)}" />
            <button class="btn btn-gold" type="submit">Send</button>
          </form>
        </div>
        <footer class="mp-foot"><span class="mp-feed" id="${P}-note"></span></footer>
      </section>
    </div>`,
  );
  const overlay = root.querySelector<HTMLElement>('#' + P + '-overlay')!;
  const list = overlay.querySelector<HTMLOListElement>('#' + P + '-msgs')!;
  const form = overlay.querySelector<HTMLFormElement>('#' + P + '-form')!;
  const input = overlay.querySelector<HTMLInputElement>('#' + P + '-input')!;
  const note = overlay.querySelector<HTMLElement>('#' + P + '-note')!;
  const here = overlay.querySelector<HTMLElement>('#' + P + '-here')!;
  overlay.querySelector('#' + P + '-close')!.addEventListener('click', () => close());
  overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) close(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) close(); });
  overlay.querySelectorAll<HTMLButtonElement>('#' + P + '-prompts button').forEach((b) => b.addEventListener('click', () => { input.value = b.textContent ?? ''; input.focus(); }));

  let cloud: Cloud | null = null;
  let readOnly = false;
  let rows: Row[] = [];
  let mine: { name: string; msgs: Msg[] } = { name: '', msgs: [] };
  let active = 0;
  let unsub: (() => void) | null = null;
  const latestFns: Array<(m: { name: string; text: string } | null) => void> = [];
  let writing: Promise<void> = Promise.resolve();
  let lastSend = 0;

  const fmtT = (t: number) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(t);
  const render = () => {
    const shown = rows.slice(-80);
    list.innerHTML = shown.length
      ? shown.map((r) => `<li class="${r.mine ? 'mine' : ''}"><span class="cf-who">${esc(r.name || 'Trader')}${r.role ? ` <i class="cf-role">${esc(r.role)}</i>` : ''}${r.mine ? ' <em>you</em>' : ''}</span><p>${esc(r.text)}</p><time>${fmtT(r.t)}</time></li>`).join('')
      : '<li class="cf-empty">No one has said anything yet. Be the first to say hi.</li>';
    list.scrollTop = list.scrollHeight;
    here.textContent = cloud ? `${Math.max(1, active)} ${cfg.noun}${active === 1 ? '' : 's'} here in the last 10 min` : '';
    const last = rows[rows.length - 1];
    for (const f of latestFns) f(last ? { name: last.name, text: last.text } : null);
  };

  const setNote = () => {
    note.innerHTML = cloud
      ? readOnly
        ? 'You have view-only access, so you can read but not post. Ask the owner for Contributor access to join the conversation.'
        : `Messages are shared with everyone who can open this city. Your character name${cfg.getRole ? ' and club role are' : ' is'} shown with each message. Keep it friendly.`
      : 'Preview: shared chat opens at launch. For now, your messages stay in this browser.';
  };

  function applyDocs(docs: Array<{ id: string; data: Record<string, unknown> }>, uid: string | null) {
    const out: Row[] = [];
    let act = 0;
    const now = Date.now();
    for (const d of docs) {
      const name = typeof d.data.name === 'string' ? d.data.name.slice(0, 24) : 'Trader';
      const role = typeof d.data.role === 'string' ? d.data.role.slice(0, 48) : '';
      const msgs = Array.isArray(d.data.msgs) ? d.data.msgs : [];
      if (typeof d.data.seenAt === 'number' && now - d.data.seenAt < 10 * 60_000) act++;
      for (const m of msgs.slice(-KEEP)) {
        if (!m || typeof m.text !== 'string' || typeof m.t !== 'number') continue;
        out.push({ uid: d.id, name, role, t: m.t, text: m.text.slice(0, MAX_LEN), mine: d.id === uid });
      }
      if (d.id === uid) mine = { name, msgs: msgs.filter((m: Msg) => m && typeof m.text === 'string').slice(-KEEP) };
    }
    out.sort((a, b) => a.t - b.t);
    rows = out;
    active = act;
    render();
  }

  async function connect() {
    cloud = await getCloud();
    readOnly = !!cloud && (cloud.canWrite === false || !cloud.uid);
    setNote();
    form.hidden = readOnly;
    overlay.querySelector<HTMLElement>('#' + P + '-prompts')!.hidden = readOnly;
    if (cloud) {
      unsub = cloud.db.collection(cfg.collection).limit(300).onSnapshot(
        (snap: { docs: Array<{ id: string; data(): Record<string, unknown> | undefined }> }) => applyDocs(snap.docs.map((d) => ({ id: d.id, data: d.data() ?? {} })), cloud!.uid),
        () => { /* terminal error: keep the last view */ },
      );
    } else {
      try {
        const v = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]');
        if (Array.isArray(v)) mine.msgs = v.filter((m) => m && typeof m.text === 'string' && typeof m.t === 'number').slice(-KEEP);
      } catch { /* ignore */ }
      rows = mine.msgs.map((m) => ({ uid: 'me', name: getName() ?? 'You', role: cfg.getRole?.() ?? '', t: m.t, text: m.text, mine: true }));
      render();
    }
  }
  const ready = connect();

  const writeMine = (extra: Record<string, unknown> = {}) => {
    if (!cloud || !cloud.uid || readOnly) return Promise.resolve();
    const doc = { name: (getName() ?? 'Trader').slice(0, 24), role: (cfg.getRole?.() ?? '').slice(0, 48), msgs: mine.msgs.slice(-KEEP), seenAt: Date.now(), ...extra };
    writing = writing.then(() => cloud!.db.doc(cfg.collection + '/' + cloud!.uid).set(doc)).catch((e: { code?: string }) => {
      if (e?.code === 'invalid_argument') { readOnly = true; form.hidden = true; setNote(); }
      if (e?.code === 'quota_exceeded') note.textContent = 'This chat is full right now. Ask the owner to clear old messages.';
    });
    return writing;
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim().slice(0, MAX_LEN);
    if (!text) return;
    const block = cfg.postBlock?.();
    if (block) { note.textContent = block; return; }
    if (Date.now() - lastSend < 2500) { note.textContent = 'Easy there — one message every few seconds.'; return; }
    lastSend = Date.now();
    input.value = '';
    mine.msgs = [...mine.msgs, { t: Date.now(), text }].slice(-KEEP);
    if (cloud) await writeMine();
    else {
      try { localStorage.setItem(LOCAL_KEY, JSON.stringify(mine.msgs)); } catch { /* ignore */ }
      rows = mine.msgs.map((m) => ({ uid: 'me', name: getName() ?? 'You', role: cfg.getRole?.() ?? '', t: m.t, text: m.text, mine: true }));
      render();
    }
  });

  function open() {
    overlay.hidden = false;
    document.body.classList.add('media-open');
    void ready.then(() => {
      render();
      // mark yourself as here (one write per visit, only if you've posted before)
      if (cloud && !readOnly && mine.msgs.length) void writeMine();
      if (!readOnly) input.focus({ preventScroll: true });
    });
  }
  function close() {
    overlay.hidden = true;
    document.body.classList.remove('media-open');
  }
  const isOpen = () => !overlay.hidden;
  window.addEventListener('beforeunload', () => unsub?.());
  return { open, close, isOpen, onLatest: (fn) => { latestFns.push(fn); } };
}

export type CafePanel = ChatPanel;
export function createCafePanel(root: HTMLElement, getName: () => string | null): CafePanel {
  return createChatPanel(root, getName, {
    prefix: 'cf', collection: 'cafe', overlayClass: 'cafe-overlay', eyebrow: 'THE WATERFRONT', title: 'Sip The Dip Cafe',
    placeholder: 'Say something to the traders here…', localKey: 'fundedcity-cafe-local', noun: 'trader',
    prompts: ['GM traders ☕', 'Who’s trading the FOMC today?', 'Just passed my evaluation!', 'NAS100 or gold this week?', 'Anyone else waiting on a payout?'],
  });
}
