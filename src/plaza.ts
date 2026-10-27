// THE PLAZA district: new land joining Brooklyn's east coast, beyond the last avenue (x 304), with a
// parking lot along the avenue, a pedestrian square, and the two buildings facing west towards Brooklyn.
//  • THE PLAZA: a two-storey shopping mall (glass barrel-vault atrium, six section storefronts) where prop
//    firms, brokers, traders, copy-trading firms and anyone else sell products, services, courses and tools.
//    No listing fees: 75% of every sale to the seller, 25% to the Plaza.
//  • THE TRADING FLOOR: a round exchange hall next to the mall with an LED ticker of the latest ideas; inside,
//    five pits (FX, INDICES, COMMODITIES, CRYPTO, OPTIONS) where traders chat and share charts.
import * as THREE from 'three';
import { mesh, box, rbox, signPlane, makeBuildingMaterials, getGlassMaterial } from './buildings';
import { bake, noBake } from './bake';

/** the new land (joins Brooklyn's east coast) */
export const PLAZA_LAND = { x0: 303, x1: 366, z0: -52, z1: 54, r: 16 };
/** both doors face west (local −z → world −x) onto the square, across from the parking lot */
export const MALL = { x: 346, z: -30, w: 28, d: 22, rot: Math.PI / 2 };
/** the Trading Floor stands where Touch The Grass Park used to be (west of the Corporate Ring), door facing east */
export const FLOOR = { x: -88, z: -64, r: 8.6, rot: -Math.PI / 2 };
/** the parking lot along Brooklyn's east avenue (world rect) and the square in front of the doors */
export const PARKING = { x0: 307, x1: 322.6, z0: -47, z1: 5 };
export const PLAZA_SQUARE = { x0: 323, x1: 337, z0: -47, z1: 6 };
/** local (building) offset → world, for a building rotated by `rot` about y */
function toWorld(cx: number, cz: number, rot: number, lx: number, lz: number) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return { x: cx + lx * c + lz * s, z: cz - lx * s + lz * c };
}
function rectToWorld(cx: number, cz: number, rot: number, lx: number, lz: number, hw: number, hd: number): Obstacle {
  const p = toWorld(cx, cz, rot, lx, lz);
  const side = Math.abs(Math.sin(rot)) > 0.5;
  return { kind: 'rect', x: p.x, z: p.z, hw: side ? hd : hw, hd: side ? hw : hd };
}

/* ---------------- marketplace sections ---------------- */
export type SectionId = 'firms' | 'brokers' | 'courses' | 'tools' | 'copy' | 'services';
export const SECTIONS: Array<{ id: SectionId; label: string; short: string; color: string; blurb: string }> = [
  { id: 'firms', label: 'Prop Firms', short: 'PROP FIRMS', color: '#2f6bff', blurb: 'Challenges, instant funding, scaling plans' },
  { id: 'brokers', label: 'Brokers', short: 'BROKERS', color: '#14b88a', blurb: 'Accounts, platforms, data feeds' },
  { id: 'courses', label: 'Courses & Mentoring', short: 'COURSES', color: '#c9973a', blurb: 'Courses, coaching, mentorships' },
  { id: 'tools', label: 'Indicators & Tools', short: 'INDICATORS', color: '#7c5cff', blurb: 'Indicators, EAs, journals, risk tools' },
  { id: 'copy', label: 'Copy Trading', short: 'COPY TRADING', color: '#ff7a45', blurb: 'Copy-trading services & signal rooms' },
  { id: 'services', label: 'Services & More', short: 'SERVICES', color: '#e0457b', blurb: 'VPS, design, coding, anything else' },
];
export const SELLER_TYPES = ['Prop firm', 'Broker', 'Trader', 'Copy-trading firm', 'Other'] as const;
export type SellerType = (typeof SELLER_TYPES)[number];
/** the Plaza's share of every sale (no listing fees) */
export const PLAZA_CUT = 0.25;

