// Ride anything: the character boards a car, golf cart, ship, yacht, sailboat, airliner, small plane
// or helicopter and drives / sails / flies it with the keyboard (or the on-screen pad).
// Arcade physics: cars stay on land and stop at buildings (bridges and the causeway included),
// boats stay on water, planes need speed to climb and stay off the sea, helicopters hover.
import * as THREE from 'three';
import { vehicles, vehicleById, KIND_VERB, KIND_ACTION, type Vehicle } from './vehicles';
import type { NavGrid } from './navigation';
import type { CameraRig } from './camera';

const WATER_Y = -2.2;
const G = 0.12;
const KMH = 4.5; // world units/s → km/h (1 unit ≈ 1.25 m)
const FT = 4.1; // world units → feet

export interface RideDeps {
  rig: CameraRig;
  nav: NavGrid;
  onLand: (x: number, z: number, margin: number) => boolean;
  heightAt: (x: number, z: number) => number;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  player: {
    active: boolean;
    riding: boolean;
    position: THREE.Vector3;
    startRide: (get: () => THREE.Vector3) => void;
    endRide: (x: number, z: number) => void;
  };
  isTyping: () => boolean;
  toast: (title: string, sub: string) => void;
  needCharacter: () => void;
}

export interface RideSystem {
  board: (id: string) => void;
  exit: () => void;
  current: () => Vehicle | null;
  update: (dt: number, t: number) => void;
}

const ICON: Record<Vehicle['kind'], string> = {
  car: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M3 12.5l1.4-4.2A2 2 0 0 1 6.3 7h7.4a2 2 0 0 1 1.9 1.3l1.4 4.2V15h-2v-1.5H5V15H3z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/><circle cx="6.5" cy="12" r="1" fill="currentColor"/><circle cx="13.5" cy="12" r="1" fill="currentColor"/></svg>',
  boat: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M2.5 12.5h15l-2.2 3.5H4.8zM5 12.5V9h6l2.5 3.5M10 3v6" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  plane: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M10 2.5c.8 0 1.2.8 1.2 1.8V8l6 3.5v1.6l-6-1.8v3.6l1.8 1.4V18L10 17l-3 1v-1.7l1.8-1.4v-3.6l-6 1.8v-1.6l6-3.5V4.3c0-1 .4-1.8 1.2-1.8z" fill="currentColor"/></svg>',
  heli: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M2 4.5h16M10 4.5v2.5M5.5 11a4 4 0 0 1 4-4h1.5a4 4 0 0 1 0 8H9.5a4 4 0 0 1-4-4zM15 11h3.5M5 17.5h9" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>',
};

