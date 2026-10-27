// FOUNDERS' SUMMIT: a stone plaza on a flattened shoulder of the mountains between the desert and the forest,
// with a statue for each of the city's five founders. Founder 1 is Kareem Capital; founders 2–5 stand veiled
// until the city's owner fills in their profiles (name, role, bio, social links), then they're unveiled.
// A cable car runs up from the main island's north-west corner. Only founders can be Mayor of FUNDEDCITY.
// Profiles live in the page's shared database (`hall/founders`, written only by the city's owner);
// off the published city, edits stay in this browser.
import * as THREE from 'three';
import { mesh, box, rbox, signPlane, makeBuildingMaterials, MAT } from './buildings';
import { bake, noBake } from './bake';
import { SUMMIT } from './terrain';
import { getCloud, type Cloud } from './cloud';
import { LOCAL_DEV } from './where';

export type FounderLink = 'x' | 'instagram' | 'youtube' | 'tiktok' | 'telegram' | 'discord' | 'linkedin' | 'website';
export const FOUNDER_LINKS: Array<[FounderLink, string]> = [['x', 'X'], ['instagram', 'Instagram'], ['youtube', 'YouTube'], ['tiktok', 'TikTok'], ['telegram', 'Telegram'], ['discord', 'Discord'], ['linkedin', 'LinkedIn'], ['website', 'Website']];
export interface Founder {
  id: string;
  /** empty = not yet revealed */
  name: string;
  handle: string;
  role: string;
  bio: string;
  links: Partial<Record<FounderLink, string>>;
  /** the founder's tower in the city, if any */
  towerId?: string;
}
export const FOUNDER_IDS = ['founder-1', 'founder-2', 'founder-3', 'founder-4', 'founder-5'];
export const DEFAULT_FOUNDERS: Founder[] = [
  { id: 'founder-1', name: 'Kareem Capital', handle: '@kareemcapital', role: 'Founder', bio: '', links: { x: 'https://x.com/kareemcapital' }, towerId: 'kareem' },
  ...[2, 3, 4, 5].map((n) => ({ id: `founder-${n}`, name: '', handle: '', role: 'Founder', bio: '', links: {} })),
];
export const revealed = (f: Founder) => !!f.name.trim();
/** only https links are ever shown */
export const safeUrl = (u: string | undefined) => {
  if (!u) return null;
  try { const url = new URL(u.trim()); return url.protocol === 'https:' ? url.toString() : null; } catch { return null; }
};

/* ---------------- the shared founders list ---------------- */
const LOCAL = 'fundedcity-founders-local';
function clean(v: unknown, i: number): Founder {
  const d = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const s = (k: string, n: number) => (typeof d[k] === 'string' ? (d[k] as string).trim().slice(0, n) : '');
  const links: Founder['links'] = {};
  const l = (d.links && typeof d.links === 'object' ? d.links : {}) as Record<string, unknown>;
  for (const [k] of FOUNDER_LINKS) { const u = typeof l[k] === 'string' ? safeUrl(l[k] as string) : null; if (u) links[k] = u.slice(0, 200); }
  return { id: FOUNDER_IDS[i], name: s('name', 40), handle: s('handle', 40), role: s('role', 40) || 'Founder', bio: s('bio', 600), links, towerId: s('towerId', 40) || DEFAULT_FOUNDERS[i].towerId };
}
export interface FoundersStore { list: () => Founder[]; onChange: (fn: (l: Founder[]) => void) => void; save: (l: Founder[]) => Promise<boolean>; canEdit: () => boolean }
let store: FoundersStore | null = null;
export function foundersStore(): FoundersStore {
  if (store) return store;
  let list = DEFAULT_FOUNDERS.map((f) => ({ ...f, links: { ...f.links } }));
  const fns: Array<(l: Founder[]) => void> = [];
  let cloud: Cloud | null = null;
  let owner = false;
  const emit = () => { for (const f of fns) f(list); };
  const apply = (items: unknown) => {
    if (!Array.isArray(items)) return;
    list = FOUNDER_IDS.map((_, i) => (items[i] ? clean(items[i], i) : { ...DEFAULT_FOUNDERS[i] }));
    emit();
  };
  void (async () => {
    cloud = await getCloud();
    if (cloud) {
      try { owner = !!(await cloud.user?.isOwner?.()); } catch { owner = false; }
      cloud.db.collection('hall').onSnapshot((s: { docs: Array<{ id: string; data(): Record<string, unknown> | undefined }> }) => {
        const d = s.docs.find((x) => x.id === 'founders');
        if (d) apply(d.data()?.items);
      }, () => {});
      emit();
    } else {
      owner = LOCAL_DEV; // only on your own machine; never on the public website
      try { apply(JSON.parse(localStorage.getItem(LOCAL) ?? 'null')?.items); } catch { /* defaults */ }
      emit();
    }
  })();
  store = {
    list: () => list,
    onChange: (fn) => { fns.push(fn); fn(list); },
    canEdit: () => owner,
    async save(next) {
      const items = next.map((f, i) => clean(f, i));
      if (cloud) {
        try { await cloud.db.doc('hall/founders').set({ items, updatedAt: Date.now() }); } catch { return false; }
      } else {
        try { localStorage.setItem(LOCAL, JSON.stringify({ items })); } catch { /* memory only */ }
      }
      list = items;
      emit();
      return true;
    },
  };
  return store;
}

