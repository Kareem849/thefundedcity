// Chat with the AI customer-service guard outside a prop firm's HQ.
// On the published city, answers come from Claude (the page's `sample` capability) using the firm facts
// the city already has, with a reminder to confirm rules on the firm's own site. Anywhere else, a simple
// offline helper answers from the same facts.
import type { Firm } from './firms';
import { CATEGORY_LABEL } from './firms';

export interface GuardPanel {
  open: (firm: Firm) => void;
  close: () => void;
  isOpen: () => boolean;
}

interface Turn { role: 'user' | 'assistant'; text: string; note?: string }

const esc = (v: string) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const CLOSE = '<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const MAX_Q = 400;

const CITY_GUIDE = [
  'Capital Square (centre): fountain plaza; City Hall on the west side (announcements, community reviews, votes and the monthly mayor election) and the Bank of Gains on the east side (max single payout rankings, the rules for building your tower).',
  'Corporate Ring: prop firm HQs; CFD firms north of the square, futures firms south, perps firms east. Each has an AI support guard outside. THE LAB (firm offers and experiments with countdowns) is next to Kareem Capital, west of the square.',
  'Trader towers: four sectors (CFD north, Futures south, Perps east, Multi-Assets west); taller towers = more verified payouts.',
  'Trading Floor (north-west, by the golf club): FX, INDICES, COMMODITIES, CRYPTO and OPTIONS pits to chat ideas, entries and exits and share charts.',
  'Liquidation Arena (south-east): prop firm tournaments, prizes and live leaderboards.',
  'Media District (north-east): economic calendar, countdowns, media theater and news.',
  '100K+ Payouts Golf Club (west coast): members only (traders with $100K+ verified payouts, prop firm CEOs and marketing teams); entry at the members’ gate.',
  'Sip The Dip Cafe: on the Waterfront (south-west) by the pier, trader chat.',
  'Rat Race Exit Bridge (east) to Brooklyn: trader houses for members without a payout yet; Yacht Marina and Container Port on the Brooklyn waterfront.',
  'Past Brooklyn (far east): THE PLAZA mall and marketplace (no listing fees, 75% to the seller, 25% to the Plaza) with free parking, and Touch The Grass Park with the RESET yoga and AI mindset deck.',
  'FUNDEDCITY International Airport (north island, via the causeway): flights, radar, aircraft ads.',
  'Set For Life Statue: in the bay to the south-west.',
  'The mainland: behind the golf club (west) desert plains and behind the airport (north) forests, both open land for future districts, ringed by rocky foothills and snowy mountain ranges. The south and east are open sea.',
  'Founders’ Summit: in the mountains where the desert meets the forest; statues of the five founders, with profiles and social links. Only founders can be mayor. Get there by riding the cable car: walk to the lower station at the main island’s north-west corner (next to the Trading Floor) and press E or tap “Ride the cable car up”; the glass cabin glides over the sea past three pylons. Leaving the summit rides you back down.',
  'Any car, boat, plane or helicopter can be ridden: walk up and press E.',
  'FUNDEDCITY Radio (RADIO button in the header): Bloomberg Radio for live global business and markets news, or Radio Paradise, commercial-free music; Off stops it. If the page can’t play outside audio, it offers the station’s own player in a new tab. The eye button (or H) hides all labels and panels for a clean view.',
].join('\n');

function firmFacts(f: Firm) {
  return JSON.stringify({
    name: f.name, category: CATEGORY_LABEL[f.category], tagline: f.tagline, website: f.website, founded: f.founded, hq: f.hq, status: f.status ?? 'live',
    profitSplit: f.split, payouts: f.payouts, platforms: f.platforms, assets: f.assets,
    plans: f.plans, services: f.services, offers: f.offers, notes: f.notes, termsChecked: f.checked ?? '26 Oct 2026', source: f.source.label,
  });
}

function buildPrompt(f: Firm, turns: Turn[]) {
  const convo = turns.slice(-10).map((t) => `${t.role === 'user' ? 'Visitor' : 'Guard'}: ${t.text}`).join('\n');
  return `You are "${f.name} Support", the AI customer-service guard standing outside the ${f.name} HQ in FUNDEDCITY, a virtual 3D city for prop-firm traders. You are an AI guide, not an employee or official representative of ${f.name}.

Answer the visitor's latest message. Rules:
- Friendly, direct and brief: at most about 120 words, plain text (short dash bullets only when listing). No markdown headings or bold.
- For anything about ${f.name}, use the FIRM FACTS. They come from ${f.source.label} (terms checked ${f.checked ?? '26 Oct 2026'}), list prices before discount codes, with every account size priced in "tiers", and may be out of date: when you give prices, rules, payout terms or discount codes, add that they should confirm on ${f.website}.
- If the facts don't cover it, say you don't know rather than guessing. Never invent rules, prices, codes, dates or guarantees.
- No personal financial advice and no promises of funding or profits.
- You can also help with general prop-trading questions and with finding places in FUNDEDCITY using the CITY GUIDE.

FIRM FACTS (JSON):
${firmFacts(f)}

CITY GUIDE:
${CITY_GUIDE}

CONVERSATION SO FAR:
${convo}

Reply as the Guard to the visitor's last message.`;
}

