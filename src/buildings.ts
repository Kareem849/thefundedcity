// Procedural, modular buildings. Towers are assembled from floor modules so that levels
// change the architecture (sections, setbacks, fins, crowns) instead of stretching a box.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { TowerLevel, CrownTier } from './data';

/* ------------------------------------------------------------------ */
/* Palette + shared materials                                          */
/* ------------------------------------------------------------------ */

export const COLORS = {
  white: 0xf6f7f9,
  stone: 0xeceef2,
  trim: 0xdfe4ea,
  grey: 0xc9d0d9,
  darkGrey: 0x8e98a6,
  glass: 0xffffff,
  gold: 0xd4a94a,
  goldLight: 0xf1d38a,
  navy: 0x13213f,
  royal: 0x2f6bff,
  mint: 0x2bd4a0,
  grass: 0x9fd486,
  grassDark: 0x7fc06a,
  hedge: 0x6fb35c,
};

const std = (color: number, roughness = 0.65, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

export const MAT = {
  white: std(COLORS.white, 0.6),
  stone: std(COLORS.stone, 0.75),
  trim: std(COLORS.trim, 0.6),
  grey: std(COLORS.grey, 0.7),
  darkGrey: std(COLORS.darkGrey, 0.55, 0.2),
  gold: new THREE.MeshStandardMaterial({ color: 0xe6b95a, roughness: 0.3, metalness: 0.75, envMapIntensity: 1.6, emissive: 0x6b4a10, emissiveIntensity: 0.25 }),
  goldSoft: new THREE.MeshStandardMaterial({ color: COLORS.goldLight, roughness: 0.35, metalness: 0.7 }),
  grass: std(COLORS.grass, 0.95),
  hedge: std(COLORS.hedge, 0.9),
  glass: null as unknown as THREE.MeshStandardMaterial, // created lazily (needs canvas)
};

/* ------------------------------------------------------------------ */
/* Glass façade texture (window mullions + sky reflection gradient)    */
/* ------------------------------------------------------------------ */

let glassTexture: THREE.CanvasTexture | null = null;
function getGlassTexture(): THREE.CanvasTexture {
  if (glassTexture) return glassTexture;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, '#e4f1ff');
  grad.addColorStop(0.5, '#acd0f4');
  grad.addColorStop(1, '#78a9e2');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  // diagonal reflection streak
  g.fillStyle = 'rgba(255,255,255,0.18)';
  g.beginPath();
  g.moveTo(14, 0); g.lineTo(30, 0); g.lineTo(12, 64); g.lineTo(-4, 64);
  g.fill();
  // mullion
  g.fillStyle = '#eef3f8';
  g.fillRect(0, 0, 4, 64);
  glassTexture = new THREE.CanvasTexture(c);
  glassTexture.colorSpace = THREE.SRGBColorSpace;
  glassTexture.wrapS = glassTexture.wrapT = THREE.RepeatWrapping;
  glassTexture.anisotropy = 4;
  return glassTexture;
}

/** Global environment state shared by materials (0 = full day, 1 = full night). */
export const ENV = { night: 0 };

/**
 * Random pattern of lit / unlit windows, 8 × 8 windows per texture tile. Used as the glass
 * emissive map so at night some offices glow warm and others stay dark.
 */
let windowLights: THREE.CanvasTexture | null = null;
function getWindowLights(): THREE.CanvasTexture {
  if (windowLights) return windowLights;
  const N = 8;
  const cell = 32;
  const c = document.createElement('canvas');
  c.width = c.height = N * cell;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, c.width, c.height);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const lit = rnd() < 0.52;
      const v = lit ? 0.72 + rnd() * 0.28 : 0.1 + rnd() * 0.06;
      const warm = rnd() < 0.8;
      const r = Math.round(255 * v);
      const gg = Math.round(255 * v * (warm ? 0.86 : 0.95));
      const b = Math.round(255 * v * (warm ? 0.62 : 1.0));
      g.fillStyle = `rgb(${r},${gg},${b})`;
      // leave the mullion (left edge) and a sill (bottom) dark
      g.fillRect(x * cell + 4, y * cell + 2, cell - 4, cell - 6);
    }
  windowLights = new THREE.CanvasTexture(c);
  windowLights.colorSpace = THREE.SRGBColorSpace;
  windowLights.wrapS = windowLights.wrapT = THREE.RepeatWrapping;
  windowLights.repeat.set(1 / N, 1 / N);
  return windowLights;
}

export function getGlassMaterial(): THREE.MeshStandardMaterial {
  if (!MAT.glass) {
    MAT.glass = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: getGlassTexture(),
      emissiveMap: getWindowLights(),
      emissive: 0x000000,
      roughness: 0.12,
      metalness: 0.15,
      envMapIntensity: 1.1,
    });
  }
  return MAT.glass;
}

/** Sign faces light up at night. */
export const SIGN_MATS: THREE.MeshStandardMaterial[] = [];

/* ------------------------------------------------------------------ */
/* Geometry helpers (cached so towers share buffers)                   */
/* ------------------------------------------------------------------ */

const geoCache = new Map<string, THREE.BufferGeometry>();
const r2 = (n: number) => Math.round(n * 100) / 100;

export function rbox(w: number, h: number, d: number, r = 0.12): THREE.BufferGeometry {
  const key = `rb:${r2(w)}:${r2(h)}:${r2(d)}:${r2(r)}`;
  let g = geoCache.get(key);
  if (!g) {
    const rr = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
    g = new RoundedBoxGeometry(w, h, d, 2, Math.max(0.005, rr));
    geoCache.set(key, g);
  }
  return g;
}

export function box(w: number, h: number, d: number): THREE.BufferGeometry {
  const key = `b:${r2(w)}:${r2(h)}:${r2(d)}`;
  let g = geoCache.get(key);
  if (!g) {
    g = new THREE.BoxGeometry(w, h, d);
    geoCache.set(key, g);
  }
  return g;
}

/** Box whose UVs are scaled to world units so the mullion texture tiles evenly on every face. */
const MULLION_SPACING = 1.55;
export function glassBox(w: number, h: number, d: number, floors: number): THREE.BufferGeometry {
  const key = `gb:${r2(w)}:${r2(h)}:${r2(d)}:${floors}`;
  let g = geoCache.get(key);
  if (g) return g;
  g = new THREE.BoxGeometry(w, h, d);
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  // face order: +x, -x, +y, -y, +z, -z (4 verts each)
  const faceU = [d, d, w, w, w, w];
  const faceV = [floors, floors, 0.01, 0.01, floors, floors];
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const idx = f * 4 + i;
      uv.setXY(idx, (uv.getX(idx) * faceU[f]) / MULLION_SPACING, uv.getY(idx) * faceV[f]);
    }
  }
  uv.needsUpdate = true;
  geoCache.set(key, g);
  return g;
}

