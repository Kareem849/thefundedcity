// Aircraft for the FUNDEDCITY airport: Boeing and Airbus airliners, helicopters and small planes.
// Every aircraft carries an advertising livery (fuselage decal / banner) — the planes are ad space.
import * as THREE from 'three';
import { mesh, box, rbox } from './buildings';
import { bake, noBake } from './bake';

export type AirlinerType = 'B777' | 'B747' | 'B737' | 'A350' | 'A320';
export const TYPE_NAME: Record<AirlinerType, string> = {
  B777: 'Boeing 777', B747: 'Boeing 747', B737: 'Boeing 737', A350: 'Airbus A350', A320: 'Airbus A320',
};
interface Spec { L: number; span: number; r: number; engines: 2 | 4; hump?: boolean; mask?: boolean; sharklet?: boolean }
const SPEC: Record<AirlinerType, Spec> = {
  B777: { L: 16, span: 15.5, r: 0.95, engines: 2 },
  B747: { L: 17, span: 16, r: 1.05, engines: 4, hump: true },
  B737: { L: 11.5, span: 10.5, r: 0.75, engines: 2, sharklet: true },
  A350: { L: 15, span: 15, r: 0.92, engines: 2, mask: true },
  A320: { L: 11, span: 10.6, r: 0.76, engines: 2, sharklet: true },
};

export interface Livery { text: string; sub?: string; color: string; tail: string }

const WHITE = new THREE.MeshStandardMaterial({ color: 0xf7f8fa, roughness: 0.35, metalness: 0.1 });
const GREY = new THREE.MeshStandardMaterial({ color: 0xc3c9d3, roughness: 0.45, metalness: 0.3 });
const DARK = new THREE.MeshStandardMaterial({ color: 0x2a3140, roughness: 0.5 });
const GLASS = new THREE.MeshStandardMaterial({ color: 0x1b2638, roughness: 0.15, metalness: 0.4 });
const matCache = new Map<string, THREE.MeshStandardMaterial>();
const colorMat = (c: string) => {
  let m = matCache.get(c);
  if (!m) { m = new THREE.MeshStandardMaterial({ color: new THREE.Color(c), roughness: 0.45 }); matCache.set(c, m); }
  return m;
};

/** Side decal: window line + big advertising text. */
function decalTexture(l: Livery) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 160;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, c.width, c.height);
  // cheat line
  g.fillStyle = l.color;
  g.fillRect(0, 118, c.width, 26);
  // windows
  g.fillStyle = '#1b2638';
  for (let x = 120; x < c.width - 40; x += 22) { g.beginPath(); g.roundRect(x, 14, 11, 16, 4); g.fill(); }
  g.fillStyle = l.color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let size = 64;
  g.font = `900 ${size}px Manrope, Inter, system-ui, sans-serif`;
  while (g.measureText(l.text).width > c.width - 140 && size > 24) g.font = `900 ${(size -= 2)}px Manrope, Inter, system-ui, sans-serif`;
  g.fillText(l.text, c.width / 2 + 30, 76);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export interface Aircraft {
  group: THREE.Group;
  gear: THREE.Object3D | null;
  spinners: THREE.Object3D[];
  length: number;
}

