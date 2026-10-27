// New York City weather + sun for the Live city.
//
// • Sun: real solar position for Lower Manhattan (sunrise, sunset, dusk, sun direction).
// • Weather: fetched live from Open-Meteo (free, no key) whenever the browser allows it. The shared
//   artifact page blocks outside requests, so there it falls back to a researched snapshot; viewers can
//   also pick a condition themselves.
// • Effects: rain and snow particles around the camera, overcast light, fog, lightning in storms.
import * as THREE from 'three';

export const NYC = { lat: 40.7128, lon: -74.006 };

/* ------------------------------------------------------------------ */
/* sun */
/* ------------------------------------------------------------------ */
const RAD = Math.PI / 180;
/** Solar elevation and azimuth (degrees; azimuth clockwise from north). */
export function solarPosition(date: Date, lat = NYC.lat, lon = NYC.lon) {
  const d = date.getTime() / 86_400_000 - 10_957.5; // days since J2000.0
  const g = ((357.529 + 0.98560028 * d) % 360) * RAD;
  const q = (280.459 + 0.98564736 * d) % 360;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const e = (23.439 - 0.00000036 * d) * RAD;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
  const H = ((gmst * 15 + lon) * RAD - ra);
  const phi = lat * RAD;
  const el = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  let az = Math.atan2(-Math.cos(dec) * Math.sin(H), Math.sin(dec) * Math.cos(phi) - Math.cos(dec) * Math.sin(phi) * Math.cos(H));
  if (az < 0) az += Math.PI * 2;
  return { elevation: el / RAD, azimuth: az / RAD };
}

/** Today's sunrise and sunset in New York (ms UTC), found by scanning the local day. */
export function sunTimes(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const midnight = now.getTime() - ((get('hour') % 24) * 3600 + get('minute') * 60 + get('second')) * 1000;
  let rise = 0;
  let set = 0;
  let prev = solarPosition(new Date(midnight)).elevation;
  for (let m = 2; m <= 24 * 60; m += 2) {
    const t = midnight + m * 60_000;
    const el = solarPosition(new Date(t)).elevation;
    if (prev < -0.833 && el >= -0.833 && !rise) rise = t;
    if (prev >= -0.833 && el < -0.833 && !set) set = t;
    prev = el;
  }
  return { rise, set };
}

/* ------------------------------------------------------------------ */
/* weather data */
/* ------------------------------------------------------------------ */
export type WeatherKind = 'clear' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm';
export const WEATHER_LABEL: Record<WeatherKind, string> = {
  clear: 'Clear', partly: 'Partly cloudy', cloudy: 'Cloudy', fog: 'Fog', drizzle: 'Drizzle', rain: 'Rain', snow: 'Snow', storm: 'Thunderstorm',
};
/** How much each condition dims the sun (0 = none, 1 = fully overcast). */
export const OVERCAST: Record<WeatherKind, number> = { clear: 0, partly: 0.22, cloudy: 0.62, fog: 0.7, drizzle: 0.66, rain: 0.8, snow: 0.72, storm: 0.95 };

export interface WeatherState {
  kind: WeatherKind;
  tempC: number | null;
  text: string;
  /** 'live' (Open-Meteo), 'snapshot' (researched fallback) or 'manual' (picked by the viewer) */
  source: 'live' | 'snapshot' | 'manual';
  updated: number;
  windKmh?: number;
}

/** Researched fallback for the shared page (no outside requests there). */
export const WEATHER_SNAPSHOT: WeatherState = {
  kind: 'clear', tempC: 13.3, text: 'Sunny', source: 'snapshot', updated: Date.parse('2026-10-26T13:52:00Z'),
};

function fromWmo(code: number): WeatherKind {
  if (code === 0 || code === 1) return 'clear';
  if (code === 2) return 'partly';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'partly';
}