/* ======================================================================= */
/* the summit in 3D                                                         */
const FONT = 'Manrope, Inter, system-ui, sans-serif';
/** statues stand in an arc on the far (north-west) side, facing the city (south-east) */
const FACE = Math.PI / 4; // rotation.y that turns +z towards (+x, +z)
export const STATION = { x: -99, z: -79 }; // the cable car's lower station, on the main island
export function statueSpot(i: number) {
  const a = FACE + Math.PI + (2 - i) * 0.42; // around the back of the plaza, founder 1 on the left as you face them
  return { x: SUMMIT.x + Math.sin(a) * 19, z: SUMMIT.z + Math.cos(a) * 19 };
}
export const UPPER = (() => { const a = FACE; return { x: SUMMIT.x + Math.sin(a) * (SUMMIT.r - 5), z: SUMMIT.z + Math.cos(a) * (SUMMIT.r - 5) }; })();

function plateTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { g: c.getContext('2d')!, tex };
}

export function buildFoundersSummit() {
  const Y = SUMMIT.y;
  const root = new THREE.Group(); // the plaza (pickable as the summit)
  const body = new THREE.Group();
  root.add(body);
  root.position.set(SUMMIT.x, Y, SUMMIT.z);
  const mats = makeBuildingMaterials();
  mats.white.color.setHex(0xe9e2d4);
  const stone = new THREE.MeshStandardMaterial({ color: 0xd9d1c1, roughness: 0.85 });
  const darkStone = new THREE.MeshStandardMaterial({ color: 0x9a9286, roughness: 0.9 });
  const gold = MAT.gold;
  // terraced round plaza with an inlaid gold compass ring
  const base = mesh(new THREE.CylinderGeometry(SUMMIT.r - 1, SUMMIT.r + 1, 2.2, 64), darkStone);
  base.position.y = -1.0;
  const top = mesh(new THREE.CylinderGeometry(SUMMIT.r - 2, SUMMIT.r - 1, 0.5, 64), stone);
  top.position.y = 0.25;
  const inner = mesh(new THREE.CylinderGeometry(9, 9, 0.12, 48), mats.white, false);
  inner.position.y = 0.56;
  body.add(base, top, inner);
  for (const r of [9.4, 26]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.12, r + 0.12, 96), gold);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.53;
    body.add(ring);
  }
  // the central obelisk with a gold pyramidion and the inscription
  const ob = mesh(new THREE.CylinderGeometry(0.9, 1.4, 14, 4, 1), mats.white);
  ob.rotation.y = Math.PI / 4;
  ob.position.y = 0.5 + 7;
  const tip = mesh(new THREE.ConeGeometry(0.95, 1.8, 4), gold);
  tip.rotation.y = Math.PI / 4;
  tip.position.y = 0.5 + 14.9;
  const plinth = mesh(box(4.2, 1.4, 4.2), stone);
  plinth.position.y = 0.5 + 0.7;
  body.add(ob, tip, plinth);
  const ins = signPlane("FOUNDERS' SUMMIT", 3.6, 0.9, { bg: '#e9e2d4', fg: '#22314f', sub: 'FUNDEDCITY · EST. 2026', subColor: '#9a7420' });
  ins.position.set(Math.sin(FACE) * 2.12, 0.5 + 1.0, Math.cos(FACE) * 2.12);
  ins.rotation.y = FACE;
  body.add(ins);
  // (the cable car's upper station is built with the cable car, see buildCableCar)
  // torches round the rim
  const flameMat = new THREE.MeshStandardMaterial({ color: 0xffd58a, emissive: 0xffa53a, emissiveIntensity: 1.2 });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.3;
    const x = Math.sin(a) * (SUMMIT.r - 3);
    const z = Math.cos(a) * (SUMMIT.r - 3);
    if (Math.hypot(x - (UPPER.x - SUMMIT.x), z - (UPPER.z - SUMMIT.z)) < 6) continue;
    const post = mesh(new THREE.CylinderGeometry(0.16, 0.22, 2.4, 8), darkStone);
    post.position.set(x, 0.5 + 1.2, z);
    const bowl = mesh(new THREE.CylinderGeometry(0.5, 0.25, 0.4, 10), gold);
    bowl.position.set(x, 0.5 + 2.5, z);
    const flame = mesh(new THREE.ConeGeometry(0.3, 0.8, 8), flameMat, false);
    flame.position.set(x, 0.5 + 3.0, z);
    body.add(post, bowl, flame);
  }
  bake(body);

  /* statues: one group each, so each one can be clicked */
  const bronze = new THREE.MeshStandardMaterial({ color: 0xb48a4f, roughness: 0.35, metalness: 0.75, envMapIntensity: 1.4 });
  const cloth = new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.95, side: THREE.DoubleSide });
  const sash = new THREE.MeshStandardMaterial({ color: 0xc9973a, roughness: 0.5, metalness: 0.4 });
  const veilGeo = new THREE.LatheGeometry([0.05, 1.9, 2.0, 1.75, 1.3, 1.15, 1.25, 1.05, 0.75, 0.3, 0.02].map((r, i, a) => new THREE.Vector2(r, (i / (a.length - 1)) * 8.6)), 24);
  const statues = FOUNDER_IDS.map((id, i) => {
    const sp = statueSpot(i);
    const sroot = new THREE.Group();
    const sbody = new THREE.Group();
    sroot.add(sbody);
    sroot.position.set(sp.x, Y + 0.5, sp.z);
    sbody.rotation.y = FACE;
    const smats = makeBuildingMaterials();
    smats.white.color.setHex(0xe9e2d4);
    const ped = mesh(rbox(4.4, 2.6, 4.4, 0.2), smats.white);
    ped.position.y = 1.3;
    const ped2 = mesh(box(5.2, 0.5, 5.2), stone);
    ped2.position.y = 0.25;
    sbody.add(ped, ped2);
    // the figure (shown once revealed): legs, coat, arms (one raised), head, all bronze
    const fig = new THREE.Group();
    const leg = rbox(0.75, 3.4, 0.8, 0.2);
    for (const sx of [-0.5, 0.5]) { const l = mesh(leg, bronze); l.position.set(sx, 1.7, 0); fig.add(l); }
    const coat = mesh(rbox(2.4, 3.6, 1.3, 0.4), bronze);
    coat.position.y = 4.9;
    const head = mesh(new THREE.SphereGeometry(0.8, 20, 14), bronze);
    head.position.y = 7.45;
    const neck = mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.5, 10), bronze);
    neck.position.y = 6.85;
    const armDown = mesh(rbox(0.6, 3.0, 0.6, 0.2), bronze);
    armDown.position.set(-1.5, 4.9, 0);
    armDown.rotation.z = -0.12;
    const armUp = mesh(rbox(0.6, 3.0, 0.6, 0.2), bronze);
    armUp.position.set(1.55, 7.2, 0.1);
    armUp.rotation.z = 0.35;
    const torch = mesh(new THREE.ConeGeometry(0.45, 1.0, 10), gold);
    torch.position.set(2.05, 8.85, 0.1);
    torch.rotation.z = Math.PI;
    fig.add(coat, head, neck, armDown, armUp, torch);
    fig.position.y = 2.6;
    // the veil (shown until the founder is revealed)
    const veil = new THREE.Group();
    const v = new THREE.Mesh(veilGeo, cloth);
    v.castShadow = true;
    const band = mesh(new THREE.TorusGeometry(1.32, 0.12, 6, 24), sash, false);
    band.rotation.x = Math.PI / 2;
    band.position.y = 3.6;
    veil.add(v, band);
    veil.position.y = 2.6;
    noBake(fig);
    noBake(veil);
    sbody.add(fig, veil);
    // name plate on the pedestal (live canvas)
    const plate = plateTexture();
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.12), new THREE.MeshBasicMaterial({ map: plate.tex, toneMapped: false }));
    pm.position.set(0, 1.5, 2.22);
    noBake(pm);
    sbody.add(pm);
    return { id, root: sroot, body: sbody, mats: smats, fig, veil, plate, height: 11, radius: 3.4 };
  });
  const drawPlate = (s: (typeof statues)[number], f: Founder, i: number) => {
    const g = s.plate.g;
    g.fillStyle = '#22314f';
    g.fillRect(0, 0, 512, 160);
    g.strokeStyle = '#c9973a';
    g.lineWidth = 6;
    g.strokeRect(8, 8, 496, 144);
    g.textAlign = 'center';
    g.fillStyle = '#f2c14e';
    g.font = `800 24px ${FONT}`;
    g.fillText(`FOUNDER ${i + 1}`, 256, 48);
    g.fillStyle = '#ffffff';
    const nm = revealed(f) ? f.name.toUpperCase() : 'TO BE REVEALED';
    let size = 46;
    g.font = `900 ${size}px ${FONT}`;
    while (g.measureText(nm).width > 460 && size > 20) g.font = `900 ${(size -= 2)}px ${FONT}`;
    g.fillText(nm, 256, 110);
    if (f.handle && revealed(f)) { g.fillStyle = '#9fb3d9'; g.font = `700 20px ${FONT}`; g.fillText(f.handle, 256, 140); }
    s.plate.tex.needsUpdate = true;
  };
  return {
    root, body, mats,
    height: 16,
    radius: SUMMIT.r,
    statues,
    setFounders(list: Founder[]) {
      statues.forEach((s, i) => {
        const f = list[i];
        s.fig.visible = revealed(f);
        s.veil.visible = !revealed(f);
        drawPlate(s, f, i);
      });
    },
  };
}


