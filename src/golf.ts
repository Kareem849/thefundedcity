// 100K+ PAYOUTS GOLF CLUB: a fenced 9-hole course on the west coast, next to the Trading Floor.
// Members only: traders with $100,000+ in verified payouts, prop-firm CEOs and their marketing teams.
// The one way in is the members' gate beside the clubhouse, where the entry conditions are posted.
// Inside: fairways, greens with fluttering flags, bunkers, ponds, the members' lawn where firm teams
// and traders stand talking in groups, golfers at the tees, and golf carts on the lawn loop (rideable).
import * as THREE from 'three';
import { MAT, mesh, rbox, box, signPlane, makeBuildingMaterials, getGlassMaterial } from './buildings';
import { bake, noBake } from './bake';
import { registerVehicle } from './vehicles';

export const GOLF = { x0: -214, x1: -101, z0: -88, z1: 30, r: 20 };
/** West edge of the main island: the fence runs just inside the golf land. */
export const GOLF_FENCE_X = -108.2;
export const CLUBHOUSE = { x: -114, z: -40 };
/** The members' gate (gap in the fence, south of the clubhouse). */
export const GOLF_GATE = { x: -108.2, z: -52.6, w: 5 };
const Y = 0.12;

/** Is (x, z) inside the fenced course? */
export function inGolf(x: number, z: number) {
  return x < GOLF_FENCE_X - 0.4 && x > GOLF.x0 - 6 && z > GOLF.z0 - 6 && z < GOLF.z1 + 6;
}

export interface GolfHole { n: number; tee: THREE.Vector2; green: THREE.Vector2; par: number }
export interface GolfGroupSpec {
  /** firm teams: CEO + marketing (+ a trader); trader-only groups have no firm */
  firm?: { id: string; name: string; color: number };
  trader?: string;
}
export interface GolfGroup extends GolfGroupSpec { x: number; z: number; size: number }

type Obs = { kind: 'rect'; x: number; z: number; hw: number; hd: number } | { kind: 'ellipse'; x: number; z: number; rx: number; rz: number } | { kind: 'circle'; x: number; z: number; r: number };

/** Simple instanced people (legs, torso, head): one draw call per part. */
function makePeople(n: number) {
  const legs = new THREE.InstancedMesh(box(0.42, 0.95, 0.3), new THREE.MeshStandardMaterial({ roughness: 0.8 }), n);
  const torso = new THREE.InstancedMesh(rbox(0.62, 0.85, 0.38, 0.12), new THREE.MeshStandardMaterial({ roughness: 0.7 }), n);
  const head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.26, 12, 10), new THREE.MeshStandardMaterial({ roughness: 0.6 }), n);
  for (const m of [legs, torso, head]) { m.castShadow = true; noBake(m); }
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  const p = new THREE.Vector3();
  const col = new THREE.Color();
  return {
    parts: [legs, torso, head],
    color(i: number, legsC: number, torsoC: number, skin: number) {
      legs.setColorAt(i, col.setHex(legsC));
      torso.setColorAt(i, col.setHex(torsoC));
      head.setColorAt(i, col.setHex(skin));
    },
    place(i: number, x: number, z: number, yaw: number, bob = 0, nod = 0) {
      q.setFromAxisAngle(up, yaw);
      m4.compose(p.set(x, Y + 0.5, z), q, one);
      legs.setMatrixAt(i, m4);
      m4.compose(p.set(x, Y + 1.42 + bob, z), q, one);
      torso.setMatrixAt(i, m4);
      m4.compose(p.set(x + Math.sin(yaw) * nod, Y + 2.1 + bob, z + Math.cos(yaw) * nod), q, one);
      head.setMatrixAt(i, m4);
    },
    commit() {
      for (const m of [legs, torso, head]) {
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }
    },
  };
}

/** Multi-line notice board texture. */
function noticeBoard(w: number, h: number, title: string, sub: string, lines: string[], foot: string) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = Math.round((1024 * h) / w);
  const g = c.getContext('2d')!;
  const F = 'Manrope, Inter, system-ui, sans-serif';
  g.fillStyle = '#1f3b33';
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = '#c9973a';
  g.lineWidth = 10;
  g.strokeRect(18, 18, c.width - 36, c.height - 36);
  g.textAlign = 'center';
  g.fillStyle = '#f2c14e';
  g.font = `900 64px ${F}`;
  g.fillText(title, c.width / 2, 110);
  g.fillStyle = '#ffffff';
  g.font = `800 34px ${F}`;
  g.fillText(sub, c.width / 2, 162);
  g.textAlign = 'left';
  const lh = Math.min(64, (c.height - 300) / lines.length);
  lines.forEach((l, i) => {
    const y = 236 + i * lh;
    g.fillStyle = '#f2c14e';
    g.beginPath();
    g.arc(86, y - 12, 9, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffffff';
    g.font = `700 36px ${F}`;
    g.fillText(l, 112, y);
  });
  g.textAlign = 'center';
  g.fillStyle = 'rgba(255,255,255,0.7)';
  g.font = `700 28px ${F}`;
  g.fillText(foot, c.width / 2, c.height - 50);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.12 }));
}