export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, cast = true, receive = true): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

/* ------------------------------------------------------------------ */
/* Canvas text textures for signs                                      */
/* ------------------------------------------------------------------ */

export interface SignStyle {
  bg: string;
  fg: string;
  accent?: string;
  font?: string;
  sub?: string;
  subColor?: string;
}

export function makeSignTexture(text: string, w: number, h: number, style: SignStyle): THREE.CanvasTexture {
  const scale = 128;
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  const g = c.getContext('2d')!;
  const rad = Math.min(c.height * 0.22, 40);
  g.fillStyle = style.bg;
  g.beginPath();
  g.roundRect(0, 0, c.width, c.height, rad);
  g.fill();
  if (style.accent) {
    g.fillStyle = style.accent;
    g.fillRect(0, c.height - c.height * 0.1, c.width, c.height * 0.1);
  }
  g.fillStyle = style.fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const fontSize = style.sub ? c.height * 0.44 : c.height * 0.58;
  g.font = style.font ?? `800 ${fontSize}px Manrope, Inter, system-ui, sans-serif`;
  // shrink to fit
  let size = fontSize;
  while (g.measureText(text).width > c.width * 0.86 && size > 10) {
    size -= 2;
    g.font = `800 ${size}px Manrope, Inter, system-ui, sans-serif`;
  }
  g.fillText(text, c.width / 2, style.sub ? c.height * 0.4 : c.height * 0.52);
  if (style.sub) {
    g.fillStyle = style.subColor ?? style.fg;
    g.font = `700 ${c.height * 0.17}px Manrope, Inter, system-ui, sans-serif`;
    g.fillText(style.sub, c.width / 2, c.height * 0.74);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function signPlane(text: string, w: number, h: number, style: SignStyle): THREE.Mesh {
  const tex = makeSignTexture(text, w, h, style);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    emissiveMap: tex,
    emissive: 0x000000,
    roughness: 0.5,
    transparent: true,
  });
  SIGN_MATS.push(mat);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.castShadow = false;
  m.receiveShadow = false;
  return m;
}

/* ------------------------------------------------------------------ */
/* Per-building materials (so hover/selection/glow can be per building) */
/* ------------------------------------------------------------------ */

export interface BuildingMaterials {
  white: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  trim: THREE.MeshStandardMaterial;
}

export function makeBuildingMaterials(): BuildingMaterials {
  return {
    white: MAT.white.clone(),
    glass: getGlassMaterial().clone(),
    trim: MAT.trim.clone(),
  };
}

/* ------------------------------------------------------------------ */
/* Floor sections                                                      */
/* ------------------------------------------------------------------ */

export const FLOOR_H = 1.2;
const SLAB_T = 0.16;

interface SectionOpts {
  w: number;
  d: number;
  floors: number;
  mats: BuildingMaterials;
  slabMat?: THREE.Material; // override (e.g. gold trim)
  pilasters?: boolean;
  topSlabMat?: THREE.Material;
  floorH?: number;
}

/**
 * A stack of floors: one textured glass core + merged floor plates (+ optional corner pilasters).
 * Origin at the bottom centre. Returns the group and its height.
 */
export function section(o: SectionOpts): { group: THREE.Group; height: number } {
  const fh = o.floorH ?? FLOOR_H;
  const group = new THREE.Group();
  const h = o.floors * fh;
  const inset = 0.28;
  const glass = mesh(glassBox(o.w - inset, h, o.d - inset, o.floors), o.mats.glass);
  glass.position.y = h / 2;
  group.add(glass);

  const slabs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < o.floors; i++) {
    const g = box(o.w, SLAB_T, o.d).clone();
    g.translate(0, i * fh + SLAB_T / 2, 0);
    slabs.push(g);
  }
  const slabMesh = mesh(mergeGeometries(slabs), o.slabMat ?? o.mats.white);
  group.add(slabMesh);
  // top slab (roof plate) — rounded for a softer silhouette
  const top = mesh(rbox(o.w + 0.08, 0.26, o.d + 0.08, 0.1), o.topSlabMat ?? o.mats.white);
  top.position.y = h + 0.13;
  group.add(top);

  if (o.pilasters) {
    const pw = 0.42;
    const pg: THREE.BufferGeometry[] = [];
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const g = box(pw, h, pw).clone();
        g.translate(sx * (o.w / 2 - pw / 2 + 0.02), h / 2, sz * (o.d / 2 - pw / 2 + 0.02));
        pg.push(g);
      }
    group.add(mesh(mergeGeometries(pg), o.mats.white));
  }
  return { group, height: h + 0.26 };
}

/** A single floor module — used for floor-by-floor construction animation. */
export function floorModule(w: number, d: number, mats: BuildingMaterials, slabMat?: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const glass = mesh(glassBox(w - 0.28, FLOOR_H, d - 0.28, 1), mats.glass);
  glass.position.y = FLOOR_H / 2;
  const slab = mesh(box(w, SLAB_T, d), slabMat ?? mats.white);
  slab.position.y = SLAB_T / 2;
  g.add(glass, slab);
  return g;
}

/* ------------------------------------------------------------------ */
/* Crown                                                               */
/* ------------------------------------------------------------------ */

const CROWN_MATS: Partial<Record<CrownTier, { metal: THREE.MeshStandardMaterial; gem: THREE.MeshStandardMaterial }>> = {};
function crownMats(tier: CrownTier) {
  if (CROWN_MATS[tier]) return CROWN_MATS[tier]!;
  const spec: Record<CrownTier, [number, number, number, number]> = {
    // metal colour, gem colour, metalness, emissive strength
    bronze: [0xb8743a, 0xe8a76a, 0.8, 0.18],
    silver: [0xc9d0da, 0xf4f8ff, 0.85, 0.15],
    gold: [0xe6b95a, 0xffe6a0, 0.8, 0.25],
    diamond: [0xdfeaf5, 0x8fe3ff, 0.6, 0.55],
    platinum: [0xeeeef2, 0xffffff, 0.9, 0.45],
  };
  const [c, g, m, e] = spec[tier];
  const metal = new THREE.MeshStandardMaterial({ color: c, roughness: 0.28, metalness: m, envMapIntensity: 1.7, emissive: c, emissiveIntensity: e * 0.35 });
  const gem = new THREE.MeshStandardMaterial({ color: g, roughness: 0.08, metalness: 0.2, emissive: g, emissiveIntensity: e, transparent: tier === 'diamond', opacity: tier === 'diamond' ? 0.9 : 1 });
  CROWN_MATS[tier] = { metal, gem };
  return CROWN_MATS[tier]!;
}

