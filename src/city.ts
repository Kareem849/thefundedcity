// FUNDEDCITY world: the main island (Corporate Ring of prop-firm HQs around Capital Square, four trader
// sectors, Media District, Stadium, parks) and Brooklyn across the river (100 trader houses, the Yacht
// Marina and the Container Port), linked by the Rat Race Exit Bridge; the Set For Life Statue stands in the bay.
import * as THREE from 'three';
import {
  COLORS, MAT, ENV, SIGN_MATS, getGlassMaterial, mesh, rbox, box, buildTower, buildHQ, buildDetachedHouse, HOUSE_PLOT, buildCommercial,
  buildDecor, makeBuildingMaterials, setRoofSnow, type BuildingMaterials, type Tower,
} from './buildings';
import { bake, noBake } from './bake';
import { buildStatueOfLiberty, buildBrooklynBridge, bridgeDeckY, type BridgeSpec } from './landmarks';
import { buildHarbour } from './harbour';
import { buildStadium, type Stadium } from './stadium';
import { buildGolfClub, GOLF, CLUBHOUSE, GOLF_GATE, GOLF_FENCE_X, type GolfClub, type GolfGroupSpec } from './golf';
import { AD_SLOTS, buildAdBoard } from './ads';
import { buildAirport, AIRPORT, AIRPORT_CX, AIRPORT_CZ, type Airport } from './airport';
import { buildCafe, buildBank } from './civic';
import { buildLab, LAB, type Lab } from './lab';
import { buildResetDeck, RESET, PARK } from './reset';
import { buildMainland, onMainland, mainlandSd, groundHeight, SUMMIT } from './terrain';
import { buildFoundersSummit, buildCableCar, STATION, FOUNDER_IDS, type Founder, type CableCar } from './founders';
import { buildMall, buildTradingFloor, buildShoppers, buildParking, PLAZA_LAND, PLAZA_SQUARE, PARKING, MALL, FLOOR, type TradingFloorBuilding } from './plaza';
import { buildCityHall, HALL, type CityHallBuilding } from './cityHall';
import { logoTexture } from './brand';
import { registerVehicle } from './vehicles';
import { COMMERCIAL_SPACES, SECTOR_LABEL, type Trader, type Resident, type SectorId } from './data';
import { FIRMS, CATEGORY_COLOR } from './firms';
import type { Obstacle } from './navigation';
import { buildMediaDistrict } from './mediaDistrict';

export type BuildingKind = 'trader' | 'firm' | 'commercial' | 'house' | 'media' | 'stadium' | 'place' | 'airport' | 'cafe' | 'bank' | 'ad' | 'lab' | 'reset' | 'plaza' | 'floor' | 'hall' | 'founders' | 'founder';

export interface CityBuilding {
  id: string;
  kind: BuildingKind;
  name: string;
  root: THREE.Group;
  body: THREE.Group;
  mats: BuildingMaterials;
  height: number;
  radius: number;
  tower?: Tower;
  /** 0..1 eased hover amount, animated by interactions. */
  hover: number;
  hoverTarget: number;
  /** extra warm window glow (payout effect). */
  windowGlow: number;
}

export interface Landmark { id: string; name: string; blurb: string; x: number; z: number; r: number }
export interface AreaLabel { id: string; name: string; subtitle: string; x: number; y: number; z: number; tone?: 'gold' | 'cfd' | 'futures' | 'perps' | 'multi' | 'urgent' }

export interface City {
  group: THREE.Group;
  buildings: Map<string, CityBuilding>;
  obstacles: Obstacle[];
  landmarks: Landmark[];
  labels: AreaLabel[];
  island: { w: number; d: number; r: number };
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Where the user's own house is (members without a payout). */
  houseSlots: Array<{ id: string; x: number; z: number }>;
  /** Rebuild a trader's tower for their current level / crown / name. */
  rebuildTower: (t: Trader) => CityBuilding;
  /**
   * Give a registered trader a tower in their sector: a demo tower makes way for them (the lowest
   * demo tower in that sector). Returns the evicted demo trader's id, or null when there is no room.
   */
  placeTrader: (t: Trader, evictable: (id: string) => boolean) => { building: CityBuilding; evicted: string | null } | null;
  /** Take a trader's tower down (its plot stays empty until someone else moves in). */
  removeTrader: (id: string) => void;
  /** Rebuild one house (e.g. to mark it as the signed-up user's own). */
  rebuildHouse: (id: string, mine: boolean) => CityBuilding;
  update: (dt: number, time: number) => void;
  applyNight: (n: number) => void;
  /** Walkable land (both islands + the bridge deck) for the navigation grid. */
  walk: { minX: number; maxX: number; minZ: number; maxZ: number; inside: (x: number, z: number) => boolean };
  /** Ground height for walkers (raised on the bridge deck). */
  heightAt: (x: number, z: number) => number;
  /** Is (x, z) on any island (negative margin = include a strip of coast)? */
  onLand: (x: number, z: number, margin: number) => boolean;
  stadium: Stadium;
  airport: Airport;
  golf: GolfClub;
  lab: Lab;
  tradingFloor: TradingFloorBuilding;
  setFounders: (list: Founder[]) => void;
  cityHall: CityHallBuilding;
  /** the cable car up to Founders’ Summit */
  cable: CableCar;
  /** ad-space boards actually placed (ids from AD_SLOTS) */
  ads: string[];
  bank: { setTopPayout: (text: string) => void };
  cafePos: THREE.Vector3;
  /** Static snow / wet look for the weather system (0..1). */
  setSnow: (v: number) => void;
}

/* ---------------- day ↔ night material registry ---------------- */
const nightFx: Array<(n: number) => void> = [];
function nightColor(mat: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial, prop: 'color' | 'emissive', day: number, night: number) {
  const a = new THREE.Color(day);
  const b = new THREE.Color(night);
  nightFx.push((n) => (mat as THREE.MeshStandardMaterial)[prop].lerpColors(a, b, n));
}
function nightValue(set: (v: number) => void, day: number, night: number) {
  nightFx.push((n) => set(day + (night - day) * n));
}

/* ---------------- layout ---------------- */
export const ISLAND_W = 214;
export const ISLAND_D = 176;
const ISLAND_R = 18;
const ROAD_W = 5;
const BLOCK_Y = 0.12;
const HX = ISLAND_W / 2 - 3; // usable half-extent for roads
const HZ = ISLAND_D / 2 - 3;

/** Brooklyn: the second island east of the river. */
export const BROOKLYN = { x0: 171, x1: 311, z0: -88, z1: 88, r: 18 };
const BK_CX = (BROOKLYN.x0 + BROOKLYN.x1) / 2;
const BK_W = BROOKLYN.x1 - BROOKLYN.x0;
const BK_D = BROOKLYN.z1 - BROOKLYN.z0;
/** Brooklyn Bridge: carries the −40 avenue across the river. */
export const BRIDGE: BridgeSpec = { x0: 100, x1: 178, z: -40, towers: [121, 157], rise: 3.5, ground: 0.12 };
const BK_STREETS = [-67, -40, -13, 14, 41, 68];
export const STATUE = { x: -150, z: 128 };
const STADIUM = { x: 88, z: 64 };
/** Sip The Dip Cafe on the Waterfront (building at the back, terrace towards the bay) */
const CAFE = { x: -90, z: 60 };

interface Seg { x1: number; z1: number; x2: number; z2: number }
const H = (z: number, x1: number, x2: number): Seg => ({ x1, z1: z, x2, z2: z });
const V = (x: number, z1: number, z2: number): Seg => ({ x1: x, z1, x2: x, z2 });

/** All roads (axis-aligned). */
const ROADS: Seg[] = [
  // inner ring around Capital Square
  H(-20, -48, 48), H(20, -48, 48), V(-48, -20, 20), V(48, -20, 20),
  // outer Corporate Ring, extended to the coast
  H(-40, -HX, HX), H(40, -HX, HX), V(-68, -HZ, HZ), V(68, -HZ, HZ),
  // centre avenue (connectors + sector avenues)
  V(0, -HZ, -20), V(0, 20, HZ),
  // sector streets
  H(-62, -68, 68), H(62, -68, 68), V(-88, -40, 40), V(88, -40, 40),
  // Brooklyn: streets with houses on both sides + three avenues
  H(-67, 178, 304), H(-40, 172, 304), H(-13, 178, 304), H(14, 178, 304), H(41, 178, 304), H(68, 178, 304),
  V(178, -67, 68), V(241, -67, 68), V(304, -67, 68),
  // causeway to the airport + the airport's landside road
  V(0, -131, -85), H(-130, -40, 140),
];

/** Ground tiles: [x1, z1, x2, z2, color] */
type Zone = [number, number, number, number, number];
const ZONES: Zone[] = [
  [-45.5, -17.5, 45.5, 17.5, 0xf7f6f2], // Capital Square
  [-65.5, -37.5, 65.5, -22.5, 0xe8edf4], // CFD firm row
  [-65.5, 22.5, 65.5, 37.5, 0xe6f1ec], // Futures firm row
  [50.5, -17.5, 65.5, 17.5, 0xece9f6], // Perps firm column
  [-65.5, -17.5, -50.5, 17.5, 0xf6efe0], // City spaces column
  [-65.5, -59.5, -2.5, -42.5, 0xe2ecfa], [2.5, -59.5, 65.5, -42.5, 0xe2ecfa], // CFD sector
  [-65.5, -85, -2.5, -64.5, 0xe2ecfa], [2.5, -85, 65.5, -64.5, 0xe2ecfa],
  [-65.5, 42.5, -2.5, 59.5, 0xdff3ea], [2.5, 42.5, 65.5, 59.5, 0xdff3ea], // Futures sector
  [-65.5, 64.5, -2.5, 85, 0xdff3ea], [2.5, 64.5, 65.5, 85, 0xdff3ea],
  [70.5, -37.5, 85.5, 37.5, 0xebe8f7], [90.5, -37.5, 105, 37.5, 0xebe8f7], // Perps sector
  [-85.5, -37.5, -70.5, 37.5, 0xf8efe3], [-105, -37.5, -90.5, 37.5, 0xf8efe3], // Multi-Assets sector
  [-105, -85, -70.5, -42.5, 0xe9edf5], // Trading Floor (where the park used to be)
  [PARK.x - 17, PARK.z - 21, PARK.x + 17, PARK.z + 21, 0xbfe3a8], // Touch The Grass Park (THE PLAZA district)
  [70.5, -85, 105, -42.5, 0xeceef4], // Media District
  [-105, 42.5, -70.5, 85, 0xeef2f5], // Waterfront
  [70.5, 42.5, 105, 85, 0xe4ece2], // Stadium
  [PLAZA_SQUARE.x0 - 0.5, PLAZA_LAND.z0 + 3, PLAZA_LAND.x1 - 2, PARK.z - 21.5, 0xf2eee6], // THE PLAZA district
];