export function createRideSystem(root: HTMLElement, d: RideDeps): RideSystem {
  /* ---------------- HUD ---------------- */
  root.insertAdjacentHTML(
    'beforeend',
    `<div class="ride-bar glass-card" id="ride-bar" hidden role="status">
      <span class="ride-ico" id="ride-ico"></span>
      <div class="ride-text"><b id="ride-title"></b><span id="ride-meta"></span></div>
      <div class="ride-gauges"><span><em>Speed</em><b id="ride-speed">0</b><small>km/h</small></span><span id="ride-alt-wrap"><em>Altitude</em><b id="ride-alt">0</b><small>ft</small></span></div>
      <span class="ride-keys" id="ride-keys"></span>
      <button class="btn btn-ghost ride-view" id="ride-view" title="Switch view (V)">City view <kbd>V</kbd></button>
      <button class="btn btn-gold" id="ride-exit">Exit <kbd>E</kbd></button>
    </div>
    <div class="ride-pad" id="ride-pad" hidden aria-label="Vehicle controls">
      <button data-k="up" aria-label="Up">▲</button>
      <button data-k="left" aria-label="Left">◀</button>
      <button data-k="down" aria-label="Down">▼</button>
      <button data-k="right" aria-label="Right">▶</button>
      <button data-k="climb" class="alt" aria-label="Climb">⤒</button>
      <button data-k="sink" class="alt" aria-label="Descend">⤓</button>
    </div>
    <button class="ride-prompt glass-card" id="ride-prompt" hidden></button>`,
  );
  const $ = <T extends HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;
  const bar = $('ride-bar');
  const pad = $('ride-pad');
  const prompt = $<HTMLButtonElement>('ride-prompt');
  $('ride-exit').addEventListener('click', () => exit());
  $('ride-view').addEventListener('click', () => toggleView());
  const VIEW_NAME: Record<Vehicle['kind'], string> = { car: 'Drive view', boat: 'Sail view', plane: 'Fly view', heli: 'Fly view' };
  const subject = () => {
    const v = cur!;
    // banner planes: sit far enough back to clear the towed banner
    return { pos: v.obj.position, heading: v.obj.rotation.y + Math.PI / 2, kind: v.kind, size: v.obj.userData.banner ? 11 : v.halfLength };
  };
  function setChase(on: boolean) {
    if (!cur) return;
    d.rig.setChase(on ? subject : null);
    $('ride-view').innerHTML = `${on ? 'City view' : VIEW_NAME[cur.kind]} <kbd>V</kbd>`;
  }
  function toggleView() { if (cur) setChase(!d.rig.chasing); }

  /* ---------------- input ---------------- */
  const keys = new Set<string>();
  const MAP: Record<string, string> = {
    KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
    Space: 'climb', ShiftLeft: 'sink', ShiftRight: 'sink', KeyR: 'climb', KeyF: 'sink',
  };
  window.addEventListener('keydown', (e) => {
    if (d.isTyping() || d.rig.interior) return;
    if (e.code === 'KeyV' && !e.repeat && cur) { toggleView(); return; }
    if (e.code === 'KeyE' && !e.repeat) {
      if (cur) exit();
      else if (nearby) board(nearby.id);
      return;
    }
    if (!cur) return;
    const k = MAP[e.code];
    if (k) { keys.add(k); e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => { const k = MAP[e.code]; if (k) keys.delete(k); });
  window.addEventListener('blur', () => keys.clear());
  pad.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
    const k = b.dataset.k!;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); keys.add(k); b.setPointerCapture(e.pointerId); });
    const up = () => keys.delete(k);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
  });
  prompt.addEventListener('click', () => { if (nearby) board(nearby.id); });

  /* ---------------- state ---------------- */
  let cur: Vehicle | null = null;
  let speed = 0;
  let vy = 0;
  let yaw = 0;
  let roll = 0;
  let nearby: Vehicle | null = null;
  let nearTimer = 0;
  let edgeToastAt = 0;
  const fwd = new THREE.Vector3();

  const groundAt = (x: number, z: number) => (d.onLand(x, z, 0.5) ? d.heightAt(x, z) : null);
  const isWater = (x: number, z: number) =>
    x > d.bounds.minX && x < d.bounds.maxX && z > d.bounds.minZ && z < d.bounds.maxZ && !d.onLand(x, z, -3.5);

  function board(id: string) {
    const v = vehicleById(id);
    if (!v) return;
    if (!d.player.active) { d.needCharacter(); return; }
    if (cur) release();
    cur = v;
    v.obj.userData.controlled = true;
    v.obj.rotation.order = 'YXZ';
    yaw = v.obj.rotation.y;
    v.obj.rotation.x = 0;
    v.obj.rotation.z = 0;
    const airborne = (v.kind === 'plane' || v.kind === 'heli') && v.obj.position.y > G + 3;
    speed = v.kind === 'plane' && airborne ? Math.max(28, v.maxSpeed * 0.7) : 0;
    vy = 0;
    roll = 0;
    keys.clear();
    d.player.startRide(() => v.obj.position);
    d.rig.follow(() => v.obj.position);
    d.rig.zoomTo(v.kind === 'car' ? 3.2 : v.kind === 'boat' ? (v.halfLength > 10 ? 1.4 : 2.4) : v.kind === 'heli' ? 2 : v.halfLength > 4 ? 1.2 : 1.8, 0.8);
    document.body.classList.add('riding');
    bar.hidden = false;
    pad.hidden = !('ontouchstart' in window) && !matchMedia('(pointer: coarse)').matches;
    prompt.hidden = true;
    $('ride-ico').innerHTML = ICON[v.kind];
    $('ride-title').textContent = `${KIND_VERB[v.kind]} · ${v.name}`;
    $('ride-meta').textContent = v.model;
    $('ride-alt-wrap').hidden = v.kind === 'car' || v.kind === 'boat';
    $('ride-keys').innerHTML = v.kind === 'car' || v.kind === 'boat'
      ? '<kbd>W</kbd><kbd>S</kbd> throttle · <kbd>A</kbd><kbd>D</kbd> steer'
      : v.kind === 'heli'
        ? '<kbd>W</kbd><kbd>S</kbd> fwd/back · <kbd>A</kbd><kbd>D</kbd> turn · <kbd>Space</kbd> up · <kbd>Shift</kbd> down'
        : '<kbd>W</kbd><kbd>S</kbd> throttle · <kbd>A</kbd><kbd>D</kbd> bank · <kbd>Space</kbd> climb · <kbd>Shift</kbd> dive';
    pad.querySelectorAll<HTMLElement>('.alt').forEach((b) => (b.hidden = v.kind === 'car' || v.kind === 'boat'));
    setChase(true);
  }

  function release() {
    if (!cur) return;
    cur.obj.userData.controlled = false;
    cur.obj.rotation.x = 0;
    cur.obj.rotation.z = 0;
    if (cur.gear) cur.gear.visible = true;
    cur = null;
  }

  function exit() {
    if (!cur) return;
    const v = cur;
    const p = v.obj.position;
    const high = (v.kind === 'plane' || v.kind === 'heli') && p.y - (groundAt(p.x, p.z) ?? WATER_Y) > 6;
    const spot = d.nav.walkable(p.x, p.z) ? { x: p.x, z: p.z } : d.nav.nearestWalkable(p.x, p.z, 700);
    release();
    keys.clear();
    document.body.classList.remove('riding');
    bar.hidden = true;
    pad.hidden = true;
    const s = spot ?? { x: 5.5, z: 6.5 };
    d.player.endRide(s.x, s.z);
    // back to the city view, centred on the character
    d.rig.setChase(null);
    d.rig.follow(null);
    d.rig.focusOn(new THREE.Vector3(s.x, 1, s.z), { zoom: 3.2, blend: 1, duration: 0.8 });
    if (high) d.toast('Parachute landing', 'You jumped out and drifted down to dry land');
    else if (v.kind === 'boat') d.toast('Back on dry land', `You stepped off at the nearest shore`);
  }

  /* ---------------- physics ---------------- */
  function drive(v: Vehicle, dt: number) {
    const o = v.obj;
    const throttle = (keys.has('up') ? 1 : 0) - (keys.has('down') ? 1 : 0);
    const steer = (keys.has('left') ? 1 : 0) - (keys.has('right') ? 1 : 0);
    const max = v.maxSpeed;
    if (v.kind === 'car' || v.kind === 'boat') {
      const accel = v.kind === 'car' ? 16 : 5 + 40 / Math.max(4, v.halfLength * 2);
      if (throttle > 0) speed = Math.min(max, speed + accel * dt);
      else if (throttle < 0) speed = Math.max(-max * 0.3, speed - accel * 1.4 * dt);
      else speed *= Math.pow(v.kind === 'car' ? 0.25 : 0.6, dt);
      const turnRate = (v.kind === 'car' ? 1.9 : 0.9 / Math.max(1, v.halfLength / 6)) * THREE.MathUtils.clamp(Math.abs(speed) / 5, 0, 1) * Math.sign(speed || 1);
      yaw += steer * turnRate * dt;
      fwd.set(Math.cos(yaw), 0, -Math.sin(yaw));
      const nx = o.position.x + fwd.x * speed * dt;
      const nz = o.position.z + fwd.z * speed * dt;
      const lookX = nx + fwd.x * v.halfLength * Math.sign(speed || 1);
      const lookZ = nz + fwd.z * v.halfLength * Math.sign(speed || 1);
      if (v.kind === 'car') {
        if (d.nav.walkable(lookX, lookZ) && d.nav.walkable(nx, nz)) { o.position.x = nx; o.position.z = nz; }
        else speed *= -0.25; // bump
        o.position.y = d.heightAt(o.position.x, o.position.z) + (v.rideY ?? 0);
      } else {
        if (isWater(lookX, lookZ) && isWater(nx, nz)) { o.position.x = nx; o.position.z = nz; }
        else speed *= -0.2;
        o.position.y = WATER_Y + Math.sin(performance.now() / 700) * 0.05;
        roll += (steer * speed * 0.01 - roll) * Math.min(1, dt * 3);
      }
      o.rotation.y = yaw;
      o.rotation.x = v.kind === 'boat' ? -roll : 0;
      return;
    }
    // aircraft
    const ground = groundAt(o.position.x, o.position.z);
    const floor = ground ?? WATER_Y + 2.5;
    const onGround = o.position.y <= floor + 0.05;
    if (v.kind === 'heli') {
      const target = throttle * max;
      speed += (target - speed) * Math.min(1, dt * 1.5);
      yaw += steer * 1.3 * dt;
      const climb = (keys.has('climb') ? 1 : 0) - (keys.has('sink') ? 1 : 0);
      vy += (climb * 9 - vy) * Math.min(1, dt * 3);
      roll += (steer * 0.25 - roll) * Math.min(1, dt * 3);
      o.rotation.z = -speed / max * 0.18; // nose down when moving forward
    } else {
      const stall = v.halfLength > 4 ? 16 : 10;
      if (throttle > 0) speed = Math.min(max, speed + (v.halfLength > 4 ? 7 : 9) * dt);
      else if (throttle < 0) speed = Math.max(0, speed - 12 * dt);
      else if (onGround) speed *= Math.pow(0.5, dt);
      const turn = onGround ? 0.9 * THREE.MathUtils.clamp(speed / 6, 0, 1) : 0.65;
      yaw += steer * turn * dt;
      const climb = (keys.has('climb') ? 1 : 0) - (keys.has('sink') ? 1 : 0);
      let targetVy = climb * (speed > stall ? 9 : 0);
      if (!onGround && speed < stall) targetVy = -7; // stall: sink
      vy += (targetVy - vy) * Math.min(1, dt * 2);
      roll += ((onGround ? 0 : steer * 0.5) - roll) * Math.min(1, dt * 2.5);
      o.rotation.z = THREE.MathUtils.clamp(Math.atan2(vy, Math.max(1, speed)), -0.35, 0.35);
    }
    fwd.set(Math.cos(yaw), 0, -Math.sin(yaw));
    const nx = o.position.x + fwd.x * speed * dt;
    const nz = o.position.z + fwd.z * speed * dt;
    let ny = o.position.y + vy * dt;
    const nGround = groundAt(nx, nz);
    const nFloor = nGround ?? WATER_Y + 2.5;
    // on the ground a plane can't taxi into the sea
    const stallSpeed = v.halfLength > 4 ? 16 : 10;
    if (ny <= nFloor + 0.05 && nGround === null && v.kind === 'plane' && o.position.y <= floor + 0.05 && speed > stallSpeed) {
      // rolled off the end of the runway at flying speed: rotate and lift off
      vy = Math.max(vy, 5);
      o.position.x = nx;
      o.position.z = nz;
    } else if (ny <= nFloor + 0.05 && nGround === null && v.kind === 'plane' && o.position.y <= floor + 0.05) {
      speed *= -0.2;
    } else {
      // airspace limit: hold the edge and bank back toward the city
      const M = 20;
      const out = nx < d.bounds.minX - M || nx > d.bounds.maxX + M || nz < d.bounds.minZ - M || nz > d.bounds.maxZ + M;
      o.position.x = THREE.MathUtils.clamp(nx, d.bounds.minX - M, d.bounds.maxX + M);
      o.position.z = THREE.MathUtils.clamp(nz, d.bounds.minZ - M, d.bounds.maxZ + M);
      if (out) {
        const want = Math.atan2(-(0 - o.position.z), 0 - o.position.x);
        let diff = want - yaw;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        yaw += Math.sign(diff) * Math.min(Math.abs(diff), 1.4 * dt);
        if (edgeToastAt < performance.now()) { edgeToastAt = performance.now() + 8000; d.toast('Edge of the airspace', 'Turning back toward FUNDEDCITY'); }
      }
    }
    ny = THREE.MathUtils.clamp(ny, nFloor, 160);
    if (ny <= nFloor && vy < 0) vy = 0;
    o.position.y = ny;
    o.rotation.y = yaw;
    o.rotation.x = -roll;
    if (v.gear) v.gear.visible = o.position.y - nFloor < 3;
    for (const s of v.spinners ?? []) {
      if (v.kind === 'heli') s.rotation[s === v.spinners![0] ? 'y' : 'z'] += dt * 30;
      else s.rotation.x += dt * (8 + speed * 2);
    }
  }

  function updateHud() {
    if (!cur) return;
    $('ride-speed').textContent = String(Math.round(Math.abs(speed) * KMH)); // 1 world unit ≈ 1.25 m
    const floor = groundAt(cur.obj.position.x, cur.obj.position.z) ?? WATER_Y;
    $('ride-alt').textContent = String(Math.max(0, Math.round(((cur.obj.position.y - Math.max(floor, G)) * FT) / 5) * 5));
  }

  function scanNearby() {
    if (cur || !d.player.active || d.player.riding || d.rig.interior) { prompt.hidden = true; nearby = null; return; }
    const p = d.player.position;
    let best: Vehicle | null = null;
    let bestD = Infinity;
    for (const v of vehicles()) {
      const o = v.obj.position;
      if (o.y > 6) continue; // flying overhead
      const dist = Math.hypot(o.x - p.x, o.z - p.z) - v.halfLength;
      if (dist < 4.5 && dist < bestD) { best = v; bestD = dist; }
    }
    nearby = best;
    prompt.hidden = !best;
    if (best) prompt.innerHTML = `<kbd>E</kbd> ${KIND_ACTION[best.kind]} ${best.name}`;
  }

  return {
    board,
    exit,
    current: () => cur,
    update(dt) {
      if (cur) { drive(cur, Math.min(dt, 0.1)); updateHud(); }
      nearTimer -= dt;
      if (nearTimer <= 0) { nearTimer = 0.3; scanNearby(); }
    },
  };
}
