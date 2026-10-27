// Brooklyn waterfront: the Yacht Marina (pontoons + moored yachts), the Container Port (pier,
// gantry cranes, container yard, a docked container ship) and boat traffic around the islands.
import * as THREE from 'three';
import { MAT, mesh, rbox, box, buildPavilion, signPlane } from './buildings';
import { bake } from './bake';
import { registerVehicle } from './vehicles';

const WATER_Y = -2.2;

const hullCache = new Map<string, THREE.BufferGeometry>();
/** Hull extruded from a top-view outline (bow at +x). */
function hullGeo(L: number, B: number, H: number, bowK = 0.32) {
  const key = `${L}:${B}:${H}:${bowK}`;
  let g = hullCache.get(key);
  if (g) return g;
  const s = new THREE.Shape();
  const bow = L * bowK;
  s.moveTo(-L / 2, -B / 2 * 0.9);
  s.lineTo(L / 2 - bow, -B / 2);
  s.quadraticCurveTo(L / 2 - bow * 0.25, -B / 2 * 0.85, L / 2, 0);
  s.quadraticCurveTo(L / 2 - bow * 0.25, B / 2 * 0.85, L / 2 - bow, B / 2);
  s.lineTo(-L / 2, B / 2 * 0.9);
  s.lineTo(-L / 2, -B / 2 * 0.9);
  g = new THREE.ExtrudeGeometry(s, { depth: H, bevelEnabled: true, bevelThickness: Math.min(0.2, H * 0.2), bevelSize: Math.min(0.2, B * 0.06), bevelSegments: 2, curveSegments: 10 });
  g.rotateX(-Math.PI / 2); // shape y → −z, depth → +y
  hullCache.set(key, g);
  return g;
}

const M = {
  hullWhite: new THREE.MeshStandardMaterial({ color: 0xfbfcfe, roughness: 0.35 }),
  hullNavy: new THREE.MeshStandardMaterial({ color: 0x1d2f55, roughness: 0.5 }),
  hullRed: new THREE.MeshStandardMaterial({ color: 0xb8443a, roughness: 0.6 }),
  darkGlass: new THREE.MeshStandardMaterial({ color: 0x1c2b44, roughness: 0.15, metalness: 0.4 }),
  teak: new THREE.MeshStandardMaterial({ color: 0xc89b6a, roughness: 0.8 }),
  deck: new THREE.MeshStandardMaterial({ color: 0xd8dde4, roughness: 0.8 }),
  pontoon: new THREE.MeshStandardMaterial({ color: 0xd9c4a0, roughness: 0.9 }),
  concrete: new THREE.MeshStandardMaterial({ color: 0xc9ced6, roughness: 0.95 }),
  craneBlue: new THREE.MeshStandardMaterial({ color: 0x2f6bff, roughness: 0.5, metalness: 0.2 }),
  craneWhite: new THREE.MeshStandardMaterial({ color: 0xf4f6f9, roughness: 0.5 }),
  funnel: new THREE.MeshStandardMaterial({ color: 0xc9973a, roughness: 0.5 }),
  stripe: new THREE.MeshStandardMaterial({ color: 0x2f6bff, roughness: 0.5 }),
  sail: new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.6 }),
};

