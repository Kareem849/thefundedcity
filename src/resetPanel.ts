// RESET session panel: talk through a losing trade with the AI mindset guide, privately or in the group
// circle, then go quiet and listen: the guide's words can be read aloud while a breathing guide runs
// (4 in · 4 hold · 6 out). The guide is an AI, not a therapist; it points people to real help when needed.
// Private sessions stay on this device (sent to Claude only to answer). The group circle is shared through
// the page's database (`circle/<your id>`: your last messages and the guide's replies to you).
import { getCloud, type Cloud } from './cloud';
import { getSample, AI_OFF_CODES, aiErrorNote } from './ai';
import { breathAt } from './reset';

export type ResetTab = 'private' | 'group';
export interface ResetPanel { open: (tab?: ResetTab) => void; close: () => void; isOpen: () => boolean }

interface Msg { t: number; role: 'me' | 'guide'; text: string; to?: string }
const esc = (v: string) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const CLOSE = '<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const MAX = 600;
const KEEP = 30;
const LOCAL_GROUP = 'fundedcity-circle-local';

const GUIDE_RULES = `You are "Reset", the AI mindset guide at the yoga deck in Touch The Grass Park, FUNDEDCITY (a virtual city for prop-firm traders). Traders come to you after losing trades, blown accounts or failed evaluations.
How you talk: warm, calm, unhurried, plain words. At most about 130 words unless asked for a guided reflection. No markdown headings or bold.
What you do: listen first and reflect back what you heard; normalise losses as part of trading; separate the person from the result; help them look at process (rules, risk per trade, sleep, tilt, revenge trading) rather than the money; offer one small, concrete next step; invite a slow breath when emotions run high.
Limits: you are an AI guide, not a licensed therapist, counsellor or financial adviser; say so if asked. Never give trade signals, market calls or advice to trade more to win it back. Don't diagnose.
Safety: if someone mentions wanting to hurt themselves, not wanting to live, losing money they can't afford (rent, debt), or that they can't stop trading/gambling, respond with care, say you're glad they told you, and gently encourage them to contact a local crisis line, a gambling-support service or a doctor, and their local emergency number if they're in danger. Encourage talking to someone they trust.`;

const OFFLINE = [
  'Thank you for sharing that. A losing trade stings, and it says nothing about your worth. Let’s slow down: breathe in for four, hold for four, out for six. When you’re ready: was this loss inside your plan, or did you step outside it?',
  'That sounds heavy. Before anything else, step away from the charts for a moment. Notice your feet on the ground and take three slow breaths. Losses are part of the job; the goal is one clean decision next time, not winning it back today.',
  'It’s normal to replay a loss. Try writing it in one line: what happened, what you controlled, what you’ll do differently. Then close the platform for today. Rest is part of your edge.',
];
const REFLECTION = 'Close your eyes if that feels okay. Breathe in slowly for four… hold for four… and let it go for six. The trade is over. The market will be there tomorrow, and so will you. Notice where you hold the tension: your jaw, your shoulders, your hands. Let them soften. You are not your last trade. You followed some of your rules and you can follow more of them next time. One breath in… and out. When you open your eyes, choose one small thing to do that has nothing to do with the screen.';