/** A crown for the top of a tower. Tiers above Level 10: bronze → silver → gold → diamond → platinum. */
export function makeCrown(scale = 1, tier: CrownTier = 'gold'): THREE.Group {
  const crown = new THREE.Group();
  const { metal, gem: gemMat } = tier === 'gold' ? { metal: MAT.gold, gem: MAT.goldSoft } : crownMats(tier);
  const points = tier === 'diamond' || tier === 'platinum' ? 8 : 6;
  const band = mesh(new THREE.CylinderGeometry(0.95, 0.85, 0.5, 24), metal);
  band.position.y = 0.25;
  crown.add(band);
  const ring = mesh(new THREE.TorusGeometry(0.93, 0.07, 6, 28), metal);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.5;
  crown.add(ring);
  const tipGeo = new THREE.ConeGeometry(0.2, tier === 'platinum' ? 0.95 : 0.75, 6);
  const gemGeo = tier === 'diamond' ? new THREE.OctahedronGeometry(0.16, 0) : new THREE.IcosahedronGeometry(0.11, 0);
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    const tip = mesh(tipGeo, metal);
    tip.position.set(Math.cos(a) * 0.8, tier === 'platinum' ? 0.95 : 0.85, Math.sin(a) * 0.8);
    crown.add(tip);
    const gem = mesh(gemGeo, gemMat, false);
    gem.position.set(Math.cos(a) * 0.8, tier === 'platinum' ? 1.48 : 1.27, Math.sin(a) * 0.8);
    crown.add(gem);
  }
  // centre stone: an orb, or a big cut diamond for the top tiers
  const orbGeo = tier === 'diamond' || tier === 'platinum' ? new THREE.OctahedronGeometry(0.42, 0) : new THREE.IcosahedronGeometry(0.28, 1);
  const orb = mesh(orbGeo, tier === 'diamond' || tier === 'platinum' ? gemMat : MAT.goldSoft);
  orb.position.y = tier === 'diamond' || tier === 'platinum' ? 1.05 : 0.75;
  if (tier === 'diamond' || tier === 'platinum') orb.scale.y = 1.4;
  crown.add(orb);
  if (tier === 'platinum') {
    const halo = mesh(new THREE.TorusGeometry(1.25, 0.05, 6, 36), gemMat, false);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 1.7;
    crown.add(halo);
  }
  crown.scale.setScalar(scale);
  crown.name = 'crown';
  crown.userData.tier = tier;
  return crown;
}

/* ------------------------------------------------------------------ */
/* Trader towers                                                       */
/* ------------------------------------------------------------------ */

export interface Tower {
  root: THREE.Group; // placed at plot position
  body: THREE.Group; // architecture (for hover/selection)
  level: TowerLevel;
  mats: BuildingMaterials;
  shaftTopY: number;
  top: THREE.Group; // everything above the shaft (setback, roof, crown)
  crown: THREE.Group | null;
  height: number;
  signature: boolean;
  /** Footprint radius used for selection rings / glow. */
  radius: number;
  /** half-width of the footprint (for the walk grid) */
  halfW: number;
}

export interface TowerOpts {
  level: TowerLevel;
  /** earned above Level 10 */
  crown?: CrownTier | null;
  signature?: boolean; // Kareem Capital: gold trims, KC sign, landscaping
  /** nameplate on the podium (registered traders) */
  name?: string;
  seed?: number;
}

// L4–L10 premium towers: each level adds height (shaft + sky tier), width and details
export const PREMIUM = { podiumW: 7.6, podiumFloors: 2, shaftW: 5.6, shaftFloors: 9, skyW: 4.9, skyFloors: 4, setW: 4.2, setFloors: 2 };
const PREMIUM_SPEC: Record<number, { shaftW: number; shaftFloors: number; skyFloors: number; fins: boolean; lantern: boolean; spire: number }> = {
  4: { shaftW: 5.6, shaftFloors: 8, skyFloors: 0, fins: false, lantern: false, spire: 0 },
  5: { shaftW: 5.6, shaftFloors: 9, skyFloors: 3, fins: true, lantern: true, spire: 0 },
  6: { shaftW: 5.8, shaftFloors: 10, skyFloors: 4, fins: true, lantern: true, spire: 0 },
  7: { shaftW: 6.0, shaftFloors: 12, skyFloors: 4, fins: true, lantern: true, spire: 2.5 },
  8: { shaftW: 6.2, shaftFloors: 13, skyFloors: 5, fins: true, lantern: true, spire: 3.5 },
  9: { shaftW: 6.4, shaftFloors: 15, skyFloors: 5, fins: true, lantern: true, spire: 5 },
  10: { shaftW: 6.6, shaftFloors: 17, skyFloors: 6, fins: true, lantern: true, spire: 6.5 },
};

