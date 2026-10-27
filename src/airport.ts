// FUNDEDCITY International Airport: its own island north of the city, linked by a causeway.
// Runway, taxiway, apron with six gates and jet bridges, a curved-roof terminal, the control tower,
// a rotating radar, hangars with small planes, a helipad and a fuel farm — plus live (simulated)
// air traffic: airliners landing, taxiing, boarding and departing on a fixed runway schedule,
// helicopter tours, and small planes towing advertising banners over the city.
import * as THREE from 'three';
import { MAT, ENV, mesh, rbox, box, signPlane, getGlassMaterial, makeBuildingMaterials, type BuildingMaterials } from './buildings';
import { bake, noBake } from './bake';
import { buildAirliner, buildHelicopter, buildSmallPlane, TYPE_NAME, type AirlinerType, type Livery, type Aircraft } from './aircraft';
import { registerVehicle } from './vehicles';

export const AIRPORT = { x0: -90, x1: 250, z0: -215, z1: -125, r: 18 };
export const AIRPORT_CX = (AIRPORT.x0 + AIRPORT.x1) / 2;
export const AIRPORT_CZ = (AIRPORT.z0 + AIRPORT.z1) / 2;
const RZ = -192; // runway centre line
const TZ = -172; // taxiway
const SZ = -159; // gate stands
const G = 0.12; // ground
export const RUNWAY = { x0: -60, x1: 222, z: RZ, w: 12 };
export const TOWER = { x: 135, z: -141 };
export const RADAR = { x: 155, z: -150 };
const HELIPAD = { x: -45, z: -152 };
export const CYCLE = 200; // seconds per airliner rotation

type V3 = THREE.Vector3;
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
type Ease = 'lin' | 'in' | 'out' | 'inout';
interface Leg { to: V3; dur: number; ease: Ease; status: string; reverse?: boolean; air?: boolean }
const ease = (e: Ease, k: number) => e === 'in' ? k * k : e === 'out' ? 1 - (1 - k) * (1 - k) : e === 'inout' ? k * k * (3 - 2 * k) : k;

export interface FlightInfo {
  id: string;
  flight: string;
  kind: 'airliner' | 'helicopter' | 'banner';
  type: string;
  ad: string;
  status: string;
  from?: string;
  to?: string;
  gate?: string;
  pos: V3;
  heading: number; // radians, 0 = +x (east)
  alt: number;
  /** seconds until touchdown / take-off roll (airliners) */
  etaLand?: number;
  etaTakeoff?: number;
}

export interface AirportBuilding { id: string; name: string; root: THREE.Group; body: THREE.Group; mats: BuildingMaterials; height: number; radius: number }