/** Tower slots per sector, most prominent first. */
const SLOTS: Record<SectorId, Array<[number, number]>> = {
  cfd: [[-11, -51], [11, -51], [-25, -51], [25, -51], [-39, -51], [39, -51], [-53, -51], [53, -51], [-11, -74], [11, -74], [-25, -74], [25, -74], [-39, -74], [39, -74], [-53, -74], [53, -74]],
  futures: [[11, 51], [-11, 51], [25, 51], [-25, 51], [39, 51], [-39, 51], [53, 51], [-53, 51], [11, 74], [-11, 74], [25, 74], [-25, 74], [39, 74], [-39, 74], [53, 74], [-53, 74]],
  perps: [[78, 0], [78, -14], [78, 14], [78, -28], [78, 28], [97.5, 0], [97.5, -14], [97.5, 14], [97.5, -28], [97.5, 28]],
  multi: [[-78, 0], [-78, 14], [-78, -14], [-78, 28], [-78, -28], [-97.5, 0], [-97.5, 14], [-97.5, -14], [-97.5, 28], [-97.5, -28]],
};

/** Corporate Ring HQ slots: [x, z, rotationY] — entrances face Capital Square. */
function ringSlots(): Record<'cfd' | 'futures' | 'perps', Array<[number, number, number]>> {
  const xs = [-43, -33.5, -24, -14.5, -5, 5, 14.5, 24, 33.5, 43];
  return {
    cfd: xs.map((x) => [x, -30, 0]),
    futures: xs.map((x) => [x, 30, Math.PI]),
    perps: [-18, -9, 0, 9, 18].map((z) => [58, z, -Math.PI / 2]),
  };
}

// deterministic random so the city looks identical on every load
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261026);

function roundedRectShape(w: number, d: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function slab(w: number, d: number, h: number, r: number, mats: THREE.Material | THREE.Material[]): THREE.Mesh {
  const geo = new THREE.ExtrudeGeometry(roundedRectShape(w, d, r), {
    depth: h, bevelEnabled: true, bevelThickness: Math.min(0.25, h * 0.3), bevelSize: Math.min(0.25, h * 0.3), bevelSegments: 2, curveSegments: 12,
  });
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, mats);
  m.receiveShadow = true;
  return m;
}

function registerSharedNightFx() {
  const glass = getGlassMaterial();
  const winCol = new THREE.Color(0xfff1d6);
  nightFx.push((n) => glass.emissive.copy(winCol).multiplyScalar(n * 1.15));
  nightValue((v) => (MAT.gold.emissiveIntensity = v), 0.25, 0.7);
  const white = new THREE.Color(0xffffff);
  const black = new THREE.Color(0x000000);
  nightFx.push((n) => {
    for (const m of SIGN_MATS) m.emissive.lerpColors(black, white, n * 0.85);
  });
}

type TreeSpot = { x: number; z: number; s: number; kind: 'round' | 'cone' };

