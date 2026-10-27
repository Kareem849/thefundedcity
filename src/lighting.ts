// Day / Night / Live lighting. Live follows the real sun over New York City (elevation for day,
// dusk and night; azimuth for the shadow direction) and the current NYC weather.
import * as THREE from 'three';
import type { City } from './city';
import { solarPosition, OVERCAST, type WeatherKind } from './weather';

export type LightMode = 'day' | 'night' | 'live';

export interface NycTime { hours: number; month: number; label: string }

export function nycNow(date = new Date()): NycTime {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', month: 'numeric', hour12: false,
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const h = get('hour') % 24;
  const m = get('minute');
  const label = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }).format(date);
  return { hours: h + m / 60, month: get('month') - 1, label };
}

/** 0 = full day, 1 = full night, from the real sun (civil twilight blend). */
export function nycNightLevel(date = new Date()): number {
  const el = solarPosition(date).elevation;
  return 1 - THREE.MathUtils.smoothstep(el, -7, 3);
}

interface LightingDeps {
  scene: THREE.Scene;
  hemi: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  city: City;
  renderer: THREE.WebGLRenderer;
  onLiveTick?: (t: NycTime, night: number) => void;
}

const DAY = {
  sky: new THREE.Color(0xf4f8ff), ground: new THREE.Color(0xdfe9d6), hemi: 0.95,
  sun: new THREE.Color(0xfff3e0), sunI: 2.9, env: 0.45,
};
const NIGHT = {
  sky: new THREE.Color(0x5a6fb0), ground: new THREE.Color(0x1c2540), hemi: 0.5,
  sun: new THREE.Color(0x9fb8ff), sunI: 0.75, env: 0.14,
};
const GOLDEN = new THREE.Color(0xffb36b);
const GREY_SKY = new THREE.Color(0xd9dee6);
const DEFAULT_DIR = new THREE.Vector3(-120, 250, 180).normalize();
const MOON_DIR = new THREE.Vector3(80, 240, 150).normalize();

export function createLighting(d: LightingDeps) {
  let mode: LightMode = 'live';
  let current = 0;
  let target = 0;
  let liveTimer = 0;
  let overcast = 0;
  let overcastTarget = 0;
  let golden = 0;
  let flash = 0;
  const sunDir = DEFAULT_DIR.clone();
  const dirTarget = DEFAULT_DIR.clone();
  const tmp = new THREE.Color();

  const apply = () => {
    const n = current;
    const ov = overcast;
    d.hemi.color.lerpColors(DAY.sky, NIGHT.sky, n);
    d.hemi.color.lerp(GREY_SKY, ov * 0.75 * (1 - n));
    d.hemi.groundColor.lerpColors(DAY.ground, NIGHT.ground, n);
    d.hemi.intensity = THREE.MathUtils.lerp(DAY.hemi, NIGHT.hemi, n) * (1 - ov * 0.12) + flash * 1.6;
    d.sun.color.lerpColors(DAY.sun, NIGHT.sun, n);
    if (golden > 0) d.sun.color.lerp(tmp.copy(GOLDEN), golden * (1 - n));
    // a sun shining from behind the camera flattens the scene: soften it a little there
    const front = Math.max(0, sunDir.x * 0.7071 + sunDir.z * 0.7071);
    d.sun.intensity = THREE.MathUtils.lerp(DAY.sunI, NIGHT.sunI, n) * (1 - ov * 0.88) * (1 - front * 0.22);
    d.scene.environmentIntensity = THREE.MathUtils.lerp(DAY.env, NIGHT.env, n) * (1 - ov * 0.25);
    d.city.applyNight(n);
    const root = document.documentElement.style;
    root.setProperty('--night', n.toFixed(3));
    root.setProperty('--overcast', ov.toFixed(3));
    root.setProperty('--golden', (golden * (1 - n) * (1 - ov)).toFixed(3));
    document.body.classList.toggle('night', n > 0.5);
    d.renderer.shadowMap.needsUpdate = true;
  };

  const liveTarget = () => {
    const now = new Date();
    const t = nycNow(now);
    const { elevation, azimuth } = solarPosition(now);
    const n = 1 - THREE.MathUtils.smoothstep(elevation, -7, 3);
    // sun direction from the real azimuth (north = −z, east = +x); elevation clamped for readable shadows
    const el = THREE.MathUtils.clamp(elevation, 34, 62) * (Math.PI / 180);
    const az = azimuth * (Math.PI / 180);
    const real = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
    dirTarget.copy(real).lerp(MOON_DIR, n).normalize();
    golden = 1 - THREE.MathUtils.smoothstep(elevation, 2, 14);
    d.onLiveTick?.(t, n);
    return n;
  };

  const api = {
    get mode() { return mode; },
    sunDir,
    state: () => ({ current, target, overcast, overcastTarget, flash, golden }),
    setMode(m: LightMode, instant = false) {
      mode = m;
      if (m === 'live') target = liveTarget();
      else {
        target = m === 'day' ? 0 : 1;
        golden = 0;
        dirTarget.copy(m === 'day' ? DEFAULT_DIR : MOON_DIR);
      }
      if (instant) { current = target; sunDir.copy(dirTarget); apply(); }
    },
    setWeather(kind: WeatherKind, instant = false) {
      overcastTarget = OVERCAST[kind];
      if (instant) { overcast = overcastTarget; apply(); }
    },
    setFlash(f: number) {
      if (Math.abs(f - flash) > 0.01) { flash = f; apply(); }
    },
    update(dt: number) {
      if (mode === 'live') {
        liveTimer -= dt;
        if (liveTimer <= 0) { liveTimer = 20; target = liveTarget(); }
      }
      let changed = false;
      if (Math.abs(target - current) > 0.0005) {
        current += (target - current) * Math.min(1, dt * 3.2);
        if (Math.abs(target - current) < 0.002) current = target;
        changed = true;
      }
      if (Math.abs(overcastTarget - overcast) > 0.0005) {
        overcast += (overcastTarget - overcast) * Math.min(1, dt * 1.5);
        if (Math.abs(overcastTarget - overcast) < 0.002) overcast = overcastTarget;
        changed = true;
      }
      if (sunDir.distanceToSquared(dirTarget) > 1e-6) {
        sunDir.lerp(dirTarget, Math.min(1, dt * 2)).normalize();
        changed = true;
      }
      if (changed) apply();
    },
  };
  return api;
}
