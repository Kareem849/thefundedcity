// 100K+ Payouts Golf Club: the members' gate (entry conditions + club pass), who's at the club, and the
// members' lounge chat. Traders qualify from their verified payouts in FUNDEDCITY; prop-firm CEOs and
// marketing teams request a firm pass (self-declared and marked unverified in this demo).
import { getPass, setPass, onPass, passRole, PASS_LABEL, type ClubPass } from './clubPass';
import { createChatPanel, type ChatPanel } from './chatPanel';
import { GOLF_CONDITIONS } from './golf';
import type { Firm } from './firms';

export type GolfTab = 'gate' | 'members';
export interface GolfPanel {
  open: (tab?: GolfTab, reason?: string) => void;
  close: () => void;
  isOpen: () => boolean;
  lounge: ChatPanel;
}

interface Deps {
  getName: () => string | null;
  /** null for guests (no verified payouts) */
  myVerifiedPayouts: () => { name: string; payouts: number } | null;
  members: () => Array<{ name: string; payouts: number }>;
  firms: Firm[];
  onSignup: () => void;
  onWalkIn: () => void;
}

const esc = (v: string) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const CLOSE = '<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const usd = (n: number) => '$' + Math.round(n).toLocaleString('en-US');

export function createGolfPanel(root: HTMLElement, d: Deps): GolfPanel {
  root.insertAdjacentHTML(
    'beforeend',
    `<div class="media-overlay golf-gate-overlay" id="gc-overlay" hidden>
      <section class="media-panel golf-panel" role="dialog" aria-modal="true" aria-labelledby="gc-title">
        <header class="mp-head">
          <div class="mp-title"><span class="mp-eyebrow gc-eyebrow">MEMBERS ONLY</span><h2 id="gc-title">100K+ Payouts Golf Club</h2></div>
          <nav class="mp-tabs" role="tablist">
            <button role="tab" data-tab="gate">Members’ gate</button>
            <button role="tab" data-tab="members">At the club</button>
          </nav>
          <button class="icon-btn sq mp-close" id="gc-close" aria-label="Close">${CLOSE}</button>
        </header>
        <div class="mp-body" id="gc-body"></div>
        <footer class="mp-foot"><span class="mp-feed">Trader access is checked against FUNDEDCITY’s verified payout records. Firm roles are self-declared and marked <b>unverified</b> in this demo; the club verifies them before anything official.</span></footer>
      </section>
    </div>`,
  );
  const overlay = root.querySelector<HTMLElement>('#gc-overlay')!;
  const body = overlay.querySelector<HTMLElement>('#gc-body')!;
  const tabs = [...overlay.querySelectorAll<HTMLButtonElement>('.mp-tabs button')];
  overlay.querySelector('#gc-close')!.addEventListener('click', () => close());
  overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) close(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) close(); });
  tabs.forEach((b) => b.addEventListener('click', () => show(b.dataset.tab as GolfTab)));

  const lounge = createChatPanel(root, d.getName, {
    prefix: 'gl', collection: 'golf', overlayClass: 'golf-overlay', eyebrow: '100K+ PAYOUTS GOLF CLUB · MEMBERS’ LOUNGE', title: 'Members’ lounge',
    placeholder: 'Talk to 100K+ traders and firm teams…', localKey: 'fundedcity-golf-local', noun: 'member',
    prompts: ['Morning all ⛳', 'Which firms are hiring affiliates?', 'Any tournaments coming up at the arena?', 'What payout speed are traders seeing this month?', 'Happy to share what got me to 100K'],
    getRole: () => passRole(getPass()),
    postBlock: () => (getPass() ? null : 'Members only: get a club pass at the members’ gate to post here.'),
  });

  let tab: GolfTab = 'gate';
  let reason = '';
  let msg = '';

  const passCard = (p: ClubPass) => `
    <div class="gc-pass">
      <div class="gc-pass-card">
        <span class="gc-pass-eyebrow">CLUB PASS</span>
        <b>${esc(d.getName() ?? 'Member')}</b>
        <em>${esc(passRole(p))}</em>
        <small>${p.kind === 'trader' ? `Verified payouts ${usd(p.payouts ?? 0)}` : 'Firm role · unverified (demo)'} · since ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(p.since)}</small>
      </div>
      <div class="gc-pass-actions">
        <button class="btn btn-gold" id="gc-walk">Walk in through the gate</button>
        <button class="btn btn-ghost" id="gc-lounge">Open the members’ lounge</button>
        <button class="btn btn-ghost" id="gc-revoke">Hand back pass</button>
      </div>
    </div>`;

  function renderGate() {
    const p = getPass();
    const me = d.myVerifiedPayouts();
    body.innerHTML = `
      ${reason ? `<div class="gc-reason">${esc(reason)}</div>` : ''}
      ${msg ? `<div class="bk-flash">${esc(msg)}</div>` : ''}
      <div class="gc-cols">
        <section class="gc-rules">
          <h3>Entry conditions</h3>
          <ol>${GOLF_CONDITIONS.map((c) => `<li>${esc(c)}</li>`).join('')}</ol>
          <p>Members meet on the lawn and in the lounge to discuss and chat: payouts, partnerships, affiliate deals, tournaments.</p>
        </section>
        <section class="gc-apply">
          ${p ? passCard(p) : `
          <article class="gc-option">
            <h4>I’m a funded trader</h4>
            <p>${me ? `Your verified payouts in FUNDEDCITY: <b>${usd(me.payouts)}</b> (${esc(me.name)}).` : 'Guests don’t have verified payouts yet.'}</p>
            ${me ? '<button class="btn btn-gold" id="gc-check">Check my payouts</button>' : '<button class="btn btn-gold" id="gc-signup">Sign up as a member</button>'}
          </article>
          <article class="gc-option">
            <h4>I represent a prop firm</h4>
            <form class="bk-form gc-firm" id="gc-firm">
              <label>Firm<select name="firm" required>${d.firms.map((f) => `<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('')}</select></label>
              <label>Role<select name="role"><option value="ceo">CEO / founder</option><option value="marketing">Marketing & partnerships</option></select></label>
              <label class="gc-check"><input type="checkbox" name="ok" required /> I work for this firm in this role</label>
              <div class="bk-actions"><button class="btn btn-gold" type="submit">Request firm pass</button></div>
            </form>
          </article>`}
        </section>
      </div>`;
    body.querySelector('#gc-check')?.addEventListener('click', () => {
      const m = d.myVerifiedPayouts();
      if (!m) return;
      if (m.payouts >= 100_000) {
        setPass({ kind: 'trader', payouts: m.payouts, since: Date.now() });
        msg = `Welcome to the club: ${usd(m.payouts)} in verified payouts.`;
        reason = '';
      } else msg = `Not yet: ${usd(m.payouts)} verified, ${usd(100_000 - m.payouts)} to go. See you on the course soon.`;
      renderGate();
    });
    body.querySelector('#gc-signup')?.addEventListener('click', () => { close(); d.onSignup(); });
    body.querySelector<HTMLFormElement>('#gc-firm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target as HTMLFormElement);
      const firm = d.firms.find((x) => x.id === f.get('firm'));
      const role = f.get('role') === 'marketing' ? 'marketing' : 'ceo';
      if (!firm) return;
      setPass({ kind: role, firmId: firm.id, firmName: firm.name, since: Date.now() });
      msg = `Firm pass issued: ${PASS_LABEL[role]} · ${firm.name} (unverified). You can also publish tournaments at the Liquidation Arena.`;
      reason = '';
      renderGate();
    });
    body.querySelector('#gc-walk')?.addEventListener('click', () => { close(); d.onWalkIn(); });
    body.querySelector('#gc-lounge')?.addEventListener('click', () => { close(); lounge.open(); });
    body.querySelector('#gc-revoke')?.addEventListener('click', () => { setPass(null); msg = 'Pass handed back.'; renderGate(); });
    msg = '';
  }

  function renderMembers() {
    const ms = d.members();
    const p = getPass();
    body.innerHTML = `
      ${p ? `<div class="gc-pass-actions gc-top"><button class="btn btn-gold" id="gc-lounge2">Open the members’ lounge</button><button class="btn btn-ghost" id="gc-walk2">Walk to the members’ lawn</button></div>` : ''}
      <div class="gc-cols">
        <section>
          <h3>100K+ traders <span class="gc-count">${ms.length}</span></h3>
          <ol class="gc-list">${ms.map((m, i) => `<li><span class="rk">${i + 1}</span><b>${esc(m.name)}</b><em>${usd(m.payouts)}</em></li>`).join('')}</ol>
        </section>
        <section>
          <h3>Firm teams on the lawn <span class="gc-count">${d.firms.length}</span></h3>
          <ul class="gc-list firms">${d.firms.map((f) => `<li><b>${esc(f.name)}</b><em>CEO · Marketing</em></li>`).join('')}</ul>
          <p class="bk-fine">Figures on the lawn represent each firm’s CEO and marketing team (illustrative, not named individuals).</p>
        </section>
      </div>`;
    body.querySelector('#gc-lounge2')?.addEventListener('click', () => { close(); lounge.open(); });
    body.querySelector('#gc-walk2')?.addEventListener('click', () => { close(); d.onWalkIn(); });
  }

  function render() {
    tabs.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    if (tab === 'gate') renderGate();
    else renderMembers();
  }
  function show(t: GolfTab) { tab = t; render(); }
  function open(t: GolfTab = 'gate', why = '') {
    reason = why;
    overlay.hidden = false;
    document.body.classList.add('media-open');
    show(t);
  }
  function close() {
    overlay.hidden = true;
    document.body.classList.remove('media-open');
  }
  const isOpen = () => !overlay.hidden;
  onPass(() => { if (isOpen()) render(); });
  return { open, close, isOpen, lounge };
}
