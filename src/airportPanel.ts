// Airport panel: live radar scope of the city's air traffic, arrivals/departures board, and the
// advertising slots on every aircraft (airliner liveries, banner planes, helicopters).
import type { Airport, FlightInfo } from './airport';

export type AirTab = 'radar' | 'flights' | 'ads';
export interface AirportPanel { open: (tab?: AirTab) => void; close: () => void; isOpen: () => boolean }

const esc = (v: string) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const CLOSE = '<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const PRICE: Record<FlightInfo['kind'], number> = { airliner: 4_999, banner: 1_499, helicopter: 999 };

export function createAirportPanel(root: HTMLElement, airport: Airport): AirportPanel {
  root.insertAdjacentHTML(
    'beforeend',
    `<div class="media-overlay air-overlay" id="ap-overlay" hidden>
      <section class="media-panel air-panel" role="dialog" aria-modal="true" aria-labelledby="ap-title">
        <header class="mp-head">
          <div class="mp-title"><span class="mp-eyebrow ap-eyebrow">FUNDEDCITY INTERNATIONAL</span><h2 id="ap-title">Airport</h2></div>
          <nav class="mp-tabs" role="tablist">
            <button role="tab" data-tab="radar">Radar</button>
            <button role="tab" data-tab="flights">Flights</button>
            <button role="tab" data-tab="ads">Advertise</button>
          </nav>
          <button class="icon-btn sq mp-close" id="ap-close" aria-label="Close airport">${CLOSE}</button>
        </header>
        <div class="mp-body" id="ap-body"></div>
        <footer class="mp-foot"><span class="mp-feed">City air traffic is simulated in real time: airliners land and depart on runway 27 every 25 seconds, helicopters tour the city and banner planes circle overhead. Every aircraft is advertising space.</span></footer>
      </section>
    </div>`,
  );
  const overlay = root.querySelector<HTMLElement>('#ap-overlay')!;
  const body = overlay.querySelector<HTMLElement>('#ap-body')!;
  const tabs = [...overlay.querySelectorAll<HTMLButtonElement>('.mp-tabs button')];
  overlay.querySelector('#ap-close')!.addEventListener('click', () => close());
  overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) close(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) close(); });
  tabs.forEach((b) => b.addEventListener('click', () => show(b.dataset.tab as AirTab)));
  let tab: AirTab = 'radar';
  let raf = 0;
  const requested = new Set<string>();

  /* ---------------- radar ---------------- */
  let canvas: HTMLCanvasElement | null = null;
  const RANGE = 520;
  const drawRadar = () => {
    if (!canvas) return;
    const g = canvas.getContext('2d')!;
    const S = canvas.width;
    const R = S / 2 - 8;
    const c = S / 2;
    const t = performance.now() / 1000;
    const sweep = (t * (Math.PI * 2)) / 4;
    g.fillStyle = '#04140e';
    g.fillRect(0, 0, S, S);
    g.save();
    g.beginPath();
    g.arc(c, c, R, 0, Math.PI * 2);
    g.clip();
    const grad = g.createRadialGradient(c, c, 0, c, c, R);
    grad.addColorStop(0, '#0b2a1d');
    grad.addColorStop(1, '#03110b');
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);
    g.strokeStyle = 'rgba(57, 255, 160, 0.22)';
    g.lineWidth = 1;
    for (let k = 1; k <= 4; k++) { g.beginPath(); g.arc(c, c, (R * k) / 4, 0, Math.PI * 2); g.stroke(); }
    g.beginPath(); g.moveTo(c - R, c); g.lineTo(c + R, c); g.moveTo(c, c - R); g.lineTo(c, c + R); g.stroke();
    // coastline hints: islands (world → scope)
    const toS = (x: number, z: number) => [c + ((x - airport.radarCenter.x) / RANGE) * R, c + ((z - airport.radarCenter.z) / RANGE) * R] as const;
    g.strokeStyle = 'rgba(57, 255, 160, 0.35)';
    for (const [x0, z0, x1, z1] of [[-107, -88, 107, 88], [171, -88, 311, 88], [-172, -80, -100, 80], [-90, -215, 250, -125]]) {
      const [a, b] = toS(x0, z0);
      const [cc, d] = toS(x1, z1);
      g.strokeRect(a, b, cc - a, d - b);
    }
    // runway
    const [r0x, r0y] = toS(-60, -192);
    const [r1x] = toS(222, -192);
    g.strokeStyle = 'rgba(160, 255, 210, 0.8)';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(r0x, r0y); g.lineTo(r1x, r0y); g.stroke();
    // sweep wedge
    const wedge = g.createConicGradient ? g.createConicGradient(sweep - 0.6, c, c) : null;
    if (wedge) {
      wedge.addColorStop(0, 'rgba(57,255,160,0)');
      wedge.addColorStop(0.095, 'rgba(57,255,160,0.28)');
      wedge.addColorStop(0.1, 'rgba(57,255,160,0)');
      g.fillStyle = wedge;
      g.fillRect(0, 0, S, S);
    }
    g.strokeStyle = 'rgba(120,255,190,0.9)';
    g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.cos(sweep) * R, c + Math.sin(sweep) * R); g.stroke();
    // blips (brighter just after the sweep passes)
    g.font = '700 11px Manrope, Inter, system-ui, sans-serif';
    for (const f of airport.flights()) {
      const [x, y] = toS(f.pos.x, f.pos.z);
      const ang = Math.atan2(y - c, x - c);
      let since = sweep - ang;
      since = ((since % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const glow = 1 - since / (Math.PI * 2);
      const colr = f.kind === 'airliner' ? '120,255,190' : f.kind === 'helicopter' ? '255,214,120' : '140,200,255';
      g.fillStyle = `rgba(${colr},${0.35 + glow * 0.65})`;
      g.beginPath(); g.arc(x, y, f.kind === 'airliner' ? 4 : 3, 0, Math.PI * 2); g.fill();
      // heading tick
      g.strokeStyle = `rgba(${colr},${0.4 + glow * 0.6})`;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(-f.heading) * 10, y + Math.sin(-f.heading) * 10); g.stroke();
      g.fillText(`${f.flight}  ${Math.round(f.alt * 100)}ft`, x + 7, y - 6);
    }
    g.restore();
    g.strokeStyle = 'rgba(57,255,160,0.6)';
    g.lineWidth = 2;
    g.beginPath(); g.arc(c, c, R, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(160,255,210,0.8)';
    g.font = '800 12px Manrope, Inter, system-ui, sans-serif';
    g.fillText('N', c - 4, 20);
  };

  const listHtml = () => {
    const fl = airport.flights();
    return `<ul class="ap-live">${fl.map((f) => `<li><b>${esc(f.flight)}</b><span>${esc(f.type)}</span><em>${esc(f.status)}</em><i>${Math.round(f.alt * 100)} ft</i></li>`).join('')}</ul>`;
  };

  function render() {
    cancelAnimationFrame(raf);
    canvas = null;
    if (tab === 'radar') {
      body.innerHTML = `<div class="ap-radar"><canvas id="ap-scope" width="440" height="440" aria-label="Radar scope"></canvas><div class="ap-side"><h4 class="mk-h">Live traffic</h4><div id="ap-live">${listHtml()}</div><p class="st-note">Range ≈ ${RANGE * 3} m from the control tower. Altitudes in feet. Green = airliners, amber = helicopters, blue = banner planes.</p></div></div>`;
      canvas = body.querySelector('#ap-scope');
      let last = 0;
      const loop = (now: number) => {
        drawRadar();
        if (now - last > 500) { last = now; const l = body.querySelector('#ap-live'); if (l) l.innerHTML = listHtml(); }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    } else if (tab === 'flights') {
      const tick = () => {
        const al = airport.flights().filter((f) => f.kind === 'airliner');
        const clock = (s: number) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(Date.now() + s * 1000);
        const arr = [...al].sort((a, b) => a.etaLand! - b.etaLand!);
        const dep = [...al].sort((a, b) => a.etaTakeoff! - b.etaTakeoff!);
        body.innerHTML = `
          <div class="ap-boards">
            <section><h4 class="mk-h">Arrivals</h4><table class="ap-board"><thead><tr><th>Time</th><th>Flight</th><th>From</th><th>Aircraft</th><th>Status</th></tr></thead><tbody>
              ${arr.map((f) => `<tr><td>${clock(f.etaLand!)}</td><td><b>${esc(f.flight)}</b></td><td>${esc(f.from ?? '')}</td><td>${esc(f.type)}</td><td><span class="ap-st">${f.etaLand! < 40 && f.alt > 0.5 ? 'Landing in ' + mmss(f.etaLand!) : esc(f.status)}</span></td></tr>`).join('')}
            </tbody></table></section>
            <section><h4 class="mk-h">Departures</h4><table class="ap-board"><thead><tr><th>Time</th><th>Flight</th><th>To</th><th>Gate</th><th>Status</th></tr></thead><tbody>
              ${dep.map((f) => `<tr><td>${clock(f.etaTakeoff!)}</td><td><b>${esc(f.flight)}</b></td><td>${esc(f.to ?? '')}</td><td>${esc(f.gate ?? '')}</td><td><span class="ap-st">${f.status.startsWith('At gate') ? 'Boarding · departs in ' + mmss(f.etaTakeoff!) : esc(f.status)}</span></td></tr>`).join('')}
            </tbody></table></section>
          </div>`;
      };
      tick();
      const iv = setInterval(() => { if (!isOpen() || tab !== 'flights') { clearInterval(iv); return; } tick(); }, 1000);
    } else {
      const fl = airport.flights();
      body.innerHTML = `
        <p class="mk-note">Put your brand on the city's aircraft: airliner liveries are seen at the gates, on the runway and in the sky; banner planes tow your message around the city all day; helicopters carry it on the tail boom.</p>
        <div class="ap-ads">${fl.map((f) => `
          <div class="ap-ad">
            <span class="ap-kind">${f.kind === 'airliner' ? 'Airliner livery' : f.kind === 'banner' ? 'Banner plane' : 'Helicopter'}</span>
            <b>${esc(f.flight)} · ${esc(f.type)}</b>
            <span class="ap-now">Now showing: <em>${esc(f.ad)}</em></span>
            <div class="ap-price">${'$' + PRICE[f.kind].toLocaleString('en-US')}<small>/month</small></div>
            <button class="btn ${requested.has(f.id) ? 'btn-ghost' : 'btn-primary'}" data-req="${esc(f.id)}"${requested.has(f.id) ? ' disabled' : ''}>${requested.has(f.id) ? 'Requested (demo)' : 'Request this slot'}</button>
          </div>`).join('')}</div>`;
      body.querySelectorAll<HTMLButtonElement>('[data-req]').forEach((b) => b.addEventListener('click', () => { requested.add(b.dataset.req!); render(); }));
    }
  }
  function show(t: AirTab) {
    tab = t;
    tabs.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
    render();
  }
  function open(t: AirTab = tab) {
    overlay.hidden = false;
    document.body.classList.add('media-open');
    show(t);
  }
  function close() {
    overlay.hidden = true;
    cancelAnimationFrame(raf);
    document.body.classList.remove('media-open');
  }
  const isOpen = () => !overlay.hidden;
  return { open, close, isOpen };
}
