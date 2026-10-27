// Media Center panel: economic calendar (week / today, impact filters, countdowns), the theater
// (broadcast programme + YouTube), markets board, headlines with URGENT items, and heads-up alerts.
import {
  getMediaFeed, onMediaFeedChange, IMPACT_COLOR, IMPACT_LABEL, NEWS_OUTLETS, MEDIA_SOURCES, SNAPSHOT_DATE,
  fmtCountdown, fmtPrice, changePct, upcoming, nowShowing, youtubeId, type Impact, type CalEvent, type QuoteGroup,
} from './media';

export type MediaTab = 'calendar' | 'theater' | 'markets' | 'news';

export interface MediaPanel {
  open: (tab?: MediaTab) => void;
  close: () => void;
  isOpen: () => boolean;
}

const esc = (v: string) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const IMPACTS: Impact[] = ['high', 'medium', 'low', 'none'];
const GROUPS: Array<[QuoteGroup, string]> = [['fx', 'FX majors'], ['index', 'Indices'], ['commodity', 'Commodities'], ['crypto', 'Crypto'], ['rates', 'Rates & volatility']];
const TZ_KEY = 'fundedcity-media-tz';

/** The published artifact runs in a sandboxed frame where YouTube embeds are blocked. */
const FRAMED = (() => { try { return window.self !== window.top; } catch { return true; } })();

const ICON = {
  close: '<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  play: '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4.5 2.8v10.4L13 8z" fill="currentColor"/></svg>',
  ext: '<svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true"><path d="M9 2.5h4.5V7M13.2 2.8 7.5 8.5M11.5 9.5v3.2a.8.8 0 0 1-.8.8H3.3a.8.8 0 0 1-.8-.8V5.3c0-.4.4-.8.8-.8h3.2" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  bell: '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M10 2.5a5 5 0 0 0-5 5v3.2L3.5 13.5h13L15 10.7V7.5a5 5 0 0 0-5-5zM8 15.5a2 2 0 0 0 4 0" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/></svg>',
  cal: '<svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><rect x="3" y="4.5" width="14" height="12" rx="2.2" stroke="currentColor" stroke-width="1.7" fill="none"/><path d="M3 8.5h14M7 2.8v3.4M13 2.8v3.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
};