/** Motor yacht, length L (bow at +x, waterline at y=0). */
export function buildYacht(L: number, accent = M.stripe): THREE.Group {
  const g = new THREE.Group();
  const B = L * 0.3;
  const hull = mesh(hullGeo(L, B, L * 0.12), M.hullWhite);
  hull.position.y = -0.15;
  const band = mesh(box(L * 0.62, 0.12, B * 0.92), accent, false);
  band.position.set(-L * 0.1, L * 0.12 - 0.12, 0);
  const deck = mesh(rbox(L * 0.7, 0.08, B * 0.78, 0.04), M.teak, false);
  deck.position.set(-L * 0.08, L * 0.12 - 0.03, 0);
  const cabin = mesh(rbox(L * 0.42, L * 0.1, B * 0.72, Math.min(0.2, L * 0.03)), M.hullWhite);
  cabin.position.set(-L * 0.06, L * 0.12 + L * 0.05, 0);
  const glass = mesh(rbox(L * 0.36, L * 0.045, B * 0.74, 0.03), M.darkGlass, false);
  glass.position.set(-L * 0.03, L * 0.12 + L * 0.065, 0);
  g.add(hull, band, deck, cabin, glass);
  if (L > 7) {
    const fly = mesh(rbox(L * 0.26, L * 0.06, B * 0.6, 0.1), M.hullWhite);
    fly.position.set(-L * 0.12, L * 0.12 + L * 0.13, 0);
    const fglass = mesh(rbox(L * 0.2, L * 0.03, B * 0.62, 0.03), M.darkGlass, false);
    fglass.position.set(-L * 0.1, L * 0.12 + L * 0.16, 0);
    g.add(fly, fglass);
  }
  return g;
}

export function buildSailboat(): THREE.Group {
  const g = new THREE.Group();
  const hull = mesh(hullGeo(3.4, 1.1, 0.5, 0.4), M.hullWhite, false);
  hull.position.y = -0.1;
  const mast = mesh(new THREE.CylinderGeometry(0.05, 0.05, 4.2, 5), MAT.darkGrey, false);
  mast.position.set(0.25, 2.4, 0);
  const sailGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0.3, 0.7, 0), new THREE.Vector3(0.3, 4.4, 0), new THREE.Vector3(-1.4, 0.8, 0)]);
  sailGeo.computeVertexNormals();
  const sail = new THREE.Mesh(sailGeo, M.sail);
  const jibGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0.35, 4.0, 0), new THREE.Vector3(1.6, 0.6, 0), new THREE.Vector3(0.35, 0.8, 0)]);
  jibGeo.computeVertexNormals();
  const jib = new THREE.Mesh(jibGeo, M.sail);
  g.add(hull, mast, sail, jib);
  return g;
}

const CONTAINER_COLORS = [0xd9483b, 0x2f6bff, 0xf08c2e, 0x14a37f, 0xf2f4f7, 0x7c5cff, 0x2a3550, 0xc9973a];