/** Airliner, nose toward +x, wheels on y=0. */
export function buildAirliner(type: AirlinerType, livery: Livery): Aircraft {
  const s = SPEC[type];
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const { L, r, span } = s;
  const cy = r + 0.55; // fuselage centre height above the wheels
  const tailMat = colorMat(livery.tail);
  // fuselage + nose + tail cone
  const fuse = mesh(new THREE.CylinderGeometry(r, r, L * 0.68, 18), WHITE);
  fuse.rotation.z = Math.PI / 2;
  fuse.position.set(L * 0.02, cy, 0);
  const nose = mesh(new THREE.SphereGeometry(r, 18, 12), WHITE);
  nose.scale.set(1.9, 1, 1);
  nose.position.set(L * 0.36, cy - 0.03, 0);
  const cockpit = mesh(box(0.5, 0.22, r * 1.1), GLASS, false);
  cockpit.position.set(L * 0.36 + r * 1.15, cy + r * 0.32, 0);
  cockpit.rotation.z = -0.5;
  const tailGeo = new THREE.ConeGeometry(r, L * 0.22, 18);
  tailGeo.rotateZ(Math.PI / 2);
  const tail = mesh(tailGeo, WHITE);
  tail.position.set(-L * 0.43, cy + r * 0.25, 0);
  tail.scale.set(1, 0.75, 1);
  body.add(fuse, nose, cockpit, tail);
  if (s.mask) {
    const mask = mesh(box(0.7, r * 0.5, r * 2.02), DARK, false);
    mask.position.set(L * 0.38, cy + r * 0.3, 0);
    body.add(mask);
  }
  if (s.hump) {
    const hump = mesh(new THREE.SphereGeometry(r * 0.8, 16, 10), WHITE);
    hump.scale.set(3.4, 1, 1);
    hump.position.set(L * 0.22, cy + r * 0.62, 0);
    body.add(hump);
  }
  // wings (one shape through the fuselage), swept back
  const w = new THREE.Shape();
  const half = span / 2;
  const le0 = L * 0.1, te0 = -L * 0.12, leT = -L * 0.14, teT = -L * 0.21;
  w.moveTo(le0, 0);
  w.lineTo(leT, half);
  w.lineTo(teT, half);
  w.lineTo(te0, 0);
  w.lineTo(teT, -half);
  w.lineTo(leT, -half);
  w.lineTo(le0, 0);
  const wingGeo = new THREE.ExtrudeGeometry(w, { depth: 0.16, bevelEnabled: false });
  wingGeo.rotateX(Math.PI / 2);
  const wing = mesh(wingGeo, GREY);
  wing.position.set(0, cy - r * 0.45 + 0.08, 0);
  wing.rotation.x = 0; // slight dihedral is visual noise at this scale
  body.add(wing);
  if (s.sharklet) {
    for (const sz of [-1, 1]) {
      const tip = mesh(box(0.5, 0.7, 0.06), tailMat, false);
      tip.position.set(leT - 0.25, cy - r * 0.45 + 0.4, sz * half);
      body.add(tip);
    }
  }
  // tailplane + fin
  const hs = new THREE.Shape();
  const hh = span * 0.2;
  hs.moveTo(-L * 0.36, 0);
  hs.lineTo(-L * 0.45, hh);
  hs.lineTo(-L * 0.49, hh);
  hs.lineTo(-L * 0.46, 0);
  hs.lineTo(-L * 0.49, -hh);
  hs.lineTo(-L * 0.45, -hh);
  hs.lineTo(-L * 0.36, 0);
  const hsGeo = new THREE.ExtrudeGeometry(hs, { depth: 0.12, bevelEnabled: false });
  hsGeo.rotateX(Math.PI / 2);
  const tailplane = mesh(hsGeo, GREY);
  tailplane.position.y = cy + r * 0.25;
  const fin = new THREE.Shape();
  const fh = r * 3.1;
  fin.moveTo(-L * 0.34, 0);
  fin.lineTo(-L * 0.46, fh);
  fin.lineTo(-L * 0.52, fh);
  fin.lineTo(-L * 0.5, 0);
  fin.lineTo(-L * 0.34, 0);
  const finGeo = new THREE.ExtrudeGeometry(fin, { depth: 0.14, bevelEnabled: false });
  finGeo.translate(0, 0, -0.07);
  const finM = mesh(finGeo, tailMat);
  finM.position.y = cy + r * 0.55;
  body.add(tailplane, finM);
  // engines
  const engGeo = new THREE.CylinderGeometry(r * 0.42, r * 0.36, L * 0.13, 14);
  engGeo.rotateZ(Math.PI / 2);
  const engZ = s.engines === 4 ? [half * 0.32, half * 0.62] : [half * 0.36];
  for (const ez of engZ) for (const sz of [-1, 1]) {
    const x = le0 - (le0 - leT) * (ez / half) + 0.1;
    const e = mesh(engGeo, GREY);
    e.position.set(x, cy - r * 0.45 - r * 0.42, sz * ez);
    const intake = mesh(new THREE.CircleGeometry(r * 0.38, 14), DARK, false);
    intake.rotation.y = Math.PI / 2;
    intake.position.set(x + L * 0.066, e.position.y, sz * ez);
    const accent = mesh(new THREE.CylinderGeometry(r * 0.43, r * 0.43, 0.25, 14), tailMat, false);
    accent.rotation.z = Math.PI / 2;
    accent.position.set(x + L * 0.04, e.position.y, sz * ez);
    body.add(e, intake, accent);
  }
  // advertising decals on both sides
  const tex = decalTexture(livery);
  const decalMat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 });
  const dw = L * 0.7;
  const dh = dw * (160 / 1024);
  for (const sz of [1, -1]) {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(dw, dh), decalMat);
    d.position.set(L * 0.02, cy + r * 0.02, sz * (r + 0.015));
    if (sz < 0) d.rotation.y = Math.PI;
    body.add(d);
  }
  // landing gear (hidden in flight)
  const gear = new THREE.Group();
  const wheelGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.25, 10);
  wheelGeo.rotateX(Math.PI / 2);
  for (const [x, z] of [[L * 0.3, 0], [-L * 0.05, r * 0.9], [-L * 0.05, -r * 0.9]]) {
    const strut = mesh(box(0.1, cy - r - 0.1, 0.1), GREY, false);
    strut.position.set(x, (cy - r) / 2 + 0.15, z);
    const wh = mesh(wheelGeo, DARK, false);
    wh.position.set(x, 0.22, z);
    gear.add(strut, wh);
  }
  noBake(gear);
  g.add(gear);
  bake(body);
  return { group: g, gear, spinners: [], length: L };
}