export function createResetPanel(root: HTMLElement, getName: () => string | null): ResetPanel {
  root.insertAdjacentHTML(
    'beforeend',
    `<div class="media-overlay reset-overlay" id="rs-overlay" hidden>
      <section class="media-panel cafe-panel reset-panel" role="dialog" aria-modal="true" aria-labelledby="rs-title">
        <header class="mp-head">
          <div class="rs-breath" id="rs-breath" aria-hidden="true"><i></i></div>
          <div class="mp-title"><span class="mp-eyebrow rs-eyebrow">TOUCH THE GRASS PARK · RESET</span><h2 id="rs-title">Mindset session</h2></div>
          <nav class="mp-tabs" role="tablist"><button role="tab" data-tab="private">Private</button><button role="tab" data-tab="group">Group circle</button></nav>
          <button class="icon-btn sq mp-close" id="rs-close" aria-label="Close session">${CLOSE}</button>
        </header>
        <div class="rs-tools">
          <span class="rs-phase" id="rs-phase">Breathe in</span>
          <label class="rs-toggle"><input type="checkbox" id="rs-voice" /> Read replies aloud</label>
          <button class="btn btn-ghost" id="rs-quiet" type="button">Go quiet &amp; listen</button>
        </div>
        <div class="cf-body">
          <ol class="cf-msgs" id="rs-msgs" aria-live="polite"></ol>
          <div class="cf-prompts" id="rs-prompts">${['I broke my rules and blew the account', 'I keep revenge trading', 'I failed my evaluation again', 'How do I let a loss go?'].map((p) => `<button type="button">${p}</button>`).join('')}</div>
          <form class="cf-form" id="rs-form"><input id="rs-input" maxlength="${MAX}" autocomplete="off" placeholder="Tell the guide what happened…" /><button class="btn btn-gold" type="submit">Share</button></form>
        </div>
        <footer class="mp-foot"><span class="mp-feed" id="rs-note"></span></footer>
      </section>
    </div>`,
  );
  const overlay = root.querySelector<HTMLElement>('#rs-overlay')!;
  const list = overlay.querySelector<HTMLOListElement>('#rs-msgs')!;
  const form = overlay.querySelector<HTMLFormElement>('#rs-form')!;
  const input = overlay.querySelector<HTMLInputElement>('#rs-input')!;
  const note = overlay.querySelector<HTMLElement>('#rs-note')!;
  const voice = overlay.querySelector<HTMLInputElement>('#rs-voice')!;
  const phase = overlay.querySelector<HTMLElement>('#rs-phase')!;
  const orb = overlay.querySelector<HTMLElement>('#rs-breath i')!;
  const tabs = [...overlay.querySelectorAll<HTMLButtonElement>('.mp-tabs button')];
  overlay.querySelector('#rs-close')!.addEventListener('click', () => close());
  overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) close(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) close(); });
  tabs.forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab as ResetTab; render(); }));
  overlay.querySelectorAll<HTMLButtonElement>('#rs-prompts button').forEach((b) => b.addEventListener('click', () => { input.value = b.textContent ?? ''; input.focus(); }));

  let tab: ResetTab = 'private';
  let busy = false;
  let aiOff = false;
  const priv: Msg[] = [{ t: Date.now(), role: 'guide', text: 'Welcome to RESET. Sit with me for a minute. Tell me about the trade that’s on your mind, as much or as little as you like. When you just want to listen, press “Go quiet & listen”.' }];
  let cloud: Cloud | null = null;
  let readOnly = false;
  let groupRows: Array<Msg & { name: string; mine: boolean }> = [];
  let mine: Msg[] = [];

  /* ---------------- breathing + voice ---------------- */
  const t0 = performance.now();
  setInterval(() => {
    if (!isOpen()) return;
    const t = (performance.now() - t0) / 1000;
    const b = breathAt(t);
    const c = t % 14;
    orb.style.transform = `scale(${0.55 + b * 0.45})`;
    phase.textContent = c < 4 ? 'Breathe in · 4' : c < 8 ? 'Hold · 4' : 'Breathe out · 6';
  }, 100);
  const speak = (text: string) => {
    try {
      const s = window.speechSynthesis;
      if (!s) return;
      s.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.88;
      u.pitch = 0.95;
      s.speak(u);
    } catch { /* voices unavailable */ }
  };

  /* ---------------- the guide ---------------- */
  async function guideReply(context: Array<{ who: string; text: string }>, extra = ''): Promise<{ text: string; note?: string }> {
    const sample = aiOff ? null : await getSample();
    if (!sample) return { text: extra ? REFLECTION : OFFLINE[Math.floor(Math.random() * OFFLINE.length)], note: 'Preview: AI replies open at launch.' };
    const prompt = `${GUIDE_RULES}\n\n${tab === 'group' ? 'This is a GROUP circle: several traders can read it. Address the person by name, keep it general enough for the group, and remind people not to share private details.' : 'This is a PRIVATE session with one trader.'}\n\nCONVERSATION:\n${context.slice(-12).map((m) => `${m.who}: ${m.text}`).join('\n')}\n\n${extra || 'Reply as Reset to the last message.'}`;
    try {
      const res = await sample(prompt, { modelTier: 'default', cache: false });
      return { text: res.text.trim() };
    } catch (e) {
      const code = (e as { code?: string })?.code ?? 'error';
      if (AI_OFF_CODES.includes(code)) { aiOff = true; return { text: extra ? REFLECTION : OFFLINE[0], note: 'AI isn’t enabled for this view, so the offline guide answered.' }; }
      return { text: (e as { text?: string })?.text ?? '', note: aiErrorNote(code) };
    }
  }

  /* ---------------- group circle (shared) ---------------- */
  function applyDocs(docs: Array<{ id: string; data: Record<string, unknown> }>, uid: string | null) {
    const out: typeof groupRows = [];
    for (const d of docs) {
      const name = typeof d.data.name === 'string' ? d.data.name.slice(0, 24) : 'Trader';
      const msgs = (Array.isArray(d.data.msgs) ? d.data.msgs : []).filter((m: Msg) => m && typeof m.text === 'string' && typeof m.t === 'number').slice(-KEEP) as Msg[];
      for (const m of msgs) out.push({ t: m.t, role: m.role === 'guide' ? 'guide' : 'me', text: m.text.slice(0, MAX + 400), to: typeof m.to === 'string' ? m.to.slice(0, 24) : undefined, name, mine: d.id === uid });
      if (d.id === uid) mine = msgs;
    }
    groupRows = out.sort((a, b) => a.t - b.t);
    if (isOpen() && tab === 'group') render();
  }
  void (async () => {
    cloud = await getCloud();
    readOnly = !!cloud && (cloud.canWrite === false || !cloud.uid);
    if (cloud) {
      cloud.db.collection('circle').limit(200).onSnapshot(
        (snap: { docs: Array<{ id: string; data(): Record<string, unknown> | undefined }> }) => applyDocs(snap.docs.map((d) => ({ id: d.id, data: d.data() ?? {} })), cloud!.uid),
        () => { /* keep the last view */ },
      );
    } else {
      try { const v = JSON.parse(localStorage.getItem(LOCAL_GROUP) ?? '[]'); if (Array.isArray(v)) applyDocs([{ id: 'me', data: { name: getName() ?? 'You', msgs: v } }], 'me'); } catch { /* ignore */ }
    }
  })();
  async function saveMine() {
    mine = mine.slice(-KEEP);
    if (cloud && cloud.uid) {
      try { await cloud.db.doc('circle/' + cloud.uid).set({ name: (getName() ?? 'Trader').slice(0, 24), msgs: mine, seenAt: Date.now() }); } catch { note.textContent = 'Couldn’t post to the circle: you may not have permission to write here.'; }
    } else {
      try { localStorage.setItem(LOCAL_GROUP, JSON.stringify(mine)); } catch { /* ignore */ }
      applyDocs([{ id: 'me', data: { name: getName() ?? 'You', msgs: mine } }], 'me');
    }
  }

  /* ---------------- render + send ---------------- */
  const fmtT = (t: number) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(t);
  function render() {
    tabs.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    const rows = tab === 'private'
      ? priv.map((m) => ({ ...m, name: m.role === 'guide' ? 'Reset · AI guide' : 'You', mine: m.role === 'me' }))
      : groupRows.map((m) => ({ ...m, name: m.role === 'guide' ? `Reset · AI guide${m.to ? ' → ' + m.to : ''}` : m.name }));
    list.innerHTML = rows.length
      ? rows.map((m) => `<li class="${m.role === 'guide' ? 'guard rs-guide' : m.mine ? 'mine' : ''}"><span class="cf-who">${esc(m.name)}${m.mine && m.role !== 'guide' ? ' <em>you</em>' : ''}</span><p>${esc(m.text) || '<span class="gd-typing"><i></i><i></i><i></i></span>'}</p><time>${fmtT(m.t)}</time></li>`).join('')
      : '<li class="cf-empty">The circle is quiet. Share what’s on your mind; the guide and other traders will see it.</li>';
    list.scrollTop = list.scrollHeight;
    form.hidden = tab === 'group' && readOnly;
    note.innerHTML = tab === 'private'
      ? 'Private: this session stays on this device and isn’t saved; messages go to Claude only to answer. <b>Reset is an AI guide, not a therapist.</b> If you’re struggling, talk to someone you trust or a professional; in danger, call your local emergency number.'
      : `Group circle: posts and the guide’s replies are visible to everyone who can open this city${cloud ? '' : ' (in this preview, only in this browser)'}. Don’t share personal details. <b>Reset is an AI guide, not a therapist.</b>`;
  }
  async function send(text: string) {
    if (busy) return;
    busy = true;
    const now = Date.now();
    if (tab === 'private') {
      priv.push({ t: now, role: 'me', text });
      const pending: Msg = { t: now + 1, role: 'guide', text: '' };
      priv.push(pending);
      render();
      const r = await guideReply(priv.slice(0, -1).map((m) => ({ who: m.role === 'me' ? 'Trader' : 'Reset', text: m.text })));
      pending.text = r.text + (r.note ? `\n\n(${r.note})` : '');
      if (voice.checked && r.text) speak(r.text);
    } else {
      const name = (getName() ?? 'Trader').slice(0, 24);
      mine = [...mine, { t: now, role: 'me', text }];
      await saveMine();
      render();
      const ctx = [...groupRows.filter((m) => m.t < now).slice(-10).map((m) => ({ who: m.role === 'guide' ? 'Reset' : m.name, text: m.text })), { who: name, text }];
      const r = await guideReply(ctx);
      if (r.text) {
        mine = [...mine, { t: Date.now(), role: 'guide', text: r.text, to: name }];
        await saveMine();
        if (voice.checked) speak(r.text);
      }
      if (r.note) note.textContent = r.note;
    }
    busy = false;
    render();
  }
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim().slice(0, MAX);
    if (!text || busy) return;
    input.value = '';
    void send(text);
  });
  // quiet mode: the guide speaks a short guided reflection; you just breathe and listen
  overlay.querySelector('#rs-quiet')!.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    const ctx = (tab === 'private' ? priv : groupRows).filter((m) => m.text).map((m) => ({ who: m.role === 'me' ? 'Trader' : 'Reset', text: m.text }));
    // the reflection is just for you: shown here, never posted to the circle
    const li = document.createElement('li');
    li.className = 'guard rs-guide rs-quiet';
    li.innerHTML = '<span class="cf-who">Reset · guided reflection (just for you)</span><p><span class="gd-typing"><i></i><i></i><i></i></span></p>';
    list.appendChild(li);
    list.scrollTop = list.scrollHeight;
    const r = await guideReply(ctx, 'The trader has gone quiet to listen. Write a calm guided reflection of about 120 words, to be read aloud slowly: begin with a breath (in four, hold four, out six), gently name what they shared (if anything), loosen self-blame, and end with one small kind action away from the screen. No questions.');
    busy = false;
    if (tab === 'private') { priv.push({ t: Date.now(), role: 'guide', text: r.text }); render(); }
    else { li.querySelector('p')!.textContent = r.text; list.scrollTop = list.scrollHeight; }
    speak(r.text);
  });

  function open(t: ResetTab = tab) {
    tab = t;
    overlay.hidden = false;
    document.body.classList.add('media-open');
    render();
    input.focus({ preventScroll: true });
  }
  function close() {
    overlay.hidden = true;
    document.body.classList.remove('media-open');
    try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
  }
  const isOpen = () => !overlay.hidden;
  return { open, close, isOpen };
}
