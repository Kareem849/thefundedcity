// FUNDEDCITY RADIO: two free, real stations picked from the header.
//  · MARKETS: Bloomberg Radio, the global business & markets station (live from New York).
//  · MUSIC: Radio Paradise, the commercial-free, listener-supported music station (since 2000).
// Choosing a station puts headphones on the character; Off takes them off.
//
// Why a station may not play inside the page: some hosts (the claude.ai artifact viewer among them)
// only let a page play audio from its own address, so outside streams are refused before they load.
// Then the panel says so plainly and offers the station's own player in a new tab, which keeps
// playing while you walk the city. On a normal website the streams play right here.
// Stream addresses: Bloomberg's WBBR 1130 mounts on StreamTheWorld as used by radio apps, and Radio
// Paradise's published stream.radioparadise.com mounts. They're tried in order.

export type StationId = 'markets' | 'music';
type Choice = StationId | 'off';

interface Station { id: StationId; tag: string; name: string; sub: string; note: string; site: string; siteLabel: string; streams: string[] }
export const STATIONS: Station[] = [
  {
    id: 'markets', tag: 'MARKETS', name: 'Bloomberg Radio', sub: 'Global business and markets news, live 24/7', note: 'Free live stream from Bloomberg, New York',
    site: 'https://www.bloomberg.com/audio', siteLabel: 'bloomberg.com',
    streams: [
      'https://playerservices.streamtheworld.com/api/livestream-redirect/WBBRAMAAC.aac',
      'https://playerservices.streamtheworld.com/api/livestream-redirect/WBBRAM.mp3',
    ],
  },
  {
    id: 'music', tag: 'MUSIC', name: 'Radio Paradise', sub: 'Commercial-free rock, pop, electronic and world music, 24/7', note: 'Free, listener-supported, on air since 2000',
    site: 'https://radioparadise.com', siteLabel: 'radioparadise.com',
    streams: [
      'https://stream.radioparadise.com/aac-320',
      'https://stream.radioparadise.com/mp3-192',
      'https://stream.radioparadise.com/mp3-128',
    ],
  },
];
const STORE = 'fundedcity-radio';

export interface Radio { current: () => Choice; set: (c: Choice) => void }

const RADIO_ICON = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><rect x="2.5" y="7" width="15" height="10" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5 7l9-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="12.6" cy="12" r="2.3" fill="currentColor"/><path d="M5.2 10.5h3.2M5.2 13.5h3.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
const OFF_ICON = '<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M3.5 7.5h3l4-3.5v12l-4-3.5h-3z" fill="currentColor"/><path d="M13 7.5l4.5 5M17.5 7.5l-4.5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
const EXT = '<svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M4.5 2.5h5v5M9.5 2.5L3 9" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>';
const IDLE = 'Pick a station. Your character puts headphones on.';