export function buildTower(o: TowerOpts): Tower {
  const mats = makeBuildingMaterials();
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const sig = !!o.signature;
  const trimMat = sig ? MAT.gold : mats.trim;
  let y = 0;
  let top = new THREE.Group();
  let crown: THREE.Group | null = null;
  let radius = 3.6;
  let halfW = 3.1;

  // plinth (all levels)
  const plinthW = o.level >= 4 ? PREMIUM_SPEC[o.level].shaftW + 2.8 : o.level >= 3 ? 8.4 : 6.2;
  const plinth = mesh(rbox(plinthW, 0.3, plinthW, 0.12), MAT.stone, false, true);
  plinth.position.y = 0.15;
  body.add(plinth);
  y = 0.3;

  if (o.level === 1) {
    const s = section({ w: 4.6, d: 4.6, floors: 2, mats });
    s.group.position.y = y;
    body.add(s.group);
    y += s.height;
    top.position.y = y;
    const parapet = mesh(rbox(4.5, 0.3, 4.5, 0.08), mats.white);
    parapet.position.y = 0.15;
    const ac = mesh(rbox(1.3, 0.6, 1.0, 0.1), MAT.grey);
    ac.position.set(0.8, 0.6, -0.6);
    top.add(parapet, ac);
    body.add(top);
    radius = 3.2;
    y += 0.9;
  } else if (o.level === 2) {
    const s = section({ w: 5.2, d: 5.2, floors: 4, mats, topSlabMat: mats.white });
    s.group.position.y = y;
    body.add(s.group);
    y += s.height;
    top.position.y = y;
    const garden = mesh(rbox(4.8, 0.22, 4.8, 0.08), MAT.grass, false);
    garden.position.y = 0.11;
    top.add(garden);
    const pent = section({ w: 3.0, d: 3.0, floors: 1, mats });
    pent.group.position.set(-0.7, 0.22, -0.7);
    top.add(pent.group);
    for (const [px, pz] of [[1.4, 1.3], [1.5, -0.4], [-0.6, 1.6]]) {
      const shrub = mesh(new THREE.IcosahedronGeometry(0.42, 0), MAT.hedge);
      shrub.position.set(px, 0.55, pz);
      top.add(shrub);
    }
    body.add(top);
    radius = 3.4;
    y += 1.6;
  } else if (o.level === 3) {
    const pod = section({ w: 7.0, d: 7.0, floors: 2, mats, topSlabMat: trimMat });
    pod.group.position.y = y;
    body.add(pod.group);
    y += pod.height;
    const shaft = section({ w: 5.0, d: 5.0, floors: 6, mats, pilasters: true });
    shaft.group.position.y = y;
    body.add(shaft.group);
    y += shaft.height;
    top.position.y = y;
    const plant = mesh(rbox(2.2, 0.9, 2.2, 0.12), mats.white);
    plant.position.set(-0.6, 0.45, -0.6);
    top.add(plant);
    top.add(railFrame(4.7, 0.35, mats.trim));
    body.add(top);
    radius = 4.0;
    halfW = 4.2;
    y += 1.0;
  } else {
    const S = PREMIUM_SPEC[o.level];
    const podiumW = S.shaftW + 2;
    const pod = section({ w: podiumW, d: podiumW, floors: 2, mats, topSlabMat: mats.white, floorH: 1.45 });
    pod.group.position.y = y;
    body.add(pod.group);
    if (sig || o.level >= 8) {
      const band = mesh(rbox(podiumW + 0.14, 0.09, podiumW + 0.14, 0.04), sig || o.level >= 9 ? MAT.gold : mats.trim, false);
      band.position.y = y + pod.height - 0.3;
      body.add(band);
    }
    y += pod.height;
    const shaft = section({ w: S.shaftW, d: S.shaftW, floors: S.shaftFloors, mats, pilasters: true });
    shaft.group.position.y = y;
    shaft.group.name = 'shaft';
    body.add(shaft.group);
    const shaftBase = y;
    y += shaft.height;
    const shaftTopY = y;
    if (S.skyFloors) {
      const skyW = S.shaftW - 0.7;
      const sky = new THREE.Group();
      sky.name = 'sky';
      for (let i = 0; i < S.skyFloors; i++) {
        const f = floorModule(skyW, skyW, mats, i === 0 ? trimMat : undefined);
        f.position.y = i * FLOOR_H;
        sky.add(f);
      }
      sky.position.y = shaftTopY;
      body.add(sky);
      y += S.skyFloors * FLOOR_H;
    }
    if (S.fins) body.add(makeFins(S.shaftW, shaftTopY - shaftBase, sig || o.level >= 9 ? MAT.gold : mats.white, shaftBase));
    top = buildPremiumTop(o.level, mats, sig, o.crown ?? null);
    top.position.y = y;
    body.add(top);
    crown = (top.getObjectByName('crown') as THREE.Group) ?? null;
    radius = podiumW / 2 + 0.8;
    halfW = podiumW / 2 + 0.6;
    y += (top.userData.height as number) ?? 4.6;
    const t: Tower = { root, body, level: o.level, mats, shaftTopY, top, crown, height: y, signature: sig, radius, halfW };
    if (sig) addSignatureDetails(t, podiumW);
    else if (o.name) addNamePlate(t, o.name, podiumW, 0.3 + 1.45 * 1.2);
    return t;
  }
  const t: Tower = { root, body, level: o.level, mats, shaftTopY: y, top, crown, height: y, signature: sig, radius, halfW };
  if (o.name) addNamePlate(t, o.name, o.level === 3 ? 7.0 : o.level === 2 ? 5.2 : 4.6, 1.0);
  return t;
}

/** Setback section + roof (+ lantern, spire and crown on the bigger levels). Stores its height in userData. */
export function buildPremiumTop(level: TowerLevel, mats: BuildingMaterials, signature: boolean, crownTier: CrownTier | null = null): THREE.Group {
  const S = PREMIUM_SPEC[level];
  const top = new THREE.Group();
  top.name = 'top';
  const trimMat = signature || level >= 9 ? MAT.gold : mats.trim;
  const setW = (S.skyFloors ? S.shaftW - 0.7 : S.shaftW) - 0.8;
  const set = section({ w: setW, d: setW, floors: PREMIUM.setFloors, mats, slabMat: mats.white, topSlabMat: mats.white });
  top.add(set.group);
  if (signature) {
    const band = mesh(rbox(setW + 0.16, 0.09, setW + 0.16, 0.04), MAT.gold, false);
    band.position.y = set.height - 0.32;
    top.add(band);
  }
  let y = set.height;
  if (S.lantern) {
    const lw = Math.max(2.7, setW - 1.4);
    const lantern = section({ w: lw, d: lw, floors: 1, mats, topSlabMat: trimMat, floorH: 1.5 });
    lantern.group.position.y = y;
    lantern.group.name = 'lantern';
    top.add(lantern.group);
    y += lantern.height;
  }
  let h = y;
  if (crownTier) {
    const sc = { bronze: 1.45, silver: 1.55, gold: 1.65, diamond: 1.8, platinum: 2.0 }[crownTier];
    const crown = makeCrown(sc, crownTier);
    crown.position.y = y;
    top.add(crown);
    h = y + sc * (crownTier === 'platinum' ? 1.9 : 1.5);
  } else if (S.spire) {
    const spire = mesh(new THREE.CylinderGeometry(0.05, 0.22, S.spire, 8), trimMat);
    spire.position.y = y + S.spire / 2;
    top.add(spire);
    h = y + S.spire;
  } else {
    const mast = mesh(new THREE.CylinderGeometry(0.07, 0.12, level >= 5 ? 4.2 : 2.6, 6), mats.trim);
    mast.position.y = y + (level >= 5 ? 2.1 : 1.3);
    top.add(mast);
    if (level === 4) {
      const helipad = mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.12, 20), MAT.grey);
      helipad.position.set(0, y + 0.06, 0);
      top.add(helipad);
    }
    h = y + (level >= 5 ? 2.6 : 1.2);
  }
  top.userData.height = h;
  return top;
}

