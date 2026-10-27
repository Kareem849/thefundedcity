// THE MAINLAND: the city isn't only islands. Behind the 100K+ Golf Club (west) and the airport (north) the
// land runs on to the horizon: flat forest (north) and desert (west) plains waiting to be built on, then
// foothills, boulder fields and a ring of mountain ranges with snowy peaks that mark the edge of the map.
// The south and east stay open sea. The coast joins the golf club land and the airport island, leaving
// the bay between them as water.
import * as THREE from 'three';
import { GOLF } from './golf';
import { AIRPORT } from './airport';
import { noBake } from './bake';

/** west mainland: everything west of this x (down to MAIN.westSouth), north mainland: north of this z */
/** FOUNDERS' SUMMIT: a flattened shoulder in the mountains where the desert meets the forest */
export const SUMMIT = { x: -372, z: -372, y: 44, r: 34 };
export const MAIN = { westX: GOLF.x0 + 4, westSouth: GOLF.z1 + 6, northZ: AIRPORT.z0 + 4, northEast: AIRPORT.x1 + 30, corner: 26, fillet: 46 };

/* ---------------- noise ---------------- */
function hash(ix: number, iz: number) {
  let h = (ix * 374761393 + iz * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x: number, z: number) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz);
  const b = hash(ix + 1, iz);
  const c = hash(ix, iz + 1);
  const d = hash(ix + 1, iz + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
function fbm(x: number, z: number, oct = 4) {
  let v = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < oct; i++) { v += vnoise(x * f, z * f) * amp; f *= 2.03; amp *= 0.5; }
  return v; // ~0..1
}
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* ---------------- the coastline as a signed distance (negative = on the mainland) ---------------- */
function sdQuadrant(x: number, z: number, x0: number, z0: number, r: number) {
  // land = { x < x0, z < z0 } with a rounded convex corner of radius r
  const dx = x - (x0 - r);
  const dz = z - (z0 - r);
  const out = Math.hypot(Math.max(dx, 0), Math.max(dz, 0));
  return (out > 0 ? out : Math.max(dx, dz)) - r;
}
function smin(a: number, b: number, k: number) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
/** < 0 on the mainland; the coast wobbles a little except where it meets the golf club and the airport */
export function mainlandSd(x: number, z: number) {
  const west = sdQuadrant(x, z, MAIN.westX, MAIN.westSouth, MAIN.corner);
  const north = sdQuadrant(x, z, MAIN.northEast, MAIN.northZ, MAIN.corner + 20);
  let d = smin(west, north, MAIN.fillet);
  const nearGolf = x > GOLF.x0 - 30 && z > GOLF.z0 - 30 && z < GOLF.z1 + 10;
  const nearAirport = z > AIRPORT.z0 - 30 && x > AIRPORT.x0 - 30 && x < AIRPORT.x1 + 10;
  if (!nearGolf && !nearAirport) d += (fbm(x * 0.02, z * 0.02, 3) - 0.5) * 16;
  return d;
}
export const onMainland = (x: number, z: number, margin = 0) => mainlandSd(x, z) < -margin;
/** ground height on the mainland (for cars driving out there) */
export const groundHeight = (x: number, z: number) => heightAt(x, z, -mainlandSd(x, z));

/** west = desert, north = forest, blended through a noisy band */
function desertness(x: number, z: number) {
  const wx = MAIN.westX - x; // inland distance west
  const nz = MAIN.northZ - z; // inland distance north
  const base = smooth(-60, 60, wx - nz);
  return Math.min(1, Math.max(0, base + (fbm(x * 0.01 + 7, z * 0.01 - 3, 3) - 0.5) * 0.7));
}

function heightAt(x: number, z: number, inland: number) {
  if (inland <= 0) return -3.2 + Math.max(-1, inland * 0.05);
  if (inland < 7) return -2.2 + (inland / 7) * 2.15; // beach slope up to the plain
  const plain = -0.05 + (inland > 14 ? (fbm(x * 0.03, z * 0.03, 3) - 0.5) * 0.6 * smooth(14, 40, inland) : 0);
  const hills = smooth(55, 120, inland) * (fbm(x * 0.012 + 3, z * 0.012, 4) * 20);
  // the boundary ranges: a ridged band of mountains, then high country to the horizon
  const ridgeN = 1 - Math.abs(fbm(x * 0.006, z * 0.006, 4) * 2 - 1);
  const range = smooth(110, 210, inland) * (38 + ridgeN * ridgeN * 100);
  const dunes = desertness(x, z) * smooth(20, 60, inland) * (1 - smooth(100, 150, inland)) * Math.sin(x * 0.09 + z * 0.05 + fbm(x * 0.02, z * 0.02) * 6) * 1.6;
  const h = plain + hills + range + dunes;
  // carve the summit plateau (and let the slopes run gently into it)
  const ds = Math.hypot(x - SUMMIT.x, z - SUMMIT.z);
  if (ds < SUMMIT.r + 40) return h + (SUMMIT.y - 0.6 - h) * smooth(SUMMIT.r + 40, SUMMIT.r + 2, ds);
  return h;
}