export async function fetchNycWeather(signal?: AbortSignal): Promise<WeatherState | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${NYC.lat}&longitude=${NYC.lon}&current=temperature_2m,weather_code,wind_speed_10m&timezone=America%2FNew_York`;
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const j = await res.json();
    const c = j?.current;
    if (!c || typeof c.weather_code !== 'number') return null;
    const kind = fromWmo(c.weather_code);
    return { kind, tempC: typeof c.temperature_2m === 'number' ? c.temperature_2m : null, text: WEATHER_LABEL[kind], source: 'live', updated: Date.now(), windKmh: c.wind_speed_10m };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* particles */
/* ------------------------------------------------------------------ */
export interface WeatherFx {
  set: (kind: WeatherKind) => void;
  update: (dt: number, t: number, center: THREE.Vector3, viewSize: number) => void;
  /** 0..1 lightning flash (storms) for the lighting system. */
  flash: () => number;
}

export function createWeatherFx(scene: THREE.Scene): WeatherFx {
  const BOX = { w: 260, h: 70, d: 260 };
  // rain: short line segments
  const RN = 5200;
  const rainPos = new Float32Array(RN * 6);
  const rainSeed = new Float32Array(RN * 3);
  for (let i = 0; i < RN; i++) {
    rainSeed[i * 3] = Math.random();
    rainSeed[i * 3 + 1] = Math.random();
    rainSeed[i * 3 + 2] = Math.random();
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainMat = new THREE.LineBasicMaterial({ color: 0xa9bed8, transparent: true, opacity: 0.55, depthWrite: false });
  const rain = new THREE.LineSegments(rainGeo, rainMat);
  rain.frustumCulled = false;
  rain.visible = false;
  scene.add(rain);
  // snow: round sprites
  const SN = 4200;
  const snowPos = new Float32Array(SN * 3);
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
  const sc = document.createElement('canvas');
  sc.width = sc.height = 32;
  const sg = sc.getContext('2d')!;
  const grad = sg.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  sg.fillStyle = grad;
  sg.fillRect(0, 0, 32, 32);
  const snowMat = new THREE.PointsMaterial({ size: 3, map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false, sizeAttenuation: false, opacity: 0.95 });
  const snow = new THREE.Points(snowGeo, snowMat);
  snow.frustumCulled = false;
  snow.visible = false;
  scene.add(snow);

  let kind: WeatherKind = 'clear';
  let flashV = 0;
  let nextBolt = 6;
  const wrap = (v: number, size: number) => ((v % size) + size) % size - size / 2;

  return {
    set(k) {
      kind = k;
      rain.visible = k === 'rain' || k === 'drizzle' || k === 'storm';
      snow.visible = k === 'snow';
      rainMat.opacity = k === 'drizzle' ? 0.32 : k === 'storm' ? 0.7 : 0.55;
      rainGeo.setDrawRange(0, (k === 'drizzle' ? RN * 0.4 : RN) * 2);
      scene.fog = k === 'fog' ? new THREE.Fog(0xd6dde6, 330, 620) : k === 'storm' || k === 'rain' ? new THREE.Fog(0xa9b4c2, 420, 900) : k === 'snow' ? new THREE.Fog(0xe7ecf2, 400, 860) : null;
    },
    flash: () => flashV,
    update(dt, t, center, viewSize) {
      const w = Math.min(BOX.w, viewSize * 1.4);
      const d = Math.min(BOX.d, viewSize * 1.4);
      if (rain.visible) {
        const speed = kind === 'storm' ? 70 : 52;
        const len = kind === 'drizzle' ? 0.9 : 1.6;
        const wind = kind === 'storm' ? 0.35 : 0.15;
        for (let i = 0; i < RN; i++) {
          const x = center.x + wrap(rainSeed[i * 3] * w + t * speed * wind, w);
          const z = center.z + wrap(rainSeed[i * 3 + 2] * d, d);
          const y = ((((rainSeed[i * 3 + 1] * BOX.h - t * speed) % BOX.h) + BOX.h) % BOX.h) - 1;
          const k = i * 6;
          rainPos[k] = x; rainPos[k + 1] = y; rainPos[k + 2] = z;
          rainPos[k + 3] = x - wind * len; rainPos[k + 4] = y + len; rainPos[k + 5] = z;
        }
        rainGeo.attributes.position.needsUpdate = true;
      }
      if (snow.visible) {
        snowMat.size = THREE.MathUtils.clamp(3.4 * (320 / viewSize), 2, 9);
        for (let i = 0; i < SN; i++) {
          const s0 = rainSeed[(i * 3) % (RN * 3)];
          const s1 = rainSeed[(i * 3 + 1) % (RN * 3)];
          const s2 = rainSeed[(i * 3 + 2) % (RN * 3)];
          snowPos[i * 3] = center.x + wrap(s0 * w + Math.sin(t * 0.7 + i) * 1.2 + t * 1.5, w);
          snowPos[i * 3 + 1] = ((((s1 * BOX.h - t * (3 + s2 * 2)) % BOX.h) + BOX.h) % BOX.h) - 1;
          snowPos[i * 3 + 2] = center.z + wrap(s2 * d + Math.cos(t * 0.5 + i) * 1.2, d);
        }
        snowGeo.attributes.position.needsUpdate = true;
      }
      // lightning
      flashV = Math.max(0, flashV - dt * 3.5);
      if (kind === 'storm') {
        nextBolt -= dt;
        if (nextBolt <= 0) {
          flashV = 1;
          nextBolt = 5 + Math.random() * 9;
          setTimeout(() => (flashV = 0.8), 140);
        }
      }
    },
  };
}
