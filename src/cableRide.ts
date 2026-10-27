// Ride the cable car: step into a glass gondola at the lower station (north-west corner of the main
// island), glide over the sea and the foothills past three pylons, and step out at Founders' Summit.
// The ride back down starts when you leave the summit. Your character stands in the cabin the whole way.
import * as THREE from 'three';
import { CABIN_FLOOR, STATION, type CableCar } from './founders';
import type { CameraRig } from './camera';

export type CableState = 'idle' | 'boarding' | 'moving' | 'top';

export interface CableRideDeps {
  cable: CableCar;
  rig: CameraRig;
  player: {
    active: boolean;
    riding: boolean;
    position: THREE.Vector3;
    startRide: (get: () => THREE.Vector3, opts?: { visible?: boolean; yaw?: number }) => void;
    endRide: (x: number, z: number) => void;
  };
  /** where you step off at the bottom (a walkable spot on the city side of the station) */
  exitSpot: () => { x: number; z: number };
  /** may the prompt show / a ride start right now? (not inside, not driving, no panel open) */
  canBoard: () => boolean;
  isTyping: () => boolean;
  needCharacter: () => void;
  onTop: () => void;
  onBottom: () => void;
}

export interface CableRide {
  state: () => CableState;
  /** riding, boarding or waiting at the top */
  busy: () => boolean;
  nearStation: () => boolean;
  boardUp: () => boolean;
  boardDown: () => void;
  /** run `fn` once you're back on the ground (turns the cabin round if it's still going up) */
  then: (fn: () => void) => void;
  update: (dt: number) => void;
}

const SPEED = 9; // world units / s ≈ 40 km/h
const KMH = 4.5;
const FT = 4.1;
const GONDOLA = '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M2 3.5l16 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M10 5v3" stroke="currentColor" stroke-width="1.6"/><rect x="4.5" y="8" width="11" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4.5 12h11" stroke="currentColor" stroke-width="1.4"/></svg>';