/* ---------------- trading floor rooms ---------------- */
export type RoomId = 'fx' | 'indices' | 'commodities' | 'crypto' | 'options';
export const ROOMS: Array<{ id: RoomId; label: string; color: string; hex: number; examples: string }> = [
  { id: 'fx', label: 'FX', color: '#3d7bff', hex: 0x3d7bff, examples: 'EURUSD, GBPJPY, USDJPY…' },
  { id: 'indices', label: 'INDICES', color: '#14b88a', hex: 0x14b88a, examples: 'NQ, ES, DAX, US30…' },
  { id: 'commodities', label: 'COMMODITIES', color: '#f2a33a', hex: 0xf2a33a, examples: 'XAUUSD, CL, NG, silver…' },
  { id: 'crypto', label: 'CRYPTO', color: '#9b6bff', hex: 0x9b6bff, examples: 'BTC, ETH, SOL perps…' },
  { id: 'options', label: 'OPTIONS', color: '#ff5d7a', hex: 0xff5d7a, examples: 'SPX 0DTE, spreads, IV…' },
];

const FONT = 'Manrope, Inter, system-ui, sans-serif';
function canvasTex(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { c, g: c.getContext('2d')!, tex };
}
type Obstacle = { kind: 'rect'; x: number; z: number; hw: number; hd: number } | { kind: 'circle'; x: number; z: number; r: number };