export function createMediaPanel(root: HTMLElement, toastHost: HTMLElement, topbarRight: HTMLElement): MediaPanel {
  /* ---------------- header chip: next major event ---------------- */
  topbarRight.insertAdjacentHTML(
    'afterbegin',
    `<button class="media-chip" id="media-chip" title="Media Center: economic calendar, theater and news">
      <span class="mc-ico">${ICON.cal}</span><span class="mc-tag">MEDIA</span><span class="mc-next" id="mc-next"></span>
    </button>`,
  );
  const chip = topbarRight.querySelector<HTMLButtonElement>('#media-chip')!;
  const chipNext = topbarRight.querySelector<HTMLElement>('#mc-next')!;
  chip.addEventListener('click', () => open('calendar'));

  /* ---------------- panel shell ---------------- */
  root.insertAdjacentHTML(
    'beforeend',
    `<div class="media-overlay" id="media-overlay" hidden>
      <section class="media-panel" role="dialog" aria-modal="true" aria-labelledby="mp-title">
        <header class="mp-head">
          <div class="mp-title"><span class="mp-eyebrow">MEDIA DISTRICT</span><h2 id="mp-title">Media Center</h2></div>
          <nav class="mp-tabs" role="tablist">
            <button role="tab" data-tab="calendar">Calendar</button>
            <button role="tab" data-tab="theater">Theater</button>
            <button role="tab" data-tab="markets">Markets</button>
            <button role="tab" data-tab="news">News</button>
          </nav>
          <button class="icon-btn sq mp-close" id="mp-close" aria-label="Close Media Center">${ICON.close}</button>
        </header>
        <div class="mp-urgent" aria-label="Urgent headlines"><b>URGENT</b><div class="mp-crawl"><span id="mp-crawl"></span></div></div>
        <div class="mp-body" id="mp-body"></div>
        <footer class="mp-foot">
          <span class="mp-feed" id="mp-feed"></span>
          <details class="mp-sources"><summary>Sources</summary><ul id="mp-sources"></ul></details>
        </footer>
      </section>
    </div>`,
  );
  const overlay = root.querySelector<HTMLElement>('#media-overlay')!;
  const body = overlay.querySelector<HTMLElement>('#mp-body')!;
  const tabs = [...overlay.querySelectorAll<HTMLButtonElement>('.mp-tabs button')];
  overlay.querySelector('#mp-close')!.addEventListener('click', () => close());
  overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) close(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) close(); });
  tabs.forEach((b) => b.addEventListener('click', () => show(b.dataset.tab as MediaTab)));
  overlay.querySelector<HTMLElement>('#mp-sources')!.innerHTML = MEDIA_SOURCES.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a></li>`).join('');

  const renderFeedLine = () => {
    const f = getMediaFeed();
    overlay.querySelector<HTMLElement>('#mp-feed')!.innerHTML = f.live
      ? `<i class="live-dot"></i>Live feed: ${esc(f.name)}`
      : `Researched snapshot · week of ${SNAPSHOT_DATE}. Countdowns run on real time; prices move with an <b>indicative simulation</b>, not live quotes.`;
    const urgent = f.headlines().filter((h) => h.urgent);
    const crawl = overlay.querySelector<HTMLElement>('#mp-crawl')!;
    const items = urgent.map((h) => `<span>${esc(h.text)}</span>`).join('<i>◆</i>');
    crawl.innerHTML = items + '<i>◆</i>' + items; // doubled for a seamless loop
  };

  /* ---------------- state ---------------- */
  let tab: MediaTab = 'calendar';
  let range: 'week' | 'today' = 'week';
  const impacts = new Set<Impact>(IMPACTS);
  let tz: 'local' | 'UTC' | 'America/New_York' = 'local';
  try {
    const v = localStorage.getItem(TZ_KEY);
    if (v === 'local' || v === 'UTC' || v === 'America/New_York') tz = v;
  } catch { /* ignore */ }
  let videoId: string | null = null;
  let pastedUrl = '';

  const tzOpt = () => (tz === 'local' ? {} : { timeZone: tz });
  const tzName = () => (tz === 'local' ? 'your time' : tz === 'UTC' ? 'GMT' : 'New York');
  const fmtTime = (t: number) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', ...tzOpt() }).format(t);
  const fmtDay = (t: number) => new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'short', ...tzOpt() }).format(t);
  const dayKey = (t: number) => new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', ...tzOpt() }).format(t);
  const fmtWhen = (t: number) => new Intl.DateTimeFormat('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit', ...tzOpt() }).format(t);

  /* ---------------- calendar ---------------- */
  const folder = (i: Impact) => `<span class="imp imp-${i}" style="--imp:${IMPACT_COLOR[i]}" title="${IMPACT_LABEL[i]}"></span>`;
  function renderCalendar() {
    const now = Date.now();
    const evs = getMediaFeed().calendar();
    const next = upcoming(evs, now, ['high'], 4);
    const todayKey = dayKey(now);
    const list = evs.filter((e) => impacts.has(e.impact) && (range === 'week' || dayKey(e.t) === todayKey));
    const nextId = evs.find((e) => !e.allDay && e.t > now)?.id;
    let lastDay = '';
    const rows = list.map((e) => {
      const k = dayKey(e.t);
      let head = '';
      if (k !== lastDay) {
        lastDay = k;
        head = `<tr class="day${k === todayKey ? ' today' : ''}"><th colspan="8">${esc(fmtDay(e.t))}${k === todayKey ? '<em>Today</em>' : ''}</th></tr>`;
      }
      const past = !e.allDay && e.t < now - 60_000;
      const cls = [past ? 'past' : '', e.id === nextId ? 'next' : ''].join(' ');
      const watch = e.broadcast ? `<button class="mini-watch" data-watch="${e.broadcast}">${ICON.play}Watch</button>` : '';
      return `${head}<tr class="${cls}">
        <td class="c-time">${e.allDay ? 'All day' : esc(fmtTime(e.t))}</td>
        <td class="c-cur">${esc(e.cur)}</td>
        <td class="c-imp">${folder(e.impact)}</td>
        <td class="c-ev"><b>${esc(e.title)}</b>${e.note ? `<small>${esc(e.note)}</small>` : ''}${watch}</td>
        <td class="c-num">${esc(e.actual ?? '')}</td>
        <td class="c-num">${esc(e.forecast ?? '')}</td>
        <td class="c-num">${esc(e.previous ?? '')}</td>
        <td class="c-cd" ${e.allDay || past ? '' : `data-cd="${e.t}"`}>${e.allDay ? '' : past ? '<span class="done">Released</span>' : ''}</td>
      </tr>`;
    }).join('');
    body.innerHTML = `
      <div class="cd-row">
        ${next.length ? next.map((e, i) => `
          <div class="cd-card${i === 0 ? ' first' : ''}">
            <span class="cd-eyebrow">${folder(e.impact)}${esc(e.cur)} · ${esc(fmtWhen(e.t))}</span>
            <b>${esc(e.title)}</b>
            <span class="cd-time" data-cd="${e.t}"></span>
          </div>`).join('') : '<div class="cd-empty">No more high-impact events in this snapshot. Plug a live calendar feed into src/media.ts.</div>'}
      </div>
      <div class="cal-tools">
        <div class="seg" role="radiogroup" aria-label="Range">
          <button role="radio" data-range="week" aria-checked="${range === 'week'}">This week</button>
          <button role="radio" data-range="today" aria-checked="${range === 'today'}">Today</button>
        </div>
        <div class="imp-filters" aria-label="Impact filter">
          ${IMPACTS.map((i) => `<button class="imp-chip${impacts.has(i) ? ' on' : ''}" data-imp="${i}" aria-pressed="${impacts.has(i)}">${folder(i)}${IMPACT_LABEL[i].replace(' impact', '')}</button>`).join('')}
        </div>
        <label class="tz">Times in
          <select id="mp-tz">
            <option value="local"${tz === 'local' ? ' selected' : ''}>Your time</option>
            <option value="UTC"${tz === 'UTC' ? ' selected' : ''}>GMT</option>
            <option value="America/New_York"${tz === 'America/New_York' ? ' selected' : ''}>New York</option>
          </select>
        </label>
      </div>
      <div class="cal-wrap">
        <table class="cal">
          <thead><tr><th>Time</th><th>Cur.</th><th>Imp.</th><th>Event</th><th>Actual</th><th>Forecast</th><th>Previous</th><th>Countdown</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="8" class="empty">No ${range === 'today' ? 'events today' : 'events'} for the selected impact levels.</td></tr>`}</tbody>
        </table>
      </div>`;
    body.querySelectorAll<HTMLButtonElement>('[data-range]').forEach((b) => b.addEventListener('click', () => { range = b.dataset.range as 'week' | 'today'; renderCalendar(); }));
    body.querySelectorAll<HTMLButtonElement>('[data-imp]').forEach((b) => b.addEventListener('click', () => {
      const i = b.dataset.imp as Impact;
      if (impacts.has(i)) impacts.delete(i); else impacts.add(i);
      renderCalendar();
    }));
    body.querySelector<HTMLSelectElement>('#mp-tz')!.addEventListener('change', (e) => {
      tz = (e.target as HTMLSelectElement).value as typeof tz;
      try { localStorage.setItem(TZ_KEY, tz); } catch { /* ignore */ }
      renderCalendar();
    });
    body.querySelectorAll<HTMLButtonElement>('[data-watch]').forEach((b) => b.addEventListener('click', () => { focusBroadcast = b.dataset.watch!; show('theater'); }));
    tickCountdowns();
    // bring the next release into view without scrolling the page around the panel
    const nextRow = body.querySelector<HTMLElement>('tr.next');
    if (nextRow) {
      const y = nextRow.getBoundingClientRect().top - body.getBoundingClientRect().top;
      if (y > body.clientHeight - 60) body.scrollTop = y - body.clientHeight / 2;
    }
  }

  function tickCountdowns() {
    const now = Date.now();
    body.querySelectorAll<HTMLElement>('[data-cd]').forEach((el) => {
      const t = Number(el.dataset.cd);
      const ms = t - now;
      el.textContent = ms <= 0 ? 'Now' : fmtCountdown(ms);
      el.classList.toggle('soon', ms > 0 && ms < 3_600_000);
      el.classList.toggle('now', ms <= 0);
    });
  }

  /* ---------------- theater ---------------- */
  let focusBroadcast: string | null = null;
  function renderTheater() {
    const now = Date.now();
    const list = getMediaFeed().broadcasts();
    const { b: showing, live } = nowShowing(list, now);
    const feature = (focusBroadcast && list.find((x) => x.id === focusBroadcast)) || showing || list[0];
    const isLive = feature === showing && live;
    const embed = videoId && !FRAMED
      ? `<iframe src="https://www.youtube-nocookie.com/embed/${esc(videoId)}?autoplay=1&rel=0" title="YouTube video" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`
      : '';
    const poster = feature ? `
      <div class="poster">
        <span class="p-eyebrow">${isLive ? '<i class="live-dot"></i>LIVE NOW' : feature.t ? 'NEXT ON SCREEN' : 'ON DEMAND'} · ${esc(feature.host)}</span>
        <h3>${esc(feature.title)}</h3>
        <p>${esc(feature.blurb)}</p>
        ${feature.t ? `<div class="p-when">${esc(fmtWhen(feature.t))} <small>${esc(tzName())}</small></div><div class="p-cd" data-cd="${feature.t}"></div>` : ''}
        <div class="p-actions">
          <a class="btn btn-red as-link" href="${esc(feature.youtube)}" target="_blank" rel="noopener">${ICON.play} Watch on YouTube</a>
          ${feature.site ? `<a class="btn btn-ghost as-link" href="${esc(feature.site)}" target="_blank" rel="noopener">Official stream ${ICON.ext}</a>` : ''}
        </div>
      </div>` : '';
    body.innerHTML = `
      <div class="theater">
        <div class="th-main">
          <div class="th-screen${embed ? ' playing' : ''}">${embed || poster}</div>
          <form class="th-paste" id="th-paste">
            <input id="th-url" type="url" inputmode="url" placeholder="Paste a YouTube link (press conference, speech, live stream)…" value="${esc(pastedUrl)}" />
            <button class="btn btn-gold" type="submit">${ICON.play} Play</button>
          </form>
          <p class="th-note" id="th-note">${FRAMED
            ? 'This shared page can’t embed YouTube, so links open on YouTube in a new tab. Run the project locally to watch inside the theater.'
            : 'Paste any YouTube link to play it on the theater screen.'}</p>
        </div>
        <aside class="th-list">
          <h4>This week on the big screen</h4>
          <ul>
            ${list.map((x) => {
              const on = x.t && now >= x.t && now < x.t + x.minutes * 60_000;
              const done = x.t && now >= x.t + x.minutes * 60_000;
              return `<li class="${x === feature ? 'sel' : ''}${done ? ' done' : ''}">
                <button class="th-item" data-b="${x.id}">
                  <span class="th-time">${x.t ? esc(fmtWhen(x.t)) : 'Announced at short notice'}</span>
                  <b>${esc(x.title)}</b>
                  <span class="th-host">${esc(x.host)}</span>
                  ${on ? '<span class="badge live"><i class="live-dot"></i>LIVE</span>' : done ? '<span class="badge">Ended</span>' : x.t ? `<span class="badge" data-cd="${x.t}"></span>` : '<span class="badge">Check schedule</span>'}
                </button>
                <a class="th-yt" href="${esc(x.youtube)}" target="_blank" rel="noopener" aria-label="Open ${esc(x.title)} on YouTube">${ICON.play}</a>
              </li>`;
            }).join('')}
          </ul>
        </aside>
      </div>`;
    body.querySelectorAll<HTMLButtonElement>('[data-b]').forEach((b) => b.addEventListener('click', () => { focusBroadcast = b.dataset.b!; videoId = null; renderTheater(); }));
    body.querySelector<HTMLFormElement>('#th-paste')!.addEventListener('submit', (e) => {
      e.preventDefault();
      pastedUrl = body.querySelector<HTMLInputElement>('#th-url')!.value.trim();
      const id = youtubeId(pastedUrl);
      const note = body.querySelector<HTMLElement>('#th-note')!;
      if (!id) { note.textContent = 'That doesn’t look like a YouTube video link. Try youtube.com/watch?v=… or youtu.be/…'; note.classList.add('err'); return; }
      if (FRAMED) {
        note.classList.remove('err');
        note.innerHTML = `Ready: <a href="https://www.youtube.com/watch?v=${esc(id)}" target="_blank" rel="noopener">open this video on YouTube ${ICON.ext}</a> (embedding is blocked on the shared page).`;
        return;
      }
      videoId = id;
      renderTheater();
    });
    tickCountdowns();
  }

  /* ---------------- markets ---------------- */
  function spark(h: number[], upMove: boolean) {
    const min = Math.min(...h);
    const max = Math.max(...h);
    const span = max - min || 1;
    const pts = h.map((v, i) => `${((i / (h.length - 1)) * 100).toFixed(1)},${(26 - ((v - min) / span) * 24).toFixed(1)}`).join(' ');
    return `<svg viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${upMove ? 'var(--up)' : 'var(--down)'}" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>`;
  }
  function renderMarkets() {
    const qs = getMediaFeed().quotes();
    body.innerHTML = `
      <p class="mk-note">${getMediaFeed().live ? 'Live quotes.' : `Indicative board: researched levels ≈ ${SNAPSHOT_DATE} with simulated movement. Not live prices — don’t trade from this.`}</p>
      ${GROUPS.map(([g, label]) => {
        const items = qs.filter((q) => q.group === g);
        if (!items.length) return '';
        return `<h4 class="mk-h">${label}</h4><div class="mk-grid">${items.map((q) => `
          <div class="mk-card" data-sym="${esc(q.sym)}">
            <div class="mk-top"><b>${esc(q.sym)}</b><span class="mk-chg"></span></div>
            <span class="mk-name">${esc(q.name)}</span>
            <div class="mk-price"></div>
            <div class="mk-spark"></div>
          </div>`).join('')}</div>`;
      }).join('')}`;
    tickMarkets();
  }
  function tickMarkets() {
    for (const q of getMediaFeed().quotes()) {
      const el = body.querySelector<HTMLElement>(`.mk-card[data-sym="${CSS.escape(q.sym)}"]`);
      if (!el) continue;
      const ch = changePct(q);
      const upMove = ch >= 0;
      el.querySelector<HTMLElement>('.mk-price')!.textContent = fmtPrice(q);
      const c = el.querySelector<HTMLElement>('.mk-chg')!;
      c.textContent = `${upMove ? '▲' : '▼'} ${Math.abs(ch).toFixed(2)}%`;
      c.className = 'mk-chg ' + (upMove ? 'up' : 'down');
      el.querySelector<HTMLElement>('.mk-spark')!.innerHTML = spark(q.history, upMove);
    }
  }

  /* ---------------- news ---------------- */
  function renderNews() {
    const now = Date.now();
    const hs = [...getMediaFeed().headlines()].sort((a, b) => Number(!!b.urgent) - Number(!!a.urgent) || b.t - a.t);
    const ago = (t: number) => {
      const m = Math.max(0, Math.round((now - t) / 60_000));
      if (m < 60) return `${m}m ago`;
      if (m < 1440) return `${Math.round(m / 60)}h ago`;
      return `${Math.round(m / 1440)}d ago`;
    };
    body.innerHTML = `
      <ul class="news">
        ${hs.map((h) => `<li class="${h.urgent ? 'urgent' : ''}">
          ${h.urgent ? '<span class="tag-urgent">URGENT</span>' : ''}
          <p>${esc(h.text)}</p>
          <span class="n-meta"><a href="${esc(h.url)}" target="_blank" rel="noopener">${esc(h.source)} ${ICON.ext}</a> · ${ago(h.t)}</span>
        </li>`).join('')}
      </ul>
      <h4 class="mk-h">Follow live coverage</h4>
      <div class="outlets">${NEWS_OUTLETS.map((o) => `<a class="outlet" href="${esc(o.url)}" target="_blank" rel="noopener">${esc(o.name)} ${ICON.ext}</a>`).join('')}</div>
      <p class="mk-note">Headlines are paraphrased summaries of the linked reports.</p>`;
  }

  /* ---------------- open / close / tabs ---------------- */
  function show(t: MediaTab) {
    tab = t;
    tabs.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
    body.scrollTop = 0;
    if (t === 'calendar') renderCalendar();
    else if (t === 'theater') renderTheater();
    else if (t === 'markets') renderMarkets();
    else renderNews();
  }
  function open(t: MediaTab = tab) {
    renderFeedLine();
    overlay.hidden = false;
    document.body.classList.add('media-open');
    show(t);
    overlay.querySelector<HTMLButtonElement>(`.mp-tabs [data-tab="${t}"]`)?.focus({ preventScroll: true });
  }
  function close() {
    overlay.hidden = true;
    document.body.classList.remove('media-open');
    // stop any playing video
    if (videoId) { videoId = null; if (tab === 'theater') body.innerHTML = ''; }
  }
  const isOpen = () => !overlay.hidden;
  onMediaFeedChange(() => { renderFeedLine(); if (isOpen()) show(tab); });

  /* ---------------- heads-up alerts ---------------- */
  const fired = new Set<string>();
  const THRESHOLDS = [60, 15, 5, 0];
  function toast(e: CalEvent, mins: number, now: number) {
    const el = document.createElement('button');
    el.className = 'media-toast glass-card';
    const ms = e.t - now;
    const hm = (x: number) => { const h = Math.floor(x / 3_600_000); const m = Math.round((x % 3_600_000) / 60_000); return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${m}m`; };
    const when = mins === 0 ? 'Released now' : ms > 3_600_000 ? `in ${hm(ms)}` : `in ${Math.max(1, Math.round(ms / 60_000))} min`;
    el.innerHTML = `<span class="mt-ico">${ICON.bell}</span><div><span class="mt-eyebrow">HEADS-UP · ${esc(e.cur)} · ${IMPACT_LABEL[e.impact]}</span><b>${esc(e.title)}</b><em>${esc(when)}${e.broadcast ? ' · watch in the Theater' : ''}</em></div>`;
    el.addEventListener('click', () => { el.remove(); if (e.broadcast) { focusBroadcast = e.broadcast; open('theater'); } else open('calendar'); });
    toastHost.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 450); }, mins === 0 ? 9000 : 7000);
  }
  function checkAlerts(now: number, boot = false) {
    const next = upcoming(getMediaFeed().calendar(), now, ['high'], 6);
    if (boot && next[0] && next[0].t - now < 24 * 3_600_000 && next[0].t - now > 60 * 60_000) {
      fired.add(next[0].id + ':boot');
      toast(next[0], 999, now);
    }
    for (const e of next) {
      const mins = (e.t - now) / 60_000;
      for (const th of THRESHOLDS) {
        const key = `${e.id}:${th}`;
        if (fired.has(key)) continue;
        // fire when we cross a threshold (within a 1-minute window so stale alerts don't pile up)
        if (mins <= th && mins > th - 1) { fired.add(key); toast(e, th, now); }
        else if (mins <= th - 1) fired.add(key);
      }
    }
  }

  /* ---------------- 1 s heartbeat ---------------- */
  const updateChip = (now: number) => {
    const [e] = upcoming(getMediaFeed().calendar(), now, ['high'], 1);
    if (!e) { chipNext.textContent = ''; chip.classList.remove('soon'); return; }
    const ms = e.t - now;
    const short = e.title.replace(/ (Statement|Press Conference|Price Index|Orders)( .*)?$/, '').replace(/^(FOMC|ECB|BoC|BoJ|RBNZ).*/, '$1');
    chipNext.innerHTML = `<i style="background:${IMPACT_COLOR[e.impact]}"></i>${esc(e.cur)} ${esc(short)} <b>${ms <= 0 ? 'now' : fmtCountdown(ms)}</b>`;
    chip.classList.toggle('soon', ms < 3_600_000);
  };
  const now0 = Date.now();
  updateChip(now0);
  setTimeout(() => checkAlerts(Date.now(), true), 2500);
  setInterval(() => {
    const now = Date.now();
    updateChip(now);
    checkAlerts(now);
    if (!isOpen()) return;
    tickCountdowns();
    if (tab === 'markets') tickMarkets();
  }, 1000);

  return { open, close, isOpen };
}
