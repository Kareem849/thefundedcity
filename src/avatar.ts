// Customisable low-poly trader avatar, built from primitives (no external models).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export type HairStyle = 'short' | 'buzz' | 'long' | 'bun' | 'curly' | 'bald';
export type Outfit = 'suit' | 'hoodie' | 'tee' | 'dress';
export type Accessory = 'none' | 'cap' | 'glasses' | 'headphones';

export interface AvatarConfig {
  skin: number;
  hairStyle: HairStyle;
  hairColor: number;
  outfit: Outfit;
  outfitColor: number;
  accessory: Accessory;
}

export interface Option<T> { id: T; label: string; color?: number }

export const SKIN_TONES: Option<number>[] = [
  { id: 0xf6dcc6, label: 'Porcelain' }, { id: 0xeec3a0, label: 'Light' }, { id: 0xd9a77e, label: 'Sand' },
  { id: 0xc18559, label: 'Tan' }, { id: 0x8d5a3b, label: 'Brown' }, { id: 0x5b3a29, label: 'Deep' },
];
export const HAIR_STYLES: Option<HairStyle>[] = [
  { id: 'short', label: 'Short' }, { id: 'buzz', label: 'Buzz' }, { id: 'long', label: 'Long' },
  { id: 'bun', label: 'Bun' }, { id: 'curly', label: 'Curly' }, { id: 'bald', label: 'Bald' },
];
export const HAIR_COLORS: Option<number>[] = [
  { id: 0x1e1b1a, label: 'Black' }, { id: 0x3b2a20, label: 'Dark brown' }, { id: 0x6b4430, label: 'Brown' },
  { id: 0x8e3b23, label: 'Auburn' }, { id: 0xd8b26a, label: 'Blonde' }, { id: 0xe9e2d0, label: 'Platinum' },
  { id: 0x9a9a9f, label: 'Silver' }, { id: 0x3d6bd8, label: 'Electric blue' }, { id: 0xd77a9b, label: 'Rose' },
];
export const OUTFITS: Option<Outfit>[] = [
  { id: 'suit', label: 'Suit' }, { id: 'hoodie', label: 'Hoodie' }, { id: 'tee', label: 'T-shirt' }, { id: 'dress', label: 'Dress' },
];
export const OUTFIT_COLORS: Option<number>[] = [
  { id: 0x1f2f55, label: 'Navy' }, { id: 0x3a3f4a, label: 'Charcoal' }, { id: 0x2f6bff, label: 'Royal' },
  { id: 0x14a37f, label: 'Emerald' }, { id: 0x7a2335, label: 'Burgundy' }, { id: 0xcdb48a, label: 'Sand' },
  { id: 0xf2f3f5, label: 'White' }, { id: 0xd4a94a, label: 'Gold' },
];
export const ACCESSORIES: Option<Accessory>[] = [
  { id: 'none', label: 'None' }, { id: 'cap', label: 'Cap' }, { id: 'glasses', label: 'Glasses' }, { id: 'headphones', label: 'Headphones' },
];

export const DEFAULT_AVATAR: AvatarConfig = {
  skin: 0xd9a77e, hairStyle: 'short', hairColor: 0x1e1b1a, outfit: 'suit', outfitColor: 0x1f2f55, accessory: 'none',
};

export function randomAvatar(): AvatarConfig {
  const pick = <T>(a: Option<T>[]) => a[Math.floor(Math.random() * a.length)].id;
  return {
    skin: pick(SKIN_TONES), hairStyle: pick(HAIR_STYLES), hairColor: pick(HAIR_COLORS),
    outfit: pick(OUTFITS), outfitColor: pick(OUTFIT_COLORS), accessory: pick(ACCESSORIES),
  };
}