export function buildAirport() {
  const group = new THREE.Group();
  const statics = new THREE.Group();
  const obstacles: Array<{ kind: 'rect'; x: number; z: number; hw: number; hd: number } | { kind: 'circle'; x: number; z: number; r: number }> = [];
  const trees: Array<{ x: number; z: number; s: number; kind: 'round' | 'cone' }> = [];
  const buildings: AirportBuilding[] = [];
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x5d6675, roughness: 0.9 });
  const taxi = new THREE.MeshStandardMaterial({ color: 0x8a93a1, roughness: 0.9 });
  const concrete = new THREE.MeshStandardMaterial({ color: 0xd7dce3, roughness: 0.95 });
  const fieldGrass = new THREE.MeshStandardMaterial({ color: 0xa9d58c, roughness: 0.95 });
  const paint = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  const yellowPaint = new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.6 });

  /* ---------------- airfield ---------------- */
  const field = mesh(rbox(AIRPORT.x1 - AIRPORT.x0 - 8, 0.1, 50, 2), fieldGrass, false);
  field.position.set(AIRPORT_CX, G + 0.02, -186);
  statics.add(field);
  const rw = mesh(box(RUNWAY.x1 - RUNWAY.x0, 0.06, RUNWAY.w), asphalt, false);
  rw.position.set((RUNWAY.x0 + RUNWAY.x1) / 2, G + 0.08, RZ);
  statics.add(rw);
  for (let x = RUNWAY.x0 + 14; x < RUNWAY.x1 - 14; x += 6) {
    const d = mesh(box(3, 0.02, 0.35), paint, false);
    d.position.set(x, G + 0.12, RZ);
    statics.add(d);
  }
  for (const end of [RUNWAY.x0 + 3, RUNWAY.x1 - 3]) {
    for (let k = -4; k <= 4; k++) {
      if (k === 0) continue;
      const s = mesh(box(4, 0.02, 0.6), paint, false);
      s.position.set(end, G + 0.12, RZ + k * 1.2);
      statics.add(s);
    }
  }
  // runway designators
  for (const [x, txt, rot] of [[RUNWAY.x0 + 10, '09', Math.PI / 2], [RUNWAY.x1 - 10, '27', -Math.PI / 2]] as const) {
    const num = signPlane(txt, 4, 2.4, { bg: '#5d6675', fg: '#ffffff' });
    num.rotation.set(-Math.PI / 2, 0, rot);
    num.position.set(x, G + 0.13, RZ);
    statics.add(num);
  }
  // taxiway + connectors + yellow centre lines
  const tw = mesh(box(270, 0.05, 7), taxi, false);
  tw.position.set(92, G + 0.07, TZ);
  statics.add(tw);
  for (const x of [60, 215]) {
    const c = mesh(box(7, 0.05, RZ - TZ + 4), taxi, false);
    c.position.set(x, G + 0.07, (RZ + TZ) / 2);
    statics.add(c);
  }
  const tl = mesh(box(268, 0.02, 0.25), yellowPaint, false);
  tl.position.set(92, G + 0.11, TZ);
  statics.add(tl);
  // apron (gates) and GA apron
  const apron = mesh(box(140, 0.05, 20), concrete, false);
  apron.position.set(45, G + 0.06, -158);
  const ga = mesh(box(64, 0.05, 18), concrete, false);
  ga.position.set(200, G + 0.06, -158);
  statics.add(apron, ga);

  /* ---------------- terminal ---------------- */
  const tMats = makeBuildingMaterials();
  const term = new THREE.Group();
  const tBody = new THREE.Group();
  term.add(tBody);
  term.position.set(45, G, -141);
  const tGlass = mesh(box(120, 6.4, 11.4), getGlassMaterial());
  tGlass.position.y = 3.3;
  const plinth = mesh(rbox(122, 0.4, 13, 0.1), MAT.stone, false);
  plinth.position.y = 0.2;
  const roofGeo = new THREE.CylinderGeometry(20, 20, 124, 32, 1, false, -0.36, 0.72);
  roofGeo.rotateZ(Math.PI / 2);
  roofGeo.rotateX(-Math.PI / 2);
  const roof = mesh(roofGeo, tMats.white);
  roof.position.y = 6.4 - 20 * Math.cos(0.36) + 0.1;
  tBody.add(tGlass, plinth, roof);
  for (let x = -58; x <= 58; x += 8) {
    for (const z of [-5.8, 5.8]) {
      const col = mesh(box(0.35, 6.4, 0.35), tMats.white);
      col.position.set(x, 3.3, z);
      tBody.add(col);
    }
  }
  const tSign = signPlane('FUNDEDCITY INTERNATIONAL AIRPORT', 34, 2.4, { bg: '#13213f', fg: '#ffffff', accent: '#2f6bff' });
  tSign.position.set(0, 5.1, 5.95);
  tBody.add(tSign);
  // jet bridges
  const gates = [0, 20, 40, 60, 80, 100];
  gates.forEach((gx, i) => {
    const jb = mesh(rbox(1.6, 1.7, 6.5, 0.2), tMats.white);
    jb.position.set(gx - 45 + 3, 3.1, -6 - 3.2);
    const leg = mesh(box(0.3, 2.4, 0.3), MAT.darkGrey);
    leg.position.set(gx - 45 + 3, 1.2, -6 - 5.6);
    const gs = signPlane(`GATE ${i + 1}`, 2.6, 0.8, { bg: '#f2c14e', fg: '#13213f' });
    gs.position.set(gx - 45 + 3, 5.4, -5.8);
    gs.rotation.y = Math.PI;
    tBody.add(jb, leg, gs);
  });
  bake(tBody);
  group.add(term);
  buildings.push({ id: 'airport-terminal', name: 'FUNDEDCITY International Airport', root: term, body: tBody, mats: tMats, height: 9, radius: 14 });
  obstacles.push({ kind: 'rect', x: 45, z: -141, hw: 61, hd: 6.8 });

  /* ---------------- control tower ---------------- */
  const cMats = makeBuildingMaterials();
  const tower = new THREE.Group();
  const cBody = new THREE.Group();
  tower.add(cBody);
  tower.position.set(TOWER.x, G, TOWER.z);
  const base = mesh(rbox(7, 3, 7, 0.2), cMats.white);
  base.position.y = 1.5;
  const shaft = mesh(new THREE.CylinderGeometry(1.3, 1.7, 20, 16), cMats.white);
  shaft.position.y = 13;
  const deck = mesh(new THREE.CylinderGeometry(3.4, 2.2, 1.2, 8), cMats.white);
  deck.position.y = 23.6;
  const cab = mesh(new THREE.CylinderGeometry(3.3, 2.9, 2.6, 8), getGlassMaterial());
  cab.position.y = 25.5;
  const cabRoof = mesh(new THREE.CylinderGeometry(3.7, 3.5, 0.5, 8), cMats.white);
  cabRoof.position.y = 27.05;
  const ant = mesh(new THREE.CylinderGeometry(0.06, 0.06, 4, 6), MAT.darkGrey);
  ant.position.y = 29.3;
  const beaconMat = new THREE.MeshStandardMaterial({ color: 0xff3b30, emissive: 0xff3b30, emissiveIntensity: 0.2 });
  const beacon = mesh(new THREE.SphereGeometry(0.25, 8, 6), beaconMat, false);
  beacon.position.y = 31.3;
  const towerSign = signPlane('CONTROL TOWER', 5, 0.9, { bg: '#2f6bff', fg: '#ffffff' });
  towerSign.position.set(0, 2.2, 3.55);
  cBody.add(base, shaft, deck, cab, cabRoof, ant, towerSign);
  bake(cBody);
  noBake(beacon);
  tower.add(beacon);
  group.add(tower);
  buildings.push({ id: 'airport-tower', name: 'Control Tower', root: tower, body: cBody, mats: cMats, height: 31, radius: 4.5 });
  obstacles.push({ kind: 'rect', x: TOWER.x, z: TOWER.z, hw: 3.8, hd: 3.8 });

  /* ---------------- radar ---------------- */
  const rMats = makeBuildingMaterials();
  const radar = new THREE.Group();
  const rBody = new THREE.Group();
  radar.add(rBody);
  radar.position.set(RADAR.x, G, RADAR.z);
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const leg = mesh(box(0.2, 8, 0.2), MAT.darkGrey);
    leg.position.set(dx * 1.2, 4, dz * 1.2);
    leg.rotation.set(dz * 0.08, 0, -dx * 0.08);
    rBody.add(leg);
  }
  const platform = mesh(box(2.4, 0.3, 2.4), rMats.white);
  platform.position.y = 8.1;
  rBody.add(platform);
  const radome = mesh(new THREE.SphereGeometry(2.4, 20, 14), rMats.white);
  radome.position.set(12, 2.6, 4);
  const radomeBase = mesh(new THREE.CylinderGeometry(1.8, 2.1, 1.6, 16), rMats.white);
  radomeBase.position.set(12, 0.8, 4);
  rBody.add(radome, radomeBase);
  bake(rBody);
  const antenna = new THREE.Group();
  const dish = mesh(rbox(5.2, 1.4, 0.3, 0.1), new THREE.MeshStandardMaterial({ color: 0xe8ecf2, roughness: 0.4, metalness: 0.3 }));
  dish.rotation.x = -0.25;
  dish.position.z = 0.3;
  const feed = mesh(box(0.15, 0.15, 1.1), MAT.darkGrey, false);
  feed.position.set(0, -0.2, -0.4);
  antenna.add(dish, feed);
  antenna.position.y = 9.2;
  noBake(antenna);
  radar.add(antenna);
  group.add(radar);
  buildings.push({ id: 'airport-radar', name: 'Radar', root: radar, body: rBody, mats: rMats, height: 10, radius: 3 });
  obstacles.push({ kind: 'circle', x: RADAR.x, z: RADAR.z, r: 2 }, { kind: 'circle', x: RADAR.x + 12, z: RADAR.z + 4, r: 2.6 });

  /* ---------------- hangars, helipad, fuel farm, car park ---------------- */
  for (const hx of [184, 214]) {
    const h = new THREE.Group();
    const walls = mesh(box(24, 3, 14), MAT.white);
    walls.position.y = 1.5;
    const archGeo = new THREE.CylinderGeometry(12.5, 12.5, 14, 24, 1, false, Math.PI - 1.05, 2.1);
    archGeo.rotateX(Math.PI / 2);
    const arch = mesh(archGeo, new THREE.MeshStandardMaterial({ color: 0xc9d0da, roughness: 0.5, metalness: 0.3 }));
    arch.position.y = 3 - 12.5 * Math.cos(1.05);
    const door = mesh(box(20, 2.8, 0.1), new THREE.MeshStandardMaterial({ color: 0x8a93a1, roughness: 0.5 }), false);
    door.position.set(0, 1.5, -7.05);
    h.add(walls, arch, door);
    h.position.set(hx, G, -143);
    statics.add(h);
    obstacles.push({ kind: 'rect', x: hx, z: -143, hw: 12.4, hd: 7.4 });
  }
  const pad = mesh(new THREE.CylinderGeometry(6, 6, 0.12, 32), concrete, false);
  pad.position.set(HELIPAD.x, G + 0.1, HELIPAD.z);
  const ring = mesh(new THREE.TorusGeometry(5.2, 0.18, 6, 40), yellowPaint, false);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(HELIPAD.x, G + 0.18, HELIPAD.z);
  const hMark = signPlane('H', 3, 3, { bg: '#d7dce3', fg: '#e5383b' });
  hMark.rotation.x = -Math.PI / 2;
  hMark.position.set(HELIPAD.x, G + 0.18, HELIPAD.z);
  statics.add(pad, ring, hMark);
  for (const [x, z] of [[-72, -142], [-64, -142], [-72, -150]]) {
    const tank = mesh(new THREE.CylinderGeometry(3, 3, 3.6, 20), MAT.white);
    tank.position.set(x, G + 1.8, z);
    statics.add(tank);
    obstacles.push({ kind: 'circle', x, z, r: 3.2 });
  }
  const lot = mesh(box(22, 0.05, 8), new THREE.MeshStandardMaterial({ color: 0xbcc6d2, roughness: 0.9 }), false);
  lot.position.set(122, G + 0.04, -133);
  statics.add(lot);
  const lotCars: Array<[number, number]> = [];
  for (let i = 0; i < 14; i++) lotCars.push([112.5 + (i % 7) * 3.2, -135.5 + Math.floor(i / 7) * 5]);
  const carCols = [0xffffff, 0x2f6bff, 0x13213f, 0xd9483b, 0x9fb4cc, 0xf2c14e];
  const cars = new THREE.InstancedMesh(box(1.9, 0.7, 0.95), new THREE.MeshStandardMaterial({ roughness: 0.4 }), lotCars.length);
  const m4 = new THREE.Matrix4();
  const col = new THREE.Color();
  lotCars.forEach(([x, z], i) => {
    cars.setMatrixAt(i, m4.makeRotationY(Math.PI / 2).setPosition(x, G + 0.45, z));
    cars.setColorAt(i, col.setHex(carCols[i % carCols.length]));
  });
  group.add(cars);
  // windsock
  const pole = mesh(new THREE.CylinderGeometry(0.06, 0.06, 4, 6), MAT.white);
  pole.position.set(110, G + 2, RZ - 12);
  const sock = mesh(new THREE.ConeGeometry(0.45, 2.2, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0xf08c2e, side: THREE.DoubleSide }), false);
  sock.rotation.z = Math.PI / 2;
  sock.position.set(111.1, G + 3.8, RZ - 12);
  statics.add(pole, sock);
  // runway edge + approach lights (glow at night)
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2cc, emissiveIntensity: 0.1 });
  const lightPos: V3[] = [];
  for (let x = RUNWAY.x0; x <= RUNWAY.x1; x += 8) for (const s of [-1, 1]) lightPos.push(v(x, G + 0.2, RZ + s * (RUNWAY.w / 2 + 0.4)));
  for (let k = 1; k <= 8; k++) for (const dz of [-1.5, 0, 1.5]) lightPos.push(v(RUNWAY.x1 + 2 + k * 2.5, G + 0.2, RZ + dz));
  const lights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.18, 6, 4), lightMat, lightPos.length);
  lightPos.forEach((p, i) => lights.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z)));
  group.add(lights);
  // trees along the landside
  for (let x = -80; x < 245; x += 7) {
    if (Math.abs(x) < 6 || (x > -20 && x < 112) || (x > 108 && x < 136)) continue;
    trees.push({ x, z: -130, s: 0.6, kind: 'round' });
  }

  /* ---------------- parked aircraft ---------------- */
  const parked: Array<[AirlinerType, Livery, number]> = [
    ['B737', { text: 'BANK OF GAINS', color: '#b8892a', tail: '#b8892a' }, 20],
    ['A320', { text: 'LIQUIDATION ARENA', color: '#d4161b', tail: '#13213f' }, 80],
  ];
  for (const [t, l, gx] of parked) {
    const a = buildAirliner(t, l);
    a.group.position.set(gx, G, SZ);
    a.group.rotation.y = -Math.PI / 2; // nose toward the terminal (+z)
    group.add(a.group);
    registerVehicle({ id: `parked-${t}-${gx}`, kind: 'plane', name: `${TYPE_NAME[t]} at Gate ${gates.indexOf(gx) + 1}`, model: TYPE_NAME[t], obj: a.group, maxSpeed: 62, halfLength: a.length / 2, gear: a.gear });
  }
  const gaPlanes = [['#2f6bff', 176], ['#14a37f', 190], ['#e5383b', 205]] as const;
  for (const [c, x] of gaPlanes) {
    const p = buildSmallPlane(c);
    p.group.position.set(x, G, -157);
    p.group.rotation.y = Math.PI / 2;
    group.add(p.group);
    registerVehicle({ id: `ga-${x}`, kind: 'plane', name: 'Small plane', model: 'Light aircraft', obj: p.group, maxSpeed: 30, halfLength: 2.5, spinners: p.spinners });
  }

  bake(statics);
  group.add(statics);

  /* ======================= air traffic ======================= */
  const A0 = v(650, 85, RZ);
  interface Airliner { ac: Aircraft; flight: string; type: AirlinerType; ad: string; from: string; to: string; gx: number; gate: string; legs: Leg[]; starts: number[]; offset: number; yaw: number; tdAt: number; toAt: number }
  const fleet: Array<[AirlinerType, string, string, string, Livery, number]> = [
    ['B777', 'FC 101', 'London', 'Dubai', { text: 'FUNDEDCITY AIR', color: '#2f6bff', tail: '#2f6bff' }, 0],
    ['A350', 'FC 214', 'Singapore', 'New York', { text: 'YOUR BRAND HERE', color: '#e5383b', tail: '#13213f' }, 40],
    ['B747', 'FC 777', 'Tokyo', 'Frankfurt', { text: 'ADVERTISE ON THIS JET', color: '#b8892a', tail: '#b8892a' }, 60],
    ['A320', 'FC 330', 'Lisbon', 'Madrid', { text: 'SIP THE DIP CAFE', color: '#1f5f4a', tail: '#1f5f4a' }, 100],
  ];
  const airliners: Airliner[] = fleet.map(([type, flight, from, to, livery, gx], i) => {
    const t4 = Math.abs(gx - 60) / 5;
    const t8 = (215 - gx) / 5;
    const dwell = 83 - t4 - t8;
    const legs: Leg[] = [
      { to: v(205, 0, RZ), dur: 14, ease: 'lin', status: 'Final approach', air: true },
      { to: v(70, 0, RZ), dur: 9, ease: 'out', status: 'Landed' },
      { to: v(60, 0, TZ), dur: 4, ease: 'inout', status: 'Taxiing to gate' },
      { to: v(gx, 0, TZ), dur: t4, ease: 'lin', status: 'Taxiing to gate' },
      { to: v(gx, 0, SZ), dur: 5, ease: 'inout', status: 'Arriving at gate' },
      { to: v(gx, 0, SZ), dur: dwell, ease: 'lin', status: 'At gate · Boarding' },
      { to: v(gx, 0, TZ), dur: 6, ease: 'inout', status: 'Pushback', reverse: true },
      { to: v(215, 0, TZ), dur: t8, ease: 'lin', status: 'Taxiing to runway' },
      { to: v(220, 0, RZ), dur: 4, ease: 'inout', status: 'Lining up' },
      { to: v(90, 0, RZ), dur: 10, ease: 'in', status: 'Take-off' },
      { to: v(-150, 30, RZ), dur: 7, ease: 'lin', status: 'Climbing', air: true },
      { to: v(-600, 95, RZ), dur: 10, ease: 'lin', status: 'Departed', air: true },
      { to: v(-600, 110, -500), dur: 12, ease: 'lin', status: 'En route', air: true },
      { to: v(650, 110, -500), dur: 25, ease: 'lin', status: 'En route', air: true },
      { to: A0.clone(), dur: 11, ease: 'lin', status: 'Inbound', air: true },
    ];
    const starts: number[] = [];
    let acc = 0;
    for (const l of legs) { starts.push(acc); acc += l.dur; }
    const ac = buildAirliner(type, livery);
    group.add(ac.group);
    registerVehicle({ id: `flight-${flight.replace(' ', '')}`, kind: 'plane', name: `${flight} · ${TYPE_NAME[type]}`, model: TYPE_NAME[type], obj: ac.group, maxSpeed: 62, halfLength: ac.length / 2, gear: ac.gear });
    return { ac, flight, type, ad: livery.text, from, to, gx, gate: `Gate ${gates.indexOf(gx) + 1}`, legs, starts, offset: i * 50, yaw: Math.PI, tdAt: 14, toAt: starts[9] };
  });

  const posAt = (a: Airliner, local: number) => {
    let i = a.legs.length - 1;
    while (i > 0 && a.starts[i] > local) i--;
    const leg = a.legs[i];
    const from = i === 0 ? A0 : a.legs[i - 1].to;
    const k = leg.dur > 0 ? ease(leg.ease, THREE.MathUtils.clamp((local - a.starts[i]) / leg.dur, 0, 1)) : 1;
    return { p: from.clone().lerp(leg.to, k), leg };
  };

  // helicopters
  const heliTour = buildHelicopter('#13213f', 'YOUR AD HERE');
  const heliNews = buildHelicopter('#e5383b', 'LIQUIDATION ARENA');
  group.add(heliTour.group, heliNews.group);
  registerVehicle({ id: 'heli-tour', kind: 'heli', name: 'Tour helicopter', model: 'Helicopter', obj: heliTour.group, maxSpeed: 22, halfLength: 3, spinners: heliTour.spinners });
  registerVehicle({ id: 'heli-news', kind: 'heli', name: 'News helicopter', model: 'Helicopter', obj: heliNews.group, maxSpeed: 22, halfLength: 3, spinners: heliNews.spinners });
  // both helicopters stay parked on the helipads (rideable: board one to fly it yourself)
  const NEWS_PAD = { x: HELIPAD.x + 16, z: HELIPAD.z };
  const pad2 = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 0.2, 32), new THREE.MeshStandardMaterial({ color: 0x3a4250, roughness: 0.8 }));
  pad2.position.set(NEWS_PAD.x, G + 0.05, NEWS_PAD.z);
  pad2.receiveShadow = true;
  const padH = signPlane('H', 4.2, 4.2, { bg: '#3a4250', fg: '#ffffff' });
  padH.rotation.x = -Math.PI / 2;
  padH.position.set(NEWS_PAD.x, G + 0.17, NEWS_PAD.z);
  group.add(pad2, padH);
  obstacles.push({ kind: 'circle', x: NEWS_PAD.x, z: NEWS_PAD.z, r: 6 });
  heliTour.group.position.set(HELIPAD.x, G, HELIPAD.z);
  heliTour.group.rotation.y = Math.PI / 2;
  heliNews.group.position.set(NEWS_PAD.x, G, NEWS_PAD.z);
  heliNews.group.rotation.y = Math.PI / 2;
  // banner planes
  const banner1 = buildSmallPlane('#2f6bff', 'YOUR AD HERE · FUNDEDCITY AIR');
  const banner2 = buildSmallPlane('#e5383b', 'SIP THE DIP CAFE · CAPITAL SQUARE');
  for (const b of [banner1, banner2, heliTour, heliNews]) b.group.rotation.order = 'YXZ';
  group.add(banner1.group, banner2.group);
  registerVehicle({ id: 'banner-1', kind: 'plane', name: 'Banner plane 1', model: 'Light aircraft', obj: banner1.group, maxSpeed: 30, halfLength: 2.5, spinners: banner1.spinners });
  registerVehicle({ id: 'banner-2', kind: 'plane', name: 'Banner plane 2', model: 'Light aircraft', obj: banner2.group, maxSpeed: 30, halfLength: 2.5, spinners: banner2.spinners });
  const banners = [
    { ac: banner1, cx: 0, cz: 0, rx: 125, rz: 100, alt: 42, period: 75, dir: 1, flight: 'BN 1', ad: 'YOUR AD HERE · FUNDEDCITY AIR' },
    { ac: banner2, cx: 110, cz: -20, rx: 240, rz: 150, alt: 52, period: 120, dir: -1, flight: 'BN 2', ad: 'SIP THE DIP CAFE' },
  ];

  let simT = 0;
  const snapshot: FlightInfo[] = [];
  const yawTo = (cur: number, target: number, k: number) => {
    let d = target - cur;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return cur + d * Math.min(1, k);
  };

  const update = (dt: number, t: number) => {
    simT = t;
    antenna.rotation.y = t * 1.6;
    lightMat.emissiveIntensity = 0.1 + ENV.night * 3.2;
    beaconMat.emissiveIntensity = 0.2 + (Math.sin(t * 4) > 0.2 ? 1 : 0) * (0.4 + ENV.night * 2.5);
    snapshot.length = 0;
    // airliners
    for (const a of airliners) {
      if (a.ac.group.userData.controlled) {
        const g = a.ac.group;
        snapshot.push({ id: a.flight, flight: a.flight, kind: 'airliner', type: TYPE_NAME[a.type], ad: a.ad, status: 'Flown by you', from: a.from, to: a.to, gate: a.gate, pos: g.position.clone(), heading: g.rotation.y, alt: g.position.y - G, etaLand: 0, etaTakeoff: 0 });
        continue;
      }
      const local = (((t + a.offset) % CYCLE) + CYCLE) % CYCLE;
      const { p, leg } = posAt(a, local);
      const { p: ahead } = posAt(a, (local + 0.4) % CYCLE);
      const dx = ahead.x - p.x;
      const dz = ahead.z - p.z;
      const dy = ahead.y - p.y;
      const hs = Math.hypot(dx, dz);
      if (hs > 0.002) {
        let target = Math.atan2(-dz, dx);
        if (leg.reverse) target += Math.PI;
        a.yaw = yawTo(a.yaw, target, dt * (leg.air ? 4 : 2.2));
      }
      const g = a.ac.group;
      g.position.set(p.x, G + p.y, p.z);
      g.rotation.order = 'YXZ';
      g.rotation.y = a.yaw;
      g.rotation.z = hs > 0.002 ? THREE.MathUtils.clamp(Math.atan2(dy, hs), -0.25, 0.3) * (leg.reverse ? -1 : 1) : 0;
      if (a.ac.gear) a.ac.gear.visible = p.y < 14;
      const etaLand = ((a.tdAt - local) % CYCLE + CYCLE) % CYCLE;
      const etaTakeoff = ((a.toAt - local) % CYCLE + CYCLE) % CYCLE;
      snapshot.push({ id: a.flight, flight: a.flight, kind: 'airliner', type: TYPE_NAME[a.type], ad: a.ad, status: leg.status, from: a.from, to: a.to, gate: a.gate, pos: g.position.clone(), heading: a.yaw, alt: p.y, etaLand, etaTakeoff });
    }
    // helicopters: parked unless someone is flying one
    for (const [id, ad, h] of [['HL 1', 'YOUR AD HERE', heliTour], ['HL 2', 'LIQUIDATION ARENA', heliNews]] as const) {
      const g = h.group;
      const flown = !!g.userData.controlled;
      snapshot.push({ id, flight: id, kind: 'helicopter', type: 'Helicopter', ad, status: flown ? 'Flown by you' : 'Parked on the helipad', pos: g.position.clone(), heading: g.rotation.y, alt: g.position.y - G });
    }
    // banner planes
    for (const b of banners) {
      if (b.ac.group.userData.controlled) {
        const g = b.ac.group;
        snapshot.push({ id: b.flight, flight: b.flight, kind: 'banner', type: 'Banner plane', ad: b.ad, status: 'Flown by you', pos: g.position.clone(), heading: g.rotation.y, alt: g.position.y - G });
        continue;
      }
      const a = b.dir * t * ((Math.PI * 2) / b.period);
      const g = b.ac.group;
      g.position.set(b.cx + Math.cos(a) * b.rx, b.alt, b.cz + Math.sin(a) * b.rz);
      const tx = -Math.sin(a) * b.rx * b.dir;
      const tz = Math.cos(a) * b.rz * b.dir;
      g.rotation.y = Math.atan2(-tz, tx);
      g.rotation.x = b.dir * -0.28;
      b.ac.spinners[0].rotation.x += dt * 40;
      const ban = g.userData.banner as THREE.Mesh | undefined;
      if (ban) ban.rotation.x = Math.sin(t * 3 + b.cx) * 0.18;
      snapshot.push({ id: b.flight, flight: b.flight, kind: 'banner', type: 'Banner plane', ad: b.ad, status: 'Towing banner', pos: g.position.clone(), heading: g.rotation.y, alt: b.alt });
    }
  };

  return {
    group,
    obstacles,
    trees,
    buildings,
    update,
    flights: () => snapshot,
    simTime: () => simT,
    radarCenter: { x: TOWER.x, z: TOWER.z },
  };
}

export type Airport = ReturnType<typeof buildAirport>;