/** Vertical façade fins on the shaft (Level 5 and up). */
export function makeFins(shaftW: number, height: number, mat: THREE.Material, baseY: number): THREE.Group {
  const fins = new THREE.Group();
  fins.name = 'fins';
  const per = 2;
  const geos: THREE.BufferGeometry[] = [];
  for (let side = 0; side < 4; side++) {
    for (let i = 0; i < per; i++) {
      const off = (i - (per - 1) / 2) * (shaftW / (per + 1)) * 1.2;
      const g = box(0.14, height, 0.34).clone();
      // fin sits proud of the glass, perpendicular to the façade
      if (side === 0) g.translate(off, height / 2, shaftW / 2 + 0.08);
      if (side === 1) g.translate(off, height / 2, -shaftW / 2 - 0.08);
      if (side === 2) { g.rotateY(Math.PI / 2); g.translate(shaftW / 2 + 0.08, height / 2, off); }
      if (side === 3) { g.rotateY(Math.PI / 2); g.translate(-shaftW / 2 - 0.08, height / 2, off); }
      geos.push(g);
    }
  }
  const m = mesh(mergeGeometries(geos), mat);
  fins.add(m);
  fins.position.y = baseY;
  return fins;
}

function railFrame(w: number, h: number, mat: THREE.Material): THREE.Mesh {
  const t = 0.08;
  const geos: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    const a = box(w, t, t).clone();
    a.translate(0, h, (s * w) / 2);
    const b = box(t, t, w).clone();
    b.translate((s * w) / 2, h, 0);
    geos.push(a, b);
  }
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const p = box(t, h, t).clone();
      p.translate((sx * w) / 2, h / 2, (sz * w) / 2);
      geos.push(p);
    }
  return mesh(mergeGeometries(geos), mat, false);
}

const initialsOf = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2)).toUpperCase() || 'FC';
};

/** Nameplate on all four façades: a registered trader's tower carries their name. */
function addNamePlate(t: Tower, name: string, w: number, y: number) {
  const pw = Math.min(w - 0.6, 3.4);
  const plaque = signPlane(initialsOf(name), pw, pw * 0.44, { bg: '#13213f', fg: '#ffffff', sub: name.toUpperCase().slice(0, 22), subColor: '#cfe0ff' });
  for (let i = 0; i < 4; i++) {
    const p = i === 0 ? plaque : plaque.clone();
    const a = (i * Math.PI) / 2;
    p.rotation.y = a;
    p.position.set(Math.sin(a) * (w / 2 + 0.03), y, Math.cos(a) * (w / 2 + 0.03));
    t.body.add(p);
  }
}

/** KC sign + landscaping for Kareem Capital. */
function addSignatureDetails(t: Tower, podiumW: number): void {
  // one plaque on every façade so the tower reads from any angle
  const plaque = signPlane('KC', 2.6, 1.15, { bg: '#13213f', fg: '#e9c46a', sub: 'KAREEM CAPITAL', subColor: '#f3dfae' });
  for (let i = 0; i < 4; i++) {
    const p = i === 0 ? plaque : plaque.clone();
    const a = (i * Math.PI) / 2;
    p.rotation.y = a;
    p.position.set(Math.sin(a) * (podiumW / 2 + 0.03), 0.3 + 1.45 * 1.2, Math.cos(a) * (podiumW / 2 + 0.03));
    t.body.add(p);
  }
  // gold entrance canopy
  const canopy = mesh(rbox(3.0, 0.12, 1.1, 0.05), MAT.gold);
  canopy.position.set(0, 0.3 + 1.45 * 0.62, podiumW / 2 + 0.5);
  t.body.add(canopy);
  // landscaped base: planters with hedges on all sides
  const planterGeo = rbox(2.4, 0.42, 0.9, 0.12);
  const hedgeGeo = rbox(2.1, 0.5, 0.62, 0.22);
  const ring = podiumW / 2 + 0.85;
  const spots: Array<[number, number, number]> = [
    [-2.6, ring, 0], [2.6, ring, 0], [-2.6, -ring, 0], [2.6, -ring, 0],
    [ring, -2.6, Math.PI / 2], [ring, 2.6, Math.PI / 2], [-ring, -2.6, Math.PI / 2], [-ring, 2.6, Math.PI / 2],
  ];
  for (const [x, z, r] of spots) {
    const p = mesh(planterGeo, MAT.white, false);
    p.position.set(x, 0.21, z);
    p.rotation.y = r;
    const hdg = mesh(hedgeGeo, MAT.hedge, true);
    hdg.position.set(x, 0.56, z);
    hdg.rotation.y = r;
    t.root.add(p, hdg);
  }
}

/* ------------------------------------------------------------------ */
/* Prop firm HQs                                                       */
/* ------------------------------------------------------------------ */

export interface SimpleBuilding {
  root: THREE.Group;
  body: THREE.Group;
  mats: BuildingMaterials;
  height: number;
  radius: number;
}

export type HQBuilding = SimpleBuilding;

const CAT_HEX: Record<string, string> = { cfd: '#2f6bff', futures: '#14a37f', perps: '#7c5cff' };
const CAT_NAME: Record<string, string> = { cfd: 'CFD', futures: 'FUTURES', perps: 'PERPS' };

/**
 * Fixed façade banner: a clean white fascia with the firm wordmark (or the official logo image
 * when provided) and a small category tab. Lit at night like the other signs.
 */