export function createCity(traders: Trader[], residents: Resident[]): City {
  registerSharedNightFx();
  const group = new THREE.Group();
  const buildings = new Map<string, CityBuilding>();
  const obstacles: Obstacle[] = [];
  const treeSpots: TreeSpot[] = [];
  const updaters: Array<(dt: number, t: number) => void> = [];

  /* ---------------- water + island ---------------- */
  const water = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshStandardMaterial({ color: 0x8fd0ea, roughness: 0.35, metalness: 0.05 }));
  nightColor(water.material as THREE.MeshStandardMaterial, 'color', 0x8fd0ea, 0x1b3766);
  water.rotation.x = -Math.PI / 2;
  water.position.y = -2.2;
  water.receiveShadow = true;
  group.add(water);
  const shallowMat = new THREE.MeshStandardMaterial({ color: 0xb7e5f2, roughness: 0.5 });
  nightColor(shallowMat, 'color', 0xb7e5f2, 0x2c5590);
  const shallow = slab(ISLAND_W + 30, ISLAND_D + 30, 0.05, 34, shallowMat);
  shallow.position.y = -2.18;
  group.add(shallow);
  const sandMat = new THREE.MeshStandardMaterial({ color: 0xf1e6cc, roughness: 0.95 });
  const sand = slab(ISLAND_W + 9, ISLAND_D + 9, 0.6, ISLAND_R + 4, sandMat);
  sand.position.y = -2.25;
  group.add(sand);
  const pavement = new THREE.MeshStandardMaterial({ color: 0xf1f3f6, roughness: 0.85 });
  const islandSide = new THREE.MeshStandardMaterial({ color: 0xe3e7ec, roughness: 0.8 });
  const island = slab(ISLAND_W, ISLAND_D, 2.0, ISLAND_R, [pavement, islandSide]);
  island.position.y = -2.25;
  group.add(island);
  // Brooklyn
  const bShallow = slab(BK_W + 30, BK_D + 30, 0.05, 34, shallowMat);
  bShallow.position.set(BK_CX, -2.18, 0);
  const bSand = slab(BK_W + 9, BK_D + 9, 0.6, BROOKLYN.r + 4, sandMat);
  bSand.position.set(BK_CX, -2.25, 0);
  const bIsland = slab(BK_W, BK_D, 2.0, BROOKLYN.r, [pavement, islandSide]);
  bIsland.position.set(BK_CX, -2.25, 0);
  group.add(bShallow, bSand, bIsland);
  // golf club land (joins the main island's west coast) and the airport island
  const extraLand = (cx: number, cz: number, w: number, d: number, r: number) => {
    const sh = slab(w + 30, d + 30, 0.05, 34, shallowMat);
    sh.position.set(cx, -2.18, cz);
    const sd = slab(w + 9, d + 9, 0.6, r + 4, sandMat);
    sd.position.set(cx, -2.25, cz);
    const isl = slab(w, d, 2.0, r, [pavement, islandSide]);
    isl.position.set(cx, -2.25, cz);
    group.add(sh, sd, isl);
  };
  extraLand((GOLF.x0 + GOLF.x1) / 2, (GOLF.z0 + GOLF.z1) / 2, GOLF.x1 - GOLF.x0, GOLF.z1 - GOLF.z0, GOLF.r);
  extraLand(AIRPORT_CX, AIRPORT_CZ, AIRPORT.x1 - AIRPORT.x0, AIRPORT.z1 - AIRPORT.z0, AIRPORT.r);
  // the mainland behind the golf club (west) and the airport (north): plains, forests, deserts and mountains
  const mainland = buildMainland();
  group.add(mainland.group);
  // FOUNDERS' SUMMIT up in the mountains, and the cable car from the main island's north-west corner
  const summit = buildFoundersSummit();
  group.add(summit.root);
  buildings.set('founders-summit', { id: 'founders-summit', kind: 'founders', name: 'Founders’ Summit', root: summit.root, body: summit.body, mats: summit.mats, height: summit.height, radius: summit.radius, hover: 0, hoverTarget: 0, windowGlow: 0 });
  summit.statues.forEach((s, i) => {
    group.add(s.root);
    buildings.set(s.id, { id: s.id, kind: 'founder', name: `Founder ${i + 1}`, root: s.root, body: s.body, mats: s.mats, height: s.height, radius: s.radius, hover: 0, hoverTarget: 0, windowGlow: 0 });
  });
  void FOUNDER_IDS;
  const cable = buildCableCar(BLOCK_Y, (x, z) => (mainlandSd(x, z) < 0 ? groundHeight(x, z) : 0));
  group.add(cable.group);
  updaters.push((dt) => cable.update(dt));
  obstacles.push({ kind: 'circle', x: STATION.x, z: STATION.z, r: 5.4 });
  for (const p of cable.pylons) obstacles.push({ kind: 'circle', x: p.x, z: p.z, r: 1.6 });
  // THE PLAZA district: new land joining Brooklyn's east coast
  extraLand((PLAZA_LAND.x0 + PLAZA_LAND.x1) / 2, (PLAZA_LAND.z0 + PLAZA_LAND.z1) / 2, PLAZA_LAND.x1 - PLAZA_LAND.x0, PLAZA_LAND.z1 - PLAZA_LAND.z0, PLAZA_LAND.r);

  /* ---------------- zones ---------------- */
  const zoneMats = new Map<number, THREE.MeshStandardMaterial>();
  for (const [x1, z1, x2, z2, color] of ZONES) {
    let m = zoneMats.get(color);
    if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness: 0.88 }); zoneMats.set(color, m); }
    const w = x2 - x1 - 1.6;
    const d = z2 - z1 - 1.6;
    const tile = mesh(rbox(w, 0.16, d, 0.6), m, false);
    tile.position.set((x1 + x2) / 2, 0.04, (z1 + z2) / 2);
    group.add(tile);
  }

  /* ---------------- roads ---------------- */
  buildRoads(group);

  /* ---------------- Capital Square ---------------- */
  buildCapitalSquare(group, treeSpots, updaters);
  obstacles.push({ kind: 'circle', x: 0, z: 0, r: 3.3 });
  obstacles.push({ kind: 'rect', x: 0, z: 13.2, hw: 3.9, hd: 1.1 }); // the welcome sign
  // Sip The Dip Cafe sits on the Waterfront, its terrace facing the bay and the pier
  const cafe = buildCafe();
  cafe.root.position.set(CAFE.x, BLOCK_Y, CAFE.z);
  group.add(cafe.root);
  buildings.set('sip-the-dip', { id: 'sip-the-dip', kind: 'cafe', name: 'Sip The Dip Cafe', root: cafe.root, body: cafe.body, mats: cafe.mats, height: cafe.height, radius: cafe.radius, hover: 0, hoverTarget: 0, windowGlow: 0 });
  obstacles.push({ kind: 'rect', x: CAFE.x, z: CAFE.z - 6.5, hw: 6.8, hd: 3.8 });
  updaters.push(cafe.update);
  const bank = buildBank();
  bank.root.position.set(31, BLOCK_Y, 0);
  bank.body.rotation.y = -Math.PI / 2;
  group.add(bank.root);
  buildings.set('bank-of-gains', { id: 'bank-of-gains', kind: 'bank', name: 'Bank of Gains', root: bank.root, body: bank.body, mats: bank.mats, height: bank.height, radius: bank.radius, hover: 0, hoverTarget: 0, windowGlow: 0 });
  obstacles.push({ kind: 'rect', x: 31 + 0.5, z: 0, hw: 6.8, hd: 8.2 });
  for (const sx of [-1, 1]) {
    for (const dz of [-11, 11]) for (const dx of [-8, 8]) treeSpots.push({ x: sx * 31 + dx, z: dz, s: 0.75, kind: 'round' });
  }
  // City Hall: Capital Square's west side, facing the Bank of Gains across the fountain
  const cityHall = buildCityHall();
  cityHall.root.position.set(HALL.x, BLOCK_Y, HALL.z);
  group.add(cityHall.root);
  obstacles.push(...cityHall.obstacles);
  buildings.set('city-hall', { id: 'city-hall', kind: 'hall', name: 'City Hall', root: cityHall.root, body: cityHall.body, mats: cityHall.mats, height: cityHall.height, radius: cityHall.radius, hover: 0, hoverTarget: 0, windowGlow: 0 });
  updaters.push((dt) => cityHall.update(dt));

  /* ---------------- Corporate Ring: prop firm HQs ---------------- */
  const ring = ringSlots();
  const byCat = { cfd: FIRMS.filter((f) => f.category === 'cfd'), futures: FIRMS.filter((f) => f.category === 'futures'), perps: FIRMS.filter((f) => f.category === 'perps') };
  (Object.keys(byCat) as Array<keyof typeof byCat>).forEach((cat) => {
    byCat[cat].forEach((f, i) => {
      const slot = ring[cat][i];
      if (!slot) return;
      const [x, z, rot] = slot;
      const seed = [...f.id].reduce((a, c) => a + c.charCodeAt(0), 0);
      const hq = buildHQ({ name: f.sign, category: f.category, floors: 4 + (seed % 4), variant: seed % 3, logo: f.logo });
      hq.root.position.set(x, BLOCK_Y, z);
      hq.body.rotation.y = rot;
      group.add(hq.root);
      const sideways = Math.abs(Math.sin(rot)) > 0.5;
      obstacles.push({ kind: 'rect', x, z, hw: sideways ? 4.2 : 3.9, hd: sideways ? 3.9 : 4.2 });
      bake(hq.body);
      buildings.set(f.id, { id: f.id, kind: 'firm', name: f.name, root: hq.root, body: hq.body, mats: hq.mats, height: hq.height, radius: hq.radius, hover: 0, hoverTarget: 0, windowGlow: 0 });
    });
  });

  /* ---------------- THE LAB (the old City Spaces column, next to Kareem Capital) ---------------- */
  const lab = buildLab();
  lab.root.position.set(LAB.x, BLOCK_Y, LAB.z);
  group.add(lab.root);
  for (const o of lab.obstacles) obstacles.push({ ...o, x: o.x, z: o.z });
  buildings.set('the-lab', { id: 'the-lab', kind: 'lab', name: 'THE LAB', root: lab.root, body: lab.body, mats: lab.mats, height: lab.height, radius: lab.radius, hover: 0, hoverTarget: 0, windowGlow: 0 });
  updaters.push(lab.update);
  for (const c of COMMERCIAL_SPACES) {
    const b = buildCommercial(c.kind);
    b.root.position.set(c.plot.x, BLOCK_Y, c.plot.z);
    if (c.kind !== 'billboard') b.body.rotation.y = Math.PI / 2;
    group.add(b.root);
    if (c.kind === 'billboard') obstacles.push({ kind: 'circle', x: c.plot.x, z: c.plot.z, r: 2.6 });
    buildings.set(c.id, { id: c.id, kind: 'commercial', name: c.name, root: b.root, body: b.body, mats: b.mats, height: b.height, radius: b.radius, hover: 0, hoverTarget: 0, windowGlow: 0 });
  }

  /* ---------------- trader towers by sector ---------------- */
  const used: Record<SectorId, number> = { cfd: 0, futures: 0, perps: 0, multi: 0 };
  /** which trader stands on each sector slot */
  const slotOwner: Record<SectorId, Array<string | null>> = { cfd: [], futures: [], perps: [], multi: [] };
  const sectorOf = new Map<string, SectorId>();
  const towerFor = (t: Trader, x: number, z: number) => {
    const tower = buildTower({ level: t.level, crown: t.crown, signature: t.signature, name: t.profile ? t.name : undefined });
    tower.root.position.set(x, BLOCK_Y, z);
    // face the nearest main road
    tower.body.rotation.y = t.sector === 'cfd' ? 0 : t.sector === 'futures' ? Math.PI : t.sector === 'perps' ? -Math.PI / 2 : Math.PI / 2;
    if (tower.crown) noBake(tower.crown);
    bake(tower.body);
    group.add(tower.root);
    const cb: CityBuilding = {
      id: t.id, kind: 'trader', name: t.name, root: tower.root, body: tower.body, mats: tower.mats,
      height: tower.height, radius: tower.radius, tower, hover: 0, hoverTarget: 0, windowGlow: 0,
    };
    buildings.set(t.id, cb);
    return cb;
  };
  const ordered = [...traders].sort((a, b) => (b.signature ? 1 : 0) - (a.signature ? 1 : 0) || b.payouts - a.payouts);
  for (const t of ordered) {
    const i = used[t.sector]++;
    const slot = SLOTS[t.sector][i];
    if (!slot) continue;
    t.plot = { x: slot[0], z: slot[1] };
    slotOwner[t.sector][i] = t.id;
    sectorOf.set(t.id, t.sector);
    // every tower plot keeps the same footprint so towers can grow without re-meshing the walk grid
    obstacles.push({ kind: 'rect', x: t.plot.x, z: t.plot.z, hw: 4.9, hd: 4.9 });
    towerFor(t, t.plot.x, t.plot.z);
  }
  // fill the remaining sector slots with low-rise offices so the districts feel built-up
  const decorBatch = new THREE.Group();
  for (const sec of Object.keys(SLOTS) as SectorId[]) {
    SLOTS[sec].slice(used[sec]).forEach(([x, z], i) => {
      if (i % 3 !== 0) {
        // pocket park
        const lawn = mesh(rbox(9, 0.24, 9, 0.4), MAT.grass, false);
        lawn.position.set(x, BLOCK_Y + 0.12, z);
        group.add(lawn);
        for (let k = 0; k < 4; k++) treeSpots.push({ x: x + (rand() - 0.5) * 6.5, z: z + (rand() - 0.5) * 6.5, s: 0.7 + rand() * 0.3, kind: 'round' });
        return;
      }
      const w = 6 + rand() * 1.5;
      const d = 6 + rand() * 1.5;
      const g = buildDecor(w, d, 1 + Math.floor(rand() * 2), 2);
      g.position.set(x, BLOCK_Y, z);
      decorBatch.add(g);
      obstacles.push({ kind: 'rect', x, z, hw: (w + 0.6) / 2, hd: (d + 0.6) / 2 });
    });
  }

  bake(decorBatch);
  group.add(decorBatch);

  /* ---------------- Brooklyn: 100 detached trader houses ---------------- */
  type Plot = { x: number; z: number; facing: number };
  const colX: number[] = [];
  for (let k = 0; k < 6; k++) colX.push(185.3 + k * 9.6, 248.3 + k * 9.6);
  const plots: Plot[] = [];
  for (const S of BK_STREETS) for (const [dz, facing] of [[-8, 0], [8, Math.PI]] as const) {
    const z = S + dz;
    if (z < -60 || z > 61) continue;
    for (const x of colX) plots.push({ x, z, facing });
  }
  // Brooklyn Commons park takes six plots in the middle
  const isCommons = (p: Plot) => (p.z === -5 || p.z === 6) && p.x > 245 && p.x < 270;
  const landing = { x: BRIDGE.x1, z: BRIDGE.z };
  const avail = plots.filter((p) => !isCommons(p)).sort((a, b) => Math.hypot(a.x - landing.x, a.z - landing.z) - Math.hypot(b.x - landing.x, b.z - landing.z));
  const housePlots = avail.slice(0, 100);
  const gardenPlots = avail.slice(100);
  // the free house for the signed-up user is the one nearest the bridge (kept last in the list)
  housePlots.push(housePlots.shift()!);
  const houseSlots: Array<{ id: string; x: number; z: number; facing: number }> = housePlots.map((p, i) => ({
    id: i < housePlots.length - 1 ? (residents[i]?.id ?? `house-${i + 1}`) : 'house-100', ...p,
  }));
  const houseBatch = new THREE.Group();
  const hitGeo = box(HOUSE_PLOT.w - 1.2, 4.6, HOUSE_PLOT.d - 1.2);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const houseRoots = new Map<string, THREE.Group>();
  const placeHouse = (slot: { id: string; x: number; z: number; facing: number }, idx: number, mine: boolean, batched: boolean) => {
    const res = residents.find((r) => r.id === slot.id);
    const hb = buildDetachedHouse(idx, mine);
    hb.root.position.set(slot.x, BLOCK_Y, slot.z);
    hb.body.rotation.y = slot.facing;
    let root = hb.root;
    let body = hb.body;
    if (batched) {
      houseBatch.add(hb.root);
      root = new THREE.Group();
      body = new THREE.Group();
      root.add(body);
      root.position.set(slot.x, BLOCK_Y, slot.z);
      body.rotation.y = slot.facing;
      group.add(root);
    } else {
      bake(hb.body);
      group.add(hb.root);
    }
    const hit = new THREE.Mesh(hitGeo, hitMat);
    hit.position.y = 2.3;
    body.add(hit);
    houseRoots.set(slot.id, root);
    const cb: CityBuilding = { id: slot.id, kind: 'house', name: res?.name ?? 'Available house', root, body, mats: hb.mats, height: hb.height, radius: hb.radius, hover: 0, hoverTarget: 0, windowGlow: 0 };
    buildings.set(slot.id, cb);
    return { cb, trees: hb.treeSpots };
  };
  houseSlots.forEach((slot, i) => {
    const last = i === houseSlots.length - 1;
    const { trees } = placeHouse(slot, i, !!residents.find((r) => r.id === slot.id)?.mine, !last);
    const f = slot.facing === 0 ? 1 : -1;
    for (const [tx, tz, ts] of trees) treeSpots.push({ x: slot.x + tx * f, z: slot.z + tz * f, s: ts, kind: 'round' });
    obstacles.push({ kind: 'rect', x: slot.x, z: slot.z - 0.35 * f, hw: 4.5, hd: 2.85 });
  });
  bake(houseBatch);
  group.add(houseBatch);
  // pocket gardens on the spare plots
  const gardenBatch = new THREE.Group();
  for (const p of gardenPlots) {
    const lawn = mesh(rbox(HOUSE_PLOT.w - 0.4, 0.2, HOUSE_PLOT.d - 0.4, 0.1), MAT.grass, false);
    lawn.position.set(p.x, BLOCK_Y + 0.1, p.z);
    gardenBatch.add(lawn);
    const bench = mesh(rbox(1.8, 0.45, 0.6, 0.08), new THREE.MeshStandardMaterial({ color: 0xc89b6a, roughness: 0.8 }));
    bench.position.set(p.x, BLOCK_Y + 0.42, p.z);
    gardenBatch.add(bench);
    for (let k = 0; k < 3; k++) treeSpots.push({ x: p.x + (rand() - 0.5) * 6, z: p.z + (rand() - 0.5) * 7, s: 0.6 + rand() * 0.3, kind: rand() < 0.3 ? 'cone' : 'round' });
  }
  // Brooklyn Commons: lawn, crossing paths, fountain and a playground
  const cx = 257.9;
  const cz = 0.5;
  const commons = mesh(rbox(28.4, 0.24, 21.6, 0.5), MAT.grass, false);
  commons.position.set(cx, BLOCK_Y + 0.12, cz);
  const pathM = new THREE.MeshStandardMaterial({ color: 0xf3ead8, roughness: 0.95 });
  const p1 = mesh(box(28, 0.06, 2), pathM, false);
  p1.position.set(cx, BLOCK_Y + 0.26, cz);
  const p2 = mesh(box(2, 0.06, 21), pathM, false);
  p2.position.set(cx, BLOCK_Y + 0.26, cz);
  const basin = mesh(new THREE.CylinderGeometry(2.4, 2.6, 0.5, 28), MAT.stone);
  basin.position.set(cx, BLOCK_Y + 0.4, cz);
  const pond = mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.1, 28), new THREE.MeshStandardMaterial({ color: 0x7cc8e8, roughness: 0.2 }), false);
  pond.position.set(cx, BLOCK_Y + 0.62, cz);
  gardenBatch.add(commons, p1, p2, basin, pond);
  const play = [[0xf08c2e, 2.2, 1.4, 2.2], [0x2f6bff, 1.2, 2.2, 1.2], [0x14a37f, 3.2, 0.6, 1.0]] as const;
  play.forEach(([c, w, h, d], k) => {
    const m = mesh(rbox(w, h, d, 0.12), new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }));
    m.position.set(cx + 7 + k * 2.6, BLOCK_Y + 0.24 + h / 2, cz - 5.5);
    gardenBatch.add(m);
  });
  obstacles.push({ kind: 'circle', x: cx, z: cz, r: 2.8 });
  for (let k = 0; k < 16; k++) {
    const x = cx + (rand() - 0.5) * 25;
    const z = cz + (rand() - 0.5) * 18;
    if (Math.abs(x - cx) < 2.2 || Math.abs(z - cz) < 2.2) continue;
    treeSpots.push({ x, z, s: 0.7 + rand() * 0.35, kind: rand() < 0.25 ? 'cone' : 'round' });
  }
  bake(gardenBatch);
  group.add(gardenBatch);
  // waterfront promenade strip along Brooklyn's south coast
  const prom = mesh(box(118, 0.06, 3), pathM, false);
  prom.position.set(BK_CX, BLOCK_Y + 0.04, 78);
  group.add(prom);

  /* ---------------- FUNDEDCITY Stadium (SE of the main island) ---------------- */
  const stadium = buildStadium();
  stadium.root.position.set(STADIUM.x, BLOCK_Y, STADIUM.z);
  group.add(stadium.root);
  buildings.set('stadium', { id: 'stadium', kind: 'stadium', name: 'Liquidation Arena', root: stadium.root, body: stadium.body, mats: stadium.mats, height: stadium.height, radius: stadium.radius, hover: 0, hoverTarget: 0, windowGlow: 0 });
  obstacles.push({ kind: 'ellipse', x: STADIUM.x, z: STADIUM.z, rx: stadium.rx, rz: stadium.rz });

  /* ---------------- THE PLAZA district: mall + trading floor ---------------- */
  const mall = buildMall();
  mall.root.position.set(MALL.x, BLOCK_Y, MALL.z);
  group.add(mall.root);
  obstacles.push(...mall.obstacles);
  for (const t of mall.trees) treeSpots.push({ ...t, s: 0.7, kind: 'round' });
  buildings.set('the-plaza', { id: 'the-plaza', kind: 'plaza', name: 'THE PLAZA', root: mall.root, body: mall.body, mats: mall.mats, height: mall.height, radius: mall.radius, hover: 0, hoverTarget: 0, windowGlow: 0 });
  const tradingFloor = buildTradingFloor();
  tradingFloor.root.position.set(FLOOR.x, BLOCK_Y, FLOOR.z);
  group.add(tradingFloor.root);
  obstacles.push(...tradingFloor.obstacles);
  updaters.push(tradingFloor.update);
  buildings.set('trading-floor', { id: 'trading-floor', kind: 'floor', name: 'Trading Floor', root: tradingFloor.root, body: tradingFloor.body, mats: tradingFloor.mats, height: tradingFloor.height, radius: tradingFloor.radius, hover: 0, hoverTarget: 0, windowGlow: 0 });
  {
    const shoppers = buildShoppers();
    group.add(shoppers.root);
    updaters.push(shoppers.update);
    // the parking lot along Brooklyn's east avenue, and the square in front of the trading floor
    const parking = buildParking();
    group.add(parking.root);
    const promMat = new THREE.MeshStandardMaterial({ color: 0xe9e3d6, roughness: 0.85 });
    // the Trading Floor's forecourt, between its door and the −68 avenue
    const sq = mesh(rbox(6.4, 0.1, 22, 0.5), promMat, false);
    sq.position.set(FLOOR.x + FLOOR.r + 5.1, BLOCK_Y + 0.04, FLOOR.z);
    group.add(sq);
    // a row of trees between the cars and the square, and a few round the back
    for (let z = PARKING.z0 + 2; z < PARKING.z1; z += 6) if (z < -16 || z > -8) treeSpots.push({ x: PARKING.x1 + 0.2, z, s: 0.6, kind: 'round' });
    for (const [x, z] of [[360, -48], [361, -8], [313, 12], [312, -50]]) treeSpots.push({ x, z, s: 0.65, kind: rand() < 0.5 ? 'cone' : 'round' });
  }

  /* ---------------- landmarks in the water ---------------- */
  const placeBuilding = (id: string, name: string, x: number, z: number, content: THREE.Object3D, height: number, radius: number, hit?: [number, number, number]) => {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    root.position.set(x, 0, z);
    content.position.x -= x;
    content.position.z -= z;
    body.add(content);
    if (hit) {
      const h = new THREE.Mesh(box(hit[0], hit[1], hit[2]), hitMat);
      h.position.y = hit[1] / 2 - 2;
      body.add(h);
    }
    group.add(root);
    buildings.set(id, { id, kind: 'place', name, root, body, mats: makeBuildingMaterials(), height, radius, hover: 0, hoverTarget: 0, windowGlow: 0 });
  };
  const bridge = buildBrooklynBridge(BRIDGE);
  bake(bridge.group);
  placeBuilding('brooklyn-bridge', 'Rat Race Exit Bridge', (BRIDGE.x0 + BRIDGE.x1) / 2, BRIDGE.z, bridge.group, 24, 9);
  updaters.push((dt, t) => bridge.update(dt, t));
  const statue = buildStatueOfLiberty();
  statue.group.position.set(STATUE.x, 0, STATUE.z);
  bake(statue.group);
  placeBuilding('statue-of-liberty', 'Set For Life Statue', STATUE.x, STATUE.z, statue.group, statue.height, 15);
  updaters.push((dt, t) => statue.update(dt, t));
  const harbour = buildHarbour({
    marina: { x0: 184, x1: 242, z: 93, rampX: 213, coastZ: 86 },
    port: { x0: 252, x1: 314, z0: 86, z1: 112 },
    // boats now cruise the open sea to the south and east (the mainland closes the north and west)
    loop: { x0: -112, z0: 132, x1: 402, z1: 196 },
    river: { x: (ISLAND_W / 2 + BROOKLYN.x0) / 2, z0: -110, z1: 130 },
  });
  group.add(harbour.group);
  updaters.push(harbour.update);
  const marinaHit = new THREE.Group();
  placeBuilding('yacht-marina', 'Yacht Marina', 213, 104, marinaHit, 6, 10, [58, 4, 28]);
  const portHit = new THREE.Group();
  placeBuilding('container-port', 'Container Port', 283, 99, portHit, 18, 12, [62, 20, 26]);

  /* ---------------- Central Park (NW), Media District (NE), Waterfront (SW) ---------------- */
  buildPark(group, treeSpots, updaters, obstacles, PARK.x, PARK.z);
  // RESET: yoga & mindset deck at the north end of Touch The Grass Park
  const resetDeck = buildResetDeck();
  group.add(resetDeck.root);
  updaters.push(resetDeck.update);
  obstacles.push({ kind: 'rect', x: RESET.x, z: RESET.z, hw: RESET.w / 2 + 0.3, hd: RESET.d / 2 + 0.3 });
  buildings.set('reset-deck', { id: 'reset-deck', kind: 'reset', name: 'RESET · yoga & mindset deck', root: resetDeck.root, body: resetDeck.body, mats: resetDeck.mats, height: resetDeck.height, radius: resetDeck.radius, hover: 0, hoverTarget: 0, windowGlow: 0 });
  // 100K+ Payouts Golf Club (west coast, beside Touch The Grass Park): firm teams + 100K+ traders on the lawn
  const members = traders.filter((t) => t.payouts >= 100_000).sort((a, b) => b.payouts - a.payouts);
  const specs: GolfGroupSpec[] = FIRMS.map((f, i) => ({ firm: { id: f.id, name: f.name, color: CATEGORY_COLOR[f.category] }, trader: members[i]?.name }));
  for (const m of members.slice(FIRMS.length)) specs.push({ trader: m.name });
  const golf = buildGolfClub(specs);
  group.add(golf.group);
  obstacles.push(...golf.obstacles);
  treeSpots.push(...golf.trees);
  updaters.push(golf.update);
  const clubHit = new THREE.Group();
  placeBuilding('golf-club', '100K+ Payouts Golf Club', CLUBHOUSE.x, CLUBHOUSE.z, clubHit, 8, 11, [12, 9, 20]);
  // FUNDEDCITY International Airport (north island) + causeway
  const airport = buildAirport();
  group.add(airport.group);
  for (const b of airport.buildings) buildings.set(b.id, { id: b.id, kind: 'airport', name: b.name, root: b.root, body: b.body, mats: b.mats, height: b.height, radius: b.radius, hover: 0, hoverTarget: 0, windowGlow: 0 });
  obstacles.push(...airport.obstacles);
  treeSpots.push(...airport.trees);
  updaters.push(airport.update);
  const causeway = new THREE.Group();
  const cwDeck = mesh(box(8, 1.2, 46), new THREE.MeshStandardMaterial({ color: 0xd7dce3, roughness: 0.9 }));
  cwDeck.position.set(0, -0.5, -107);
  causeway.add(cwDeck);
  for (let z = -124; z <= -90; z += 8) {
    const pier = mesh(box(6, 2.4, 1.2), MAT.stone);
    pier.position.set(0, -1.6, z);
    causeway.add(pier);
  }
  for (const sx of [-1, 1]) {
    const rail = mesh(box(0.25, 0.8, 46), MAT.white, false);
    rail.position.set(sx * 3.9, 0.5, -107);
    causeway.add(rail);
  }
  bake(causeway);
  group.add(causeway);
  const media = buildMediaDistrict();
  for (const m of media.buildings) {
    group.add(m.root);
    buildings.set(m.id, { id: m.id, kind: 'media', name: m.name, root: m.root, body: m.body, mats: m.mats, height: m.height, radius: m.radius, hover: 0, hoverTarget: 0, windowGlow: 0 });
  }
  obstacles.push(...media.obstacles);
  treeSpots.push(...media.treeSpots);
  updaters.push((dt) => media.update(dt));
  buildWaterfront(group, treeSpots, obstacles);

  /* ---------------- street trees, coastal pines, lights ---------------- */
  const blocked = (x: number, z: number, pad = 0.8) => {
    if (onRoad(x, z, 0.9)) return true;
    for (const o of obstacles) {
      if (o.kind === 'rect' && Math.abs(x - o.x) < o.hw + pad && Math.abs(z - o.z) < o.hd + pad) return true;
      if (o.kind === 'circle' && Math.hypot(x - o.x, z - o.z) < o.r + pad) return true;
      if (o.kind === 'ellipse' && ((x - o.x) / (o.rx + pad)) ** 2 + ((z - o.z) / (o.rz + pad)) ** 2 < 1) return true;
    }
    return false;
  };
  // ad spaces: billboards on the coasts and avenues, the Yacht Club board, golf course boards
  const placedAds: string[] = [];
  for (const slot of AD_SLOTS) {
    if (slot.x === undefined || slot.z === undefined) continue;
    const onWater = slot.kind === 'marina';
    if (!onWater && (!inIsland(slot.x, slot.z, 3) || blocked(slot.x, slot.z, 3))) continue;
    const ad = buildAdBoard(slot);
    const root = new THREE.Group();
    const body = new THREE.Group();
    body.add(ad.group);
    body.rotation.y = slot.rot ?? 0;
    root.add(body);
    root.position.set(slot.x, slot.y ?? BLOCK_Y, slot.z);
    group.add(root);
    bake(body);
    const hit = new THREE.Mesh(box(ad.radius * 2, ad.height, 1.2), hitMat);
    hit.position.y = ad.height / 2;
    hit.rotation.y = slot.rot ?? 0;
    root.add(hit);
    if (!onWater) obstacles.push({ kind: 'circle', x: slot.x, z: slot.z, r: 1.6 });
    for (let i = treeSpots.length - 1; i >= 0; i--) if (Math.hypot(treeSpots[i].x - slot.x, treeSpots[i].z - slot.z) < ad.radius) treeSpots.splice(i, 1);
    buildings.set(slot.id, { id: slot.id, kind: 'ad', name: slot.name, root, body, mats: makeBuildingMaterials(), height: ad.height, radius: ad.radius, hover: 0, hoverTarget: 0, windowGlow: 0 });
    placedAds.push(slot.id);
  }
  for (const r of ROADS) {
    const horiz = r.z1 === r.z2;
    const len = horiz ? r.x2 - r.x1 : r.z2 - r.z1;
    for (const side of [-1, 1])
      for (let d = 4; d < len - 4; d += 8) {
        const x = horiz ? r.x1 + d + (side > 0 ? 2 : 0) : r.x1 + side * (ROAD_W / 2 + 1.2);
        const z = horiz ? r.z1 + side * (ROAD_W / 2 + 1.2) : r.z1 + d + (side > 0 ? 2 : 0);
        if (nearIntersection(x, z, 6) || blocked(x, z, 0.6) || !inIsland(x, z, 4)) continue;
        treeSpots.push({ x, z, s: 0.6, kind: 'round' });
      }
  }
  for (let a = 0; a < Math.PI * 2; a += 0.022) {
    // coastal pines just inside the island edges
    const p = islandEdgePoint(a, 3.2);
    if (p.z > 80 && p.x < -70) continue; // keep the pier approach open
    if (Math.abs(p.z - BRIDGE.z) < 8 && p.x > 90) continue; // bridge approach
    if (p.x < -100 && p.z > GOLF.z0 - 4 && p.z < GOLF.z1 + 4) continue; // joins the golf club
    if (Math.abs(p.x) < 8 && p.z < -78) continue; // causeway
    if (!blocked(p.x, p.z, 0.5) && rand() < 0.7) treeSpots.push({ x: p.x, z: p.z, s: 0.55 + rand() * 0.25, kind: 'cone' });
  }
  for (let a = 0; a < Math.PI * 2; a += 0.024) {
    const p = edgePoint((GOLF.x0 + GOLF.x1) / 2, GOLF.x1 - GOLF.x0, GOLF.z1 - GOLF.z0, GOLF.r, a, 3.2);
    p.z += (GOLF.z0 + GOLF.z1) / 2;
    if (p.x > GOLF_FENCE_X - 4) continue;
    if (!blocked(p.x, p.z, 0.5) && rand() < 0.8) treeSpots.push({ x: p.x, z: p.z, s: 0.65 + rand() * 0.3, kind: rand() < 0.6 ? 'cone' : 'round' });
  }
  for (let a = 0; a < Math.PI * 2; a += 0.03) {
    const p = edgePoint((PLAZA_LAND.x0 + PLAZA_LAND.x1) / 2, PLAZA_LAND.x1 - PLAZA_LAND.x0, PLAZA_LAND.z1 - PLAZA_LAND.z0, PLAZA_LAND.r, a, 3.2);
    p.z += (PLAZA_LAND.z0 + PLAZA_LAND.z1) / 2;
    if (p.x < BROOKLYN.x1 + 2) continue; // joins Brooklyn
    if (!blocked(p.x, p.z, 0.8) && rand() < 0.55) treeSpots.push({ x: p.x, z: p.z, s: 0.55 + rand() * 0.25, kind: 'cone' });
  }
  for (let a = 0; a < Math.PI * 2; a += 0.026) {
    const p = edgePoint(BK_CX, BK_W, BK_D, BROOKLYN.r, a, 3.2);
    if (Math.abs(p.z - BRIDGE.z) < 8 && p.x < BK_CX) continue;
    if (p.z > 70) continue; // marina + port waterfront
    if (p.x > BROOKLYN.x1 - 8 && p.z > PLAZA_LAND.z0 - 4 && p.z < PLAZA_LAND.z1 + 4) continue; // joins THE PLAZA district
    if (!blocked(p.x, p.z, 0.5) && rand() < 0.6) treeSpots.push({ x: p.x, z: p.z, s: 0.55 + rand() * 0.25, kind: 'cone' });
  }
  const leafMats = plantTrees(group, treeSpots);
  addStreetLights(group);

  /* ---------------- traffic ---------------- */
  addTraffic(group, updaters, heightAt);

  /* ---------------- labels & landmarks ---------------- */
  const count = (s: SectorId) => traders.filter((t) => t.sector === s).length;
  const labels: AreaLabel[] = [
    { id: 'capital', name: 'Capital Square', subtitle: 'Heart of FUNDEDCITY', x: 0, y: 9, z: 0, tone: 'gold' },
    { id: 'ring-cfd', name: 'CFD Firms', subtitle: `${byCat.cfd.length} HQs`, x: 0, y: 19, z: -30, tone: 'cfd' },
    { id: 'ring-fut', name: 'Futures Firms', subtitle: `${byCat.futures.length} HQs`, x: 0, y: 19, z: 30, tone: 'futures' },
    { id: 'ring-perps', name: 'Perps Firms', subtitle: `${byCat.perps.length} HQs`, x: 58, y: 19, z: 0, tone: 'perps' },
    { id: 'spaces', name: 'THE LAB', subtitle: 'Offers & experiments', x: -58, y: 15, z: 0, tone: 'cfd' },
    { id: 'reset', name: 'RESET', subtitle: 'Yoga · AI mindset guide', x: RESET.x, y: 7, z: RESET.z, tone: 'futures' },
    { id: 'sec-cfd', name: `${SECTOR_LABEL.cfd} Sector`, subtitle: `${count('cfd')} trader towers`, x: 0, y: 14, z: -63, tone: 'cfd' },
    { id: 'sec-fut', name: `${SECTOR_LABEL.futures} Sector`, subtitle: `${count('futures')} trader towers`, x: 0, y: 14, z: 63, tone: 'futures' },
    { id: 'sec-perps', name: `${SECTOR_LABEL.perps} Sector`, subtitle: `${count('perps')} trader towers`, x: 88, y: 16, z: 21, tone: 'perps' },
    { id: 'sec-multi', name: `${SECTOR_LABEL.multi} Sector`, subtitle: `${count('multi')} trader towers`, x: -88, y: 16, z: -21, tone: 'multi' },
    { id: 'media', name: 'Media District', subtitle: 'Calendar · Theater · News', x: 80, y: 18, z: -52, tone: 'urgent' },
    { id: 'airport', name: 'FUNDEDCITY Airport', subtitle: 'Live arrivals & departures', x: 45, y: 16, z: -148, tone: 'cfd' },
    { id: 'park', name: 'Touch The Grass Park', subtitle: 'Pond · gazebo · yoga deck', x: PARK.x, y: 10, z: PARK.z + 2, tone: 'futures' },
    { id: 'golf', name: '100K+ Payouts Golf Club', subtitle: 'Members only · 9 holes', x: -160, y: 12, z: -24, tone: 'gold' },
    { id: 'cafe', name: 'Sip The Dip Cafe', subtitle: 'Waterfront · traders meet & talk', x: CAFE.x, y: 9, z: CAFE.z - 4, tone: 'futures' },
    { id: 'bank', name: 'Bank of Gains', subtitle: 'Max payout rankings', x: 31, y: 19, z: 0, tone: 'gold' },
    { id: 'brooklyn', name: 'Brooklyn', subtitle: `${houseSlots.length} trader houses`, x: 241, y: 12, z: -27 },
    { id: 'stadium', name: 'Liquidation Arena', subtitle: 'Prop firm tournaments', x: STADIUM.x, y: 22, z: STADIUM.z, tone: 'gold' },
    { id: 'plaza', name: 'THE PLAZA', subtitle: 'Mall & marketplace · 0 listing fees', x: MALL.x, y: 15, z: MALL.z, tone: 'gold' },
    { id: 'floor', name: 'Trading Floor', subtitle: 'FX · Indices · Commodities · Crypto · Options', x: FLOOR.x, y: 14, z: FLOOR.z, tone: 'cfd' },
    { id: 'summit', name: 'Founders’ Summit', subtitle: 'Statues of the founders · cable car', x: SUMMIT.x, y: SUMMIT.y + 20, z: SUMMIT.z, tone: 'gold' },
    { id: 'hall', name: 'City Hall', subtitle: 'Announcements · votes · mayor', x: HALL.x, y: 19, z: HALL.z, tone: 'gold' },
    { id: 'bridge', name: 'Rat Race Exit Bridge', subtitle: 'Walk across the river', x: 139, y: 27, z: BRIDGE.z },
    { id: 'statue', name: 'Set For Life Statue', subtitle: 'In the bay', x: STATUE.x, y: 30, z: STATUE.z },
    { id: 'marina', name: 'Yacht Marina', subtitle: 'Brooklyn waterfront', x: 213, y: 8, z: 106 },
    { id: 'port', name: 'Container Port', subtitle: 'Ships & cranes', x: 283, y: 24, z: 100 },
  ];
  const landmarks: Landmark[] = [
    { id: 'capital-square', name: 'Capital Square', blurb: 'The fountain plaza at the centre of the Corporate Ring.', x: 0, z: 0, r: 11 },
    { id: 'central-park', name: 'Touch The Grass Park', blurb: 'Pond, gazebo and the quietest paths in the city: log off and relax.', x: PARK.x - 8, z: PARK.z + 6, r: 8 },
    { id: 'golf-clubhouse', name: 'Golf Club · Members’ Gate', blurb: 'Entry conditions are posted at the gate: 100K+ traders, prop firm CEOs and marketing teams.', x: GOLF_FENCE_X + 3.4, z: GOLF_GATE.z, r: 5 },
    { id: 'golf-lawn', name: 'Members’ Lawn', blurb: 'Where firm CEOs, marketing teams and 100K+ traders meet and talk.', x: -165, z: -41, r: 9 },
    { id: 'airport-landside', name: 'Airport Terminal', blurb: 'FUNDEDCITY International: departures, arrivals and the radar.', x: 0, z: -130, r: 8 },
    { id: 'media-district', name: 'Media District', blurb: 'Economic calendar, countdowns, the big-screen theater and the URGENT news crawl.', x: 88, z: -55, r: 8 },
    { id: 'waterfront', name: 'Waterfront & Pier', blurb: 'Café terraces and the pier out to the bay.', x: -88, z: 64, r: 13 },
    { id: 'brooklyn-commons', name: 'Brooklyn Commons', blurb: 'The park at the heart of the Brooklyn houses, where traders live until their first verified payout.', x: 257.9, z: 0.5, r: 12 },
    { id: 'bridge-walk', name: 'Rat Race Exit Bridge walk', blurb: 'The promenade over the river from the city to Brooklyn: leave the rat race behind.', x: 139, z: BRIDGE.z, r: 6 },
    { id: 'marina-club', name: 'Marina Club', blurb: 'Pontoons, superyachts and the breakwater light.', x: 213, z: 82, r: 8 },
    { id: 'plaza-promenade', name: 'Plaza Square', blurb: 'The square between the Plaza parking lot, THE PLAZA mall and the Trading Floor.', x: (PLAZA_SQUARE.x0 + PLAZA_SQUARE.x1) / 2 - 1.5, z: -12, r: 6 },
    { id: 'port-gate', name: 'Port Gate', blurb: 'Gantry cranes, the container yard and ships at the quay.', x: 283, z: 82, r: 8 },
  ];

  const SNOW = new THREE.Color(0xf4f7fb);
  const WHITE = new THREE.Color(0xffffff);
  const LEAF_SNOW = new THREE.Color(0xf0f4f8);
  const grassBase = MAT.grass.color.clone();
  const paveBase = pavement.color.clone();
  const zoneBase = [...zoneMats.values()].map((m) => [m, m.color.clone()] as const);
  const city: City = {
    group,
    buildings,
    obstacles,
    landmarks,
    labels,
    houseSlots: houseSlots.map(({ id, x, z }) => ({ id, x, z })),
    island: { w: ISLAND_W, d: ISLAND_D, r: ISLAND_R },
    bounds: { minX: -700, maxX: 400, minZ: -700, maxZ: 170 },
    walk: {
      minX: GOLF.x0, maxX: PLAZA_LAND.x1, minZ: AIRPORT.z0, maxZ: ISLAND_D / 2,
      inside: (x, z) => inIsland(x, z, 1.6) || (x > BRIDGE.x0 - 1 && x < BRIDGE.x1 + 1 && Math.abs(z - BRIDGE.z) < 2.9) || (Math.abs(x) < 3 && z > -130 && z < -84),
    },
    heightAt,
    onLand: (x, z, m) => inIsland(x, z, m) || onMainland(x, z, m),
    stadium,
    airport,
    golf,
    lab,
    tradingFloor,
    cityHall,
    cable,
    setFounders: (list) => {
      summit.setFounders(list);
      list.forEach((f, i) => { const b = buildings.get(f.id); if (b) b.name = f.name.trim() ? f.name : `Founder ${i + 1}`; });
    },
    ads: placedAds,
    bank,
    cafePos: new THREE.Vector3(CAFE.x, 0, CAFE.z - 6.5),
    setSnow(v) {
      MAT.grass.color.lerpColors(grassBase, SNOW, v * 0.85);
      for (const [m, c] of zoneBase) m.color.lerpColors(c, SNOW, v * 0.6);
      pavement.color.lerpColors(paveBase, SNOW, v * 0.55);
      for (const lm of leafMats) lm.color.lerpColors(WHITE, LEAF_SNOW, v);
      setRoofSnow(v);
    },
    rebuildTower(t) {
      const b = buildings.get(t.id)!;
      const pos = b.root.position.clone();
      group.remove(b.root);
      disposeMats(b.mats);
      const nb = towerFor(t, pos.x, pos.z);
      nb.name = t.name;
      return nb;
    },
    placeTrader(t, evictable) {
      const owners = slotOwner[t.sector];
      // already standing in this sector? just rebuild
      if (sectorOf.get(t.id) === t.sector && buildings.has(t.id)) return { building: city.rebuildTower(t), evicted: null };
      if (buildings.has(t.id)) city.removeTrader(t.id);
      let idx = owners.findIndex((o) => o === null);
      let evicted: string | null = null;
      if (idx < 0) {
        // the smallest demo tower in the sector makes way
        let best = -1;
        let bestH = Infinity;
        owners.forEach((o, i) => {
          if (!o || !evictable(o)) return;
          const h = buildings.get(o)?.height ?? 0;
          if (h < bestH) { bestH = h; best = i; }
        });
        if (best < 0) return null;
        idx = best;
        evicted = owners[best];
        const eb = buildings.get(evicted!);
        if (eb) { group.remove(eb.root); disposeMats(eb.mats); buildings.delete(evicted!); }
        sectorOf.delete(evicted!);
      }
      const [x, z] = SLOTS[t.sector][idx];
      owners[idx] = t.id;
      sectorOf.set(t.id, t.sector);
      t.plot = { x, z };
      return { building: towerFor(t, x, z), evicted };
    },
    removeTrader(id) {
      const sec = sectorOf.get(id);
      const b = buildings.get(id);
      if (b) { group.remove(b.root); disposeMats(b.mats); buildings.delete(id); }
      if (sec) { const i = slotOwner[sec].indexOf(id); if (i >= 0) slotOwner[sec][i] = null; }
      sectorOf.delete(id);
    },
    rebuildHouse(id, mine) {
      const b = buildings.get(id)!;
      group.remove(b.root);
      const idx = houseSlots.findIndex((s) => s.id === id);
      return placeHouse(houseSlots[idx], idx, mine, false).cb;
    },
    applyNight(n) {
      ENV.night = n;
      for (const f of nightFx) f(n);
    },
    update(dt, t) {
      for (const u of updaters) u(dt, t);
      for (const b of buildings.values()) if (b.tower?.crown) b.tower.crown.rotation.y += dt * 0.35;
    },
  };
  return city;
}

