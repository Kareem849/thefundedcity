// Trader profile: who you are (public), how to reach you (private), your payouts (uploaded, checked
// and verified), and what that builds in the city: a Brooklyn house, or a tower from Level 1 to 10 and
// then crowns. Free to join, no subscription.
import { FIRMS } from './firms';
import {
  SECTOR_LABEL, LINK_LABEL, LEVEL_BANDS, CROWN_BANDS, levelFor, crownFor, crownBand, levelProgress, verifiedTotal, towerTitle,
  type TraderProfilePublic, type SectorId, type LinkKey, type PayoutRecord,
} from './data';
import type { ProfileStore } from './profile';
import { verifyPayout, scanCode, isImage, aiAvailable, type Step } from './verify';

export type ProfileTab = 'profile' | 'payouts' | 'tower';
export interface ProfilePanel {
  open: (tab?: ProfileTab, onboarding?: boolean) => void;
  close: () => void;
  isOpen: () => boolean;
}
interface Deps {
  store: ProfileStore;
  isMember: () => boolean;
  characterName: () => string | null;
  onSignup: () => void;
  openRules: () => void;
  walkHome: () => void;
  /** after a save: the city rebuilds; `newlyVerified` drives the payout animation */
  onSaved: (p: TraderProfilePublic, newlyVerified: number) => void;
}

const esc = (v: string) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const usd = (n: number) => '$' + Math.round(n).toLocaleString('en-US');
const CLOSE = '<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const SECTORS: SectorId[] = ['cfd', 'futures', 'perps', 'multi'];
const FIRM_LIST = [...new Map(FIRMS.map((f) => [f.name, f])).values()].sort((a, b) => a.name.localeCompare(b.name));
const ISO = 'AE AF AL AM AO AR AT AU AZ BA BD BE BG BH BO BR BY CA CH CI CL CM CN CO CR CY CZ DE DK DO DZ EC EE EG ES ET FI FR GB GE GH GR GT HK HN HR HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KR KW KZ LB LK LT LU LV LY MA MD ME MK MM MN MT MU MX MY NG NI NL NO NP NZ OM PA PE PH PK PL PR PS PT PY QA RO RS RU RW SA SD SE SG SI SK SN SV SY TH TN TR TT TW TZ UA UG US UY UZ VE VN YE ZA ZM ZW'.split(' ');
const COUNTRIES = (() => {
  try {
    const dn = new Intl.DisplayNames(['en'], { type: 'region' });
    return ISO.map((c) => dn.of(c) ?? c).sort();
  } catch { return ISO; }
})();
const LINK_HINT: Record<LinkKey, string> = {
  website: 'https://yoursite.com', discord: 'Invite link or code', youtube: '@channel or link', facebook: 'Page name or link', x: '@handle', instagram: '@handle', telegram: '@channel or t.me link', whatsapp: 'Number with country code',
};
const STATUS_LABEL = { verified: 'Verified', rejected: 'Rejected', pending: 'Pending' } as const;