/** Big container ship (bow at +x, waterline at y=0). Containers are one instanced mesh. */
export function buildContainerShip(L = 46): THREE.Group {
  const g = new THREE.Group();
  const B = L * 0.17;
  const lower = mesh(hullGeo(L, B, 1.6, 0.18), M.hullRed);
  lower.position.y = -1.4;
  const upper = mesh(hullGeo(L, B, 2.4, 0.18), M.hullNavy);
  upper.position.y = 0.2;
  const deck = mesh(box(L * 0.84, 0.1, B * 0.86), M.deck, false);
  deck.position.set(-L * 0.04, 2.65, 0);
  // superstructure at the stern
  const sx = -L / 2 + 4.2;
  const house = mesh(rbox(4.6, 6.2, B * 0.9, 0.12), M.hullWhite);
  house.position.set(sx, 2.7 + 3.1, 0);
  const bridge = mesh(rbox(3.4, 1.0, B * 1.08, 0.08), M.hullWhite);
  bridge.position.set(sx + 0.4, 2.7 + 6.2 + 0.5, 0);
  const bglass = mesh(box(3.45, 0.42, B * 1.1), M.darkGlass, false);
  bglass.position.set(sx + 0.4, 2.7 + 6.2 + 0.6, 0);
  const funnel = mesh(rbox(1.6, 2.4, 1.8, 0.2), M.funnel);
  funnel.position.set(sx - 1.5, 2.7 + 6.2 + 1.2, 0);
  g.add(lower, upper, deck, house, bridge, bglass, funnel);
  // hull ad panels, one per side (each reads the right way round)
  for (const side of [1, -1]) {
    const ad = signPlane('YOUR AD HERE · HULL AD SPACE', L * 0.56, 2.2, { bg: '#ffffff', fg: '#13213f', accent: '#e8bf62' });
    ad.position.set(L * 0.02, 1.42, side * (B / 2 + 0.07));
    if (side < 0) ad.rotation.y = Math.PI;
    g.add(ad);
  }
  bake(g);
  // containers
  const cL = 2.5;
  const cH = 1.05;
  const cW = 1.0;
  const slots: Array<[number, number, number]> = [];
  const rnd = (() => { let s = Math.round(L * 97); return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  for (let x = sx + 3.6; x < L / 2 - L * 0.18; x += cL + 0.12) {
    const rows = Math.floor((B * 0.82) / (cW + 0.04));
    for (let r = 0; r < rows; r++) {
      const z = (r - (rows - 1) / 2) * (cW + 0.04);
      const tiers = 2 + Math.floor(rnd() * 3);
      for (let k = 0; k < tiers; k++) slots.push([x, 2.7 + cH / 2 + k * cH, z]);
    }
  }
  const boxes = new THREE.InstancedMesh(box(cL, cH, cW), new THREE.MeshStandardMaterial({ roughness: 0.7 }), slots.length);
  const m4 = new THREE.Matrix4();
  const col = new THREE.Color();
  slots.forEach(([x, y, z], i) => {
    boxes.setMatrixAt(i, m4.makeTranslation(x, y, z));
    boxes.setColorAt(i, col.setHex(CONTAINER_COLORS[Math.floor(rnd() * CONTAINER_COLORS.length)]));
  });
  boxes.castShadow = true;
  boxes.receiveShadow = true;
  g.add(boxes);
  return g;
}

/* ------------------------------------------------------------------ */
/* boat routes */
/* ------------------------------------------------------------------ */

/** Closed rounded-rectangle route around the islands, sampled by arc length. */
function roundedLoop(x0: number, z0: number, x1: number, z1: number, r: number) {
  const pts: THREE.Vector2[] = [];
  const corner = (cx: number, cz: number, a0: number) => {
    for (let i = 0; i <= 8; i++) {
      const a = a0 + (i / 8) * (Math.PI / 2);
      pts.push(new THREE.Vector2(cx + Math.cos(a) * r, cz + Math.sin(a) * r));
    }
  };
  // clockwise in screen terms: along −z edge to +x, down +x edge, back along +z, up −x
  corner(x1 - r, z0 + r, -Math.PI / 2);
  corner(x1 - r, z1 - r, 0);
  corner(x0 + r, z1 - r, Math.PI / 2);
  corner(x0 + r, z0 + r, Math.PI);
  const lens: number[] = [0];
  for (let i = 1; i <= pts.length; i++) lens.push(lens[i - 1] + pts[i - 1].distanceTo(pts[i % pts.length]));
  const total = lens[lens.length - 1];
  return {
    total,
    at(d: number) {
      d = ((d % total) + total) % total;
      let i = 1;
      while (lens[i] < d) i++;
      const a = pts[i - 1];
      const b = pts[i % pts.length];
      const t = (d - lens[i - 1]) / (lens[i] - lens[i - 1]);
      return { x: a.x + (b.x - a.x) * t, z: a.y + (b.y - a.y) * t, ang: Math.atan2(-(b.y - a.y), b.x - a.x) };
    },
  };
}

export interface HarbourOpts {
  /** marina pontoon spine z and x range */
  marina: { x0: number; x1: number; z: number; rampX: number; coastZ: number };
  port: { x0: number; x1: number; z0: number; z1: number };
  loop: { x0: number; z0: number; x1: number; z1: number };
  river: { x: number; z0: number; z1: number };
}

export function buildHarbour(o: HarbourOpts) {
  const group = new THREE.Group();
  const updaters: Array<(dt: number, t: number) => void> = [];
  const statics = new THREE.Group();

  /* ---------------- Yacht Marina ---------------- */
  const mz = o.marina.z;
  const spine = mesh(box(o.marina.x1 - o.marina.x0, 0.3, 1.8), M.pontoon, false, true);
  spine.position.set((o.marina.x0 + o.marina.x1) / 2, WATER_Y + 0.55, mz);
  const ramp = mesh(box(1.8, 0.3, mz - o.marina.coastZ + 1), M.pontoon, false, true);
  ramp.position.set(o.marina.rampX, WATER_Y + 1.2, (mz + o.marina.coastZ) / 2);
  ramp.rotation.x = -0.08;
  statics.add(spine, ramp);
  const FINGER = 13;
  let k = 0;
  for (let x = o.marina.x0 + 1; x <= o.marina.x1 - 1; x += 6, k++) {
    const f = mesh(box(0.8, 0.26, FINGER), M.pontoon, false, true);
    f.position.set(x, WATER_Y + 0.55, mz + FINGER / 2 + 0.9);
    statics.add(f);
    // cleats / posts
    const post = mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.6, 6), MAT.grey, false);
    post.position.set(x, WATER_Y + 0.5, mz + FINGER + 1.2);
    statics.add(post);
    if (x + 3 < o.marina.x1 - 1) {
      const L = 4.2 + ((k * 37) % 5) * 0.4;
      const y = buildYacht(L, k % 3 === 0 ? M.funnel : M.stripe);
      bake(y);
      y.rotation.y = k % 2 ? Math.PI / 2 : -Math.PI / 2;
      y.position.set(x + 3, WATER_Y, mz + 2.4 + L / 2 + (k % 2) * 0.6);
      group.add(y);
      registerVehicle({ id: `moored-yacht-${k + 1}`, kind: 'boat', name: `Moored yacht ${k + 1}`, model: 'Motor yacht', obj: y, maxSpeed: 13, halfLength: L / 2 });
    }
  }
  // superyachts on the outer berth
  for (const [x, L] of [[o.marina.x0 + 12, 14], [o.marina.x0 + 36, 11.5]] as const) {
    const y = buildYacht(L, M.funnel);
    for (const side of [1, -1]) {
      const ad = signPlane('YOUR AD HERE', L * 0.4, L * 0.07, { bg: '#13213f', fg: '#f2c14e' });
      ad.position.set(L * 0.02, L * 0.055, side * (L * 0.15 + 0.04));
      if (side < 0) ad.rotation.y = Math.PI;
      y.add(ad);
    }
    y.userData.adSlot = L > 12 ? 'ad-yacht-payout' : 'ad-yacht-funded';
    bake(y);
    y.position.set(x, WATER_Y, mz + FINGER + 4.6);
    group.add(y);
    registerVehicle({ id: `superyacht-${x}`, kind: 'boat', name: L > 12 ? 'Superyacht “Payout”' : 'Superyacht “Funded”', model: 'Superyacht', obj: y, maxSpeed: 11, halfLength: L / 2 });
  }
  // breakwater with a light at the end
  const bw = mesh(rbox(o.marina.x1 - o.marina.x0 + 10, 1.6, 2.2, 0.4), new THREE.MeshStandardMaterial({ color: 0xb8ab94, roughness: 0.95 }));
  bw.position.set((o.marina.x0 + o.marina.x1) / 2 + 4, WATER_Y + 0.4, mz + FINGER + 10);
  statics.add(bw);
  const beacon = mesh(new THREE.CylinderGeometry(0.5, 0.6, 3.2, 10), M.craneWhite);
  beacon.position.set(o.marina.x1 + 8, WATER_Y + 2.6, mz + FINGER + 10);
  const beaconTop = mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.6, 10), M.hullRed);
  beaconTop.position.set(o.marina.x1 + 8, WATER_Y + 4.5, mz + FINGER + 10);
  statics.add(beacon, beaconTop);
  // marina club
  const club = buildPavilion(9, 5, 0x2f6bff);
  club.position.set(o.marina.rampX - 7, 0.12, o.marina.coastZ - 6);
  statics.add(club);

  /* ---------------- Container Port ---------------- */
  const p = o.port;
  const pierH = 2.4;
  const pier = mesh(box(p.x1 - p.x0, pierH, p.z1 - p.z0), M.concrete, false, true);
  pier.position.set((p.x0 + p.x1) / 2, WATER_Y + pierH / 2 + 0.02, (p.z0 + p.z1) / 2);
  statics.add(pier);
  const pierTop = WATER_Y + pierH + 0.02;
  // quay edge stripe
  const edge = mesh(box(p.x1 - p.x0, 0.08, 0.5), M.funnel, false);
  edge.position.set((p.x0 + p.x1) / 2, pierTop + 0.03, p.z1 - 0.4);
  statics.add(edge);
  // gantry cranes
  const craneXs = [p.x0 + 12, p.x0 + (p.x1 - p.x0) / 2, p.x1 - 12];
  for (const cx of craneXs) {
    const H = 15;
    for (const lx of [-2.2, 2.2]) for (const lz of [p.z1 - 8, p.z1 - 1]) {
      const leg = mesh(box(0.55, H, 0.55), M.craneBlue);
      leg.position.set(cx + lx, pierTop + H / 2, lz);
      statics.add(leg);
    }
    for (const lx of [-2.2, 2.2]) {
      const beam = mesh(box(0.55, 0.55, 7), M.craneBlue);
      beam.position.set(cx + lx, pierTop + 4.5, p.z1 - 4.5);
      statics.add(beam);
    }
    const girder = mesh(box(5.2, 1.1, 30), M.craneWhite);
    girder.position.set(cx, pierTop + H + 0.5, p.z1 + 4);
    const machinery = mesh(rbox(5.4, 2.2, 4.2, 0.15), M.craneWhite);
    machinery.position.set(cx, pierTop + H + 2.1, p.z1 - 7.5);
    const cab = mesh(rbox(1.4, 1.2, 1.6, 0.1), M.darkGlass, false);
    cab.position.set(cx, pierTop + H - 0.6, p.z1 + 6);
    const apex = mesh(box(0.4, 5, 0.4), M.craneBlue);
    apex.position.set(cx, pierTop + H + 3.5, p.z1 - 2);
    statics.add(girder, machinery, cab, apex);
  }
  // container yard (instanced)
  const yard: Array<[number, number, number]> = [];
  const rnd = (() => { let s = 4242; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  for (let x = p.x0 + 3; x < p.x1 - 3; x += 2.7) {
    for (let z = p.z0 + 4; z < p.z1 - 10; z += 1.25) {
      if (Math.floor((x - p.x0) / 13) % 2 === 1 && (x - p.x0) % 13 < 2.7) continue; // truck lanes
      const tiers = 1 + Math.floor(rnd() * 3);
      for (let t = 0; t < tiers; t++) yard.push([x, pierTop + 0.53 + t * 1.06, z]);
    }
  }
  const yardMesh = new THREE.InstancedMesh(box(2.5, 1.05, 1.0), new THREE.MeshStandardMaterial({ roughness: 0.7 }), yard.length);
  const m4 = new THREE.Matrix4();
  const col = new THREE.Color();
  yard.forEach(([x, y, z], i) => {
    yardMesh.setMatrixAt(i, m4.makeTranslation(x, y, z));
    yardMesh.setColorAt(i, col.setHex(CONTAINER_COLORS[Math.floor(rnd() * CONTAINER_COLORS.length)]));
  });
  yardMesh.castShadow = yardMesh.receiveShadow = true;
  group.add(yardMesh);
  // docked container ship + tug
  const docked = buildContainerShip(46);
  docked.position.set((p.x0 + p.x1) / 2 + 2, WATER_Y, p.z1 + 6);
  group.add(docked);
  docked.userData.adSlot = 'ad-ship-docked';
  registerVehicle({ id: 'docked-ship', kind: 'boat', name: 'Container ship at the quay', model: 'Container ship', obj: docked, maxSpeed: 6, halfLength: 23 });
  const tug = buildYacht(4.2, M.hullRed);
  tug.position.set(p.x0 + 2, WATER_Y, p.z1 + 13);
  tug.rotation.y = 0.4;
  statics.add(tug);

  bake(statics);
  group.add(statics);

  /* ---------------- moving boats ---------------- */
  const loop = roundedLoop(o.loop.x0, o.loop.z0, o.loop.x1, o.loop.z1, 32);
  const movers: Array<{ g: THREE.Group; offset: number; speed: number; bob: number }> = [];
  const addMover = (g: THREE.Group, offset: number, speed: number) => {
    group.add(g);
    movers.push({ g, offset, speed, bob: Math.random() * 6 });
  };
  const ship = buildContainerShip(40);
  ship.userData.adSlot = 'ad-ship-cargo';
  addMover(ship, 0.1 * loop.total, 2.4);
  registerVehicle({ id: 'cargo-ship', kind: 'boat', name: 'Cargo ship “Compound Interest”', model: 'Container ship', obj: ship, maxSpeed: 7, halfLength: 20 });
  ([[0.3, 6.5, 'Yacht “Green Day”'], [0.55, 9, 'Yacht “Max Drawdown”'], [0.82, 5.2, 'Yacht “Pip Dreams”']] as const).forEach(([f, L, name], i) => {
    const y = buildYacht(L);
    bake(y);
    addMover(y, f * loop.total, 5.5);
    registerVehicle({ id: `cruising-yacht-${i + 1}`, kind: 'boat', name, model: 'Motor yacht', obj: y, maxSpeed: 14, halfLength: L / 2 });
  });
  [0.42, 0.7, 0.95].forEach((f, i) => {
    const s = buildSailboat();
    s.scale.setScalar(1.4);
    addMover(s, f * loop.total, 3.2);
    registerVehicle({ id: `sailboat-${i + 1}`, kind: 'boat', name: `Sailboat ${i + 1}`, model: 'Sailboat', obj: s, maxSpeed: 9, halfLength: 2.4 });
  });
  // river runabout (low enough to pass under the bridge)
  const runabout = buildYacht(3.6);
  bake(runabout);
  group.add(runabout);
  registerVehicle({ id: 'runabout', kind: 'boat', name: 'River runabout', model: 'Speedboat', obj: runabout, maxSpeed: 16, halfLength: 1.8 });
  updaters.push((_dt, t) => {
    for (const m of movers) {
      if (m.g.userData.controlled) continue;
      const q = loop.at(m.offset + t * m.speed);
      m.g.position.set(q.x, WATER_Y + Math.sin(t * 1.3 + m.bob) * 0.05, q.z);
      m.g.rotation.y = q.ang;
      m.g.rotation.z = Math.sin(t * 0.9 + m.bob) * 0.025;
    }
    if (runabout.userData.controlled) return;
    const span = o.river.z1 - o.river.z0;
    const u = ((t * 6) % (span * 2)) / span; // 0..2 ping-pong
    const dirDown = u < 1;
    const z = o.river.z0 + span * (dirDown ? u : 2 - u);
    runabout.position.set(o.river.x + (dirDown ? 4 : -4), WATER_Y + Math.sin(t * 2) * 0.04, z);
    runabout.rotation.y = dirDown ? -Math.PI / 2 : Math.PI / 2;
  });
  return { group, update: (dt: number, t: number) => { for (const u of updaters) u(dt, t); } };
}