function disposeMats(m: BuildingMaterials) {
  m.white.dispose();
  m.glass.dispose();
  m.trim.dispose();
}

/* ======================================================================= */
/* geometry helpers                                                         */

function onRoad(x: number, z: number, pad = 0): boolean {
  const hw = ROAD_W / 2 + pad;
  for (const r of ROADS) {
    if (r.z1 === r.z2) {
      if (Math.abs(z - r.z1) < hw && x > r.x1 - hw && x < r.x2 + hw) return true;
    } else if (Math.abs(x - r.x1) < hw && z > r.z1 - hw && z < r.z2 + hw) return true;
  }
  return false;
}

function intersections(): Array<{ x: number; z: number }> {
  const pts: Array<{ x: number; z: number }> = [];
  const hs = ROADS.filter((r) => r.z1 === r.z2);
  const vs = ROADS.filter((r) => r.x1 === r.x2);
  for (const h of hs)
    for (const v of vs) {
      if (v.x1 >= h.x1 - 0.1 && v.x1 <= h.x2 + 0.1 && h.z1 >= v.z1 - 0.1 && h.z1 <= v.z2 + 0.1) {
        if (!pts.some((p) => p.x === v.x1 && p.z === h.z1)) pts.push({ x: v.x1, z: h.z1 });
      }
    }
  return pts;
}
const INTERSECTIONS = intersections();
function nearIntersection(x: number, z: number, d: number) {
  return INTERSECTIONS.some((p) => Math.abs(p.x - x) < d && Math.abs(p.z - z) < d);
}