/** Helicopter, nose toward +x. Main + tail rotors spin. */
export function buildHelicopter(color: string, ad: string): Aircraft {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const m = colorMat(color);
  const cab = mesh(new THREE.SphereGeometry(1, 16, 12), m);
  cab.scale.set(1.6, 1.05, 1.0);
  cab.position.y = 1.3;
  const glass = mesh(new THREE.SphereGeometry(0.85, 14, 10, 0, Math.PI), GLASS, false);
  glass.scale.set(1.2, 0.85, 1.05);
  glass.rotation.y = -Math.PI / 2;
  glass.position.set(0.75, 1.45, 0);
  const boomGeo = new THREE.CylinderGeometry(0.16, 0.32, 4.2, 10);
  boomGeo.rotateZ(Math.PI / 2);
  const boom = mesh(boomGeo, m);
  boom.position.set(-3.2, 1.55, 0);
  const fin = mesh(box(0.7, 1.1, 0.1), m);
  fin.position.set(-5.1, 2.0, 0);
  for (const sz of [-0.7, 0.7]) {
    const skid = mesh(box(3.4, 0.1, 0.1), DARK, false);
    skid.position.set(0, 0.08, sz);
    const strut = mesh(box(0.08, 0.5, 0.08), DARK, false);
    strut.position.set(0.6, 0.35, sz);
    const strut2 = strut.clone();
    strut2.position.x = -0.6;
    body.add(skid, strut, strut2);
  }
  const mast = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 8), DARK, false);
  mast.position.y = 2.5;
  body.add(cab, glass, boom, fin, mast);
  // tail-boom ad
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const cg = c.getContext('2d')!;
  cg.fillStyle = '#ffffff';
  cg.font = '900 54px Manrope, Inter, system-ui, sans-serif';
  cg.textAlign = 'center';
  cg.textBaseline = 'middle';
  cg.fillText(ad, 256, 50);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const adMat = new THREE.MeshBasicMaterial({ map: t, transparent: true });
  for (const sz of [1, -1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.5), adMat);
    p.position.set(-0.1, 1.25, sz * 1.02);
    if (sz < 0) p.rotation.y = Math.PI;
    body.add(p);
  }
  bake(body);
  const rotor = new THREE.Group();
  for (const a of [0, Math.PI / 2]) {
    const blade = mesh(box(8, 0.06, 0.32), DARK, false);
    blade.rotation.y = a;
    rotor.add(blade);
  }
  rotor.position.y = 2.8;
  const tailRotor = new THREE.Group();
  const tb = mesh(box(0.14, 1.4, 0.05), DARK, false);
  tailRotor.add(tb);
  tailRotor.position.set(-5.2, 2.0, 0.15);
  noBake(rotor);
  noBake(tailRotor);
  g.add(rotor, tailRotor);
  return { group: g, gear: null, spinners: [rotor, tailRotor], length: 7 };
}