export function createRadio(topbarRight: HTMLElement, opts: { onListening: (on: boolean) => void }): Radio {
  const wrap = document.createElement('div');
  wrap.className = 'radio';
  wrap.innerHTML = `
    <button class="radio-btn" id="radio-btn" aria-haspopup="true" aria-expanded="false" title="FUNDEDCITY Radio">
      ${RADIO_ICON}<span class="radio-eq" aria-hidden="true"><i></i><i></i><i></i></span><span class="radio-lbl">RADIO</span>
    </button>
    <div class="radio-menu glass-card" id="radio-menu" hidden role="dialog" aria-label="FUNDEDCITY Radio">
      <div class="rd-head"><span class="rd-eyebrow">FUNDEDCITY RADIO · FREE</span><b id="rd-now">Off</b><span id="rd-status">${IDLE}</span></div>
      <div class="rd-stations" role="radiogroup" aria-label="Stations">
        ${STATIONS.map((s) => `<button class="rd-st" data-c="${s.id}" role="radio" aria-checked="false">
          <span class="rd-tag rd-${s.id}">${s.tag}</span><b>${s.name}</b><span>${s.sub}</span><em>${s.note}</em>
        </button>`).join('')}
      </div>
      <div class="rd-fallback" id="rd-fallback" hidden></div>
      <div class="rd-foot">
        <button class="rd-off" data-c="off" role="radio" aria-checked="true">${OFF_ICON}Off</button>
        <label class="rd-vol"><span>Volume</span><input type="range" id="rd-vol" min="0" max="100" step="1" aria-label="Volume" /></label>
      </div>
    </div>`;
  const media = topbarRight.querySelector('#media-chip');
  if (media) media.after(wrap); else topbarRight.prepend(wrap);
  const btn = wrap.querySelector<HTMLButtonElement>('#radio-btn')!;
  const menu = wrap.querySelector<HTMLElement>('#radio-menu')!;
  const now = wrap.querySelector<HTMLElement>('#rd-now')!;
  const status = wrap.querySelector<HTMLElement>('#rd-status')!;
  const fallback = wrap.querySelector<HTMLElement>('#rd-fallback')!;
  const vol = wrap.querySelector<HTMLInputElement>('#rd-vol')!;
  const choices = [...wrap.querySelectorAll<HTMLButtonElement>('[data-c]')];

  let saved: { s: Choice; v: number } = { s: 'off', v: 0.6 };
  try {
    const j = JSON.parse(localStorage.getItem(STORE) ?? 'null');
    const s = j?.s === 'chill' ? 'music' : j?.s; // the old generated station became Radio Paradise
    if (j && ['off', 'markets', 'music'].includes(s)) saved = { s, v: typeof j.v === 'number' ? Math.min(1, Math.max(0, j.v)) : 0.6 };
  } catch { /* storage off */ }
  let choice: Choice = 'off';
  let volume = saved.v;
  const persist = () => { try { localStorage.setItem(STORE, JSON.stringify({ s: choice, v: volume })); } catch { /* storage off */ } };
  vol.value = String(Math.round(volume * 100));

  let audio: HTMLAudioElement | null = null;
  let streamIx = 0;
  // the browser reports when the page's security rules refused a stream (vs. the station being down)
  let pageBlocks = false;
  const BLOCKED_MSG = 'This page isn’t allowed to play audio from other websites, so the stream can’t start here.';
  document.addEventListener('securitypolicyviolation', (e) => {
    if (!/media/.test(e.effectiveDirective || e.violatedDirective || '')) return;
    pageBlocks = true;
    if (!fallback.hidden && station()) status.textContent = BLOCKED_MSG;
  });
  let stallTimer = 0;
  const station = () => STATIONS.find((s) => s.id === choice) ?? null;
  const setMediaSession = (title: string, artist: string) => {
    try { if ('mediaSession' in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title, artist, album: 'FUNDEDCITY Radio' }); } catch { /* unsupported */ }
  };

  function stopAudio() {
    window.clearTimeout(stallTimer);
    if (!audio) return;
    audio.onplaying = audio.onerror = audio.onwaiting = null;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }
  function play(st: Station) {
    if (!audio) { audio = new Audio(); audio.preload = 'none'; }
    const a = audio;
    a.volume = volume;
    streamIx = 0;
    fallback.hidden = true;
    now.textContent = st.name;
    status.textContent = 'Connecting to the live stream…';
    const tryNext = () => {
      if (choice !== st.id) return;
      if (streamIx >= st.streams.length) return blocked(st, false);
      a.src = st.streams[streamIx++];
      a.play().catch(() => { /* the error event moves on */ });
      window.clearTimeout(stallTimer);
      stallTimer = window.setTimeout(() => { if (choice === st.id && a.paused) blocked(st, true); }, 15000);
    };
    a.onerror = () => tryNext();
    a.onplaying = () => {
      window.clearTimeout(stallTimer);
      fallback.hidden = true;
      now.textContent = `${st.name} · LIVE`;
      status.textContent = st.sub;
      btn.title = `Playing: ${st.name} (live)`;
      wrap.classList.add('playing');
      opts.onListening(true);
      setMediaSession(`${st.name} · live`, st.name);
    };
    a.onwaiting = () => { if (choice === st.id) status.textContent = 'Buffering…'; };
    wrap.classList.remove('playing');
    tryNext();
  }
  function blocked(st: Station, slow: boolean) {
    if (choice !== st.id) return;
    stopAudio();
    wrap.classList.remove('playing');
    opts.onListening(false);
    now.textContent = st.name;
    status.textContent = pageBlocks ? BLOCKED_MSG : slow ? 'The live stream isn’t answering right now.' : 'The live stream couldn’t be reached from here right now.';
    fallback.hidden = false;
    fallback.innerHTML = `<a class="btn btn-gold rd-ext" id="rd-open" href="${st.site}" target="_blank" rel="noopener noreferrer">Listen on ${st.siteLabel} ${EXT}</a>
      <button class="btn btn-ghost" id="rd-retry">Try again</button>
      <p>${st.name}’s own player opens in a new tab and keeps playing while you walk the city.</p>`;
    fallback.querySelector('#rd-open')!.addEventListener('click', () => {
      // they're listening in the other tab: headphones on, and say where the sound is
      now.textContent = `${st.name} · in a new tab`;
      status.textContent = 'Playing in the station’s own player. Switch it off there.';
      wrap.classList.add('playing');
      opts.onListening(true);
    });
    fallback.querySelector('#rd-retry')!.addEventListener('click', () => set(st.id, true));
  }

  function set(c: Choice, force = false) {
    if (c === choice && !force) return;
    stopAudio();
    choice = c;
    persist();
    fallback.hidden = true;
    choices.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.c === c)));
    wrap.classList.toggle('on', c !== 'off');
    wrap.classList.remove('playing');
    const st = station();
    if (!st) {
      now.textContent = 'Off';
      status.textContent = IDLE;
      btn.title = 'FUNDEDCITY Radio';
      opts.onListening(false);
      try { if ('mediaSession' in navigator) navigator.mediaSession.metadata = null; } catch { /* unsupported */ }
      return;
    }
    play(st);
  }

  const setOpen = (o: boolean) => { menu.hidden = !o; btn.setAttribute('aria-expanded', String(o)); };
  btn.addEventListener('click', (e) => { e.stopPropagation(); setOpen(!!menu.hidden); });
  document.addEventListener('pointerdown', (e) => { if (!wrap.contains(e.target as Node)) setOpen(false); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) setOpen(false); });
  choices.forEach((b) => b.addEventListener('click', () => set(b.dataset.c as Choice)));
  vol.addEventListener('input', () => {
    volume = Number(vol.value) / 100;
    if (audio) audio.volume = volume;
    persist();
  });
  try {
    navigator.mediaSession?.setActionHandler('pause', () => set('off'));
    navigator.mediaSession?.setActionHandler('stop', () => set('off'));
  } catch { /* unsupported */ }

  // pick up last session's station on the first touch (browsers block sound before a gesture)
  if (saved.s !== 'off') {
    const name = STATIONS.find((s) => s.id === saved.s)!.name;
    now.textContent = `${name} · paused`;
    status.textContent = 'Tap anywhere in the city to resume.';
    wrap.classList.add('resume');
    const resume = (e: Event) => {
      document.removeEventListener('pointerdown', resume, true);
      document.removeEventListener('keydown', resume, true);
      wrap.classList.remove('resume');
      if (choice !== 'off') return;
      if (e.target instanceof Node && menu.contains(e.target)) return; // they're choosing in the menu
      set(saved.s);
    };
    document.addEventListener('pointerdown', resume, true);
    document.addEventListener('keydown', resume, true);
  }

  return { current: () => choice, set: (c) => set(c) };
}