function inRoundRect(x: number, z: number, cx: number, w: number, d: number, rr: number, margin: number) {
  const hw = w / 2 - margin;
  const hd = d / 2 - margin;
  const r = Math.max(0, rr - margin);
  const ax = Math.abs(x - cx);
  const az = Math.abs(z);
  if (ax > hw || az > hd) return false;
  if (ax > hw - r && az > hd - r) return Math.hypot(ax - (hw - r), az - (hd - r)) <= r;
  return true;
}
/** On land: the main island or Brooklyn. */
function inIsland(x: number, z: number, margin: number) {
  return inRoundRect(x, z, 0, ISLAND_W, ISLAND_D, ISLAND_R, margin) || inRoundRect(x, z, BK_CX, BK_W, BK_D, BROOKLYN.r, margin)
    || inRoundRect(x, z - (GOLF.z0 + GOLF.z1) / 2, (GOLF.x0 + GOLF.x1) / 2, GOLF.x1 - GOLF.x0, GOLF.z1 - GOLF.z0, GOLF.r, margin)
    || inRoundRect(x, z - AIRPORT_CZ, AIRPORT_CX, AIRPORT.x1 - AIRPORT.x0, AIRPORT.z1 - AIRPORT.z0, AIRPORT.r, margin)
    || inRoundRect(x, z - (PLAZA_LAND.z0 + PLAZA_LAND.z1) / 2, (PLAZA_LAND.x0 + PLAZA_LAND.x1) / 2, PLAZA_LAND.x1 - PLAZA_LAND.x0, PLAZA_LAND.z1 - PLAZA_LAND.z0, PLAZA_LAND.r, margin);
}
function edgePoint(cx: number, w: number, d: number, r: number, a: number, inset: number) {
  const dx = Math.cos(a);
  const dz = Math.sin(a);
  let lo = 0;
  let hi = 200;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (inRoundRect(cx + dx * mid, dz * mid, cx, w, d, r, inset)) lo = mid;
    else hi = mid;
  }
  return { x: cx + dx * lo, z: dz * lo };
}
/** Walker / car height: raised on the Brooklyn Bridge deck. */
function heightAt(x: number, z: number) {
  if (x > BRIDGE.x0 && x < BRIDGE.x1 && Math.abs(z - BRIDGE.z) < 3.7) return Math.max(BLOCK_Y, bridgeDeckY(BRIDGE, x));
  // out on the mainland, follow the ground (plains, dunes, foothills)
  if (!inIsland(x, z, 0) && mainlandSd(x, z) < 0) return Math.max(BLOCK_Y, groundHeight(x, z) + 0.05);
  return BLOCK_Y;
}