/* ======================================================================= */
/* the cable car from the main island up to the summit                     */
/* Two glass gondolas on a loop (one goes up as the other comes down), three pylons over the sea and
   the foothills, and open stations at both ends where you step in. Your character rides in cabin
   `rider.side` while the city's ride controller drives it; otherwise the cabins shuttle on their own. */
export const CABLE_GAP = 2.4; // each track's offset from the centre line (the bullwheel radius)
const DECK = 0.6; // station deck height above its ground
export const CABIN_FLOOR = 4.75; // cabin floor below the cable
const UPPER_DECK_Y = SUMMIT.y + 0.5 + 0.1;

export interface CableCar {
  group: THREE.Group;
  /** pylon bases (for walking obstacles) */
  pylons: { x: number; z: number }[];
  update: (dt: number) => void;
  /** u ∈ [0,1] along the line (0 = lower station) for the cabin on track `side` */
  uOf: (side: number) => number;
  /** take a cabin out of the shuttle for the player (null hands it back) */
  setRider: (r: { side: number; u: number } | null) => void;
  /** a point on the cable for track `side` at u */
  at: (u: number, side: number, out?: THREE.Vector3) => THREE.Vector3;
  /** yaw that faces uphill (towards the summit) */
  upYaw: number;
  /** line length in world units */
  length: number;
}