/** Offline helper: keyword answers from the firm facts. */
function offlineAnswer(f: Firm, q: string) {
  const s = q.toLowerCase();
  const confirm = ` Please confirm on ${f.website}, as rules and prices change.`;
  if (/price|cost|fee|cheap|how much/.test(s)) return `${f.name} plans (researched 26 Oct 2026):\n${f.plans.slice(0, 4).map((p) => `- ${p.program}: ${p.sizes}, from ${p.price}`).join('\n')}\n${confirm.trim()}`;
  if (/split|profit share|keep/.test(s)) return `Profit split: ${f.split}.${confirm}`;
  if (/payout|withdraw|paid/.test(s)) return `Payouts: ${f.payouts}.${confirm}`;
  if (/platform|mt5|mt4|ctrader|tradingview|ninja|rithmic|tradovate|dxtrade|match/.test(s)) return `Platforms: ${f.platforms.join(', ')}.${confirm}`;
  if (/drawdown|loss|rule|target|limit/.test(s)) return `${f.plans.slice(0, 3).map((p) => `- ${p.program}: target ${p.target}, daily loss ${p.dailyLoss}, max loss ${p.maxLoss}`).join('\n')}\n${confirm.trim()}`;
  if (/code|discount|coupon|offer|promo/.test(s)) return f.offers.length ? `Offers seen: ${f.offers.map((o) => (o.code ? `${o.code}: ${o.text}` : o.text)).join(' · ')}.${confirm}` : `I don't have a current offer for ${f.name}.${confirm}`;
  if (/asset|instrument|market|trade what|forex|crypto|futures|gold|indices/.test(s)) return `Markets: ${f.assets}.${confirm}`;
  if (/where|find|how do i get|cafe|bank|golf|arena|airport|bridge|brooklyn|park/.test(s)) return 'Use the search bar or the “Walk to” menu to head anywhere. Quick guide: the café and Bank of Gains are on Capital Square, the Liquidation Arena is south-east, the golf club is on the west coast and the airport is across the causeway to the north.';
  return `I can help with ${f.name}'s plans and prices, rules, profit split, payouts, platforms and current offers, or with finding your way around FUNDEDCITY. What would you like to know?`;
}

const SUGGEST = ['What does the cheapest plan cost?', 'What are the drawdown rules?', 'How do payouts work?', 'Any discount code right now?', 'Which platforms can I use?'];