/** Point on the main island's rounded outline at angle a, inset by `inset`. */
function islandEdgePoint(a: number, inset: number) {
  return edgePoint(0, ISLAND_W, ISLAND_D, ISLAND_R, a, inset);
}

function buildRoads(group: THREE.Group) {
  const asphalt = new THREE.MeshStandardMaterial({ color: 0xbcc6d2, roughness: 0.9 });
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  for (const r of ROADS) {
    const horiz = r.z1 === r.z2;
    const len = (horiz ? r.x2 - r.x1 : r.z2 - r.z1) + ROAD_W;
    const m = mesh(horiz ? box(len, 0.04, ROAD_W) : box(ROAD_W, 0.04, len), asphalt, false);
    m.position.set((r.x1 + r.x2) / 2, 0.02, (r.z1 + r.z2) / 2);
    group.add(m);
  }
  const m4 = new THREE.Matrix4();
  const rotY = new THREE.Matrix4().makeRotationY(Math.PI / 2);
  const dashes: THREE.Matrix4[] = [];
  for (const r of ROADS) {
    const horiz = r.z1 === r.z2;
    const len = horiz ? r.x2 - r.x1 : r.z2 - r.z1;
    for (let d = 1.5; d < len - 1; d += 2.4) {
      const x = horiz ? r.x1 + d : r.x1;
      const z = horiz ? r.z1 : r.z1 + d;
      if (nearIntersection(x, z, ROAD_W)) continue;
      dashes.push(horiz ? m4.clone().makeTranslation(x, 0.055, z).multiply(rotY) : m4.clone().makeTranslation(x, 0.05, z));
    }
  }
  const zebras: THREE.Matrix4[] = [];
  for (const p of INTERSECTIONS) {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const cx = p.x + dx * (ROAD_W / 2 + 1.6);
      const cz = p.z + dz * (ROAD_W / 2 + 1.6);
      if (!onRoad(cx, cz)) continue;
      for (let i = -3; i <= 3; i++) {
        if (dx) zebras.push(m4.clone().makeTranslation(cx, 0.06, cz + i * 0.72).multiply(rotY));
        else zebras.push(m4.clone().makeTranslation(cx + i * 0.72, 0.06, cz));
      }
    }
  }
  const dashMesh = new THREE.InstancedMesh(box(0.18, 0.02, 1.2), lineMat, dashes.length);
  dashes.forEach((m, i) => dashMesh.setMatrixAt(i, m));
  const zebraMesh = new THREE.InstancedMesh(box(0.5, 0.02, 2.6), lineMat, zebras.length);
  zebras.forEach((m, i) => zebraMesh.setMatrixAt(i, m));
  dashMesh.receiveShadow = zebraMesh.receiveShadow = true;
  group.add(dashMesh, zebraMesh);
}