function stationBay(signText: string, signW: number) {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f6fa, roughness: 0.6 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x8a94a3, roughness: 0.4, metalness: 0.6 });
  const slate = new THREE.MeshStandardMaterial({ color: 0x55657a, roughness: 0.6 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x2f6bff, roughness: 0.4, metalness: 0.3 });
  const deck = mesh(rbox(11, DECK, 7.2, 0.12), white);
  deck.position.y = DECK / 2;
  g.add(deck);
  const edge = mesh(box(11.02, 0.08, 0.3), new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.5 }));
  edge.position.set(0, DECK + 0.01, 1.2);
  g.add(edge);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const p = mesh(box(0.42, 6.4, 0.42), steel);
    p.position.set(sx * 5.2, 3.2, sz * 3.3);
    g.add(p);
  }
  const roof = mesh(box(11.8, 0.36, 7.8), slate);
  roof.position.y = 6.55;
  const wheel = mesh(new THREE.TorusGeometry(CABLE_GAP, 0.11, 8, 40), blue);
  wheel.rotation.x = Math.PI / 2;
  wheel.position.y = DECK + CABIN_FLOOR;
  const hub = mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.9, 12), steel);
  hub.position.y = DECK + CABIN_FLOOR + 0.5;
  const sign = signPlane(signText, signW, 0.62, { bg: '#2f6bff', fg: '#ffffff' });
  sign.position.set(0, 7.15, 3.9);
  g.add(roof, wheel, hub, sign);
  return g;
}