/* ======================================================================= */
/* THE PLAZA · shopping mall                                               */
export function buildMall() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const mats = makeBuildingMaterials();
  mats.white.color.setHex(0xf4efe6);
  const { w: W, d: D } = MALL;
  const H = 7.4;
  const Y = 0.3;
  const dark = new THREE.MeshStandardMaterial({ color: 0x23232f, roughness: 0.45, metalness: 0.3 });
  const stone = new THREE.MeshStandardMaterial({ color: 0xe2dccf, roughness: 0.8 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xe6b95a, roughness: 0.3, metalness: 0.7, emissive: 0x6b4a10, emissiveIntensity: 0.3 });
  const obstacles: Obstacle[] = [];

  const podium = mesh(rbox(W + 1.2, Y, D + 1.2, 0.3), stone, false);
  podium.position.y = Y / 2;
  const main = mesh(rbox(W, H, D, 0.5), mats.white);
  main.position.y = Y + H / 2;
  body.add(podium, main);
  // ground-floor shop windows all round, under a dark canopy band
  const glass = getGlassMaterial();
  const front = mesh(box(W - 2, 2.7, 0.1), glass, false);
  front.position.set(0, Y + 1.5, -D / 2 - 0.03);
  const back = front.clone();
  back.position.z = D / 2 + 0.03;
  const side = mesh(box(0.1, 2.7, D - 2), glass, false);
  side.position.set(-W / 2 - 0.03, Y + 1.5, 0);
  const side2 = side.clone();
  side2.position.x = W / 2 + 0.03;
  body.add(front, back, side, side2);
  for (const [w, d, x, z] of [[W + 0.8, 1.4, 0, -D / 2 - 0.45], [W + 0.8, 1.4, 0, D / 2 + 0.45], [1.4, D + 0.8, -W / 2 - 0.45, 0], [1.4, D + 0.8, W / 2 + 0.45, 0]] as const) {
    const c = mesh(box(w, 0.22, d), dark);
    c.position.set(x, Y + 3.1, z);
    body.add(c);
  }
  // upper floor: a band of slim windows + a parapet
  for (const sx of [-1, 1]) {
    const up = mesh(box(9.6, 1.5, 0.1), glass, false);
    up.position.set(sx * 8.9, Y + 6.2, -D / 2 - 0.03);
    body.add(up);
  }
  const parapet = mesh(box(W + 0.3, 0.45, D + 0.3), mats.trim);
  parapet.position.y = Y + H + 0.1;
  body.add(parapet);

  // six section signs on the upper façade (three either side of the entrance), each with a colour bar
  SECTIONS.forEach((s, i) => {
    const sx = i < 3 ? 1 : -1; // the façade faces −z, so +x is on a visitor's left
    const k = i < 3 ? 2 - i : i - 3;
    const x = sx * (4.9 + k * 3.05 + 1.45);
    const plate = signPlane(s.short, 2.85, 0.82, { bg: '#ffffff', fg: '#1d1b2e', accent: s.color });
    plate.position.set(x, Y + 4.55, -D / 2 - 0.06);
    plate.rotation.y = Math.PI;
    body.add(plate);
    const bar = mesh(box(2.85, 0.1, 0.14), new THREE.MeshStandardMaterial({ color: new THREE.Color(s.color), emissive: new THREE.Color(s.color), emissiveIntensity: 0.35 }), false);
    bar.position.set(x, Y + 4.05, -D / 2 - 0.08);
    body.add(bar);
  });

  // entrance portal: a tall glass box with a gold frame
  const portal = mesh(rbox(7, 8.6, 2.2, 0.2), dark);
  portal.position.set(0, Y + 4.3, -D / 2 - 0.7);
  const pGlass = mesh(box(5.8, 7.4, 0.1), new THREE.MeshStandardMaterial({ color: 0xbfd9ef, roughness: 0.08, metalness: 0.4, transparent: true, opacity: 0.75, emissive: 0x5a7da8, emissiveIntensity: 0.15 }), false);
  pGlass.position.set(0, Y + 4.1, -D / 2 - 1.82);
  const pFrame = mesh(box(6.2, 0.18, 0.2), gold, false);
  pFrame.position.set(0, Y + 7.9, -D / 2 - 1.86);
  const door = mesh(box(2.8, 2.6, 0.12), dark, false);
  door.position.set(0, Y + 1.3, -D / 2 - 1.9);
  for (const dx of [-0.7, 0.7]) {
    const handle = mesh(box(0.06, 0.8, 0.08), gold, false);
    handle.position.set(dx, Y + 1.3, -D / 2 - 1.98);
    body.add(handle);
  }
  body.add(portal, pGlass, pFrame, door);
  obstacles.push(rectToWorld(MALL.x, MALL.z, MALL.rot, 0, 0, W / 2 + 0.5, D / 2 + 0.5), rectToWorld(MALL.x, MALL.z, MALL.rot, 0, -D / 2 - 0.9, 3.6, 1.2));

  // THE PLAZA sign on the roof (both faces)
  const signF = signPlane('THE PLAZA', 11, 2.1, { bg: '#1d1b2e', fg: '#ffffff', sub: 'MALL · MARKETPLACE · 0 LISTING FEES', subColor: '#f2c14e' });
  signF.position.set(0, Y + H + 2.5, -D / 2 + 0.92);
  signF.rotation.y = Math.PI;
  const signB = signF.clone();
  signB.rotation.y = 0;
  signB.position.z = -D / 2 + 1.08;
  const signFrame = mesh(box(11.3, 2.35, 0.1), dark, false);
  signFrame.position.set(0, Y + H + 2.5, -D / 2 + 1.0);
  for (const dx of [-3.5, 3.5]) {
    const leg = mesh(box(0.18, 1.6, 0.18), dark);
    leg.position.set(dx, Y + H + 0.8, -D / 2 + 1.0);
    body.add(leg);
  }
  body.add(signF, signB, signFrame);

  // glass barrel-vault skylight over the atrium (runs front to back) with ribs
  const vaultLen = D - 4;
  const vault = new THREE.Mesh(
    new THREE.CylinderGeometry(4.2, 4.2, vaultLen, 28, 1, true, Math.PI / 2, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0xcfe6f7, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.55, side: THREE.DoubleSide, emissive: 0x9fc6ea, emissiveIntensity: 0.1 }),
  );
  vault.rotation.x = Math.PI / 2;
  vault.position.set(0, Y + H + 0.3, 1);
  noBake(vault);
  root.add(vault);
  for (let z = -vaultLen / 2; z <= vaultLen / 2 + 0.01; z += vaultLen / 6) {
    const rib = mesh(new THREE.TorusGeometry(4.22, 0.07, 6, 28, Math.PI), mats.trim, false);
    rib.position.set(0, Y + H + 0.3, 1 + z);
    body.add(rib);
  }
  for (const sx of [-1, 1]) {
    const curb = mesh(box(0.5, 0.5, vaultLen + 0.4), mats.trim);
    curb.position.set(sx * 4.3, Y + H + 0.3, 1);
    body.add(curb);
  }
  // rooftop plant
  for (const [x, z] of [[-10.5, 6.5], [10.5, 6.5], [-10.5, -3], [10.5, -3]]) {
    const unit = mesh(rbox(2.2, 1.1, 1.8, 0.12), new THREE.MeshStandardMaterial({ color: 0xc9ced6, roughness: 0.7 }));
    unit.position.set(x, Y + H + 0.85, z);
    body.add(unit);
  }

  // forecourt: patterned paving, a fee totem and benches
  const court = mesh(rbox(W + 2, 0.1, 9, 0.4), stone, false);
  court.position.set(0, 0.05, -D / 2 - 6.2);
  body.add(court);
  for (let x = -W / 2; x <= W / 2; x += 3.5) {
    const strip = mesh(box(0.12, 0.02, 8.4), new THREE.MeshStandardMaterial({ color: 0xcfc6b4, roughness: 0.8 }), false);
    strip.position.set(x, 0.11, -D / 2 - 6.2);
    body.add(strip);
  }
  const totem = signPlane('0 LISTING FEES', 2.6, 1.7, { bg: '#f2c14e', fg: '#1d1b2e', sub: '75% SELLER · 25% PLAZA', subColor: '#1d1b2e' });
  totem.position.set(-10.2, 2.2, -D / 2 - 6.06);
  totem.rotation.y = Math.PI;
  const totemB = totem.clone();
  totemB.rotation.y = 0;
  totemB.position.z = -D / 2 - 5.94;
  const totemPost = mesh(box(2.8, 1.9, 0.1), dark, false);
  totemPost.position.set(-10.2, 2.2, -D / 2 - 6.0);
  const totemLeg = mesh(box(0.3, 1.3, 0.3), dark);
  totemLeg.position.set(-10.2, 0.65, -D / 2 - 6.0);
  body.add(totem, totemB, totemPost, totemLeg);
  { const p = toWorld(MALL.x, MALL.z, MALL.rot, -10.2, -D / 2 - 6.0); obstacles.push({ kind: 'circle', x: p.x, z: p.z, r: 1.5 }); }
  const wood = new THREE.MeshStandardMaterial({ color: 0xb98a5a, roughness: 0.8 });
  for (const x of [-5.5, 5.5]) {
    const bench = mesh(rbox(2.4, 0.45, 0.6, 0.08), wood);
    bench.position.set(x, 0.33, -D / 2 - 8.4);
    body.add(bench);
  }
  bake(body);
  root.rotation.y = MALL.rot;
  const trees = [[-12.5, -D / 2 - 9.5], [12.5, -D / 2 - 9.5]].map(([x, z]) => toWorld(MALL.x, MALL.z, MALL.rot, x, z));
  return { root, body, mats, height: H + Y + 3.6, radius: 15, obstacles, trees };
}