/* ======================================================================= */

function buildCapitalSquare(group: THREE.Group, trees: TreeSpot[], updaters: Array<(dt: number, t: number) => void>) {
  const y = BLOCK_Y;
  const step = mesh(new THREE.CylinderGeometry(10.2, 10.4, 0.18, 64), MAT.stone, false);
  step.position.y = y + 0.09;
  const plaza = mesh(new THREE.CylinderGeometry(9.4, 9.4, 0.26, 64), MAT.white, false);
  plaza.position.y = y + 0.13;
  group.add(step, plaza);
  const inlayMat = new THREE.MeshStandardMaterial({ color: COLORS.gold, roughness: 0.35, metalness: 0.6, emissive: 0xffc35a, emissiveIntensity: 0 });
  nightValue((v) => (inlayMat.emissiveIntensity = v), 0, 1.2);
  for (const r of [8.6, 5.2]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.09, r + 0.09, 96), inlayMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = y + 0.265;
    ring.receiveShadow = true;
    group.add(ring);
  }
  const lineGeo = box(0.08, 0.01, 3.2);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const l = new THREE.Mesh(lineGeo, MAT.trim);
    l.position.set(Math.cos(a) * 6.9, y + 0.265, Math.sin(a) * 6.9);
    l.rotation.y = -a + Math.PI / 2;
    group.add(l);
  }
  const basin = mesh(new THREE.CylinderGeometry(3.1, 3.25, 0.6, 48), MAT.white);
  basin.position.y = y + 0.56;
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x8fd6f0, roughness: 0.1, metalness: 0.1, emissive: 0x3aa7d8, emissiveIntensity: 0.15 });
  nightValue((v) => (waterMat.emissiveIntensity = v), 0.15, 1.3);
  const water = mesh(new THREE.CylinderGeometry(2.8, 2.8, 0.1, 48), waterMat, false);
  water.position.y = y + 0.82;
  const column = mesh(new THREE.CylinderGeometry(0.45, 0.6, 1.4, 16), MAT.white);
  column.position.y = y + 1.5;
  const bowl = mesh(new THREE.CylinderGeometry(1.3, 0.7, 0.4, 32), MAT.white);
  bowl.position.y = y + 2.3;
  const bowlWater = mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.06, 32), waterMat, false);
  bowlWater.position.y = y + 2.49;
  const orb = mesh(new THREE.IcosahedronGeometry(0.55, 2), MAT.gold);
  orb.position.y = y + 3.05;
  group.add(basin, water, column, bowl, bowlWater, orb);
  const ripples: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const r = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
    r.rotation.x = -Math.PI / 2;
    r.position.y = y + 0.88;
    group.add(r);
    ripples.push(r);
  }
  updaters.push((_dt, t) => {
    ripples.forEach((r, i) => {
      const p = (t * 0.35 + i / 3) % 1;
      const s = 1 + p * 1.7;
      r.scale.set(s, s, 1);
      (r.material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - p);
    });
    orb.rotation.y = t * 0.3;
  });
  // lawns north & south of the plaza
  for (const z of [-13.5, 13.5]) {
    const edge = mesh(rbox(14.4, 0.26, 5.4, 0.15), MAT.white, false);
    edge.position.set(0, y + 0.13, z);
    const l = mesh(rbox(14, 0.3, 5, 0.15), MAT.grass, false);
    l.position.set(0, y + 0.15, z);
    group.add(edge, l);
    for (const dx of z > 0 ? [-5.2, 5.2] : [-4.5, 0, 4.5]) trees.push({ x: dx, z, s: 0.75, kind: 'round' });
  }
  // the city's welcome sign with the official logo, on the south lawn facing the way in
  {
    const sign = new THREE.Group();
    const plinth = mesh(rbox(7.4, 0.7, 1.5, 0.12), MAT.stone);
    plinth.position.y = 0.35;
    const panel = mesh(rbox(6.8, 2.75, 0.34, 0.1), MAT.white);
    panel.position.y = 0.7 + 1.375;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 2.44), new THREE.MeshStandardMaterial({ map: logoTexture('lockup'), roughness: 0.55 }));
    face.position.set(0, 0.7 + 1.375, 0.175);
    const back = face.clone();
    back.rotation.y = Math.PI;
    back.position.z = -0.175;
    const trim = mesh(box(6.95, 0.12, 0.42), MAT.gold);
    trim.position.y = 0.7 + 2.78;
    sign.add(plinth, panel, face, back, trim);
    sign.position.set(0, y + 0.3, 13.2);
    sign.rotation.y = 0.18; // turned a little towards the default view
    group.add(sign);
  }
  // flags at the four entrances
  const flagCols = [COLORS.royal, COLORS.gold, COLORS.royal, COLORS.gold];
  const flagTex = logoTexture('flag');
  const flags: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const pole = mesh(new THREE.CylinderGeometry(0.06, 0.08, 5.2, 6), MAT.white);
    pole.position.set(Math.cos(a) * 9.9, y + 2.6, Math.sin(a) * 9.9);
    const flagGeo = new THREE.PlaneGeometry(1.5, 0.9, 6, 1);
    flagGeo.translate(0.75, 0, 0);
    // the official FundedCity logo flies on the gold flags; the blue ones stay plain
    const flag = new THREE.Mesh(flagGeo, i % 2 ? new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.6 }) : new THREE.MeshStandardMaterial({ color: flagCols[i], side: THREE.DoubleSide, roughness: 0.6 }));
    flag.position.set(Math.cos(a) * 9.9, y + 4.6, Math.sin(a) * 9.9);
    flag.userData.base = (flagGeo.attributes.position.array as Float32Array).slice();
    flags.push(flag);
    group.add(pole, flag);
  }
  updaters.push((_dt, t) => {
    for (const [i, f] of flags.entries()) {
      const pos = f.geometry.attributes.position as THREE.BufferAttribute;
      const base = f.userData.base as Float32Array;
      for (let v = 0; v < pos.count; v++) pos.setZ(v, Math.sin(t * 3 + base[v * 3] * 2.4 + i) * 0.12 * base[v * 3]);
      pos.needsUpdate = true;
      f.rotation.y = -0.6 + Math.sin(t * 0.4 + i) * 0.1;
    }
  });
  // curved flower beds east & west of the plaza
  const flowerGeo = new THREE.IcosahedronGeometry(0.2, 0);
  const flowerCols = [0xf6a6b2, 0xffffff, 0xf7d77a, 0xc9b6f2];
  const fSpots: THREE.Vector3[] = [];
  for (const c of [0, Math.PI])
    for (const [a0, a1] of [[c + 0.14, c + 0.9], [c - 0.9, c - 0.14]]) {
      const shape = new THREE.Shape();
      shape.absarc(0, 0, 11.3, a0, a1, false);
      shape.absarc(0, 0, 10.5, a1, a0, true);
      const g = new THREE.ExtrudeGeometry(shape, { depth: 0.32, bevelEnabled: false, curveSegments: 16 });
      g.rotateX(Math.PI / 2);
      const bed = mesh(g, MAT.hedge, false);
      bed.position.y = y + 0.34;
      group.add(bed);
      for (let k = 0; k <= 7; k++) {
        const a = a0 + ((a1 - a0) * k) / 7;
        for (const r of [10.75, 11.05]) fSpots.push(new THREE.Vector3(Math.cos(a) * r, y + 0.42, Math.sin(a) * r));
      }
    }
  const flowers = new THREE.InstancedMesh(flowerGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, flatShading: true }), fSpots.length);
  const fm = new THREE.Matrix4();
  fSpots.forEach((p, i) => {
    fm.makeTranslation(p.x, p.y, p.z);
    flowers.setMatrixAt(i, fm);
    flowers.setColorAt(i, new THREE.Color(flowerCols[i % flowerCols.length]));
  });
  group.add(flowers);
  const benchGeo = rbox(1.5, 0.3, 0.5, 0.08);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const b = mesh(benchGeo, MAT.darkGrey);
    b.position.set(Math.cos(a) * 7.9, y + 0.42, Math.sin(a) * 7.9);
    b.rotation.y = -a + Math.PI / 2;
    group.add(b);
  }
}

function buildPark(group: THREE.Group, trees: TreeSpot[], updaters: Array<(dt: number, t: number) => void>, obstacles: Obstacle[], cx: number, cz: number) {
  const pondShape = new THREE.Shape();
  pondShape.absellipse(0, 0, 8.5, 5.6, 0, Math.PI * 2, false, 0);
  const pondGeo = new THREE.ShapeGeometry(pondShape, 48);
  pondGeo.rotateX(-Math.PI / 2);
  const px = cx + 1;
  const pz = cz + 4;
  const pondEdge = mesh(new THREE.CylinderGeometry(1, 1, 0.22, 48), MAT.white, false);
  pondEdge.scale.set(9.1, 1, 6.2);
  pondEdge.position.set(px, 0.15, pz);
  const pondMat = new THREE.MeshStandardMaterial({ color: 0x86cde9, roughness: 0.15, metalness: 0.1, emissive: 0x2a6fb0, emissiveIntensity: 0 });
  nightValue((v) => (pondMat.emissiveIntensity = v), 0, 0.35);
  const pond = new THREE.Mesh(pondGeo, pondMat);
  pond.position.set(px, 0.27, pz);
  pond.receiveShadow = true;
  group.add(pondEdge, pond);
  obstacles.push({ kind: 'ellipse', x: px, z: pz, rx: 9.1, rz: 6.2 });
  const pathMat = new THREE.MeshStandardMaterial({ color: 0xf3ead8, roughness: 0.95 });
  const p1 = mesh(box(1.8, 0.06, 40), pathMat, false);
  p1.position.set(cx + 11, 0.15, cz);
  const p2 = mesh(box(32, 0.06, 1.8), pathMat, false);
  p2.position.set(cx, 0.155, cz - 9);
  group.add(p1, p2);
  const gazebo = new THREE.Group();
  const floor = mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.25, 8), MAT.white);
  floor.position.y = 0.25;
  const roof = mesh(new THREE.ConeGeometry(2.8, 1.2, 8), MAT.white);
  roof.position.y = 3.1;
  gazebo.add(floor, roof);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const c = mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.3, 6), MAT.white);
    c.position.set(Math.cos(a) * 1.9, 1.5, Math.sin(a) * 1.9);
    gazebo.add(c);
  }
  gazebo.position.set(cx + 11, 0.05, cz - 9);
  group.add(gazebo);
  obstacles.push({ kind: 'circle', x: cx + 11, z: cz - 9, r: 2.3 });
  const duck = mesh(rbox(0.8, 0.35, 0.5, 0.15), MAT.white, false);
  group.add(duck);
  updaters.push((_dt, t) => {
    const a = t * 0.25;
    duck.position.set(px + Math.cos(a) * 5.2, 0.4, pz + Math.sin(a) * 3.2);
    duck.rotation.y = -a;
  });
  let placed = 0;
  let guard = 0;
  while (placed < 60 && guard++ < 1500) {
    const x = cx - 15 + rand() * 30;
    const z = cz - 19 + rand() * 38;
    const inPond = ((x - px) / 10) ** 2 + ((z - pz) / 7.2) ** 2 < 1;
    const onPath = Math.abs(x - (cx + 11)) < 1.8 || Math.abs(z - (cz - 9)) < 1.8;
    const nearGazebo = Math.hypot(x - (cx + 11), z - (cz - 9)) < 4 || (Math.abs(x - RESET.x) < RESET.w / 2 + 1.5 && Math.abs(z - RESET.z) < RESET.d / 2 + 1.5);
    const tooClose = trees.some((t) => Math.hypot(t.x - x, t.z - z) < 2.2);
    if (inPond || onPath || nearGazebo || tooClose || !inIsland(x, z, 4)) continue;
    trees.push({ x, z, s: 0.6 + rand() * 0.5, kind: rand() < 0.3 ? 'cone' : 'round' });
    placed++;
  }
}

