// BANK OF GAINS: ranks every max single payout in the city and every trader's total verified payouts,
// and publishes the rules: free registration, tower levels, crowns and how payouts are verified.
// Verified single payouts come from registered traders' profiles. Earlier self-reported entries
// (`bank/<id>`) still show, marked as self-reported.
import { getCloud, type Cloud } from './cloud';
import { FIRMS } from './firms';
import { LEVEL_BANDS, CROWN_BANDS, towerTitle, SECTOR_LABEL, type Trader } from './data';

export interface BankPanel {
  open: (tab?: BankTab) => void;
  close: () => void;
  isOpen: () => boolean;
  onTop: (fn: (label: string) => void) => void;
}
export type BankTab = 'single' | 'total' | 'rules';

interface Entry { key: string; name: string; amount: number; firm: string; date: string; source: 'city' | 'submitted' | 'verified'; mine: boolean }
interface Extra {
  verifiedSingles: () => Array<Omit<Entry, 'source'>>;
  onUpload: () => void;
}

const esc = (v: string) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const usd = (n: number) => '$' + Math.round(n).toLocaleString('en-US');
const LOCAL_KEY = 'fundedcity-bank-local';
const CLOSE = '<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const FIRM_NAMES = [...new Set(FIRMS.map((f) => f.name))].sort();