export function buildMainland() {
  const group = new THREE.Group();
  // one terrain mesh: fine near the city, from far west/north to just past the coast
  const X0 = -1500;
  const X1 = 700;
  const Z0 = -1500;
  const Z1 = 140;
  const STEP = 5;
  const nx = Math.round((X1 - X0) / STEP);
  const nz = Math.round((Z1 - Z0) / STEP);
  const geo = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0, nx, nz);
  geo.rotateX(-Math.PI / 2);
  geo.translate((X0 + X1) / 2, 0, (Z0 + Z1) / 2);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const SAND = new THREE.Color(0xf1e6cc);
  const GRASS = new THREE.Color(0x9fd27e);
  const FOREST = new THREE.Color(0x7dbb68);
  const DESERT = new THREE.Color(0xeccf95);
  const DUNE = new THREE.Color(0xe0b878);
  const ROCK = new THREE.Color(0x9b9184);
  const BROWN = new THREE.Color(0x8a7864);
  const SNOW = new THREE.Color(0xf4f7fb);
  const inlandOf: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const inland = -mainlandSd(x, z);
    inlandOf.push(inland);
    const y = heightAt(x, z, inland);
    pos.setY(i, y);
    const des = desertness(x, z);
    if (inland < 9) c.copy(SAND);
    else {
      c.copy(GRASS).lerp(FOREST, fbm(x * 0.05, z * 0.05, 2));
      c.lerp(DESERT, des).lerp(DUNE, des * fbm(x * 0.04 + 9, z * 0.04, 2) * 0.6);
      c.lerp(BROWN, smooth(14, 40, y) * 0.8).lerp(ROCK, smooth(35, 70, y)).lerp(SNOW, smooth(92, 112, y));
    }
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: false }));
  terrain.receiveShadow = true;
  noBake(terrain);
  group.add(terrain);

  // distant high country beyond the mesh: a low wall of peaks that closes the horizon to the west and north
  const far = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000, 60, 60), new THREE.MeshStandardMaterial({ color: 0x8f9a8a, roughness: 1 }));
  far.rotation.x = -Math.PI / 2;
  far.position.set(-1500 - 2900, 60, -500);
  group.add(far);
  const far2 = far.clone();
  far2.position.set(0, 60, -1500 - 2900);
  group.add(far2);

  /* ---------------- forests, cacti and boulders (instanced) ---------------- */
  let seed = 9;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  type Spot = { x: number; z: number; y: number; s: number };
  const pines: Spot[] = [];
  const rounds: Spot[] = [];
  const cacti: Spot[] = [];
  const rocks: Spot[] = [];
  for (let k = 0; k < 60000 && pines.length + rounds.length < 5200; k++) {
    const x = X0 + 40 + rnd() * (X1 - X0 - 80);
    const z = Z0 + 40 + rnd() * (Z1 - Z0 - 80);
    const inland = -mainlandSd(x, z);
    if (inland < 12 || inland > 230) continue;
    if (Math.hypot(x - SUMMIT.x, z - SUMMIT.z) < SUMMIT.r + 10) continue;
    const y = heightAt(x, z, inland);
    if (y > 55) continue;
    const des = desertness(x, z);
    const forest = fbm(x * 0.015 + 40, z * 0.015, 3);
    if (des > 0.55) {
      if (rnd() < 0.04 && cacti.length < 500) cacti.push({ x, z, y, s: 0.8 + rnd() * 0.6 });
      continue;
    }
    if (forest < 0.42 && rnd() < 0.85) continue; // clearings
    if (rnd() < 0.62) pines.push({ x, z, y, s: 0.8 + rnd() * 0.9 });
    else rounds.push({ x, z, y, s: 0.8 + rnd() * 0.7 });
  }
  for (let k = 0; k < 20000 && rocks.length < 650; k++) {
    const x = X0 + 40 + rnd() * (X1 - X0 - 80);
    const z = Z0 + 40 + rnd() * (Z1 - Z0 - 80);
    const inland = -mainlandSd(x, z);
    if (inland < 10) continue;
    if (Math.hypot(x - SUMMIT.x, z - SUMMIT.z) < SUMMIT.r + 8) continue;
    // boulder fields at the foothills, a few scattered on the plains
    const foothill = smooth(70, 130, inland) * (1 - smooth(220, 300, inland));
    if (rnd() > foothill * 0.9 + 0.06) continue;
    rocks.push({ x, z, y: heightAt(x, z, inland), s: (0.6 + rnd() * 1.8) * (1 + foothill * 1.6) });
  }
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const col = new THREE.Color();
  const inst = (geo2: THREE.BufferGeometry, mat: THREE.Material, list: Spot[], place: (sp: Spot, i: number) => void) => {
    const m = new THREE.InstancedMesh(geo2, mat, Math.max(1, list.length));
    list.forEach((sp, i) => { place(sp, i); m.setMatrixAt(i, m4); });
    m.count = list.length;
    m.receiveShadow = true;
    noBake(m);
    group.add(m);
    return m;
  };
  const pineGeo = new THREE.ConeGeometry(1.1, 3.4, 7);
  pineGeo.translate(0, 2.3, 0);
  const pine = inst(pineGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true }), pines, (sp) => { m4.compose(p.set(sp.x, sp.y, sp.z), q.identity(), s.setScalar(sp.s)); });
  pines.forEach((_, i) => pine.setColorAt(i, col.setHex([0x4f9a5c, 0x5fae6a, 0x478f55, 0x6cb873][i % 4])));
  const roundGeo = new THREE.IcosahedronGeometry(1.3, 1);
  roundGeo.translate(0, 2.4, 0);
  const round = inst(roundGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true }), rounds, (sp) => { m4.compose(p.set(sp.x, sp.y, sp.z), q.identity(), s.set(sp.s, sp.s * 1.1, sp.s)); });
  rounds.forEach((_, i) => round.setColorAt(i, col.setHex([0x8ccf6e, 0x7fc66a, 0x6fbb5f, 0x9bd67c][i % 4])));
  const trunkGeo = new THREE.CylinderGeometry(0.14, 0.2, 1.2, 5);
  trunkGeo.translate(0, 0.6, 0);
  const trunks = [...pines, ...rounds];
  inst(trunkGeo, new THREE.MeshStandardMaterial({ color: 0xa48866, roughness: 0.9 }), trunks, (sp) => { m4.compose(p.set(sp.x, sp.y, sp.z), q.identity(), s.setScalar(sp.s)); });
  // saguaro-style cacti: a trunk with two arms baked into one geometry
  const cactusParts = [new THREE.CylinderGeometry(0.28, 0.32, 3.2, 7).translate(0, 1.6, 0), new THREE.CylinderGeometry(0.18, 0.2, 1.2, 6).translate(0.55, 2.0, 0), new THREE.CylinderGeometry(0.18, 0.2, 1.0, 6).translate(-0.5, 1.6, 0)];
  const armL = new THREE.CylinderGeometry(0.18, 0.18, 0.5, 6).rotateZ(Math.PI / 2).translate(0.32, 1.45, 0);
  const armR = new THREE.CylinderGeometry(0.18, 0.18, 0.4, 6).rotateZ(Math.PI / 2).translate(-0.28, 1.1, 0);
  const cactusGeo = mergeGeos([...cactusParts, armL, armR]);
  inst(cactusGeo, new THREE.MeshStandardMaterial({ color: 0x5f9a4e, roughness: 0.8, flatShading: true }), cacti, (sp) => { m4.compose(p.set(sp.x, sp.y, sp.z), q.setFromEuler(e.set(0, sp.x * 13.7, 0)), s.setScalar(sp.s)); });
  const rockGeo = new THREE.IcosahedronGeometry(1, 0);
  const rock = inst(rockGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }), rocks, (sp) => {
    m4.compose(p.set(sp.x, sp.y - sp.s * 0.15, sp.z), q.setFromEuler(e.set(sp.x * 0.37, sp.z * 0.71, sp.x * 0.13)), s.set(sp.s * 1.3, sp.s * 0.8, sp.s));
  });
  rocks.forEach((sp, i) => rock.setColorAt(i, col.setHex(desertness(sp.x, sp.z) > 0.5 ? [0xc4996a, 0xb3865b, 0xd2a878][i % 3] : [0x9b9184, 0x8a8278, 0xa8a094][i % 3])));
  return { group, counts: { trees: trunks.length, cacti: cacti.length, rocks: rocks.length } };
}

/** merge simple non-indexed-compatible geometries (positions + normals) into one */
function mergeGeos(list: THREE.BufferGeometry[]) {
  const parts = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0;
  for (const g of parts) n += g.getAttribute('position').count;
  const posA = new Float32Array(n * 3);
  const norA = new Float32Array(n * 3);
  let o = 0;
  for (const g of parts) {
    g.computeVertexNormals();
    posA.set(g.getAttribute('position').array as Float32Array, o * 3);
    norA.set(g.getAttribute('normal').array as Float32Array, o * 3);
    o += g.getAttribute('position').count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(posA, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(norA, 3));
  return out;
}