/* ======================================================================= */
/* THE TRADING FLOOR · round exchange hall with an LED ticker                */
export interface TickerItem { room: RoomId; text: string }
export function buildTradingFloor() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const mats = makeBuildingMaterials();
  const R = FLOOR.r;
  const H = 7.2;
  const Y = 0.3;
  const obstacles: Obstacle[] = [];
  const stone = new THREE.MeshStandardMaterial({ color: 0xe2e5ea, roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x141a28, roughness: 0.4, metalness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x2b3d5e, roughness: 0.12, metalness: 0.7, emissive: 0x0d1830, emissiveIntensity: 0.4 });
  const podium = mesh(new THREE.CylinderGeometry(R + 1.1, R + 1.3, Y, 48), stone, false);
  podium.position.y = Y / 2;
  const drum = mesh(new THREE.CylinderGeometry(R, R, H, 48), glass);
  drum.position.y = Y + H / 2;
  const base = mesh(new THREE.CylinderGeometry(R + 0.12, R + 0.12, 0.6, 48), mats.white);
  base.position.y = Y + 0.3;
  const crown = mesh(new THREE.CylinderGeometry(R + 0.35, R + 0.35, 0.7, 48), mats.white);
  crown.position.y = Y + H + 0.1;
  const cap = mesh(new THREE.CylinderGeometry(R - 0.2, R, 0.3, 48), mats.trim);
  cap.position.y = Y + H + 0.55;
  body.add(podium, drum, base, crown, cap);
  // vertical mullions
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    const m = mesh(box(0.12, H - 1.2, 0.18), mats.white, false);
    m.position.set(Math.sin(a) * (R + 0.04), Y + 0.6 + (H - 1.2) / 2, Math.cos(a) * (R + 0.04));
    m.rotation.y = a;
    body.add(m);
  }
  // skylight dome over the pits + five glowing section beacons round it
  const dome = new THREE.Mesh(new THREE.SphereGeometry(4.2, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xcfe6f7, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.6, emissive: 0x6f9fd6, emissiveIntensity: 0.15 }));
  dome.position.y = Y + H + 0.7;
  noBake(dome);
  root.add(dome);
  const beaconMats: THREE.MeshStandardMaterial[] = [];
  ROOMS.forEach((r, i) => {
    const a = Math.PI + (i - 2) * 0.62; // fanned round the north side, towards the entrance
    const x = Math.sin(a) * 6.2;
    const z = Math.cos(a) * 6.2;
    const post = mesh(new THREE.CylinderGeometry(0.22, 0.28, 1.8, 10), dark);
    post.position.set(x, Y + H + 1.6, z);
    body.add(post);
    const m = new THREE.MeshStandardMaterial({ color: r.hex, emissive: r.hex, emissiveIntensity: 0.9, roughness: 0.3 });
    beaconMats.push(m);
    const head = mesh(new THREE.SphereGeometry(0.42, 16, 12), m, false);
    head.position.set(x, Y + H + 2.7, z);
    noBake(head);
    root.add(head);
  });
  // entrance on the north side, facing the stadium
  const portal = mesh(rbox(5.6, 4.8, 2.4, 0.2), dark);
  portal.position.set(0, Y + 2.4, -R - 0.6);
  const pGlass = mesh(box(4.4, 3.8, 0.1), new THREE.MeshStandardMaterial({ color: 0xbfd9ef, roughness: 0.08, metalness: 0.4, emissive: 0x5a7da8, emissiveIntensity: 0.25 }), false);
  pGlass.position.set(0, Y + 2.0, -R - 1.82);
  body.add(portal, pGlass);
  const sign = signPlane('TRADING FLOOR', 9, 1.5, { bg: '#0d1424', fg: '#ffffff', sub: 'FX · INDICES · COMMODITIES · CRYPTO · OPTIONS', subColor: '#7fb0ff' });
  sign.position.set(0, Y + 5.8, -R - 1.86);
  sign.rotation.y = Math.PI;
  const signBack = mesh(box(9.2, 1.7, 0.2), dark, false);
  signBack.position.set(0, Y + 5.8, -R - 1.74);
  body.add(sign, signBack);
  for (const dx of [-3.2, 3.2]) {
    const leg = mesh(box(0.2, 1.4, 0.2), dark);
    leg.position.set(dx, Y + 4.9, -R - 1.74);
    body.add(leg);
  }
  obstacles.push({ kind: 'circle', x: FLOOR.x, z: FLOOR.z, r: R + 1.2 }, rectToWorld(FLOOR.x, FLOOR.z, FLOOR.rot, 0, -R - 0.6, 3.1, 1.5));
  // five section flags in a row along the south side (world), one per pit
  ROOMS.forEach((r, i) => {
    const dx = -6 + i * 3;
    const dz = R + 3.6;
    // world offset (dx, dz) → local for a building turned by FLOOR.rot
    const c = Math.cos(FLOOR.rot);
    const sn = Math.sin(FLOOR.rot);
    const lx = dx * c - dz * sn;
    const lz = dx * sn + dz * c;
    const pole = mesh(new THREE.CylinderGeometry(0.05, 0.07, 4.6, 6), mats.white);
    pole.position.set(lx, 2.3, lz);
    const flag = mesh(box(0.03, 0.75, 1.3), new THREE.MeshStandardMaterial({ color: r.hex, roughness: 0.6 }), false);
    flag.position.set(lx, 4.1, lz - 0.68);
    body.add(pole, flag);
    obstacles.push({ kind: 'circle', x: FLOOR.x + dx, z: FLOOR.z + dz, r: 0.3 });
  });
  bake(body);
  root.rotation.y = FLOOR.rot;

  // the LED ticker wrapping the drum: latest ideas from the floor (set by the panel)
  const tick = canvasTex(2048, 128);
  tick.tex.wrapS = THREE.RepeatWrapping;
  tick.tex.repeat.x = 2;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.1, R + 0.1, 1.25, 64, 1, true), new THREE.MeshBasicMaterial({ map: tick.tex, toneMapped: false }));
  band.position.y = Y + H - 1.05;
  noBake(band);
  root.add(band);
  const drawTicker = (items: TickerItem[]) => {
    const g = tick.g;
    g.fillStyle = '#05080f';
    g.fillRect(0, 0, 2048, 128);
    g.font = `900 58px ${FONT}`;
    g.textBaseline = 'middle';
    let x = 24;
    g.fillStyle = '#ffffff';
    g.fillText('TRADING FLOOR', x, 66);
    x += g.measureText('TRADING FLOOR').width + 30;
    g.fillStyle = '#7fb0ff';
    g.font = `800 40px ${FONT}`;
    g.fillText('IDEAS · NOT ADVICE', x, 68);
    x += g.measureText('IDEAS · NOT ADVICE').width + 40;
    const list = items.length ? items : ROOMS.map((r) => ({ room: r.id, text: `${r.label} PIT OPEN` }));
    for (const it of list) {
      if (x > 2000) break;
      const r = ROOMS.find((rr) => rr.id === it.room) ?? ROOMS[0];
      g.font = `900 40px ${FONT}`;
      const tag = r.label;
      const tw = g.measureText(tag).width;
      g.fillStyle = r.color;
      g.beginPath();
      g.roundRect(x, 30, tw + 24, 74, 12);
      g.fill();
      g.fillStyle = '#ffffff';
      g.fillText(tag, x + 12, 68);
      x += tw + 40;
      g.font = `800 44px ${FONT}`;
      g.fillStyle = '#e8eefc';
      const text = it.text.length > 46 ? it.text.slice(0, 44) + '…' : it.text;
      g.fillText(text, x, 68);
      x += g.measureText(text).width + 50;
    }
    tick.tex.needsUpdate = true;
  };
  drawTicker([]);
  return {
    root, body, mats,
    height: H + Y + 3.2,
    radius: R + 2,
    obstacles,
    tickerTexture: tick.tex,
    setTicker: drawTicker,
    update(dt: number, t: number) {
      tick.tex.offset.x = (tick.tex.offset.x + dt * 0.018) % 1;
      beaconMats.forEach((m, i) => (m.emissiveIntensity = 0.6 + 0.5 * (0.5 + 0.5 * Math.sin(t * 2 + i * 1.3))));
    },
  };
}
export type TradingFloorBuilding = ReturnType<typeof buildTradingFloor>;