export function createCableRide(root: HTMLElement, d: CableRideDeps): CableRide {
  root.insertAdjacentHTML(
    'beforeend',
    `<div class="ride-bar glass-card cable-bar" id="cable-bar" hidden role="status">
      <span class="ride-ico">${GONDOLA}</span>
      <div class="ride-text"><b id="cb-title">Cable car · Founders’ Summit line</b><span id="cb-meta"></span></div>
      <div class="cb-line" aria-hidden="true"><i class="cb-stop"></i><i class="cb-py" style="left:33%"></i><i class="cb-py" style="left:66%"></i><i class="cb-py" style="left:93%"></i><i class="cb-stop end"></i><b id="cb-dot"></b></div>
      <div class="ride-gauges"><span><em>Speed</em><b id="cb-speed">0</b><small>km/h</small></span><span><em>Altitude</em><b id="cb-alt">0</b><small>ft</small></span></div>
      <button class="btn btn-ghost" id="cb-fast" aria-pressed="false" title="Fast-forward the ride">×3</button>
      <button class="btn btn-ghost" id="cb-view" title="Switch view (V)">City view <kbd>V</kbd></button>
      <button class="btn btn-gold" id="cb-back">Turn back</button>
    </div>
    <button class="ride-prompt glass-card cable-prompt" id="cable-prompt" hidden><kbd>E</kbd> Ride the cable car up to Founders’ Summit</button>`,
  );
  const $ = <T extends HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;
  const bar = $('cable-bar');
  const prompt = $<HTMLButtonElement>('cable-prompt');
  const fastBtn = $<HTMLButtonElement>('cb-fast');
  const viewBtn = $<HTMLButtonElement>('cb-view');
  const backBtn = $<HTMLButtonElement>('cb-back');

  let state: CableState = 'idle';
  let side = -1;
  let u = 0;
  let dir = 1;
  let v = 0;
  let timer = 0;
  let fast = false;
  let pending: (() => void) | null = null;
  let promptTimer = 0;
  const attach = new THREE.Vector3();
  const floor = new THREE.Vector3();
  const look = new THREE.Vector3();
  const getAttach = () => d.cable.at(u, side, attach);
  const getFloor = () => { getAttach(); return floor.set(attach.x, attach.y - CABIN_FLOOR, attach.z); };
  const yawNow = () => d.cable.upYaw + (dir > 0 ? 0 : Math.PI);
  const subject = () => {
    getAttach();
    look.set(attach.x, attach.y - 2.6, attach.z);
    return { pos: look, heading: yawNow(), kind: 'cable' as const, size: 0 };
  };

  function setChase(on: boolean) {
    if (on) { d.rig.setChase(subject); viewBtn.innerHTML = 'City view <kbd>V</kbd>'; }
    else {
      d.rig.setChase(null);
      d.rig.focusOn(getFloor().clone(), { zoom: 1.6, blend: 1, duration: 0.6 });
      d.rig.follow(() => getFloor());
      viewBtn.innerHTML = 'Cabin view <kbd>V</kbd>';
    }
  }

  function start(newDir: number) {
    dir = newDir;
    u = dir > 0 ? 0 : 1;
    v = 0;
    state = 'boarding';
    timer = 1.3;
    d.cable.setRider({ side, u });
    d.player.startRide(getFloor, { visible: true, yaw: yawNow() });
    document.body.classList.add('riding', 'cable-riding');
    bar.hidden = false;
    prompt.hidden = true;
    backBtn.disabled = true;
    setChase(true);
    hud();
  }

  function boardUp() {
    if (state !== 'idle') return false;
    if (!d.player.active) { d.needCharacter(); return false; }
    // whichever cabin is nearer the bottom pulls in for you
    side = d.cable.uOf(-1) <= d.cable.uOf(1) ? -1 : 1;
    start(1);
    return true;
  }
  function boardDown() {
    if (state !== 'top') return;
    start(-1);
  }
  function turnBack() {
    if (state !== 'moving') return;
    dir = -dir;
    v *= 0.3;
    d.player.startRide(getFloor, { visible: true, yaw: yawNow() });
  }

  function arrive() {
    if (dir > 0) {
      state = 'top';
      u = 1;
      d.cable.setRider({ side, u });
      d.player.startRide(getFloor, { visible: false }); // you're out on the plaza now
      bar.hidden = true;
      d.rig.setChase(null);
      d.rig.follow(null);
      if (pending) { start(-1); return; }
      d.onTop();
      return;
    }
    // back at the bottom: step out on the city side
    state = 'idle';
    u = 0;
    d.cable.setRider(null);
    const s = d.exitSpot();
    d.player.endRide(s.x, s.z);
    document.body.classList.remove('riding', 'cable-riding');
    bar.hidden = true;
    d.rig.setChase(null);
    d.rig.follow(null);
    d.rig.focusOn(new THREE.Vector3(s.x, 1, s.z), { zoom: 3.2, blend: 1, duration: 0.8 });
    d.onBottom();
    const fn = pending;
    pending = null;
    if (fn) setTimeout(fn, 250);
  }

  function hud() {
    getFloor();
    const pct = Math.round(u * 100);
    $('cb-meta').textContent = state === 'boarding'
      ? (dir > 0 ? 'Doors closing · next stop Founders’ Summit' : 'Doors closing · next stop the city')
      : `${dir > 0 ? 'Going up' : 'Going down'} · ${dir > 0 ? pct : 100 - pct}% of the way`;
    $('cb-dot').style.left = `${u * 100}%`;
    $('cb-speed').textContent = String(Math.round(v * KMH));
    $('cb-alt').textContent = String(Math.max(0, Math.round((floor.y * FT) / 5) * 5));
  }

  fastBtn.addEventListener('click', () => { fast = !fast; fastBtn.setAttribute('aria-pressed', String(fast)); fastBtn.classList.toggle('on', fast); });
  viewBtn.addEventListener('click', () => { if (state === 'boarding' || state === 'moving') setChase(!d.rig.chasing); });
  backBtn.addEventListener('click', () => turnBack());
  prompt.addEventListener('click', () => boardUp());
  window.addEventListener('keydown', (e) => {
    if (d.isTyping() || e.repeat) return;
    if (e.code === 'KeyE' && !prompt.hidden) { boardUp(); return; }
    if (e.code === 'KeyV' && (state === 'boarding' || state === 'moving')) setChase(!d.rig.chasing);
  });

  return {
    state: () => state,
    busy: () => state !== 'idle',
    nearStation,
    boardUp,
    boardDown,
    then(fn) {
      pending = fn;
      if ((state === 'moving' || state === 'boarding') && dir > 0) {
        if (state === 'boarding') { state = 'moving'; }
        turnBack();
      }
      // at the top, leaving the summit starts the ride down; at the bottom it runs on arrival
    },
    update(dt) {
      if (state === 'boarding') {
        timer -= dt;
        if (timer <= 0) { state = 'moving'; backBtn.disabled = false; }
        d.cable.setRider({ side, u });
        hud();
      } else if (state === 'moving') {
        const L = d.cable.length;
        const toEnd = (dir > 0 ? 1 - u : u) * L;
        // pull away gently, cruise, and slow into the station
        const cruise = SPEED * (fast ? 3 : 1);
        const brake = Math.sqrt(2 * 2.2 * Math.max(0, toEnd)) + 0.6;
        const target = Math.min(cruise, brake);
        v = v < target ? Math.min(target, v + (fast ? 7 : 2.4) * dt) : Math.max(target, v - 6 * dt);
        u = THREE.MathUtils.clamp(u + (dir * v * dt) / L, 0, 1);
        d.cable.setRider({ side, u });
        d.cable.update(0); // move the cabins this frame too, so you and your cabin stay together
        hud();
        if ((dir > 0 && u >= 1) || (dir < 0 && u <= 0)) arrive();
      }
      // the boarding prompt at the lower station
      promptTimer -= dt;
      if (promptTimer <= 0) {
        promptTimer = 0.25;
        prompt.hidden = !(state === 'idle' && d.player.active && !d.player.riding && d.canBoard() && nearStation());
      }
    },
  };
  function nearStation() {
    const p = d.player.position;
    return Math.hypot(p.x - STATION.x, p.z - STATION.z) < 10.5;
  }
}