export function isValidConfig(c: unknown): c is AvatarConfig {
  if (!c || typeof c !== 'object') return false;
  const o = c as Record<string, unknown>;
  return SKIN_TONES.some((s) => s.id === o.skin) && HAIR_STYLES.some((s) => s.id === o.hairStyle)
    && HAIR_COLORS.some((s) => s.id === o.hairColor) && OUTFITS.some((s) => s.id === o.outfit)
    && OUTFIT_COLORS.some((s) => s.id === o.outfitColor) && ACCESSORIES.some((s) => s.id === o.accessory);
}

/* ------------------------------------------------------------------ */

export interface Avatar {
  root: THREE.Group;
  /** speed: 0 idle … 1 walking … 1.6 jogging */
  update: (dt: number, speed: number) => void;
  dispose: () => void;
}

const std = (color: number, roughness = 0.7) => new THREE.MeshStandardMaterial({ color, roughness });

/** Darken / lighten a hex colour for trims. */
function shade(hex: number, f: number) {
  const c = new THREE.Color(hex);
  if (f < 0) c.lerp(new THREE.Color(0x000000), -f);
  else c.lerp(new THREE.Color(0xffffff), f);
  return c.getHex();
}

export function buildAvatar(cfg: AvatarConfig, opts: { castShadow?: boolean } = {}): Avatar {
  const root = new THREE.Group();
  const body = new THREE.Group(); // bobbing part
  root.add(body);
  const mats: THREE.Material[] = [];
  const geos: THREE.BufferGeometry[] = [];
  const M = (color: number, r = 0.7) => { const m = std(color, r); mats.push(m); return m; };
  const G = <T extends THREE.BufferGeometry>(g: T) => { geos.push(g); return g; };
  const add = (parent: THREE.Object3D, g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = !!opts.castShadow;
    parent.add(mesh);
    return mesh;
  };

  const skin = M(cfg.skin, 0.6);
  const hair = M(cfg.hairColor, 0.55);
  const top = M(cfg.outfitColor, cfg.outfit === 'suit' ? 0.5 : 0.8);
  const pantsColor = cfg.outfit === 'suit' ? cfg.outfitColor : cfg.outfit === 'hoodie' ? 0x2b3550 : cfg.outfit === 'tee' ? 0x3b4d74 : cfg.skin;
  const pants = M(pantsColor, 0.75);
  const shoe = M(cfg.outfit === 'suit' ? 0x1a1a1f : 0xf3f4f6, 0.5);
  const dark = M(0x1d2230, 0.4);

  /* legs (pivot at hips) */
  const legs: THREE.Group[] = [];
  const legGeo = G(new THREE.CapsuleGeometry(0.085, 0.5, 4, 10));
  const shoeGeo = G(new RoundedBoxGeometry(0.15, 0.09, 0.26, 2, 0.04));
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.1, 0.8, 0);
    add(pivot, legGeo, pants, 0, -0.36, 0);
    add(pivot, shoeGeo, shoe, 0, -0.74, 0.04);
    body.add(pivot);
    legs.push(pivot);
  }

  /* torso */
  const torsoGeo = G(new RoundedBoxGeometry(0.44, 0.54, 0.26, 3, 0.09));
  add(body, torsoGeo, top, 0, 1.06, 0);
  if (cfg.outfit === 'dress') {
    const skirt = add(body, G(new THREE.CylinderGeometry(0.2, 0.36, 0.46, 16)), top, 0, 0.66, 0);
    skirt.scale.z = 0.8;
  } else {
    add(body, G(new RoundedBoxGeometry(0.42, 0.14, 0.25, 2, 0.05)), pants, 0, 0.8, 0); // hips
  }
  if (cfg.outfit === 'suit') {
    add(body, G(new THREE.BoxGeometry(0.12, 0.26, 0.02)), M(0xffffff, 0.5), 0, 1.18, 0.13);
    add(body, G(new THREE.BoxGeometry(0.045, 0.22, 0.025)), M(0xd4a94a, 0.35), 0, 1.15, 0.145);
    const lapelGeo = G(new THREE.BoxGeometry(0.05, 0.24, 0.02));
    const lapelMat = M(shade(cfg.outfitColor, -0.25), 0.5);
    for (const s of [-1, 1]) {
      const l = add(body, lapelGeo, lapelMat, s * 0.08, 1.18, 0.135);
      l.rotation.z = s * 0.35;
    }
  } else if (cfg.outfit === 'hoodie') {
    const hood = add(body, G(new THREE.TorusGeometry(0.13, 0.055, 8, 16)), top, 0, 1.33, -0.09);
    hood.rotation.x = Math.PI / 2.4;
    add(body, G(new RoundedBoxGeometry(0.26, 0.12, 0.03, 2, 0.02)), M(shade(cfg.outfitColor, -0.18)), 0, 0.92, 0.13);
    const stringGeo = G(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 4));
    for (const s of [-1, 1]) add(body, stringGeo, M(0xffffff), s * 0.04, 1.2, 0.135);
  } else if (cfg.outfit === 'tee') {
    add(body, G(new THREE.TorusGeometry(0.075, 0.015, 6, 16)), M(shade(cfg.outfitColor, -0.15)), 0, 1.32, 0.02).rotation.x = Math.PI / 2;
  } else {
    add(body, G(new THREE.BoxGeometry(0.46, 0.05, 0.27)), M(shade(cfg.outfitColor, -0.2)), 0, 0.86, 0); // belt line
  }

  /* arms (pivot at shoulders) */
  const arms: THREE.Group[] = [];
  const sleeveMat = cfg.outfit === 'tee' || cfg.outfit === 'dress' ? skin : top;
  const upperGeo = G(new THREE.CapsuleGeometry(0.065, 0.38, 4, 10));
  const handGeo = G(new THREE.SphereGeometry(0.068, 12, 10));
  const shortSleeveGeo = G(new THREE.CapsuleGeometry(0.075, 0.1, 4, 10));
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.28, 1.26, 0);
    pivot.rotation.z = side * 0.08;
    add(pivot, upperGeo, sleeveMat, 0, -0.24, 0);
    if (cfg.outfit === 'tee') add(pivot, shortSleeveGeo, top, 0, -0.06, 0);
    add(pivot, handGeo, skin, 0, -0.5, 0);
    body.add(pivot);
    arms.push(pivot);
  }

  /* head */
  add(body, G(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 10)), skin, 0, 1.37, 0);
  const head = new THREE.Group();
  head.position.y = 1.58;
  body.add(head);
  const skull = add(head, G(new THREE.SphereGeometry(0.2, 24, 18)), skin);
  skull.scale.set(1, 1.06, 0.98);
  const eyeGeo = G(new THREE.SphereGeometry(0.022, 8, 6));
  for (const s of [-1, 1]) add(head, eyeGeo, dark, s * 0.07, 0.01, 0.185);
  const earGeo = G(new THREE.SphereGeometry(0.045, 8, 6));
  for (const s of [-1, 1]) add(head, earGeo, skin, s * 0.2, -0.01, 0).scale.set(0.6, 1, 0.8);

  /* hair */
  const cap = (theta: number, r = 0.215) => {
    const m = add(head, G(new THREE.SphereGeometry(r, 24, 14, 0, Math.PI * 2, 0, theta)), hair, 0, 0.01, -0.012);
    m.rotation.x = -0.18; // sits back a little, shows forehead
    return m;
  };
  switch (cfg.hairStyle) {
    case 'short':
      cap(Math.PI * 0.5);
      add(head, G(new RoundedBoxGeometry(0.3, 0.06, 0.08, 2, 0.025)), hair, 0, 0.13, 0.14).rotation.x = -0.4;
      break;
    case 'buzz':
      cap(Math.PI * 0.44, 0.207);
      break;
    case 'long':
      cap(Math.PI * 0.56);
      add(head, G(new RoundedBoxGeometry(0.4, 0.46, 0.13, 3, 0.06)), hair, 0, -0.14, -0.12);
      for (const s of [-1, 1]) add(head, G(new RoundedBoxGeometry(0.07, 0.34, 0.12, 2, 0.03)), hair, s * 0.19, -0.1, 0.0);
      break;
    case 'bun':
      cap(Math.PI * 0.5);
      add(head, G(new THREE.SphereGeometry(0.1, 14, 10)), hair, 0, 0.2, -0.13);
      break;
    case 'curly': {
      const curlGeo = G(new THREE.IcosahedronGeometry(0.075, 0));
      for (let i = 0; i < 22; i++) {
        const phi = Math.acos(1 - (i + 0.5) / 22 * 1.05); // upper hemisphere
        const th = i * 2.399963;
        const r = 0.2;
        const p = new THREE.Vector3(Math.sin(phi) * Math.cos(th) * r, Math.cos(phi) * r + 0.02, Math.sin(phi) * Math.sin(th) * r - 0.02);
        if (p.z > 0.12 && p.y < 0.1) continue; // keep the face clear
        add(head, curlGeo, hair, p.x, p.y, p.z);
      }
      break;
    }
    case 'bald':
      break;
  }

  /* accessories */
  if (cfg.accessory === 'cap') {
    const capMat = M(cfg.outfit === 'suit' ? 0x13213f : cfg.outfitColor, 0.6);
    add(head, G(new THREE.SphereGeometry(0.222, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.42)), capMat, 0, 0.03, 0);
    const brim = add(head, G(new THREE.CylinderGeometry(0.15, 0.15, 0.018, 20, 1, false, -Math.PI / 2, Math.PI)), capMat, 0, 0.09, 0.12);
    brim.scale.z = 1.2;
  } else if (cfg.accessory === 'glasses') {
    const frame = M(0x1d2230, 0.3);
    const ringGeo = G(new THREE.TorusGeometry(0.048, 0.011, 6, 16));
    for (const s of [-1, 1]) add(head, ringGeo, frame, s * 0.072, 0.01, 0.196);
    add(head, G(new THREE.BoxGeometry(0.05, 0.01, 0.01)), frame, 0, 0.02, 0.2);
  } else if (cfg.accessory === 'headphones') {
    const hp = M(0x22262f, 0.4);
    const band = add(head, G(new THREE.TorusGeometry(0.225, 0.022, 6, 24, Math.PI)), hp, 0, 0.0, 0);
    band.scale.set(1, 1.05, 1); // arch over the head, ear to ear
    const cupGeo = G(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 16));
    for (const s of [-1, 1]) {
      const c = add(head, cupGeo, M(0xd4a94a, 0.35), s * 0.215, -0.01, 0);
      c.rotation.z = Math.PI / 2;
    }
  }

  /* soft blob shadow (cheaper and steadier than a real shadow for a moving figure) */
  const blobTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(20,30,50,0.45)');
    grad.addColorStop(1, 'rgba(20,30,50,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false });
  mats.push(blobMat);
  const blob = new THREE.Mesh(G(new THREE.PlaneGeometry(1.1, 1.1)), blobMat);
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.02;
  root.add(blob);

  let phase = 0;
  let t = 0;
  let smoothSpeed = 0;
  return {
    root,
    update(dt, speed) {
      t += dt;
      smoothSpeed += (speed - smoothSpeed) * Math.min(1, dt * 8);
      const s = smoothSpeed;
      phase += dt * (6 + 5 * s) * Math.min(1, s * 4);
      const swing = Math.sin(phase);
      const amp = Math.min(1, s);
      legs[0].rotation.x = swing * 0.6 * amp;
      legs[1].rotation.x = -swing * 0.6 * amp;
      arms[0].rotation.x = -swing * 0.5 * amp;
      arms[1].rotation.x = swing * 0.5 * amp;
      body.position.y = Math.abs(Math.cos(phase)) * 0.045 * amp + Math.sin(t * 2) * 0.006 * (1 - amp);
      body.rotation.x = 0.06 * amp;
      head.rotation.y = Math.sin(t * 0.7) * 0.12 * (1 - amp);
      blob.scale.setScalar(1 - body.position.y * 1.5);
    },
    dispose() {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
      blobTex.dispose();
    },
  };
}