/* ======================================================================= */
/* shoppers: people strolling between the arena, the square and both doors  */
export function buildShoppers(count = 26) {
  const root = new THREE.Group();
  const sqX = (PLAZA_SQUARE.x0 + PLAZA_SQUARE.x1) / 2 - 1.5;
  const nodes = [
    // from the parking lot
    { x: PARKING.x1 + 0.6, z: -40 }, { x: PARKING.x1 + 0.6, z: -24 }, { x: PARKING.x1 + 0.6, z: -6 }, { x: PARKING.x1 + 0.6, z: 3 },
    // across the square
    { x: sqX, z: -42 }, { x: sqX, z: -30 }, { x: sqX, z: -18 }, { x: sqX, z: -9 }, { x: sqX, z: 2 },
    // the mall door, and the way into Touch The Grass Park
    { x: MALL.x - MALL.d / 2 - 2.1, z: MALL.z, door: true }, { x: MALL.x - MALL.d / 2 - 2.1, z: -36, door: true }, { x: sqX + 4, z: 6 },
  ];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const legs = new THREE.InstancedMesh(box(0.42, 0.62, 0.26), new THREE.MeshStandardMaterial({ roughness: 0.8 }), count);
  const torso = new THREE.InstancedMesh(rbox(0.52, 0.74, 0.32, 0.1), new THREE.MeshStandardMaterial({ roughness: 0.7 }), count);
  const head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshStandardMaterial({ roughness: 0.6 }), count);
  const bag = new THREE.InstancedMesh(box(0.3, 0.34, 0.14), new THREE.MeshStandardMaterial({ roughness: 0.6 }), count);
  for (const m of [legs, torso, head, bag]) { m.castShadow = true; noBake(m); root.add(m); }
  const col = new THREE.Color();
  const tops = [0x2f6bff, 0xf2c14e, 0x14b88a, 0xe0457b, 0xffffff, 0x13213f, 0x7c5cff, 0xff7a45];
  const skin = [0xd9a77e, 0x8d5a3b, 0xf1c7a5, 0xb98463, 0x6b4428];
  const bags = SECTIONS.map((s) => new THREE.Color(s.color).getHex());
  const ppl = Array.from({ length: count }, (_, i) => {
    const a = nodes[Math.floor(rnd() * nodes.length)];
    legs.setColorAt(i, col.setHex(rnd() < 0.5 ? 0x2a3140 : 0x4a5a7a));
    torso.setColorAt(i, col.setHex(tops[i % tops.length]));
    head.setColorAt(i, col.setHex(skin[i % skin.length]));
    bag.setColorAt(i, col.setHex(bags[i % bags.length]));
    return { x: a.x + (rnd() - 0.5) * 2, z: a.z + (rnd() - 0.5) * 2, to: Math.floor(rnd() * nodes.length), speed: 1.1 + rnd() * 0.6, wait: rnd() * 4, hidden: 0, h: 0, ph: rnd() * 6, bag: rnd() < 0.6 };
  });
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const p3 = new THREE.Vector3();
  const s3 = new THREE.Vector3(1, 1, 1);
  const zero = new THREE.Vector3(0, 0, 0);
  const side = new THREE.Vector3();
  const Y = 0.12;
  return {
    root,
    update(dt: number, t: number) {
      ppl.forEach((p, i) => {
        let moving = false;
        if (p.hidden > 0) p.hidden -= dt;
        else if (p.wait > 0) p.wait -= dt;
        else {
          const n = nodes[p.to];
          const dx = n.x - p.x;
          const dz = n.z - p.z;
          const d = Math.hypot(dx, dz);
          if (d < 0.3) {
            if ('door' in n && rnd() < 0.7) p.hidden = 4 + rnd() * 10; // gone in to shop
            else p.wait = rnd() < 0.4 ? 1 + rnd() * 3 : 0;
            let next = Math.floor(rnd() * nodes.length);
            if (next === p.to) next = (next + 1) % nodes.length;
            p.to = next;
          } else {
            const st = Math.min(d, p.speed * dt);
            p.x += (dx / d) * st;
            p.z += (dz / d) * st;
            p.h = Math.atan2(dx, dz);
            moving = true;
          }
        }
        if (p.hidden > 0) {
          m4.compose(p3.set(p.x, -50, p.z), q.identity(), zero);
          legs.setMatrixAt(i, m4); torso.setMatrixAt(i, m4); head.setMatrixAt(i, m4); bag.setMatrixAt(i, m4);
          return;
        }
        const bob = moving ? Math.abs(Math.sin(t * 7 + p.ph)) * 0.05 : 0;
        q.setFromAxisAngle(up, p.h);
        m4.compose(p3.set(p.x, Y + 0.31, p.z), q, s3.set(1, moving ? 0.96 + bob : 1, 1));
        legs.setMatrixAt(i, m4);
        m4.compose(p3.set(p.x, Y + 0.99 + bob, p.z), q, s3.set(1, 1, 1));
        torso.setMatrixAt(i, m4);
        m4.compose(p3.set(p.x, Y + 1.6 + bob, p.z), q, s3);
        head.setMatrixAt(i, m4);
        side.set(0.36, 0, 0).applyQuaternion(q);
        m4.compose(p3.set(p.x + side.x, Y + 0.72 + bob, p.z + side.z), q, p.bag ? s3 : zero);
        bag.setMatrixAt(i, m4);
      });
      for (const m of [legs, torso, head, bag]) m.instanceMatrix.needsUpdate = true;
    },
  };
}