export function buildCableCar(groundAtStation: number, ground: (x: number, z: number) => number): CableCar {
  const group = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0x8a94a3, roughness: 0.4, metalness: 0.6 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f6fa, roughness: 0.6 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x2f6bff, roughness: 0.4 });
  const gold = MAT.gold;

  // lower station: an open boarding bay, steps down to the street on the city side
  const ls = stationBay("CABLE CAR · FOUNDERS' SUMMIT", 5.6);
  for (let k = 0; k < 3; k++) {
    const step = mesh(box(4, DECK - k * 0.2, 0.7), white);
    step.position.set(0, (DECK - k * 0.2) / 2, 3.95 + k * 0.7);
    ls.add(step);
  }
  ls.position.set(STATION.x, groundAtStation, STATION.z);
  ls.rotation.y = FACE;
  group.add(ls);
  bake(ls);
  // upper station on the front edge of the summit plaza
  const us = stationBay('CABLE CAR · BACK TO THE CITY', 5.2);
  us.position.set(UPPER.x, UPPER_DECK_Y - DECK, UPPER.z);
  us.rotation.y = FACE;
  group.add(us);
  bake(us);

  // the line: lower bullwheel → three pylons → upper bullwheel, each span sagging a little
  const a = new THREE.Vector3(STATION.x, groundAtStation + DECK + CABIN_FLOOR, STATION.z);
  const b = new THREE.Vector3(UPPER.x, UPPER_DECK_Y + CABIN_FLOOR, UPPER.z);
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const perp = new THREE.Vector3(b.z - a.z, 0, -(b.x - a.x)).normalize();
  const climb = (u: number) => a.y + (b.y - a.y) * (1 - Math.pow(1 - u, 2.2));
  const anchors = [
    { u: 0, y: a.y },
    { u: 0.33, y: climb(0.33) },
    { u: 0.66, y: climb(0.66) },
    { u: 0.93, y: b.y + 0.3 },
    { u: 1, y: b.y },
  ];
  const heightOn = (u: number) => {
    let k = 0;
    while (k < anchors.length - 2 && u > anchors[k + 1].u) k++;
    const p = anchors[k], q = anchors[k + 1];
    const t = THREE.MathUtils.clamp((u - p.u) / (q.u - p.u), 0, 1);
    const sag = 0.012 * (q.u - p.u) * len;
    return p.y + (q.y - p.y) * t - Math.sin(t * Math.PI) * sag;
  };
  const at = (u: number, side: number, out = new THREE.Vector3()) => {
    out.lerpVectors(a, b, u);
    out.y = heightOn(u);
    out.addScaledVector(perp, side * CABLE_GAP);
    return out;
  };
  const upYaw = Math.atan2(b.x - a.x, b.z - a.z);
  for (const side of [-1, 1]) {
    const pts = Array.from({ length: 240 }, (_, i) => at(i / 239, side));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x3a4250 })));
  }
  // pylons
  const pylons: { x: number; z: number }[] = [];
  for (const an of anchors.slice(1, -1)) {
    const c = new THREE.Vector3().lerpVectors(a, b, an.u);
    const base = Math.min(ground(c.x, c.z), 0) - 3; // sink it into the ground / sea bed
    const top = an.y + 0.35;
    const h = top - base;
    const py = new THREE.Group();
    const col = mesh(new THREE.CylinderGeometry(0.45, 1.5, h, 4, 1), steel);
    col.rotation.y = Math.PI / 4;
    col.position.y = base + h / 2;
    const arm = mesh(box(CABLE_GAP * 2 + 1.4, 0.45, 0.7), steel);
    arm.position.y = top;
    py.add(col, arm);
    for (const sx of [-1, 1]) {
      const sheave = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12), blue);
      sheave.rotation.x = Math.PI / 2;
      sheave.position.set(sx * CABLE_GAP, top + 0.1, 0);
      py.add(sheave);
    }
    const lamp = mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshStandardMaterial({ color: 0xff5a4f, emissive: 0xff2a1f, emissiveIntensity: 1.4 }), false);
    lamp.position.y = top + 0.5;
    py.add(lamp);
    py.position.set(c.x, 0, c.z);
    py.rotation.y = upYaw;
    group.add(py);
    pylons.push({ x: c.x, z: c.z });
  }

  // two glass gondolas: you can see who's riding
  const glass = new THREE.MeshStandardMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.24, roughness: 0.05, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide });
  const makeCabin = (n: number) => {
    const c = new THREE.Group();
    const grip = mesh(box(0.5, 0.32, 0.8), steel);
    const hanger = mesh(box(0.14, 1.4, 0.14), steel);
    hanger.position.y = -0.75;
    const roof = mesh(rbox(3.5, 0.32, 3.1, 0.12), blue);
    roof.position.y = -1.6;
    const floor = mesh(rbox(3.5, 0.28, 3.1, 0.1), blue);
    floor.position.y = -CABIN_FLOOR - 0.14;
    const band = mesh(box(3.52, 0.16, 3.12), gold);
    band.position.y = -CABIN_FLOOR + 0.12;
    const bench = mesh(box(2.9, 0.4, 0.55), white);
    bench.position.set(0, -CABIN_FLOOR + 0.2, -1.15);
    c.add(grip, hanger, roof, floor, band, bench);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const post = mesh(box(0.14, 3.0, 0.14), white);
      post.position.set(sx * 1.66, -3.2, sz * 1.46);
      c.add(post);
    }
    const pane = new THREE.Mesh(new THREE.BoxGeometry(3.3, 2.95, 2.9), glass);
    pane.position.y = -3.2;
    pane.renderOrder = 2;
    c.add(pane);
    const num = signPlane(`CABIN ${n}`, 1.3, 0.3, { bg: '#2f6bff', fg: '#ffffff' });
    num.position.set(0, -1.6, 1.56);
    c.add(num);
    noBake(c);
    group.add(c);
    return c;
  };
  const cabins = [-1, 1].map((side, i) => ({ c: makeCabin(i + 1), side }));

  // the shuttle: cabin on track -1 at uA, the other at 1 - uA; a pause at each end for boarding
  const SPEED = 9; // world units / s
  let uA = 0.15;
  let dir = 1;
  let dwell = 0;
  let rider: { side: number; u: number } | null = null;
  const uOf = (side: number) => (side < 0 ? uA : 1 - uA);
  const tmp = new THREE.Vector3();
  return {
    group,
    pylons,
    at,
    upYaw,
    length: len,
    uOf,
    setRider(r) {
      rider = r;
      if (r) uA = r.side < 0 ? r.u : 1 - r.u;
    },
    update(dt) {
      if (rider) uA = rider.side < 0 ? rider.u : 1 - rider.u;
      else if (dwell > 0) dwell -= dt;
      else {
        const edge = Math.min(uA, 1 - uA) * len;
        const v = SPEED * THREE.MathUtils.clamp((edge + 1.5) / 14, 0.12, 1);
        uA += (dir * v * dt) / len;
        if (uA >= 1 || uA <= 0) { uA = THREE.MathUtils.clamp(uA, 0, 1); dir = -dir; dwell = 8; }
      }
      for (const { c, side } of cabins) {
        const u = uOf(side);
        c.position.copy(at(u, side, tmp));
        c.rotation.y = upYaw;
        c.rotation.z = Math.sin(performance.now() / 900 + side) * 0.012; // a gentle sway
      }
    },
  };
}