export function createProfilePanel(root: HTMLElement, d: Deps): ProfilePanel {
  root.insertAdjacentHTML(
    'beforeend',
    `<div class="media-overlay tp-overlay" id="tp-overlay" hidden>
      <section class="media-panel tp-panel" role="dialog" aria-modal="true" aria-labelledby="tp-title">
        <header class="mp-head">
          <div class="mp-title"><span class="mp-eyebrow tp-eyebrow">FREE TO JOIN · NO SUBSCRIPTION</span><h2 id="tp-title">Your trader profile</h2></div>
          <nav class="mp-tabs" role="tablist">
            <button role="tab" data-tab="profile">1 · Profile</button>
            <button role="tab" data-tab="payouts">2 · Payouts</button>
            <button role="tab" data-tab="tower">3 · Your building</button>
          </nav>
          <button class="icon-btn sq mp-close" id="tp-close" aria-label="Close">${CLOSE}</button>
        </header>
        <div class="mp-body" id="tp-body"></div>
        <footer class="mp-foot"><span class="mp-feed" id="tp-note"></span></footer>
      </section>
    </div>
    <datalist id="tp-countries">${COUNTRIES.map((c) => `<option value="${esc(c)}"></option>`).join('')}</datalist>`,
  );
  const overlay = root.querySelector<HTMLElement>('#tp-overlay')!;
  const body = overlay.querySelector<HTMLElement>('#tp-body')!;
  const note = overlay.querySelector<HTMLElement>('#tp-note')!;
  const tabs = [...overlay.querySelectorAll<HTMLButtonElement>('.mp-tabs button')];
  overlay.querySelector('#tp-close')!.addEventListener('click', () => close());
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen() && !busy) close(); });
  tabs.forEach((b) => b.addEventListener('click', () => { if (!busy) show(b.dataset.tab as ProfileTab); }));

  let tab: ProfileTab = 'profile';
  let onboarding = false;
  let flash = '';
  let busy = false;

  const blank = (): TraderProfilePublic => ({
    uid: d.store.uid, fullName: '', towerName: d.characterName() ?? '', sector: 'multi', allocation: 0, claimedPayouts: 0, country: '',
    firms: [], links: {}, services: '', allowVisitors: false, payouts: [], joined: Date.now(), updatedAt: 0,
  });

  const setNote = () => {
    note.innerHTML = d.store.shared
      ? 'Your profile, tower and payout results are visible to everyone who can open this city. <b>Email and phone stay private</b>. Payout documents are checked on your device and never stored.'
      : 'Preview: your profile stays in this browser until shared accounts open at launch. Payout documents are never stored.';
  };

  /* ---------------- gate: members only ---------------- */
  function renderGate() {
    body.innerHTML = `<div class="tp-gate">
      <h3>Build your tower for free</h3>
      <p>Guests can walk the city. To get a house or a tower with your name on it, sign up (free, no subscription), then fill in your trader profile and upload your payouts.</p>
      <button class="btn btn-gold" id="tp-signup">Sign up free</button>
    </div>`;
    body.querySelector('#tp-signup')!.addEventListener('click', () => { close(); d.onSignup(); });
  }

  /* ---------------- 1. profile ---------------- */
  async function renderProfile() {
    const p = d.store.mine() ?? blank();
    const contact = (await d.store.getContact()) ?? { email: '', phone: '' };
    if (tab !== 'profile') return;
    const firmsSet = new Set(p.firms);
    const otherFirms = p.firms.filter((f) => !FIRM_LIST.some((x) => x.name === f)).join(', ');
    body.innerHTML = `
      ${flash ? `<div class="bk-flash">${esc(flash)}</div>` : ''}
      ${onboarding ? '<p class="tp-lead">Tell the city who you are. Your tower is built from <b>verified payouts only</b>: you’ll upload them in step 2. No payouts yet? You get a house in Brooklyn until your first one.</p>' : ''}
      <form class="tp-form" id="tp-form" novalidate>
        <fieldset><legend>About you</legend>
          <label>Full name<input name="fullName" required maxlength="60" autocomplete="name" value="${esc(p.fullName)}" /></label>
          <label>Name on your tower<input name="towerName" maxlength="28" placeholder="Defaults to your full name" value="${esc(p.towerName === p.fullName ? '' : p.towerName)}" /></label>
          <label>Country<input name="country" required list="tp-countries" maxlength="48" autocomplete="country-name" value="${esc(p.country)}" /></label>
          <div class="tp-field wide"><span>What do you trade?</span>
            <div class="tp-seg" role="radiogroup">${SECTORS.map((s) => `<label><input type="radio" name="sector" value="${s}" ${p.sector === s ? 'checked' : ''} /><span>${SECTOR_LABEL[s]}</span></label>`).join('')}</div>
          </div>
          <label>Current funded allocation (USD)<input name="allocation" inputmode="numeric" placeholder="e.g. 400000" value="${p.allocation || ''}" /></label>
          <label>Total payouts so far (USD, your estimate)<input name="claimed" inputmode="numeric" placeholder="0 if none yet" value="${p.claimedPayouts || ''}" /></label>
        </fieldset>
        <fieldset><legend>Contact <em>private: never shown on your tower</em></legend>
          <label>Email<input name="email" type="email" required maxlength="120" autocomplete="email" value="${esc(contact.email)}" /></label>
          <label>Phone<input name="phone" type="tel" maxlength="40" autocomplete="tel" placeholder="+351 …" value="${esc(contact.phone)}" /></label>
        </fieldset>
        <fieldset><legend>Prop firms you’ve traded with</legend>
          <div class="tp-firms">${FIRM_LIST.map((f) => `<label><input type="checkbox" name="firm" value="${esc(f.name)}" ${firmsSet.has(f.name) ? 'checked' : ''} /><span>${esc(f.name)}</span></label>`).join('')}</div>
          <label class="wide">Other firms<input name="otherFirms" maxlength="160" placeholder="Comma-separated" value="${esc(otherFirms)}" /></label>
        </fieldset>
        <fieldset><legend>Links <em>public, optional</em></legend>
          ${(Object.keys(LINK_LABEL) as LinkKey[]).map((k) => `<label>${LINK_LABEL[k]}<input name="link-${k}" maxlength="160" placeholder="${esc(LINK_HINT[k])}" value="${esc(p.links[k] ?? '')}" /></label>`).join('')}
        </fieldset>
        <fieldset><legend>Services you offer <em>public, optional</em></legend>
          <label class="wide">Courses, mentoring, communities, tools…<textarea name="services" maxlength="400" rows="3" placeholder="e.g. NAS100 scalping course, weekly live sessions, free Discord">${esc(p.services)}</textarea></label>
        </fieldset>
        <label class="tp-consent wide"><input type="checkbox" name="visitors" ${p.allowVisitors ? 'checked' : ''} /> Let other traders visit inside my tower or house (you can always go in yourself)</label>
        <label class="tp-consent wide"><input type="checkbox" name="consent" ${p.updatedAt ? 'checked' : ''} required /> Show my profile (not my email or phone) on my building in FUNDEDCITY</label>
        <div class="bk-actions"><button class="btn btn-gold" type="submit">${onboarding ? 'Save and continue' : 'Save profile'}</button><span id="tp-msg" role="status"></span></div>
      </form>`;
    const form = body.querySelector<HTMLFormElement>('#tp-form')!;
    const msg = body.querySelector<HTMLElement>('#tp-msg')!;
    if (d.store.readOnly) { form.querySelectorAll('input,textarea,button').forEach((el) => ((el as HTMLInputElement).disabled = true)); msg.textContent = 'View-only access: ask the owner for Contributor access to register.'; }
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(form);
      const s = (k: string) => String(f.get(k) ?? '').trim();
      const money = (k: string) => { const n = Math.round(Number(s(k).replace(/[^0-9.]/g, ''))); return Number.isFinite(n) ? Math.min(n, 1e9) : 0; };
      const fail = (m: string, field?: string) => { msg.textContent = m; if (field) form.querySelector<HTMLElement>(`[name="${field}"]`)?.focus(); };
      if (!s('fullName')) return fail('Enter your full name.', 'fullName');
      if (!s('country')) return fail('Enter your country.', 'country');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s('email'))) return fail('Enter a valid email address.', 'email');
      if (!f.get('consent')) return fail('Tick the box to show your profile on your building.');
      const links: Partial<Record<LinkKey, string>> = {};
      for (const k of Object.keys(LINK_LABEL) as LinkKey[]) { const v = s('link-' + k); if (v) links[k] = v; }
      const firms = [...f.getAll('firm').map(String), ...s('otherFirms').split(',').map((x) => x.trim()).filter(Boolean)].slice(0, 30);
      const prev = d.store.mine();
      const next: TraderProfilePublic = {
        ...(prev ?? blank()),
        fullName: s('fullName'), towerName: s('towerName') || s('fullName'), country: s('country'),
        sector: (SECTORS.includes(s('sector') as SectorId) ? s('sector') : 'multi') as SectorId,
        allocation: money('allocation'), claimedPayouts: money('claimed'), firms, links, services: s('services'), allowVisitors: !!f.get('visitors'),
      };
      const btn = form.querySelector<HTMLButtonElement>('button[type=submit]')!;
      btn.disabled = true;
      msg.textContent = 'Saving…';
      try {
        await d.store.save(next);
        await d.store.saveContact({ email: s('email'), phone: s('phone') });
        d.onSaved(d.store.mine() ?? next, 0);
        flash = prev ? 'Profile saved.' : 'Profile saved. Your building is ready in the city.';
        show(onboarding ? (next.claimedPayouts > 0 ? 'payouts' : 'tower') : 'profile');
      } catch (err) {
        const code = (err as { code?: string })?.code;
        msg.textContent = code === 'invalid_argument' ? 'Your access level can’t save here. Ask the owner for Contributor access.' : 'Couldn’t save just now. Try again in a moment.';
        btn.disabled = false;
      }
    });
  }

  /* ---------------- 2. payouts ---------------- */
  const stepIcon: Record<Step['state'], string> = { run: '<i class="tp-spin"></i>', ok: '✓', fail: '✕', warn: '!', skip: '–' };
  const recordHTML = (r: PayoutRecord) => `
    <li class="tp-rec ${r.status}">
      <div class="tp-rec-main"><b>${usd(r.amount)}</b><span>${r.kind === 'lifetime' ? 'Lifetime total' : 'Single payout'} · ${esc(r.firm)}${r.date ? ' · ' + esc(r.date) : ''} · ${r.method === 'code' ? 'QR / barcode' : 'Bank proof'}</span></div>
      <span class="tp-chip ${r.status}">${STATUS_LABEL[r.status]}</span>
      <details><summary>Checks</summary><ul>${r.checks.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></details>
      <button class="btn btn-ghost tp-del" data-del="${esc(r.id)}" type="button">Remove</button>
    </li>`;

  async function renderPayouts() {
    const p = d.store.mine();
    if (!p) {
      body.innerHTML = '<div class="tp-gate"><h3>Fill in your profile first</h3><p>Your payouts are matched against your full name and firms.</p><button class="btn btn-gold" id="tp-go-prof">Go to profile</button></div>';
      body.querySelector('#tp-go-prof')!.addEventListener('click', () => show('profile'));
      return;
    }
    const total = verifiedTotal(p);
    const lp = levelProgress(total);
    const canAI = await aiAvailable();
    if (tab !== 'payouts') return;
    const today = new Date().toISOString().slice(0, 10);
    body.innerHTML = `
      ${flash ? `<div class="bk-flash">${esc(flash)}</div>` : ''}
      <div class="tp-summary">
        <div><span>Verified payouts</span><b>${usd(total)}</b><em>${p.payouts.filter((r) => r.status === 'verified').length} verified · ${p.payouts.filter((r) => r.status === 'pending').length} pending</em></div>
        <div><span>Your building</span><b>${esc(towerTitle(total))}</b><em>${lp.nextLabel ? `${esc(lp.nextLabel)} at ${usd(lp.nextAt)}` : 'Top tier reached'}</em></div>
        <div class="tp-bar"><i style="width:${lp.pct}%"></i></div>
      </div>
      <div class="tp-cols">
        <form class="tp-form tp-upload" id="tp-up" novalidate>
          <h3>Upload a payout</h3>
          <div class="tp-seg" role="radiogroup">
            <label><input type="radio" name="kind" value="single" checked /><span>Single payout</span></label>
            <label><input type="radio" name="kind" value="lifetime" /><span>Lifetime total</span></label>
          </div>
          <label>Prop firm<select name="firm" required><option value="">Choose…</option>${FIRM_LIST.map((f) => `<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('')}<option value="other">Other firm</option></select></label>
          <label class="tp-other" hidden>Firm name<input name="otherFirm" maxlength="48" /></label>
          <label>Amount (USD)<input name="amount" inputmode="decimal" required placeholder="e.g. 12500" /></label>
          <label>Payout date<input name="date" type="date" max="${today}" /></label>
          <label class="wide">Payout certificate or screenshot<input name="doc" type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" required /></label>
          <div class="tp-scan wide" id="tp-scan" hidden></div>
          <label class="wide tp-bankf" hidden>Bank transfer proof (needed when there’s no code)<input name="bank" type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" /></label>
          <label class="tp-consent wide"><input type="checkbox" name="mine" required /> This is my payout and the document is genuine</label>
          <div class="bk-actions"><button class="btn btn-gold" type="submit">Check and verify</button><span id="tp-umsg" role="status"></span></div>
          <ol class="tp-steps" id="tp-steps" hidden></ol>
          <p class="bk-fine">${canAI ? 'Claude reads your documents to match amount, firm, date and name.' : 'Preview: AI document reading opens at launch; for now only the code check runs, and bank proofs stay pending.'} Documents are checked on your device and are never stored.</p>
        </form>
        <section class="tp-list">
          <h3>Your payouts</h3>
          ${p.payouts.length ? `<ul>${[...p.payouts].sort((a, b) => b.at - a.at).map(recordHTML).join('')}</ul>` : '<p class="tn-empty">Nothing uploaded yet.</p>'}
          <button class="btn btn-ghost" type="button" id="tp-rules">How verification works</button>
        </section>
      </div>`;
    flash = '';
    body.querySelector('#tp-rules')!.addEventListener('click', () => { close(); d.openRules(); });
    body.querySelectorAll<HTMLButtonElement>('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      const cur = d.store.mine();
      if (!cur || busy) return;
      const before = verifiedTotal(cur);
      const next = { ...cur, payouts: cur.payouts.filter((r) => r.id !== b.dataset.del) };
      await d.store.save(next);
      d.onSaved(d.store.mine() ?? next, verifiedTotal(next) - before);
      flash = 'Removed.';
      renderPayouts();
    }));
    const form = body.querySelector<HTMLFormElement>('#tp-up')!;
    const msg = body.querySelector<HTMLElement>('#tp-umsg')!;
    const scanBox = body.querySelector<HTMLElement>('#tp-scan')!;
    const bankField = body.querySelector<HTMLElement>('.tp-bankf')!;
    const firmSel = form.querySelector<HTMLSelectElement>('[name=firm]')!;
    const docIn = form.querySelector<HTMLInputElement>('[name=doc]')!;
    firmSel.addEventListener('change', () => { form.querySelector<HTMLElement>('.tp-other')!.hidden = firmSel.value !== 'other'; void preScan(); });
    docIn.addEventListener('change', () => void preScan());
    // read the code as soon as a document is picked, so the trader knows whether a bank proof is needed
    let scanSeq = 0;
    async function preScan() {
      const file = docIn.files?.[0];
      if (!file) { scanBox.hidden = true; return; }
      const seq = ++scanSeq;
      scanBox.hidden = false;
      scanBox.className = 'tp-scan wide';
      scanBox.textContent = 'Looking for a QR code or barcode…';
      const r = await scanCode(file, firmSel.value);
      if (seq !== scanSeq) return;
      const needBank = r.kind !== 'link-ok';
      bankField.hidden = !needBank;
      scanBox.classList.add(r.kind === 'link-ok' ? 'ok' : r.kind === 'link-bad' && r.firmHost ? 'bad' : 'warn');
      scanBox.textContent =
        r.kind === 'link-ok' ? `Code found: links to ${r.host}, the firm’s official site. No bank proof needed.`
        : r.kind === 'link-bad' ? (r.firmHost ? `Code links to ${r.host}, not ${r.firmHost}: this payout will be rejected.` : `Code links to ${r.host}. Choose the firm, or attach the bank transfer proof.`)
        : r.kind === 'no-link' ? 'A code was found, but it holds no web link. Attach the bank transfer proof.'
        : r.kind === 'none' ? 'No code found on this document. Attach the bank transfer proof.'
        : isImage(file) ? 'This browser can’t read codes. Attach the bank transfer proof.' : 'PDFs can’t be scanned for codes. Upload an image, or attach the bank transfer proof.';
    }
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (busy) return;
      const f = new FormData(form);
      const cur = d.store.mine();
      if (!cur) return;
      const firmId = String(f.get('firm') ?? '');
      const firmName = firmId === 'other' ? String(f.get('otherFirm') ?? '').trim() : FIRM_LIST.find((x) => x.id === firmId)?.name ?? '';
      const amount = Math.round(Number(String(f.get('amount') ?? '').replace(/[^0-9.]/g, '')));
      const doc = docIn.files?.[0] ?? null;
      const bank = form.querySelector<HTMLInputElement>('[name=bank]')!.files?.[0] ?? null;
      if (!firmName) { msg.textContent = 'Choose the prop firm.'; return; }
      if (!(amount >= 1 && amount <= 100_000_000)) { msg.textContent = 'Enter the amount in USD.'; return; }
      if (!doc) { msg.textContent = 'Attach the payout document.'; return; }
      if (doc.size > 20e6 || (bank && bank.size > 20e6)) { msg.textContent = 'Files must be under 20 MB.'; return; }
      if (!f.get('mine')) { msg.textContent = 'Confirm this is your payout.'; return; }
      busy = true;
      msg.textContent = '';
      form.querySelectorAll('input,select,button').forEach((el) => ((el as HTMLInputElement).disabled = true));
      const list = body.querySelector<HTMLOListElement>('#tp-steps')!;
      list.hidden = false;
      const res = await verifyPayout({
        kind: f.get('kind') === 'lifetime' ? 'lifetime' : 'single', amount, firmId, firmName, date: String(f.get('date') ?? ''),
        fullName: cur.fullName, doc, bank, usedHashes: cur.payouts.filter((r) => r.status !== 'rejected').map((r) => r.hash ?? '').filter(Boolean),
      }, (steps) => {
        list.innerHTML = steps.map((s) => `<li class="${s.state}"><span>${stepIcon[s.state]}</span>${esc(s.label)}</li>`).join('');
      });
      const rec: PayoutRecord = {
        id: Math.random().toString(36).slice(2, 10), kind: f.get('kind') === 'lifetime' ? 'lifetime' : 'single', amount, firm: firmName,
        date: String(f.get('date') ?? ''), method: res.method, status: res.status, checks: res.checks, at: Date.now(), hash: res.hash,
      };
      const before = verifiedTotal(cur);
      const next = { ...cur, payouts: [rec, ...cur.payouts].slice(0, 60) };
      try {
        await d.store.save(next);
        const after = verifiedTotal(next);
        d.onSaved(d.store.mine() ?? next, after - before);
        flash = res.status === 'verified'
          ? `Verified: ${usd(amount)} from ${firmName}. ${after > before ? `Your building is now ${towerTitle(after)}.` : 'Your lifetime total already covers it.'}`
          : res.status === 'rejected' ? `Rejected: ${res.checks[res.checks.length - 1]?.replace(/^Rejected: /, '') ?? ''}`
          : `Pending: ${res.checks[res.checks.length - 1]?.replace(/^Pending: /, '') ?? ''}`;
      } catch {
        flash = 'Checked, but couldn’t save the result. Try again in a moment.';
      }
      busy = false;
      renderPayouts();
    });
  }

  /* ---------------- 3. building ---------------- */
  function renderTower() {
    const p = d.store.mine();
    const total = p ? verifiedTotal(p) : 0;
    const lvl = levelFor(total);
    const crown = crownFor(total);
    const lp = levelProgress(total);
    body.innerHTML = `
      ${flash ? `<div class="bk-flash">${esc(flash)}</div>` : ''}
      <div class="tp-building ${crown ? 'crown-' + crown : ''}">
        <span class="tp-b-eyebrow">${p ? esc(p.towerName) : 'Your building'}</span>
        <b>${esc(towerTitle(total))}</b>
        <em>${lvl ? `${usd(total)} verified · ${SECTOR_LABEL[p!.sector]} sector` : 'A house in Brooklyn, across the Rat Race Exit Bridge, until your first verified payout.'}</em>
        ${lp.nextLabel ? `<div class="tp-bar"><i style="width:${lp.pct}%"></i></div><small>Next: ${esc(lp.nextLabel)} at ${usd(lp.nextAt)}</small>` : '<small>Platinum Crown: the top of the city.</small>'}
        <div class="tp-b-actions">
          <button class="btn btn-gold" id="tp-walk">${lvl ? 'Walk to my tower' : 'Walk to my house'}</button>
          <button class="btn btn-ghost" id="tp-up2">Upload a payout</button>
          <button class="btn btn-ghost" id="tp-rules2">All rules · Bank of Gains</button>
        </div>
      </div>
      <div class="tp-ladder">
        <h3>Tower levels</h3>
        <ol>${LEVEL_BANDS.map((b) => `<li class="${lvl === b.level && !crown ? 'here' : ''}"><b>Level ${b.level}</b><span>${usd(b.min === 1 ? 1 : b.min)} – ${usd(b.max)}</span><em>${esc(b.name)}</em></li>`).join('')}</ol>
        <h3>Crowns after Level 10</h3>
        <ol>${CROWN_BANDS.map((b) => `<li class="${crown === b.tier ? 'here' : ''}"><b style="color:${b.color}">${esc(b.label)}</b><span>${b.max === Infinity ? `${usd(b.min)}+` : `${usd(b.min)} – ${usd(b.max)}`}</span></li>`).join('')}</ol>
      </div>`;
    flash = '';
    body.querySelector('#tp-walk')!.addEventListener('click', () => { close(); d.walkHome(); });
    body.querySelector('#tp-up2')!.addEventListener('click', () => show('payouts'));
    body.querySelector('#tp-rules2')!.addEventListener('click', () => { close(); d.openRules(); });
    void crownBand;
  }

  function render() {
    tabs.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    setNote();
    if (!d.isMember()) return renderGate();
    if (tab === 'profile') void renderProfile();
    else if (tab === 'payouts') void renderPayouts();
    else renderTower();
  }
  function show(t: ProfileTab) { tab = t; render(); }
  function open(t: ProfileTab = 'profile', onb = false) {
    onboarding = onb;
    overlay.hidden = false;
    document.body.classList.add('media-open');
    void d.store.ready.then(() => show(t));
  }
  function close() {
    if (busy) return;
    overlay.hidden = true;
    onboarding = false;
    flash = '';
    document.body.classList.remove('media-open');
  }
  const isOpen = () => !overlay.hidden;
  return { open, close, isOpen };
}