/* ======================================================================= */
/* the parking lot: asphalt, painted bays in three rows, parked cars          */
export function buildParking() {
  const root = new THREE.Group();
  const { x0, x1, z0, z1 } = PARKING;
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x9aa4b1, roughness: 0.92 });
  const paint = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  const lot = mesh(rbox(x1 - x0, 0.1, z1 - z0, 0.5), asphalt, false);
  lot.position.set((x0 + x1) / 2, 0.17, (z0 + z1) / 2);
  root.add(lot);
  // rows: A along the avenue (cars nose-in from the west aisle edge), B + C back to back in the middle
  const SLOT_W = 1.5;
  const SLOT_D = 2.5;
  const rows = [
    { x: x0 + 0.3 + SLOT_D / 2, face: 1 },
    { x: x0 + 0.3 + SLOT_D + 3.2 + SLOT_D / 2, face: -1 },
    { x: x0 + 0.3 + SLOT_D * 2 + 3.2 + SLOT_D / 2, face: 1 },
  ];
  const gapZ0 = -15.5;
  const gapZ1 = -10.5; // the entrance lane lines up with Brooklyn's −13 street
  const slots: Array<{ x: number; z: number; face: number }> = [];
  const lineGeo = box(SLOT_D, 0.02, 0.08);
  const lines: THREE.Matrix4[] = [];
  const m4 = new THREE.Matrix4();
  for (const r of rows) {
    for (let z = z0 + 1; z + SLOT_W <= z1 - 1; z += SLOT_W) {
      if (z + SLOT_W > gapZ0 && z < gapZ1) continue;
      slots.push({ x: r.x, z: z + SLOT_W / 2, face: r.face });
      lines.push(new THREE.Matrix4().makeTranslation(r.x, 0.23, z));
      lines.push(new THREE.Matrix4().makeTranslation(r.x, 0.23, z + SLOT_W));
    }
  }
  const lineMesh = new THREE.InstancedMesh(lineGeo, paint, lines.length);
  lines.forEach((m, i) => lineMesh.setMatrixAt(i, m));
  lineMesh.receiveShadow = true;
  noBake(lineMesh);
  root.add(lineMesh);
  // aisle arrows + a "P" sign at the entrance
  const sign = signPlane('P', 1.1, 1.1, { bg: '#2f6bff', fg: '#ffffff' });
  sign.position.set(x0 + 0.5, 2.6, gapZ0 - 0.4);
  sign.rotation.y = -Math.PI / 2;
  const signB = sign.clone();
  signB.rotation.y = Math.PI / 2;
  signB.position.x = x0 + 0.56;
  const pole = mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 8), new THREE.MeshStandardMaterial({ color: 0x8a94a3 }));
  pole.position.set(x0 + 0.53, 1.3, gapZ0 - 0.4);
  const sub = signPlane('PLAZA PARKING · FREE', 3.2, 0.5, { bg: '#ffffff', fg: '#13213f' });
  sub.position.set(x0 + 0.5, 1.75, gapZ0 - 0.4);
  sub.rotation.y = -Math.PI / 2;
  root.add(sign, signB, pole, sub);
  // parked cars (about two in three bays taken)
  let seed = 31;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const taken = slots.filter(() => rnd() < 0.66);
  const bodyM = new THREE.InstancedMesh(rbox(1.9, 0.55, 0.95, 0.22), new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.2 }), taken.length);
  const cabM = new THREE.InstancedMesh(rbox(1.05, 0.42, 0.8, 0.18), new THREE.MeshStandardMaterial({ color: 0x2b3a55, roughness: 0.2, metalness: 0.3 }), taken.length);
  const cols = [0xffffff, 0x2f6bff, 0xf6f7f9, 0x2bd4a0, 0xd4a94a, 0x13213f, 0x9fb4cc, 0xe0457b, 0x1d1b2e, 0xd6363b];
  const col = new THREE.Color();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const p = new THREE.Vector3();
  const sc = new THREE.Vector3(1, 1, 1);
  taken.forEach((s, i) => {
    // cars are 1.9 long along their local x: turn them to point along the bay (x)
    q.setFromAxisAngle(up, s.face > 0 ? 0 : Math.PI);
    m4.compose(p.set(s.x, 0.22 + 0.45, s.z), q, sc);
    bodyM.setMatrixAt(i, m4);
    m4.compose(p.set(s.x - 0.1 * s.face, 0.22 + 0.88, s.z), q, sc);
    cabM.setMatrixAt(i, m4);
    bodyM.setColorAt(i, col.setHex(cols[Math.floor(rnd() * cols.length)]));
  });
  for (const m of [bodyM, cabM]) { m.castShadow = true; m.receiveShadow = true; noBake(m); root.add(m); }
  return { root, slots: slots.length, parked: taken.length };
}