function buildWaterfront(group: THREE.Group, trees: TreeSpot[], obstacles: Obstacle[]) {
  // (Sip The Dip Cafe now stands here: see CAFE)
  void obstacles;
  for (const [x, z] of [[-78, 50], [-78, 70]]) {
    const l = mesh(rbox(8, 0.24, 6, 0.3), MAT.grass, false);
    l.position.set(x, 0.14, z);
    group.add(l);
    for (const dx of [-2.5, 2.5]) trees.push({ x: x + dx, z, s: 0.7, kind: 'round' });
  }
  // pier out into the bay
  const deckMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc4, roughness: 0.9 });
  const pierX = -84;
  const deck = mesh(rbox(3.2, 0.3, 18, 0.08), deckMat);
  deck.position.set(pierX, -0.7, 92);
  group.add(deck);
  const end = mesh(rbox(9, 0.3, 3.6, 0.08), deckMat);
  end.position.set(pierX, -0.7, 101);
  group.add(end);
  for (let z = 85; z <= 101; z += 3) for (const x of [-1.4, 1.4]) {
    const post = mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.8, 6), MAT.grey);
    post.position.set(pierX + x, -1.5, z);
    group.add(post);
  }
}

function plantTrees(group: THREE.Group, spots: TreeSpot[]) {
  const round = spots.filter((s) => s.kind === 'round');
  const cone = spots.filter((s) => s.kind === 'cone');
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.16, 1, 6);
  trunkGeo.translate(0, 0.5, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0xb59a7a, roughness: 0.9 });
  const leafGeo = new THREE.IcosahedronGeometry(1, 1);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true });
  const coneGeo = new THREE.ConeGeometry(0.9, 2.6, 7);
  const coneMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, round.length);
  const cones = new THREE.InstancedMesh(coneGeo, coneMat, cone.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const col = new THREE.Color();
  const greens = [0x8ccf6e, 0x7fc66a, 0x9bd67c, 0x6fbb5f, 0xa5da86];
  spots.forEach((s, i) => {
    const th = s.kind === 'cone' ? 0.7 : 1.25;
    m.compose(new THREE.Vector3(s.x, BLOCK_Y, s.z), q, new THREE.Vector3(s.s, s.s * th, s.s));
    trunks.setMatrixAt(i, m);
  });
  round.forEach((s, i) => {
    q.setFromEuler(new THREE.Euler(0, rand() * Math.PI, 0));
    const sx = s.s * (1.05 + rand() * 0.15);
    m.compose(new THREE.Vector3(s.x, BLOCK_Y + s.s * 1.25 + sx * 0.75, s.z), q, new THREE.Vector3(sx, sx * 1.08, sx));
    leaves.setMatrixAt(i, m);
    leaves.setColorAt(i, col.setHex(greens[Math.floor(rand() * greens.length)]));
  });
  q.identity();
  cone.forEach((s, i) => {
    m.compose(new THREE.Vector3(s.x, BLOCK_Y + s.s * 0.7 + s.s * 1.3, s.z), q, new THREE.Vector3(s.s, s.s, s.s));
    cones.setMatrixAt(i, m);
    cones.setColorAt(i, col.setHex([0x5fae6a, 0x6cb873, 0x58a463][Math.floor(rand() * 3)]));
  });
  for (const im of [trunks, leaves, cones]) {
    im.castShadow = true;
    im.receiveShadow = true;
    group.add(im);
  }
  return [leafMat, coneMat];
}

function addStreetLights(group: THREE.Group) {
  const poles: THREE.Vector3[] = [];
  const off = ROAD_W / 2 + 0.45;
  for (const r of ROADS) {
    const horiz = r.z1 === r.z2;
    const len = horiz ? r.x2 - r.x1 : r.z2 - r.z1;
    for (let d = 6; d < len - 3; d += 14)
      for (const s of [-1, 1]) {
        const x = horiz ? r.x1 + d + s * 3 : r.x1 + s * off;
        const z = horiz ? r.z1 + s * off : r.z1 + d + s * 3;
        if (nearIntersection(x, z, 5) || !inIsland(x, z, 3) || onRoad(x, z, -0.3)) continue;
        poles.push(new THREE.Vector3(x, 0, z));
      }
  }
  const poleGeo = new THREE.CylinderGeometry(0.06, 0.08, 3.2, 5);
  poleGeo.translate(0, 1.6, 0);
  const poleMesh = new THREE.InstancedMesh(poleGeo, MAT.darkGrey, poles.length);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2cc, emissiveIntensity: 0.6, roughness: 0.4 });
  const headMesh = new THREE.InstancedMesh(box(0.55, 0.16, 0.3), headMat, poles.length);
  const m = new THREE.Matrix4();
  poles.forEach((p, i) => {
    m.makeTranslation(p.x, BLOCK_Y, p.z);
    poleMesh.setMatrixAt(i, m);
    m.makeTranslation(p.x, BLOCK_Y + 3.2, p.z);
    headMesh.setMatrixAt(i, m);
  });
  poleMesh.castShadow = true;
  nightValue((v) => (headMat.emissiveIntensity = v), 0.6, 4);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,214,150,0.9)');
  grad.addColorStop(0.5, 'rgba(255,196,120,0.35)');
  grad.addColorStop(1, 'rgba(255,190,110,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const poolTex = new THREE.CanvasTexture(c);
  poolTex.colorSpace = THREE.SRGBColorSpace;
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const poolGeo = new THREE.PlaneGeometry(7, 7);
  poolGeo.rotateX(-Math.PI / 2);
  const pools = new THREE.InstancedMesh(poolGeo, poolMat, poles.length);
  poles.forEach((p, i) => {
    m.makeTranslation(p.x, BLOCK_Y + 0.05, p.z);
    pools.setMatrixAt(i, m);
  });
  pools.renderOrder = 1;
  nightValue((v) => { poolMat.opacity = v; pools.visible = v > 0.01; }, 0, 0.75);
  group.add(poleMesh, headMesh, pools);
}

function addTraffic(group: THREE.Group, updaters: Array<(dt: number, t: number) => void>, groundAt: (x: number, z: number) => number) {
  const colors = [0xffffff, 0x2f6bff, 0xf6f7f9, 0x2bd4a0, 0xd4a94a, 0x13213f, 0xffffff, 0x9fb4cc, 0xffffff, 0x7c5cff];
  const bodyGeo = rbox(1.9, 0.55, 0.95, 0.22);
  const cabGeo = rbox(1.05, 0.42, 0.8, 0.18);
  const cabMat = new THREE.MeshStandardMaterial({ color: 0x2b3a55, roughness: 0.2, metalness: 0.3 });
  const wheelGeo = new THREE.CylinderGeometry(0.2, 0.2, 1.0, 10);
  wheelGeo.rotateX(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.8 });
  const headLightMat = new THREE.MeshStandardMaterial({ color: 0xfafafa, emissive: 0xfff2c4, emissiveIntensity: 0.1 });
  const tailLightMat = new THREE.MeshStandardMaterial({ color: 0xc2453b, emissive: 0xff3b30, emissiveIntensity: 0 });
  nightValue((v) => (headLightMat.emissiveIntensity = v), 0.1, 4);
  nightValue((v) => (tailLightMat.emissiveIntensity = v), 0, 2.5);
  const lampGeo = rbox(0.06, 0.14, 0.22, 0.03);
  const bodyMats = colors.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, metalness: 0.2 }));
  let ci = 0;
  const COLOR_NAMES = ['White', 'Blue', 'Silver', 'Mint', 'Gold', 'Navy', 'White', 'Steel', 'Pearl', 'Violet'];
  const makeCar = () => {
    const g = new THREE.Group();
    const idx = ci++;
    const body = mesh(bodyGeo, bodyMats[idx % bodyMats.length], false);
    body.position.y = 0.45;
    const cab = mesh(cabGeo, cabMat, false);
    cab.position.set(-0.1, 0.88, 0);
    const w1 = mesh(wheelGeo, wheelMat, false);
    w1.position.set(0.6, 0.2, 0);
    const w2 = w1.clone();
    w2.position.x = -0.6;
    g.add(body, cab, w1, w2);
    for (const z of [-0.3, 0.3]) {
      const hl = mesh(lampGeo, headLightMat, false, false);
      hl.position.set(0.95, 0.5, z);
      const tl = mesh(lampGeo, tailLightMat, false, false);
      tl.position.set(-0.95, 0.5, z);
      g.add(hl, tl);
    }
    bake(g);
    group.add(g);
    registerVehicle({ id: `car-${idx + 1}`, kind: 'car', name: `${COLOR_NAMES[idx % COLOR_NAMES.length]} city car`, model: 'City car', obj: g, maxSpeed: 24, halfLength: 1, rideY: -0.08 });
    return g;
  };
  // no moving traffic for now: a few city cars stand parked at the kerb, ready to drive (click one)
  void updaters;
  const PARKED: Array<[number, number, number]> = [
    [-12, 21.7, 0], [12, 21.7, Math.PI], // Capital Square, south side
    [-80, 41.7, 0], // the Waterfront, by the café
    [60, -41.7, 0], // the −40 avenue, before the bridge
    [200, 15.7, 0], [242.7, 30, -Math.PI / 2], // Brooklyn
    [20, -128.3, Math.PI], // the airport's landside road
    [304 + 1.7, -20, Math.PI / 2], // Brooklyn's east avenue, by the Plaza parking
  ];
  for (const [x, z, ry] of PARKED) {
    const g = makeCar();
    g.position.set(x, groundAt(x, z) - 0.08, z);
    g.rotation.y = ry;
  }
}
