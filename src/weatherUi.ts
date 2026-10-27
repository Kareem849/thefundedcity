// Header weather control: NYC conditions + temperature, sunrise/sunset, and a picker
// (Live NYC or a fixed condition for previewing rain, snow, storms, fog).
import { WEATHER_LABEL, type WeatherKind, type WeatherState } from './weather';

const ICON: Record<WeatherKind, string> = {
  clear: '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><circle cx="10" cy="10" r="3.6" fill="currentColor"/><path d="M10 1.8v2.4M10 15.8v2.4M1.8 10h2.4M15.8 10h2.4M4.2 4.2l1.7 1.7M14.1 14.1l1.7 1.7M4.2 15.8l1.7-1.7M14.1 5.9l1.7-1.7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  partly: '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><circle cx="7.5" cy="7.5" r="3" fill="currentColor" opacity=".8"/><path d="M6 16h8.5a3 3 0 0 0 0-6 4 4 0 0 0-7.6.9A2.6 2.6 0 0 0 6 16z" fill="currentColor"/></svg>',
  cloudy: '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M5.5 15.5h9a3.3 3.3 0 0 0 0-6.6 4.6 4.6 0 0 0-8.8 1A2.8 2.8 0 0 0 5.5 15.5z" fill="currentColor"/></svg>',
  fog: '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M3 7h14M2 10.5h16M4 14h12M6 17.5h8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  drizzle: '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M5.5 11.5h9a3 3 0 0 0 0-6 4.2 4.2 0 0 0-8 .9A2.6 2.6 0 0 0 5.5 11.5z" fill="currentColor"/><path d="M7 14l-.5 1.5M11 14l-.5 1.5M9 16.5l-.4 1.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  rain: '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M5.5 11h9a3 3 0 0 0 0-6 4.2 4.2 0 0 0-8 .9A2.6 2.6 0 0 0 5.5 11z" fill="currentColor"/><path d="M6.5 13.5l-1 2.8M10 13.5l-1 2.8M13.5 13.5l-1 2.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  snow: '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M10 2.5v15M3.5 6.2l13 7.6M3.5 13.8l13-7.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  storm: '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M5.5 10.5h9a3 3 0 0 0 0-6 4.2 4.2 0 0 0-8 .9A2.6 2.6 0 0 0 5.5 10.5z" fill="currentColor"/><path d="M10.5 11.5L8.5 15h3l-2 3.5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

export type WeatherChoice = 'live' | WeatherKind;

export function createWeatherUi(topbarRight: HTMLElement, onPick: (c: WeatherChoice) => void) {
  const wrap = document.createElement('div');
  wrap.className = 'wx';
  wrap.innerHTML = `
    <button class="wx-btn" id="wx-btn" aria-haspopup="true" aria-expanded="false" title="New York weather"></button>
    <div class="wx-menu glass-card" id="wx-menu" hidden role="menu">
      <div class="wx-head"><b id="wx-title"></b><span id="wx-src"></span></div>
      <div class="wx-sun" id="wx-sun"></div>
      <div class="wx-opts" role="group" aria-label="Weather">
        <button data-c="live" role="menuitemradio">Live NYC</button>
        ${(['clear', 'cloudy', 'rain', 'snow', 'storm', 'fog'] as WeatherKind[]).map((k) => `<button data-c="${k}" role="menuitemradio">${ICON[k]}${WEATHER_LABEL[k]}</button>`).join('')}
      </div>
    </div>`;
  // place before the Day/Night/Live switch
  const modeSwitch = topbarRight.querySelector('.mode-switch');
  topbarRight.insertBefore(wrap, modeSwitch);
  const btn = wrap.querySelector<HTMLButtonElement>('#wx-btn')!;
  const menu = wrap.querySelector<HTMLElement>('#wx-menu')!;
  const opts = [...wrap.querySelectorAll<HTMLButtonElement>('.wx-opts button')];
  let choice: WeatherChoice = 'live';
  const setOpen = (o: boolean) => { menu.hidden = !o; btn.setAttribute('aria-expanded', o ? 'true' : 'false'); };
  btn.addEventListener('click', (e) => { e.stopPropagation(); setOpen(!!menu.hidden); });
  document.addEventListener('pointerdown', (e) => { if (!wrap.contains(e.target as Node)) setOpen(false); });
  opts.forEach((b) => b.addEventListener('click', () => { choice = b.dataset.c as WeatherChoice; onPick(choice); setOpen(false); }));
  const tf = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });

  return {
    render(w: WeatherState, sun: { rise: number; set: number }, fetchNote: string) {
      const temp = w.tempC == null ? '' : `${Math.round(w.tempC)}°C · ${Math.round(w.tempC * 1.8 + 32)}°F`;
      btn.innerHTML = `${ICON[w.kind]}<span class="wx-t">${w.tempC == null ? WEATHER_LABEL[w.kind] : `${Math.round(w.tempC)}°`}</span>${choice !== 'live' ? '<i class="wx-pin" title="Fixed by you"></i>' : ''}`;
      btn.title = `New York: ${w.text}${temp ? ', ' + temp : ''}`;
      wrap.querySelector('#wx-title')!.innerHTML = `${ICON[w.kind]} New York · ${w.text}${temp ? ` <span>${temp}</span>` : ''}`;
      wrap.querySelector('#wx-src')!.textContent = choice !== 'live' ? 'Fixed by you — pick Live NYC to follow the real weather' : fetchNote;
      wrap.querySelector('#wx-sun')!.innerHTML = sun.rise ? `<span>Sunrise <b>${tf.format(sun.rise)}</b></span><span>Sunset <b>${tf.format(sun.set)}</b></span>` : '';
      opts.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.c === choice)));
    },
  };
}