/** Small high-wing plane, nose toward +x; optionally towing an advertising banner. */
export function buildSmallPlane(color: string, banner?: string): Aircraft {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const m = colorMat(color);
  const fuseGeo = new THREE.CylinderGeometry(0.42, 0.22, 4.2, 12);
  fuseGeo.rotateZ(Math.PI / 2);
  const fuse = mesh(fuseGeo, WHITE);
  fuse.position.y = 0.95;
  const noseCone = mesh(new THREE.SphereGeometry(0.42, 12, 8), m);
  noseCone.scale.set(0.8, 1, 1);
  noseCone.position.set(2.1, 0.95, 0);
  const wing = mesh(rbox(1.1, 0.1, 7.6, 0.04), m);
  wing.position.set(0.5, 1.5, 0);
  const cabin = mesh(box(1.0, 0.45, 0.7), GLASS, false);
  cabin.position.set(0.9, 1.25, 0);
  const tailPlane = mesh(box(0.7, 0.06, 2.4), m);
  tailPlane.position.set(-1.9, 1.05, 0);
  const fin = mesh(box(0.7, 0.9, 0.06), m);
  fin.position.set(-1.95, 1.45, 0);
  const gearL = mesh(box(0.06, 0.6, 1.4), DARK, false);
  gearL.position.set(0.8, 0.35, 0);
  body.add(fuse, noseCone, wing, cabin, tailPlane, fin, gearL);
  bake(body);
  const prop = new THREE.Group();
  const blade = mesh(box(0.05, 1.4, 0.12), DARK, false);
  prop.add(blade);
  prop.position.set(2.5, 0.95, 0);
  noBake(prop);
  g.add(prop);
  if (banner) {
    // big banner, readable from both sides: two faces back to back, each drawn the right way round
    const c = document.createElement('canvas');
    c.width = 2048;
    c.height = 400;
    const cg = c.getContext('2d')!;
    cg.fillStyle = '#ffffff';
    cg.fillRect(0, 0, c.width, c.height);
    cg.fillStyle = '#e5383b';
    cg.fillRect(0, 0, 36, c.height);
    cg.fillRect(c.width - 36, 0, 36, c.height);
    cg.strokeStyle = '#13213f';
    cg.lineWidth = 12;
    cg.strokeRect(6, 6, c.width - 12, c.height - 12);
    cg.fillStyle = '#13213f';
    cg.textAlign = 'center';
    cg.textBaseline = 'middle';
    let size = 260;
    cg.font = `900 ${size}px Manrope, Inter, system-ui, sans-serif`;
    while (cg.measureText(banner).width > c.width - 160 && size > 60) cg.font = `900 ${(size -= 4)}px Manrope, Inter, system-ui, sans-serif`;
    cg.fillText(banner, c.width / 2, c.height / 2 + size * 0.04);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    const bm = new THREE.MeshStandardMaterial({ map: t, roughness: 0.7, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.18 });
    const bw = 26;
    const bh = 5.1;
    const geo = new THREE.PlaneGeometry(bw, bh, 16, 1);
    const bannerGroup = new THREE.Group();
    const front = new THREE.Mesh(geo, bm);
    front.position.z = 0.03;
    const back = new THREE.Mesh(geo, bm);
    back.rotation.y = Math.PI;
    back.position.z = -0.03;
    bannerGroup.add(front, back);
    bannerGroup.position.set(-7 - bw / 2, 0.2, 0);
    const pole = mesh(box(0.08, bh + 0.2, 0.08), DARK, false);
    pole.position.set(bw / 2 + 0.05, 0, 0);
    bannerGroup.add(pole);
    const rope = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-2, 0.9, 0), new THREE.Vector3(-7, 0.2 + bh / 2, 0), new THREE.Vector3(-2, 0.9, 0), new THREE.Vector3(-7, 0.2 - bh / 2, 0)]), new THREE.LineBasicMaterial({ color: 0x555555 }));
    noBake(bannerGroup);
    g.add(bannerGroup, rope);
    g.userData.banner = bannerGroup;
  }
  return { group: g, gear: null, spinners: [prop], length: 5 };
}