export function createGuardPanel(root: HTMLElement): GuardPanel {
  root.insertAdjacentHTML(
    'beforeend',
    `<div class="media-overlay guard-overlay" id="gd-overlay" hidden>
      <section class="media-panel guard-panel" role="dialog" aria-modal="true" aria-labelledby="gd-title">
        <header class="mp-head">
          <span class="gd-badge" aria-hidden="true">AI</span>
          <div class="mp-title"><span class="mp-eyebrow gd-eyebrow" id="gd-eyebrow">CUSTOMER SERVICE</span><h2 id="gd-title">Support</h2></div>
          <button class="icon-btn sq mp-close" id="gd-close" aria-label="Close support chat">${CLOSE}</button>
        </header>
        <div class="cf-body">
          <ol class="cf-msgs gd-msgs" id="gd-msgs" aria-live="polite"></ol>
          <div class="cf-prompts" id="gd-prompts">${SUGGEST.map((p) => `<button type="button">${esc(p)}</button>`).join('')}</div>
          <form class="cf-form" id="gd-form">
            <input id="gd-input" maxlength="${MAX_Q}" autocomplete="off" placeholder="Ask anything about this firm or the city…" />
            <button class="btn btn-gold" type="submit" id="gd-send">Ask</button>
          </form>
        </div>
        <footer class="mp-foot"><span class="mp-feed" id="gd-note"></span></footer>
      </section>
    </div>`,
  );
  const overlay = root.querySelector<HTMLElement>('#gd-overlay')!;
  const list = overlay.querySelector<HTMLOListElement>('#gd-msgs')!;
  const form = overlay.querySelector<HTMLFormElement>('#gd-form')!;
  const input = overlay.querySelector<HTMLInputElement>('#gd-input')!;
  const send = overlay.querySelector<HTMLButtonElement>('#gd-send')!;
  const note = overlay.querySelector<HTMLElement>('#gd-note')!;
  overlay.querySelector('#gd-close')!.addEventListener('click', () => close());
  overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) close(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) close(); });
  overlay.querySelectorAll<HTMLButtonElement>('#gd-prompts button').forEach((b) => b.addEventListener('click', () => { input.value = b.textContent ?? ''; form.requestSubmit(); }));

  let firm: Firm | null = null;
  const convos = new Map<string, Turn[]>();
  let busy: AbortController | null = null;
  let live: Turn | null = null;
  // the AI: resolved once, null when this view can't use it (then the offline helper answers)
  type SampleFn = ((input: string, opts?: Record<string, unknown>) => Promise<{ text: string }>) | null;
  let samplePromise: Promise<SampleFn> | null = null;
  let aiOff = false;
  const getSample = () => {
    if (!samplePromise) {
      samplePromise = (async () => {
        const c = (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude;
        if (!c || typeof c.use !== 'function') return null;
        try { return ((await c.use('sample')) as SampleFn) ?? null; } catch { return null; }
      })();
    }
    return samplePromise;
  };

  const render = () => {
    if (!firm) return;
    const turns = convos.get(firm.id) ?? [];
    list.innerHTML = turns.map((t) => `<li class="${t.role === 'user' ? 'mine' : 'guard'}"><span class="cf-who">${t.role === 'user' ? 'You' : esc(firm!.sign) + ' support'}</span><p>${esc(t.text) || '<span class="gd-typing"><i></i><i></i><i></i></span>'}</p>${t.note ? `<small>${esc(t.note)}</small>` : ''}</li>`).join('');
    list.scrollTop = list.scrollHeight;
  };

  const setNote = (ai: boolean) => {
    note.innerHTML = ai
      ? `AI answers by Claude, using what FUNDEDCITY knows about ${esc(firm?.name ?? 'this firm')} (researched 26 Oct 2026). Not an official ${esc(firm?.name ?? 'firm')} channel: confirm rules and prices on <b>${esc(firm?.website ?? 'the firm’s website')}</b>.`
      : `Preview: AI answers open at launch. Answers here come from FUNDEDCITY’s ${esc(firm?.name ?? 'firm')} notes; confirm on <b>${esc(firm?.website ?? 'the firm’s website')}</b>.`;
  };

  async function ask(q: string) {
    if (!firm || busy) return;
    const f = firm;
    const turns = convos.get(f.id) ?? [];
    turns.push({ role: 'user', text: q });
    const reply: Turn = { role: 'assistant', text: '' };
    turns.push(reply);
    convos.set(f.id, turns);
    live = reply;
    render();
    const sample = aiOff ? null : await getSample();
    setNote(!!sample);
    if (!sample) {
      setTimeout(() => { reply.text = offlineAnswer(f, q); live = null; render(); }, 450);
      return;
    }
    const ctl = new AbortController();
    busy = ctl;
    send.disabled = true;
    try {
      const res = await sample(buildPrompt(f, turns.slice(0, -1)), {
        cache: false, modelTier: 'quick', signal: ctl.signal,
        onText: ({ text }: { text: string }) => { reply.text = text; if (firm === f) render(); },
      });
      reply.text = res.text.trim();
    } catch (e) {
      const code = (e as { code?: string })?.code ?? 'upstream_error';
      const partial = (e as { text?: string })?.text;
      if (code === 'cancelled') reply.text = partial ?? '';
      else if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(code)) {
        aiOff = true;
        reply.text = offlineAnswer(f, q);
        reply.note = 'AI is not enabled for this city view, so this answer comes from the offline helper.';
        setNote(false);
      } else if (code === 'rate_limited') { reply.text = partial ?? ''; reply.note = 'Too many questions right now. Try again in a little while.'; }
      else if (code === 'session_expired') { reply.text = partial ?? ''; reply.note = 'Please sign in to Claude again, then ask once more.'; }
      else if (code === 'refused') { reply.text = ''; reply.note = 'I can’t help with that one. Try asking another way.'; }
      else { reply.text = partial ?? ''; reply.note = 'The answer was interrupted. Ask again to retry.'; }
    } finally {
      busy = null;
      live = null;
      send.disabled = false;
      if (firm === f) render();
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim().slice(0, MAX_Q);
    if (!q || busy) return;
    input.value = '';
    void ask(q);
  });

  function open(f: Firm) {
    if (busy && firm !== f) busy.abort();
    firm = f;
    overlay.querySelector('#gd-title')!.textContent = `${f.name} · Support`;
    overlay.querySelector('#gd-eyebrow')!.textContent = `${CATEGORY_LABEL[f.category].toUpperCase()} FIRM HQ · AI CUSTOMER SERVICE`;
    if (!convos.has(f.id)) convos.set(f.id, [{ role: 'assistant', text: `Hi, welcome to ${f.name}. I’m the AI support guard: ask me about plans, prices, rules, payouts, platforms or offers, or where to go next in the city.` }]);
    overlay.hidden = false;
    document.body.classList.add('media-open');
    setNote(!aiOff && !!(window as unknown as { claude?: unknown }).claude);
    render();
    input.focus({ preventScroll: true });
  }
  function close() {
    overlay.hidden = true;
    document.body.classList.remove('media-open');
    void live;
  }
  const isOpen = () => !overlay.hidden;
  return { open, close, isOpen };
}