export const GOLF_CONDITIONS = [
  'Traders with $100,000+ in verified payouts',
  'Prop firm CEOs',
  'Prop firm marketing & partnerships teams',
  'Club pass checked at the members’ gate',
  'Smart casual · no signal selling · no referral spam',
];

export function buildGolfClub(groupSpecs: GolfGroupSpec[]) {
  const group = new THREE.Group();
  const statics = new THREE.Group();
  const obstacles: Obs[] = [];
  const trees: Array<{ x: number; z: number; s: number; kind: 'round' | 'cone' }> = [];
  const rnd = (() => { let s = 777; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

  const rough = new THREE.MeshStandardMaterial({ color: 0x78b95c, roughness: 0.95 });
  const fairwayMat = new THREE.MeshStandardMaterial({ color: 0xa6e07e, roughness: 0.9 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0x9bd775, roughness: 0.9 });
  const greenMat = new THREE.MeshStandardMaterial({ color: 0xc2f294, roughness: 0.8 });
  const teeMat = new THREE.MeshStandardMaterial({ color: 0xb9ea8c, roughness: 0.85 });
  const sandMat = new THREE.MeshStandardMaterial({ color: 0xf1e1b4, roughness: 1 });
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x5fb9e0, roughness: 0.15, metalness: 0.1 });
  const pathMat = new THREE.MeshStandardMaterial({ color: 0xe7e2d6, roughness: 0.95 });
  const clubGreen = new THREE.MeshStandardMaterial({ color: 0x1f3b33, roughness: 0.6 });
  // the grass stops at the fence; east of it is the main island's pavement
  const bx0 = GOLF.x0 + 1.5;
  const bx1 = GOLF_FENCE_X + 0.3;
  const base = mesh(rbox(bx1 - bx0, 0.2, GOLF.z1 - GOLF.z0 - 3, GOLF.r - 2), rough, false);
  base.position.set((bx0 + bx1) / 2, Y + 0.06, (GOLF.z0 + GOLF.z1) / 2);
  statics.add(base);

  /* ---------------- 9 holes in three rows ---------------- */
  const rowsZ = [-70, -12, 12];
  const cols: Array<[number, number]> = [[-122, -142], [-150, -170], [-178, -200]];
  const pars = [4, 3, 5, 4, 4, 4, 5, 3, 4];
  const holes: GolfHole[] = [];
  let n = 0;
  rowsZ.forEach((z, r) => {
    const order = r % 2 === 0 ? cols : [...cols].reverse().map(([a, b]) => [b, a] as [number, number]);
    order.forEach(([a, b], k) => {
      const tee = new THREE.Vector2(a, z + (k % 2 ? 3 : -3));
      const green = new THREE.Vector2(b, z + (k % 2 ? -4 : 4));
      holes.push({ n: ++n, tee, green, par: pars[n - 1] });
    });
  });
  const flags: Array<{ flag: THREE.Mesh; phase: number }> = [];
  const flagMat = new THREE.MeshStandardMaterial({ color: 0xe5383b, side: THREE.DoubleSide, roughness: 0.6 });
  for (const h of holes) {
    const dx = h.green.x - h.tee.x;
    const dz = h.green.y - h.tee.y;
    const len = Math.hypot(dx, dz);
    const ang = -Math.atan2(dz, dx);
    const fw = mesh(rbox(len + 4, 0.08, 9, 4), fairwayMat, false);
    fw.position.set((h.tee.x + h.green.x) / 2, Y + 0.22, (h.tee.y + h.green.y) / 2);
    fw.rotation.y = ang;
    statics.add(fw);
    for (let s = -len / 2 + 3; s < len / 2 - 3; s += 6) {
      const st = mesh(box(3, 0.02, 8.6), stripeMat, false);
      st.position.set((h.tee.x + h.green.x) / 2 + Math.cos(ang) * s, Y + 0.27, (h.tee.y + h.green.y) / 2 - Math.sin(ang) * s);
      st.rotation.y = ang;
      statics.add(st);
    }
    const tee = mesh(rbox(4, 0.18, 3.2, 0.3), teeMat, false);
    tee.position.set(h.tee.x, Y + 0.3, h.tee.y);
    tee.rotation.y = ang;
    const marker = signPlane(String(h.n), 1.2, 0.8, { bg: '#13213f', fg: '#f2c14e' });
    marker.position.set(h.tee.x, Y + 1.0, h.tee.y + 2.2);
    statics.add(tee, marker);
    const green = mesh(new THREE.CylinderGeometry(5, 5.2, 0.16, 28), greenMat, false);
    green.scale.set(1.15, 1, 0.9);
    green.position.set(h.green.x, Y + 0.3, h.green.y);
    statics.add(green);
    const hole = mesh(new THREE.CircleGeometry(0.25, 12), MAT.darkGrey, false);
    hole.rotation.x = -Math.PI / 2;
    hole.position.set(h.green.x, Y + 0.39, h.green.y);
    const pole = mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), MAT.white, false);
    pole.position.set(h.green.x, Y + 1.6, h.green.y);
    statics.add(hole, pole);
    const flagGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.6, 0), new THREE.Vector3(1.0, -0.3, 0)]);
    flagGeo.computeVertexNormals();
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(h.green.x, Y + 2.85, h.green.y);
    noBake(flag);
    group.add(flag);
    flags.push({ flag, phase: h.n });
    const bunkers = h.par === 5 ? 3 : h.par === 3 ? 1 : 2;
    for (let k = 0; k < bunkers; k++) {
      const t = k === 2 ? 0.55 : 0.88;
      const side = k % 2 ? 1 : -1;
      const b = mesh(new THREE.CylinderGeometry(1, 1, 0.12, 16), sandMat, false);
      b.scale.set(2.4, 1, 1.5);
      b.position.set(h.tee.x + dx * t + Math.sin(ang) * side * 6.5, Y + 0.24, h.tee.y + dz * t + Math.cos(ang) * side * 6.5);
      b.rotation.y = rnd() * Math.PI;
      statics.add(b);
    }
  }
  // ponds and a tree line between the back rows
  const ponds: Array<[number, number, number, number]> = [[-160, 0, 6.5, 2.6], [-190, 0, 5, 2.6], [-131, 0, 4.2, 2.4]];
  for (const [x, z, rx, rz] of ponds) {
    const p = mesh(new THREE.CylinderGeometry(1, 1, 0.14, 28), waterMat, false);
    p.scale.set(rx, 1, rz);
    p.position.set(x, Y + 0.26, z);
    statics.add(p);
    obstacles.push({ kind: 'ellipse', x, z, rx: rx + 0.4, rz: rz + 0.4 });
  }
  for (let x = GOLF.x0 + 8; x < -112; x += 6 + rnd() * 4) {
    if (ponds.some(([px, , rx]) => Math.abs(x - px) < rx + 2.5)) continue;
    trees.push({ x, z: (rnd() - 0.5) * 1.5, s: 0.85 + rnd() * 0.4, kind: rnd() < 0.35 ? 'cone' : 'round' });
  }

  /* ---------------- members' lawn with a cart loop ---------------- */
  const L = { x0: -204, x1: -126, z0: -56, z1: -26 };
  const loopPts = [new THREE.Vector2(L.x0, L.z0), new THREE.Vector2(L.x1, L.z0), new THREE.Vector2(L.x1, L.z1), new THREE.Vector2(L.x0, L.z1)];
  for (let i = 0; i < 4; i++) {
    const a = loopPts[i];
    const b = loopPts[(i + 1) % 4];
    const seg = mesh(box(Math.abs(b.x - a.x) + 2.4, 0.05, Math.abs(b.y - a.y) + 2.4), pathMat, false);
    if (a.x === b.x) seg.scale.set(2.4 / (Math.abs(b.x - a.x) + 2.4), 1, 1);
    else seg.scale.set(1, 1, 2.4 / (Math.abs(b.y - a.y) + 2.4));
    seg.position.set((a.x + b.x) / 2, Y + 0.23, (a.y + b.y) / 2);
    statics.add(seg);
  }
  // path from the members' gate to the lawn loop
  const gateX0 = GOLF_FENCE_X + 2;
  const gatePath = mesh(box(gateX0 - L.x1, 0.05, 3), pathMat, false);
  gatePath.position.set((gateX0 + L.x1) / 2, Y + 0.23, GOLF_GATE.z);
  statics.add(gatePath);

  /* ---------------- clubhouse ---------------- */
  const mats = makeBuildingMaterials();
  mats.white.color.setHex(0xfbf8f1);
  const club = new THREE.Group();
  const body = new THREE.Group();
  club.add(body);
  club.position.set(CLUBHOUSE.x, Y, CLUBHOUSE.z);
  const hall = mesh(box(10, 4.6, 18), mats.white);
  hall.position.set(0, 2.5, 0);
  const glass = mesh(box(0.1, 3.2, 15), getGlassMaterial());
  glass.position.set(5.05, 2.1, 0);
  const glassW = mesh(box(0.1, 3.2, 15), getGlassMaterial());
  glassW.position.set(-5.05, 2.1, 0);
  const roof = new THREE.Shape();
  roof.moveTo(-6.2, 0);
  roof.lineTo(6.2, 0);
  roof.lineTo(0, 2.6);
  roof.lineTo(-6.2, 0);
  const roofGeo = new THREE.ExtrudeGeometry(roof, { depth: 19.4, bevelEnabled: false });
  roofGeo.translate(0, 0, -9.7);
  const roofM = mesh(roofGeo, clubGreen);
  roofM.position.y = 4.8;
  body.add(hall, glass, glassW, roofM);
  // members' terrace on the course side (west)
  const terrace = mesh(rbox(5, 0.3, 16, 0.08), MAT.stone, false);
  terrace.position.set(-7.6, 0.15, 0);
  body.add(terrace);
  for (const z of [-5, 0, 5]) {
    const um = mesh(new THREE.ConeGeometry(1.5, 0.7, 8), clubGreen);
    um.position.set(-7.8, 2.6, z);
    const pole = mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.3, 6), MAT.white, false);
    pole.position.set(-7.8, 1.4, z);
    const tbl = mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.08, 12), MAT.white, false);
    tbl.position.set(-7.8, 0.95, z);
    body.add(um, pole, tbl);
  }
  // city-side façade sign (faces +x)
  const sign = signPlane('100K+ PAYOUTS GOLF CLUB', 10, 1.25, { bg: '#1f3b33', fg: '#f2c14e', accent: '#c9973a' });
  sign.position.set(5.16, 4.0, 0);
  sign.rotation.y = Math.PI / 2;
  body.add(sign);
  bake(body);
  group.add(club);
  obstacles.push({ kind: 'rect', x: CLUBHOUSE.x - 1.2, z: CLUBHOUSE.z, hw: 6.4, hd: 9.6 });

  /* ---------------- fence, members' gate and the entry conditions ---------------- */
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0xf5f1e6, roughness: 0.7 });
  const fenceRun = (z0: number, z1: number) => {
    const len = z1 - z0;
    for (const y of [0.55, 1.05]) {
      const rail = mesh(box(0.12, 0.1, len), fenceMat, false);
      rail.position.set(GOLF_FENCE_X, Y + y, (z0 + z1) / 2);
      statics.add(rail);
    }
    for (let z = z0; z <= z1 + 0.01; z += 2.5) {
      const post = mesh(box(0.18, 1.3, 0.18), fenceMat, false);
      post.position.set(GOLF_FENCE_X, Y + 0.65, z);
      statics.add(post);
    }
    obstacles.push({ kind: 'rect', x: GOLF_FENCE_X, z: (z0 + z1) / 2, hw: 0.35, hd: len / 2 });
  };
  const gz0 = GOLF_GATE.z - GOLF_GATE.w / 2;
  const gz1 = GOLF_GATE.z + GOLF_GATE.w / 2;
  fenceRun(GOLF.z0 + 4, gz0);
  fenceRun(CLUBHOUSE.z + 9.6, GOLF.z1 - 4);
  // gate arch
  for (const z of [gz0, gz1]) {
    const pil = mesh(rbox(0.7, 4, 0.7, 0.1), MAT.stone);
    pil.position.set(GOLF_FENCE_X, Y + 2, z);
    const cap = mesh(box(0.9, 0.3, 0.9), MAT.gold);
    cap.position.set(GOLF_FENCE_X, Y + 4.1, z);
    statics.add(pil, cap);
  }
  const beam = mesh(rbox(0.5, 0.9, GOLF_GATE.w + 0.7, 0.08), clubGreen);
  beam.position.set(GOLF_FENCE_X, Y + 3.7, GOLF_GATE.z);
  const gateSign = signPlane('MEMBERS’ GATE', GOLF_GATE.w - 0.2, 0.7, { bg: '#1f3b33', fg: '#f2c14e' });
  gateSign.position.set(GOLF_FENCE_X + 0.27, Y + 3.7, GOLF_GATE.z);
  gateSign.rotation.y = Math.PI / 2;
  const gateSignB = gateSign.clone();
  gateSignB.position.x = GOLF_FENCE_X - 0.27;
  gateSignB.rotation.y = -Math.PI / 2;
  statics.add(beam, gateSign, gateSignB);
  // entry conditions board (faces the city), just outside the gate
  const BW = 8.4;
  const BH = 6;
  const board = noticeBoard(BW, BH, '100K+ PAYOUTS GOLF CLUB', 'ENTRY CONDITIONS · MEMBERS ONLY', GOLF_CONDITIONS, 'Show your club pass at the gate · verified by the club');
  const bxp = -105.6;
  const bzp = GOLF_GATE.z - 7;
  board.position.set(bxp + 0.18, Y + 1.2 + BH / 2, bzp);
  board.rotation.y = Math.PI / 2;
  const boardBack = mesh(rbox(0.3, BH + 0.4, BW + 0.4, 0.08), clubGreen);
  boardBack.position.set(bxp, Y + 1.2 + BH / 2, bzp);
  for (const dz of [-BW / 2 + 0.6, BW / 2 - 0.6]) {
    const post = mesh(box(0.3, 1.4, 0.3), MAT.gold);
    post.position.set(bxp, Y + 0.7, bzp + dz);
    statics.add(post);
  }
  statics.add(board, boardBack);
  obstacles.push({ kind: 'rect', x: bxp, z: bzp, hw: 0.5, hd: BW / 2 + 0.2 });
  bake(statics);
  group.add(statics);

  /* ---------------- members' lawn: firm teams and traders talking ---------------- */
  const slots: Array<[number, number]> = [];
  for (const z of [-49, -41, -33]) for (let i = 0; i < 9; i++) slots.push([-197 + i * 8.4, z + (i % 2 ? 1.2 : -1.2)]);
  const groups: GolfGroup[] = [];
  groupSpecs.slice(0, slots.length).forEach((g, i) => {
    const size = (g.firm ? 2 : 0) + (g.trader ? 1 : 0) + (g.firm ? 0 : 1);
    groups.push({ ...g, x: slots[i][0], z: slots[i][1], size: Math.max(2, size) });
  });
  const tableMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  const tables = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.45, 0.45, 1.1, 12), tableMat, groups.length);
  const m4 = new THREE.Matrix4();
  groups.forEach((g, i) => tables.setMatrixAt(i, m4.makeTranslation(g.x, Y + 0.55, g.z)));
  tables.castShadow = true;
  noBake(tables);
  group.add(tables);
  const SKIN = [0xf1c7a5, 0xd9a77e, 0xb98463, 0x8d5a3b, 0xf3d2b8, 0x6b4428];
  const people: Array<{ x: number; z: number; yaw: number; phase: number }> = [];
  const peopleColors: Array<[number, number, number]> = [];
  groups.forEach((g, gi) => {
    const who: Array<[number, number]> = [];
    if (g.firm) {
      who.push([0x2b3346, 0x1d2740]); // CEO: dark suit
      who.push([0x3a4252, g.firm.color]); // marketing: firm-colour polo
    }
    if (g.trader) who.push([0xd8cdb4, 0xe8bf62]); // 100K+ trader: gold polo
    if (!g.firm && !g.trader) who.push([0xd8cdb4, 0xe8bf62]);
    who.forEach((c, k) => {
      const a = (k / who.length) * Math.PI * 2 + gi;
      const x = g.x + Math.cos(a) * 1.25;
      const z = g.z + Math.sin(a) * 1.25;
      people.push({ x, z, yaw: Math.atan2(g.x - x, g.z - z), phase: gi * 1.7 + k });
      peopleColors.push([c[0], c[1], SKIN[(gi * 3 + k) % SKIN.length]]);
    });
  });
  // golfers at the tees (with clubs)
  const golferHoles = holes.filter((h) => h.n % 3 !== 0);
  const crowd = makePeople(people.length + golferHoles.length);
  crowd.parts.forEach((p) => group.add(p));
  peopleColors.forEach(([l, t, s], i) => crowd.color(i, l, t, s));
  const shirts = [0xffffff, 0x2f6bff, 0xf2c14e, 0xe5383b, 0x14a37f, 0x13213f];
  golferHoles.forEach((_, i) => crowd.color(people.length + i, 0x3a4252, shirts[i % shirts.length], SKIN[(i * 2) % SKIN.length]));
  const clubs = new THREE.InstancedMesh(box(0.07, 1.3, 0.07), new THREE.MeshStandardMaterial({ color: 0xc9d0da, metalness: 0.6, roughness: 0.3 }), golferHoles.length);
  noBake(clubs);
  group.add(clubs);

  /* ---------------- golf carts (rideable) ---------------- */
  const cartBody = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  const makeCart = (i: number) => {
    const g = new THREE.Group();
    const b = mesh(rbox(2.2, 0.55, 1.2, 0.15), cartBody);
    b.position.y = 0.5;
    const seat = mesh(box(0.7, 0.4, 1.1), clubGreen, false);
    seat.position.set(-0.2, 0.95, 0);
    const top = mesh(rbox(2.0, 0.08, 1.3, 0.04), clubGreen);
    top.position.y = 2.0;
    for (const [x, z] of [[0.7, 0.55], [0.7, -0.55], [-0.7, 0.55], [-0.7, -0.55]]) {
      const post = mesh(box(0.05, 1.2, 0.05), MAT.darkGrey, false);
      post.position.set(x, 1.4, z);
      g.add(post);
    }
    const bag = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.9, 8), clubGreen, false);
    bag.position.set(-1.0, 1.0, 0);
    g.add(b, seat, top, bag);
    bake(g);
    group.add(g);
    registerVehicle({ id: `golf-cart-${i + 1}`, kind: 'car', name: `Golf cart ${i + 1}`, model: 'Golf cart', obj: g, maxSpeed: 8, halfLength: 1.1, rideY: 0 });
    return g;
  };
  const carts = [0, 1].map(makeCart);
  makeCart(2).position.set(L.x1 + 3, Y, GOLF_GATE.z - 0.5);
  const per = loopPts.reduce((a, p, i) => a + p.distanceTo(loopPts[(i + 1) % 4]), 0);
  const along = (dd: number) => {
    dd = ((dd % per) + per) % per;
    for (let i = 0; i < 4; i++) {
      const a = loopPts[i];
      const b = loopPts[(i + 1) % 4];
      const s = a.distanceTo(b);
      if (dd <= s) return { x: a.x + ((b.x - a.x) * dd) / s, z: a.y + ((b.y - a.y) * dd) / s, ang: Math.atan2(-(b.y - a.y), b.x - a.x) };
      dd -= s;
    }
    return { x: loopPts[0].x, z: loopPts[0].y, ang: 0 };
  };

  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const e = new THREE.Euler();
  const pv = new THREE.Vector3();
  return {
    group,
    obstacles,
    trees,
    holes,
    groups,
    update(_dt: number, t: number) {
      flags.forEach(({ flag, phase }) => { flag.rotation.y = Math.sin(t * 2.2 + phase) * 0.5; });
      carts.forEach((c, i) => {
        if (c.userData.controlled) return;
        const p = along(t * 3.2 + (i * per) / 2);
        c.position.set(p.x, Y, p.z);
        c.rotation.y = p.ang;
      });
      people.forEach((p, i) => {
        const talk = Math.sin(t * 1.3 + p.phase);
        crowd.place(i, p.x, p.z, p.yaw + Math.sin(t * 0.4 + p.phase) * 0.25, Math.max(0, talk) * 0.03, talk > 0.6 ? 0.05 : 0);
      });
      golferHoles.forEach((h, i) => {
        const dir = Math.atan2(-(h.green.y - h.tee.y), h.green.x - h.tee.x);
        const gx = h.tee.x + Math.sin(dir) * 0.9;
        const gz = h.tee.y + Math.cos(dir) * 0.9;
        crowd.place(people.length + i, gx, gz, dir + Math.PI);
        const ph = (t * 0.6 + i * 0.37) % 4;
        const swing = ph < 1 ? Math.sin(ph * Math.PI) * 2.4 - 0.4 : -0.4;
        q.setFromEuler(e.set(0, dir + Math.PI / 2, swing));
        m4.compose(pv.set(gx + Math.cos(dir) * 0.2, Y + 1.15, gz - Math.sin(dir) * 0.2), q, one);
        clubs.setMatrixAt(i, m4);
      });
      crowd.commit();
      clubs.instanceMatrix.needsUpdate = true;
    },
  };
}

export type GolfClub = ReturnType<typeof buildGolfClub>;