function makeBanner(name: string, category: string, w: number, h: number, logo?: string): THREE.Group {
  const W = 1024;
  const H = Math.round((W * h) / w);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const accent = CAT_HEX[category] ?? '#2f6bff';
  let logoImg: HTMLImageElement | null = null;
  const draw = () => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, W, H);
    // category tab on the left + hairline underline
    const tabW = 150;
    g.fillStyle = accent;
    g.fillRect(0, 0, tabW, H);
    g.fillStyle = '#ffffff';
    g.font = `800 ${Math.round(H * 0.2)}px Manrope, Inter, system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(CAT_NAME[category] ?? category.toUpperCase(), tabW / 2, H / 2 + 2);
    g.fillStyle = accent;
    g.fillRect(tabW, H - 8, W - tabW, 8);
    const cx = tabW + (W - tabW) / 2;
    const maxW = W - tabW - 70;
    if (logoImg && logoImg.complete && logoImg.naturalWidth) {
      const r = Math.min(maxW / logoImg.naturalWidth, (H * 0.62) / logoImg.naturalHeight);
      const lw = logoImg.naturalWidth * r;
      const lh = logoImg.naturalHeight * r;
      g.drawImage(logoImg, cx - lw / 2, (H - lh) / 2, lw, lh);
    } else {
      g.fillStyle = '#13213f';
      let size = Math.round(H * 0.56);
      g.font = `800 ${size}px Manrope, Inter, system-ui, sans-serif`;
      while (g.measureText(name).width > maxW && size > 20) {
        size -= 2;
        g.font = `800 ${size}px Manrope, Inter, system-ui, sans-serif`;
      }
      g.fillText(name, cx, H / 2 + 2);
    }
    tex.needsUpdate = true;
  };
  if (logo) {
    logoImg = new Image();
    logoImg.onload = draw;
    logoImg.src = logo;
  }
  draw();
  const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0x000000, roughness: 0.5 });
  SIGN_MATS.push(mat);
  const grp = new THREE.Group();
  const back = mesh(rbox(w + 0.16, h + 0.16, 0.12, 0.04), MAT.white, false);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  face.position.z = 0.065;
  grp.add(back, face);
  return grp;
}

const accentCache = new Map<string, THREE.MeshStandardMaterial>();
function mats_accent(hex: string) {
  let m = accentCache.get(hex);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: 0.45, metalness: 0.1 });
    accentCache.set(hex, m);
  }
  return m;
}

/**
 * Office HQ for a prop firm. Built with its entrance facing +z; the city rotates it to face the plaza.
 */
export function buildHQ(opts: { name: string; category: string; floors: number; variant: number; logo?: string }): HQBuilding {
  const mats = makeBuildingMaterials();
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const accent = CAT_HEX[opts.category] ?? '#2f6bff';
  const W = 7.0;
  const D = 7.6;
  const plinth = mesh(rbox(W + 0.8, 0.3, D + 0.8, 0.12), MAT.stone, false);
  plinth.position.y = 0.15;
  body.add(plinth);
  // double-height glass lobby under a cantilevered office mass
  const lobby = mesh(glassBox(W - 1.1, 2.0, D - 1.1, 1), mats.glass);
  lobby.position.y = 1.3;
  body.add(lobby);
  const cols: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const gg = box(0.4, 2.0, 0.4).clone();
    gg.translate(sx * (W / 2 - 0.35), 1.3, sz * (D / 2 - 0.35));
    cols.push(gg);
  }
  body.add(mesh(mergeGeometries(cols), mats.white));
  // entrance canopy in the category colour
  const canopy = mesh(rbox(3.2, 0.14, 1.3, 0.05), mats_accent(accent));
  canopy.position.set(0, 2.15, D / 2 + 0.35);
  body.add(canopy);
  // office floors; variant 1 adds a setback crown floor, variant 2 vertical fins
  const fh = 1.25;
  const offices = section({ w: W, d: D, floors: opts.floors, mats, topSlabMat: mats.white, floorH: fh, pilasters: opts.variant === 0 });
  offices.group.position.y = 2.3;
  body.add(offices.group);
  let h = 2.3 + offices.height;
  if (opts.variant === 1) {
    const crown = section({ w: W - 1.8, d: D - 1.8, floors: 1, mats, topSlabMat: mats.white, floorH: 1.4 });
    crown.group.position.y = h;
    body.add(crown.group);
    h += crown.height;
  }
  if (opts.variant === 2) body.add(makeFins(W - 0.2, offices.height - 0.3, mats.white, 2.3));
  // accent stripe running up the entrance façade
  const stripe = mesh(rbox(0.32, h - 2.6, 0.18, 0.06), mats_accent(accent));
  stripe.position.set(W / 2 - 0.9, 2.3 + (h - 2.6) / 2, D / 2 + 0.06);
  body.add(stripe);
  // rooftop plant room
  const plant = mesh(rbox(2.0, 0.7, 1.6, 0.1), mats.white);
  plant.position.set(-1.9, h + 0.35, -2.2);
  body.add(plant);
  // fixed fascia banners on the top office floor, front (plaza side) and back
  const bw = W - 0.7;
  const bh = 1.55;
  const by = 2.3 + offices.height - 0.95;
  for (const sideZ of [1, -1]) {
    const b = makeBanner(opts.name, opts.category, bw, bh, opts.logo);
    b.position.set(0, by, sideZ * (D / 2 + 0.36));
    if (sideZ < 0) b.rotation.y = Math.PI;
    body.add(b);
  }
  return { root, body, mats, height: h + 0.8, radius: 5.0 };
}

/* ------------------------------------------------------------------ */
/* Houses (registered traders without a payout yet)                   */
/* ------------------------------------------------------------------ */

const HOUSE_WALLS = [0xf7f3ec, 0xeef3f8, 0xf6ece6, 0xeef6f0, 0xf8f1e0, 0xe9edf5];
const HOUSE_ROOFS = [0x5b6475, 0xb8664a, 0x3f4a5c, 0x8a6f5a];
const DOOR_COLORS = [0x2f6bff, 0x14a37f, 0x7c5cff, 0xd96b4a, 0x3a3f4a, 0xc9973a];
const houseMatCache = new Map<string, THREE.MeshStandardMaterial>();
function hmat(key: string, color: number, rough = 0.85) {
  let m = houseMatCache.get(key);
  if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness: rough }); houseMatCache.set(key, m); }
  return m;
}
const gableCache = new Map<string, THREE.BufferGeometry>();
function gable(w: number, d: number, rise: number) {
  const key = `${w}:${d}:${rise}`;
  let g = gableCache.get(key);
  if (!g) {
    const shape = new THREE.Shape();
    shape.moveTo(-d / 2, 0);
    shape.lineTo(d / 2, 0);
    shape.lineTo(0, rise);
    shape.lineTo(-d / 2, 0);
    g = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
    g.translate(0, 0, -w / 2);
    g.rotateY(Math.PI / 2);
    gableCache.set(key, g);
  }
  return g;
}

export const HOUSE_PLOT = { w: 9.6, d: 11 };
const ROOF_SNOW = new THREE.Color(0xf5f8fc);
/** Snow on the house roofs (0..1), driven by the weather. */
export function setRoofSnow(v: number) {
  for (const [k, m] of houseMatCache) {
    if (k[0] !== 'r') continue;
    const base = (m.userData.base ??= m.color.clone()) as THREE.Color;
    m.color.lerpColors(base, ROOF_SNOW, v * 0.85);
  }
}
const SHARED_HOUSE_MATS: BuildingMaterials = { white: new THREE.MeshStandardMaterial(), glass: new THREE.MeshStandardMaterial(), trim: new THREE.MeshStandardMaterial() };

/**
 * A detached family house on its own plot (front faces +z): pitched-roof house with a front door,
 * porch and path, an attached garage with driveway, a fenced back garden and a hedged front garden.
 * Shared materials let the city merge all houses into a handful of draw calls; `mine` gets its own.
 */
export function buildDetachedHouse(i: number, mine = false): SimpleBuilding & { treeSpots: Array<[number, number, number]> } {
  const mats = mine ? makeBuildingMaterials() : SHARED_HOUSE_MATS;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const side = i % 2 === 0 ? 1 : -1; // garage on the right or the left
  const wallC = HOUSE_WALLS[(i * 7) % HOUSE_WALLS.length];
  const walls = mine ? mats.white : hmat('w' + wallC, wallC);
  if (mine) mats.white.color.setHex(0xfbf3df);
  const roofC = HOUSE_ROOFS[(i * 5 + 1) % HOUSE_ROOFS.length];
  const roofM = hmat('r' + roofC, roofC, 0.7);
  const doorC = DOOR_COLORS[(i * 3) % DOOR_COLORS.length];
  const doorM = mine ? MAT.gold : hmat('d' + doorC, doorC, 0.5);
  const concrete = hmat('concrete', 0xdfe2e7, 0.95);
  const pathM = hmat('path', 0xeee3cf, 0.95);
  const hedgeM = hmat('hedge', 0x7cbf5a, 0.9);
  const fenceM = hmat('fence', 0xffffff, 0.7);
  const garageDoorM = hmat('gdoor', 0xc9d0da, 0.55);
  const glass = getGlassMaterial();
  const X = (x: number) => x * side;
  const add = (m: THREE.Mesh, x: number, y: number, z: number) => { m.position.set(X(x), y, z); body.add(m); return m; };

  // plot lawn
  add(mesh(rbox(HOUSE_PLOT.w - 0.3, 0.14, HOUSE_PLOT.d - 0.3, 0.06), MAT.grass, false), 0, 0.07, 0);
  // house
  const HW = 5.0, HD = 4.8, HH = 2.7, hx = -1.3, hz = -0.7;
  add(mesh(box(HW, HH, HD), walls), hx, 0.14 + HH / 2, hz);
  add(mesh(box(HW + 0.2, 0.16, HD + 0.2), fenceM), hx, 0.14 + HH + 0.06, hz);
  add(mesh(gable(HW + 0.5, HD + 0.7, 1.5), roofM), hx, 0.14 + HH + 0.12, hz);
  // chimney
  add(mesh(box(0.5, 1.2, 0.5), walls), hx - 1.4, 0.14 + HH + 1.0, hz - 0.9);
  // front door, porch roof, step
  const dx = hx - 0.9;
  const fz = hz + HD / 2;
  add(mesh(rbox(0.9, 1.7, 0.08, 0.03), doorM), dx, 0.14 + 0.85, fz + 0.04);
  add(mesh(rbox(1.7, 0.1, 1.0, 0.03), fenceM), dx, 0.14 + 2.05, fz + 0.45);
  for (const px of [-0.75, 0.75]) add(mesh(box(0.1, 1.9, 0.1), fenceM), dx + px, 0.14 + 0.95, fz + 0.88);
  add(mesh(rbox(1.6, 0.14, 0.8, 0.03), MAT.stone, false), dx, 0.21, fz + 0.45);
  // windows (shared glass → lit at night)
  for (const wx of [hx + 1.1]) {
    add(mesh(glassBox(1.5, 1.0, 0.06, 1), glass), wx, 0.14 + 1.45, fz + 0.02);
    add(mesh(box(1.7, 0.08, 0.16), fenceM), wx, 0.14 + 0.92, fz + 0.06);
  }
  add(mesh(glassBox(1.2, 0.5, 0.06, 1), glass), hx, 0.14 + HH + 0.55, fz + 0.36); // dormer-ish gable window
  // side + back windows
  add(mesh(glassBox(1.4, 0.9, 0.06, 1), glass), hx, 0.14 + 1.45, hz - HD / 2 - 0.02);
  // garage
  const GW = 3.0, GD = 4.6, GH = 2.3, gx = 2.65, gz = -0.8;
  add(mesh(box(GW, GH, GD), walls), gx, 0.14 + GH / 2, gz);
  add(mesh(box(GW + 0.2, 0.16, GD + 0.2), fenceM), gx, 0.14 + GH + 0.08, gz);
  add(mesh(rbox(2.4, 1.85, 0.06, 0.02), garageDoorM), gx, 0.14 + 0.93, gz + GD / 2 + 0.03);
  // driveway + front path
  add(mesh(box(2.6, 0.04, 3.9), concrete, false), gx, 0.16, gz + GD / 2 + 1.95);
  add(mesh(box(1.0, 0.04, 2.9), pathM, false), dx, 0.16, fz + 2.3);
  // front hedges (gaps for the path and the driveway) and a white fence round the back garden
  const front = HOUSE_PLOT.d / 2 - 0.45;
  const hedge = (x1: number, x2: number) => add(mesh(rbox(Math.abs(x2 - x1), 0.6, 0.5, 0.12), hedgeM), (x1 + x2) / 2, 0.14 + 0.3, front);
  hedge(-4.55, dx - 0.6);
  hedge(dx + 0.6, gx - 1.4);
  const back = -HOUSE_PLOT.d / 2 + 0.25;
  add(mesh(box(HOUSE_PLOT.w - 0.6, 0.55, 0.08), fenceM), 0, 0.14 + 0.28, back);
  for (const sx of [-1, 1]) add(mesh(box(0.08, 0.55, 3.0), fenceM), sx * (HOUSE_PLOT.w / 2 - 0.3), 0.14 + 0.28, back + 1.5);
  // back-garden patio
  add(mesh(box(2.6, 0.04, 1.6), pathM, false), hx + 0.4, 0.16, hz - HD / 2 - 1.0);
  if (mine) {
    const pole = mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.0, 6), MAT.white);
    add(pole, gx, 0.14 + GH + 1.0, gz);
    add(mesh(rbox(0.9, 0.5, 0.04, 0.02), MAT.gold), gx + 0.47, 0.14 + GH + 1.7, gz);
  }
  // trees: one in the back garden, a small one in the front garden [x, z, scale]
  const treeSpots: Array<[number, number, number]> = [[X(-3.4), -4.0, 0.62], [X(-3.6), 3.4, 0.42]];
  return { root, body, mats, height: 4.6, radius: 4.6, treeSpots };
}

/* ------------------------------------------------------------------ */
/* Commercial / leasable spaces                                        */
/* ------------------------------------------------------------------ */

const dashedMat = new THREE.LineDashedMaterial({ color: COLORS.royal, dashSize: 0.55, gapSize: 0.35, transparent: true, opacity: 0.9 });

function dashedRect(w: number, d: number, y: number): THREE.LineSegments {
  const pts = [
    new THREE.Vector3(-w / 2, y, -d / 2), new THREE.Vector3(w / 2, y, -d / 2),
    new THREE.Vector3(w / 2, y, -d / 2), new THREE.Vector3(w / 2, y, d / 2),
    new THREE.Vector3(w / 2, y, d / 2), new THREE.Vector3(-w / 2, y, d / 2),
    new THREE.Vector3(-w / 2, y, d / 2), new THREE.Vector3(-w / 2, y, -d / 2),
  ];
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  const l = new THREE.LineSegments(g, dashedMat);
  l.computeLineDistances();
  return l;
}

function leaseSign(text: string): THREE.Group {
  const g = new THREE.Group();
  const post = mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 6), MAT.darkGrey);
  post.position.y = 0.8;
  const board = signPlane(text, 2.2, 0.8, { bg: '#2f6bff', fg: '#ffffff' });
  board.position.y = 1.65;
  const back = mesh(rbox(2.3, 0.88, 0.08, 0.04), MAT.white);
  back.position.set(0, 1.65, -0.06);
  const board2 = board.clone();
  board2.position.z = -0.12;
  board2.rotation.y = Math.PI;
  g.add(post, back, board, board2);
  g.rotation.y = Math.PI / 4;
  return g;
}

export function buildCommercial(kind: 'plot' | 'billboard' | 'hq'): SimpleBuilding {
  const mats = makeBuildingMaterials();
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  if (kind === 'plot') {
    const lawn = mesh(rbox(10, 0.24, 7, 0.1), MAT.grass, false);
    lawn.position.y = 0.12;
    body.add(lawn);
    body.add(dashedRect(9.2, 6.2, 0.27));
    const s = leaseSign('FOR LEASE');
    s.position.set(2.6, 0.24, 1.6);
    body.add(s);
    // survey stakes
    for (const [x, z] of [[-4.6, -3.1], [4.6, -3.1], [-4.6, 3.1], [4.6, 3.1]]) {
      const stake = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 5), MAT.gold);
      stake.position.set(x, 0.6, z);
      body.add(stake);
    }
    return { root, body, mats, height: 3, radius: 5.8 };
  }
  if (kind === 'billboard') {
    const base = mesh(rbox(5.6, 0.25, 2.2, 0.1), MAT.stone, false);
    base.position.y = 0.125;
    body.add(base);
    for (const x of [-1.8, 1.8]) {
      const leg = mesh(rbox(0.32, 3.4, 0.32, 0.06), MAT.white);
      leg.position.set(x, 1.95, 0);
      body.add(leg);
    }
    const frame = mesh(rbox(7.4, 3.4, 0.35, 0.12), MAT.white);
    frame.position.set(0, 5.0, 0);
    const face = signPlane('YOUR BRAND HERE', 7.0, 3.0, { bg: '#eef4ff', fg: '#2f6bff', sub: 'BILLBOARD · AVAILABLE', subColor: '#13213f', accent: '#d4a94a' });
    face.position.set(0, 5.0, 0.19);
    const face2 = face.clone();
    face2.position.z = -0.19;
    face2.rotation.y = Math.PI;
    body.add(frame, face, face2);
    body.rotation.y = Math.PI / 4;
    body.scale.setScalar(1.25);
    return { root, body, mats, height: 8.5, radius: 4.8 };
  }
  // hq site: foundation + ghosted massing
  const slab = mesh(rbox(9, 0.4, 8, 0.1), MAT.grey, false);
  slab.position.y = 0.2;
  body.add(slab);
  const ghostMat = new THREE.MeshStandardMaterial({ color: COLORS.royal, transparent: true, opacity: 0.1, depthWrite: false });
  const ghost = new THREE.Mesh(box(7, 9, 6), ghostMat);
  ghost.position.y = 0.4 + 4.5;
  ghost.name = 'ghost';
  body.add(ghost);
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(box(7, 9, 6)),
    new THREE.LineDashedMaterial({ color: COLORS.royal, dashSize: 0.4, gapSize: 0.28, transparent: true, opacity: 0.85 }),
  );
  edges.computeLineDistances();
  edges.position.y = ghost.position.y;
  body.add(edges);
  // ghost floor lines
  for (let i = 1; i < 6; i++) {
    const r = dashedRect(7, 6, 0.4 + i * 1.5);
    body.add(r);
  }
  const s = leaseSign('HQ SITE');
  s.position.set(3.6, 0.4, 3.1);
  body.add(s);
  return { root, body, mats, height: 10, radius: 5.4 };
}

/* ------------------------------------------------------------------ */
/* Decorative low-rise buildings (non-interactive)                     */
/* ------------------------------------------------------------------ */

export function buildDecor(w: number, d: number, floors: number, variant = 0): THREE.Group {
  const mats = { white: MAT.white, glass: getGlassMaterial(), trim: MAT.trim } as BuildingMaterials;
  const g = new THREE.Group();
  const plinth = mesh(rbox(w + 0.6, 0.24, d + 0.6, 0.1), MAT.stone, false);
  plinth.position.y = 0.12;
  g.add(plinth);
  const s = section({ w, d, floors, mats, pilasters: variant === 1 });
  s.group.position.y = 0.24;
  g.add(s.group);
  const topY = 0.24 + s.height;
  if (variant === 2) {
    const garden = mesh(rbox(w - 0.6, 0.18, d - 0.6, 0.08), MAT.grass, false);
    garden.position.y = topY + 0.09;
    g.add(garden);
  } else {
    const box1 = mesh(rbox(Math.min(1.6, w * 0.35), 0.6, Math.min(1.4, d * 0.35), 0.1), MAT.grey);
    box1.position.set(w * 0.18, topY + 0.3, -d * 0.15);
    g.add(box1);
  }
  return g;
}

/** Small pavilion with a flat white canopy (café / kiosk). */
export function buildPavilion(w: number, d: number, awning: number): THREE.Group {
  const g = new THREE.Group();
  const glass = mesh(glassBox(w - 0.6, 1.6, d - 0.6, 1), getGlassMaterial());
  glass.position.y = 0.8 + 0.2;
  const roof = mesh(rbox(w + 0.6, 0.22, d + 0.6, 0.1), MAT.white);
  roof.position.y = 2.0;
  const aw = mesh(rbox(w * 0.7, 0.08, 1.0, 0.04), new THREE.MeshStandardMaterial({ color: awning, roughness: 0.6 }));
  aw.position.set(0, 1.55, d / 2 + 0.2);
  aw.rotation.x = 0.25;
  const base = mesh(rbox(w + 0.8, 0.2, d + 0.8, 0.08), MAT.stone, false);
  base.position.y = 0.1;
  g.add(base, glass, roof, aw);
  return g;
}