/** Each mock city trader's largest single payout (deterministic, ≤ their total). */
function cityMaxSingle(t: Trader): Entry {
  const seed = [...t.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const avg = t.payouts / Math.max(1, t.payoutCount);
  const amount = Math.min(t.payouts, Math.round((avg * (1.6 + (seed % 9) / 10)) / 10) * 10);
  const firm = FIRM_NAMES[seed % FIRM_NAMES.length];
  const month = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct'][seed % 5];
  return { key: 'city:' + t.id, name: t.name, amount, firm, date: `${month} 2026`, source: 'city', mine: false };
}

export function createBankPanel(root: HTMLElement, getTraders: () => Trader[], getName: () => string | null, x: Extra): BankPanel {
  void getName;
  root.insertAdjacentHTML(
    'beforeend',
    `<div class="media-overlay bank-overlay" id="bk-overlay" hidden>
      <section class="media-panel bank-panel" role="dialog" aria-modal="true" aria-labelledby="bk-title">
        <header class="mp-head">
          <div class="mp-title"><span class="mp-eyebrow bk-eyebrow">CAPITAL SQUARE · EAST</span><h2 id="bk-title">Bank of Gains</h2></div>
          <nav class="mp-tabs" role="tablist">
            <button role="tab" data-tab="single">Max single payout</button>
            <button role="tab" data-tab="total">Total payouts</button>
            <button role="tab" data-tab="rules">Rules · build your tower</button>
          </nav>
          <button class="icon-btn sq mp-close" id="bk-close" aria-label="Close bank">${CLOSE}</button>
        </header>
        <div class="mp-body" id="bk-body"></div>
        <footer class="mp-foot"><span class="mp-feed" id="bk-note"></span></footer>
      </section>
    </div>`,
  );
  const overlay = root.querySelector<HTMLElement>('#bk-overlay')!;
  const body = overlay.querySelector<HTMLElement>('#bk-body')!;
  const note = overlay.querySelector<HTMLElement>('#bk-note')!;
  const tabs = [...overlay.querySelectorAll<HTMLButtonElement>('.mp-tabs button')];
  overlay.querySelector('#bk-close')!.addEventListener('click', () => close());
  overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) close(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) close(); });
  tabs.forEach((b) => b.addEventListener('click', () => show(b.dataset.tab as BankTab)));

  let tab: BankTab = 'single';
  let cloud: Cloud | null = null;
  let submitted: Entry[] = [];

  let flash = '';
  const topFns: Array<(label: string) => void> = [];

  const ranking = () => [
    ...getTraders().filter((t) => t.demo).map(cityMaxSingle),
    ...x.verifiedSingles().map((e) => ({ ...e, source: 'verified' as const })),
    ...submitted,
  ].sort((a, b) => b.amount - a.amount);
  const emitTop = () => {
    const top = ranking()[0];
    for (const f of topFns) f(top ? `${usd(top.amount)} · ${top.name}` : '—');
  };

  function applyDocs(docs: Array<{ id: string; data: Record<string, unknown> }>, uid: string | null) {
    const out: Entry[] = [];

    for (const d of docs) {
      const a = Number(d.data.amount);
      if (!Number.isFinite(a) || a < 1 || a > 10_000_000) continue;
      const e: Entry = {
        key: 'sub:' + d.id,
        name: String(d.data.name ?? 'Trader').slice(0, 24),
        amount: Math.round(a),
        firm: String(d.data.firm ?? '').slice(0, 40),
        date: String(d.data.date ?? '').slice(0, 10),
        source: 'submitted',
        mine: d.id === uid,
      };
      out.push(e);

    }
    submitted = out;
    emitTop();
    if (isOpen()) render();
  }

  async function connect() {
    cloud = await getCloud();

    if (cloud) {
      cloud.db.collection('bank').limit(1000).onSnapshot(
        (snap: { docs: Array<{ id: string; data(): Record<string, unknown> | undefined }> }) => applyDocs(snap.docs.map((d) => ({ id: d.id, data: d.data() ?? {} })), cloud!.uid),
        () => { /* keep the last view */ },
      );
    } else {
      try {
        const v = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? 'null');
        if (v && typeof v === 'object') applyDocs([{ id: 'me', data: v }], 'me');
      } catch { /* ignore */ }
      emitTop();
    }
  }
  const ready = connect();

  const table = (rows: Entry[], rankOf: (e: Entry) => number) => `
    <table class="bk-table">
      <thead><tr><th>#</th><th>Trader</th><th>Max single payout</th><th>Firm</th><th>Date</th><th></th></tr></thead>
      <tbody>${rows.map((e) => `<tr class="${e.mine ? 'mine' : ''}">
        <td class="rk">${rankOf(e)}</td>
        <td><b>${esc(e.name)}</b>${e.mine ? ' <em class="you">you</em>' : ''}</td>
        <td class="amt">${usd(e.amount)}</td>
        <td>${esc(e.firm || '—')}</td>
        <td>${esc(e.date || '—')}</td>
        <td><span class="bk-tag ${e.source}">${e.source === 'city' ? 'Demo data' : e.source === 'verified' ? 'Verified' : 'Self-reported'}</span></td>
      </tr>`).join('')}</tbody>
    </table>`;

  function render() {
    const rank = ranking();
    const rankOf = (e: Entry) => rank.indexOf(e) + 1;
    if (tab === 'single') {
      const mineE = rank.find((e) => e.mine && e.source === 'verified') ?? rank.find((e) => e.mine);
      const mineRank = mineE ? rank.indexOf(mineE) + 1 : 0;
      body.innerHTML = `
        ${flash ? `<div class="bk-flash">${flash}</div>` : ''}
        <div class="bk-hero">
          <div><span>#1 max single payout</span><b>${rank[0] ? usd(rank[0].amount) : '—'}</b><em>${rank[0] ? esc(rank[0].name) : ''}</em></div>
          <div><span>Entries ranked</span><b>${rank.length}</b><em>${rank.filter((e) => e.source === 'verified').length} verified by FUNDEDCITY checks</em></div>
          <div><span>Your best</span><b>${mineRank ? '#' + mineRank : '—'}</b><em>${mineE ? usd(mineE.amount) : '<button class="linkish" id="bk-up">Upload & verify a payout</button>'}</em></div>
        </div>
        <div class="bk-wrap">${table(rank, rankOf)}</div>`;
      body.querySelector('#bk-up')?.addEventListener('click', () => { close(); x.onUpload(); });
    } else if (tab === 'total') {
      const traders = [...getTraders()].sort((a, b) => b.payouts - a.payouts);
      body.innerHTML = `
        <div class="bk-wrap"><table class="bk-table">
          <thead><tr><th>#</th><th>Trader</th><th>Total verified payouts</th><th>Payouts</th><th>Sector</th><th>Tower</th></tr></thead>
          <tbody>${traders.map((t, i) => `<tr class="${t.mine ? 'mine' : ''}"><td class="rk">${i + 1}</td><td><b>${esc(t.name)}</b>${t.mine ? ' <em class="you">you</em>' : ''}${t.demo ? ' <span class="bk-tag city">Demo</span>' : ''}</td><td class="amt">${usd(t.payouts)}</td><td>${t.payoutCount}</td><td>${SECTOR_LABEL[t.sector]}</td><td>${esc(towerTitle(t.payouts))}</td></tr>`).join('')}</tbody>
        </table></div>`;
    } else {
      body.innerHTML = rulesHTML();
      body.querySelector('#bk-start')!.addEventListener('click', () => { close(); x.onUpload(); });
    }
  }

  function rulesHTML() {
    const band = (min: number, max: number) => (max === Infinity ? `${usd(min)} and above` : `${usd(min)} to ${usd(max)}`);
    return `
      <div class="bk-rules">
        <section class="bk-free">
          <h3>Free for every trader</h3>
          <p>Register and start building now: <b>no subscription, no fees</b>. Create your character, sign up, fill in your trader profile and upload your payouts. Your building goes up in the city straight away.</p>
          <button class="btn btn-gold" id="bk-start">Build my tower</button>
        </section>
        <section>
          <h3>1 · Your profile</h3>
          <ul>
            <li>Full name, country, what you trade (CFD, Futures, Perps or Multi-Assets), current funded allocation, your payouts so far, and the prop firms you’ve traded with.</li>
            <li>Optional: website, Discord, YouTube, Facebook, X, Instagram, Telegram, WhatsApp, and services you offer (courses, mentoring, communities).</li>
            <li>Email and phone are <b>private</b>: they’re never shown on your building.</li>
          </ul>
        </section>
        <section>
          <h3>2 · Your building</h3>
          <ul>
            <li><b>No verified payout yet:</b> you get a house in Brooklyn, across the Rat Race Exit Bridge.</li>
            <li><b>Verified payouts:</b> you get a tower in your sector, with your name on it. Only verified payouts count, never the estimate on your profile.</li>
            <li>Your tower total is the larger of your best verified <b>lifetime-total</b> certificate and the sum of your verified <b>single</b> payouts.</li>
          </ul>
          <div class="bk-wrap"><table class="bk-table bk-levels">
            <thead><tr><th>Tower</th><th>Verified payouts</th><th>Building</th></tr></thead>
            <tbody>
              ${LEVEL_BANDS.map((b) => `<tr><td class="rk">Level ${b.level}</td><td class="amt">${band(b.min, b.max)}</td><td>${esc(b.name)}</td></tr>`).join('')}
              ${CROWN_BANDS.map((b) => `<tr class="crown"><td class="rk"><i class="bk-crown" style="--c:${b.color}"></i>${esc(b.label)}</td><td class="amt">${band(b.min, b.max)}</td><td>Level 10 tower crowned in ${esc(b.label.split(' ')[0].toLowerCase())}</td></tr>`).join('')}
            </tbody>
          </table></div>
          <p class="bk-fine">A band includes its lower figure: exactly $10,000 is Level 2, exactly $2,000,000 is a Bronze Crown.</p>
        </section>
        <section>
          <h3>3 · How payouts are verified</h3>
          <ul>
            <li>Upload <b>single payouts</b> one by one, or one <b>lifetime-total</b> certificate. Use an image (JPG, PNG or WebP).</li>
            <li><b>With a QR code or barcode:</b> the code is read automatically. If it links to the prop firm’s official website, the payout is <b>verified</b>. If it links anywhere else, it’s <b>rejected</b>.</li>
            <li><b>No code:</b> attach the <b>bank transfer</b> (or payment provider) proof. It must show the same amount (allowing up to 10% for transfer fees), and the payout is verified when it matches.</li>
            <li>Claude reads every document: the amount must match what you entered, the firm must match, the name should match your profile, and edited-looking documents are rejected.</li>
            <li>Each document can be used once. Amounts are in US dollars.</li>
            <li><b>Pending</b> means a check couldn’t run yet (for example the bank proof wasn’t attached). Pending payouts don’t count until they’re verified.</li>
            <li>Your documents are checked on your device and are <b>never stored or shared</b>: only the result and the list of checks are saved.</li>
          </ul>
          <p class="bk-fine">These checks run automatically and catch mismatches, wrong links and reused documents. They can’t confirm a payout with the prop firm itself, so FUNDEDCITY may ask for more proof before anything official.</p>
        </section>
      </div>`;
  }

  function setNote() {
    note.innerHTML = cloud
      ? 'Rankings are shared with everyone who can open this city. “Verified” payouts passed FUNDEDCITY’s checks; “Demo data” rows are the sample traders that ship with the city.'
      : 'Preview: shared rankings open at launch. “Demo data” rows are the sample traders that ship with the city.';
  }
  function show(t: BankTab) {
    tab = t;
    tabs.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
    render();
    if (t !== 'single') flash = '';
  }
  function open(t: BankTab = tab) {
    overlay.hidden = false;
    document.body.classList.add('media-open');
    void ready.then(() => { setNote(); show(t); });
  }
  function close() {
    overlay.hidden = true;
    flash = '';
    document.body.classList.remove('media-open');
  }
  const isOpen = () => !overlay.hidden;
  return { open, close, isOpen, onTop: (fn) => { topFns.push(fn); void ready.then(emitTop); } };
}
