// Inside views. Every place you can go into gets a seat:
//  • your home: on the sofa in your living room (TV shows your stats)
//  • your tower: on the sofa of the top floor, looking out over the city through the glass
//  • Sip The Dip Cafe: at a terrace table while you chat
//  • Bank of Gains: a trading floor with a giant LED wall and a ticker pillar (Nasdaq-style)
//  • airport terminal: a seat in the departures hall facing the apron, with the live flight board
//  • control tower: in the cab, consoles and live radar, looking out over the airport and city
//  • Liquidation Arena: in the crowd; Media Theater: in the seats; firm HQs: the lobby with the AI guard
//  • THE PLAZA: the mall atrium; the Trading Floor: the five pits; City Hall: the council chamber
//  • golf clubhouse terrace, the Set For Life Statue's crown, the marina club deck, a port crane cab
// Rooms that need the real city outside are built on the spot (the building's shell is hidden while
// you're in); the rest are built off-map below the city. Everything is built on entry and disposed on exit.
import * as THREE from 'three';
import { MAT, box, rbox, signPlane } from './buildings';
import type { CityBuilding } from './city';
import type { InteriorCam } from './camera';
import { SECTIONS, ROOMS } from './plaza';

export interface InteriorAction { id: string; label: string }
export interface Interior {
  id: string;
  title: string;
  sub: string;
  /** roofed: hide rain/snow particles */
  indoor: boolean;
  cam: InteriorCam;
  actions: InteriorAction[];
  update: (dt: number, t: number) => void;
  dispose: () => void;
}
export interface OwnerInfo { name: string; title: string; payouts: number; sector: string; mine: boolean }
export interface InteriorDeps {
  scene: THREE.Scene;
  flights: () => Array<{ flight: string; type: string; status: string; to?: string; from?: string; gate?: string; kind: string; pos: THREE.Vector3; alt: number }>;
  topPayouts: () => Array<{ name: string; amount: number; title: string }>;
  statue: { x: number; z: number; height: number };
  cafe: () => CityBuilding | undefined;
}

const FONT = 'Manrope, Inter, system-ui, sans-serif';
const OFF = new THREE.Vector3(0, -320, 0);
const usd = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : '$' + Math.round(n).toLocaleString('en-US'));
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function canvasTex(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { c, g: c.getContext('2d')!, tex };
}
const screen = (tex: THREE.Texture) => new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });

/** Room kit: every mesh is unshadowed (rooms sit outside the sun's shadow box) and tracked for disposal. */
function kit(parent: THREE.Object3D) {
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const texs: THREE.Texture[] = [];
  const mat = (color: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...o });
    mats.push(m);
    return m;
  };
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, ry = 0) => {
    geos.push(geo);
    const me = new THREE.Mesh(geo, m);
    me.position.set(x, y, z);
    me.rotation.y = ry;
    parent.add(me);
    return me;
  };
  const bx = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, ry = 0) => add(box(w, h, d).clone(), m, x, y + h / 2, z, ry);
  const rb = (w: number, h: number, d: number, r: number, m: THREE.Material, x: number, y: number, z: number, ry = 0) => add(rbox(w, h, d, r).clone(), m, x, y + h / 2, z, ry);
  const plant = (x: number, z: number, s = 1, y = 0) => {
    const pot = mat(0xe9e4da);
    const leaf = mat(0x3f9a5a, { roughness: 0.8 });
    add(new THREE.CylinderGeometry(0.28 * s, 0.22 * s, 0.55 * s, 12), pot, x, y + 0.27 * s, z);
    add(new THREE.IcosahedronGeometry(0.55 * s, 0), leaf, x, y + 0.95 * s, z);
    add(new THREE.IcosahedronGeometry(0.38 * s, 0), leaf, x + 0.2 * s, y + 1.35 * s, z - 0.1 * s);
  };
  const sofa = (x: number, z: number, ry: number, w: number, col: number, y = 0) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = ry;
    parent.add(g);
    const k = kitInner(g, geos, mats);
    const fab = mat(col, { roughness: 0.9 });
    const cushion = mat(new THREE.Color(col).offsetHSL(0, -0.05, 0.08).getHex(), { roughness: 0.95 });
    k.rb(w, 0.42, 1.0, 0.12, fab, 0, 0.08, 0);
    k.rb(w, 0.75, 0.26, 0.1, fab, 0, 0.1, 0.42);
    for (const sx of [-1, 1]) k.rb(0.26, 0.62, 1.0, 0.1, fab, sx * (w / 2 - 0.13), 0.08, 0);
    const n = Math.max(2, Math.round(w / 1.2));
    for (let i = 0; i < n; i++) k.rb((w - 0.6) / n - 0.06, 0.16, 0.8, 0.07, cushion, -((w - 0.6) / 2) + ((w - 0.6) / n) * (i + 0.5), 0.5, -0.04);
    return g;
  };
  return {
    mat, add, bx, rb, plant, sofa,
    tex(w: number, h: number) { const t = canvasTex(w, h); texs.push(t.tex); return t; },
    dispose() {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
      texs.forEach((t) => t.dispose());
      parent.removeFromParent();
    },
  };
}
function kitInner(parent: THREE.Object3D, geos: THREE.BufferGeometry[], mats: THREE.Material[]) {
  void mats;
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
    geos.push(geo);
    const me = new THREE.Mesh(geo, m);
    me.position.set(x, y, z);
    parent.add(me);
    return me;
  };
  return { rb: (w: number, h: number, d: number, r: number, m: THREE.Material, x: number, y: number, z: number) => add(rbox(w, h, d, r).clone(), m, x, y + h / 2, z) };
}

/** A painted view for the windows of off-map rooms (sky + skyline), tinted for night. */
function windowView(k: ReturnType<typeof kit>, night: number) {
  const { g, tex } = k.tex(1024, 512);
  const sky = g.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, night > 0.5 ? '#0c1630' : '#9fd3f2');
  sky.addColorStop(1, night > 0.5 ? '#2a3b66' : '#e6f4fb');
  g.fillStyle = sky;
  g.fillRect(0, 0, 1024, 512);
  let s = 11;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let x = 0; x < 1024; ) {
    const w = 30 + rnd() * 60;
    const h = 120 + rnd() * 260;
    g.fillStyle = night > 0.5 ? '#16223f' : '#c9d6e6';
    g.fillRect(x, 512 - h, w, h);
    g.fillStyle = night > 0.5 ? 'rgba(255,214,140,0.85)' : 'rgba(255,255,255,0.55)';
    for (let wy = 512 - h + 8; wy < 500; wy += 14) for (let wx = x + 5; wx < x + w - 6; wx += 10) if (rnd() > 0.35) g.fillRect(wx, wy, 5, 7);
    x += w + 4 + rnd() * 10;
  }
  tex.needsUpdate = true;
  return screen(tex);
}

export function createInteriors(d: InteriorDeps) {
  const hidden: THREE.Object3D[] = [];
  const hide = (o: THREE.Object3D) => { if (o.visible) { o.visible = false; hidden.push(o); } };
  const unhideAll = () => { hidden.forEach((o) => (o.visible = true)); hidden.length = 0; };
  const night = () => Number(getComputedStyle(document.documentElement).getPropertyValue('--night')) || 0;

  const finish = (root: THREE.Group, k: ReturnType<typeof kit>, i: Omit<Interior, 'dispose' | 'update'> & { update?: (dt: number, t: number) => void }): Interior => {
    d.scene.add(root);
    root.updateMatrixWorld(true);
    return { ...i, update: i.update ?? (() => {}), dispose: () => { k.dispose(); unhideAll(); } };
  };

  /* ---------------- home: the living room ---------------- */
  function home(id: string, owner: OwnerInfo): Interior {
    const root = new THREE.Group();
    root.position.copy(OFF);
    const k = kit(root);
    const W = 9;
    const D = 7.6;
    const H = 3.2;
    const n = night();
    const wall = k.mat(0xf1ebe0, { emissive: 0xf1ebe0, emissiveIntensity: 0.08 });
    const wood = k.mat(0x9a7552, { roughness: 0.55 });
    k.bx(W, 0.1, D, wood, 0, -0.1, 0);
    k.bx(W, 0.1, D, k.mat(0xfaf7f2, { emissive: 0xffffff, emissiveIntensity: 0.06 }), 0, H, 0);
    k.bx(4.4, 0.02, 3.0, k.mat(0x24375f, { roughness: 1 }), 0, 0, 0.6);
    // back wall: TV between two windows
    const view = windowView(k, n);
    for (const [x0, x1] of [[-4.0, -1.6], [1.6, 4.0]]) {
      const w = x1 - x0;
      const cx = (x0 + x1) / 2;
      k.add(new THREE.PlaneGeometry(w, 1.8), view, cx, 1.8, -D / 2 + 0.02);
      k.bx(w, 0.9, 0.2, wall, cx, 0, -D / 2);
      k.bx(w, H - 2.7, 0.2, wall, cx, 2.7, -D / 2);
      k.bx(w + 0.1, 0.06, 0.3, k.mat(0xffffff), cx, 0.88, -D / 2 + 0.1);
    }
    k.bx(0.5, H, 0.2, wall, -4.25, 0, -D / 2);
    k.bx(0.5, H, 0.2, wall, 4.25, 0, -D / 2);
    k.bx(3.2, H, 0.2, wall, 0, 0, -D / 2);
    for (const sx of [-1, 1]) k.bx(0.2, H, D, wall, sx * W / 2, 0, 0);
    k.bx(W, H, 0.2, wall, 0, 0, D / 2);
    // TV with your stats
    const tv = k.tex(1024, 576);
    const drawTV = () => {
      const g = tv.g;
      const grad = g.createLinearGradient(0, 0, 1024, 576);
      grad.addColorStop(0, '#0f1b36');
      grad.addColorStop(1, '#1d3566');
      g.fillStyle = grad;
      g.fillRect(0, 0, 1024, 576);
      g.fillStyle = '#f2c14e';
      g.font = `800 34px ${FONT}`;
      g.fillText('FUNDEDCITY · HOME', 60, 90);
      g.fillStyle = '#ffffff';
      g.font = `900 72px ${FONT}`;
      g.fillText(owner.name.slice(0, 22), 60, 200);
      g.font = `700 36px ${FONT}`;
      g.fillStyle = '#cfe0ff';
      g.fillText(owner.title, 60, 270);
      g.font = `800 30px ${FONT}`;
      g.fillStyle = '#9fb3d9';
      g.fillText(owner.payouts > 0 ? `Verified payouts ${usd(owner.payouts)}` : 'Next goal: your first verified payout', 60, 360);
      g.fillText(owner.mine ? 'Upload a payout to move into a tower' : `${owner.sector} trader`, 60, 410);
      g.strokeStyle = '#2bd4a0';
      g.lineWidth = 6;
      g.beginPath();
      for (let i = 0; i < 12; i++) g.lineTo(560 + i * 36, 500 - (i * 9 + Math.sin(i * 1.7) * 26));
      g.stroke();
      tv.tex.needsUpdate = true;
    };
    drawTV();
    k.bx(2.7, 1.55, 0.08, k.mat(0x111111, { roughness: 0.3 }), 0, 1.0, -D / 2 + 0.15);
    k.add(new THREE.PlaneGeometry(2.56, 1.44), screen(tv.tex), 0, 1.775, -D / 2 + 0.2);
    k.rb(2.8, 0.45, 0.45, 0.06, wood, 0, 0, -D / 2 + 0.4);
    // sofa, table, lamp, shelf, plants, a framed name plaque
    k.sofa(0, 2.4, 0, 3.4, 0x2f4a7a);
    const glass = k.mat(0xdfe8f0, { roughness: 0.1, metalness: 0.3 });
    k.rb(1.7, 0.06, 0.85, 0.03, glass, 0, 0.4, 0.8);
    for (const [x, z] of [[-0.75, 0.45], [0.75, 0.45], [-0.75, 1.15], [0.75, 1.15]]) k.bx(0.05, 0.4, 0.05, k.mat(0x222222), x, 0, z);
    k.add(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 12), k.mat(0xffffff), 0.3, 0.52, 0.8);
    k.bx(0.06, 1.5, 0.06, k.mat(0x222222), 3.6, 0, 2.5);
    k.add(new THREE.CylinderGeometry(0.25, 0.35, 0.4, 16), k.mat(0xfff1d0, { emissive: 0xffd88a, emissiveIntensity: 0.6 + n }), 3.6, 1.6, 2.5);
    k.bx(0.4, 2.4, 2.4, wood, -4.2, 0, 1.6);
    for (let i = 0; i < 4; i++) k.bx(0.3, 0.5, 2.2, k.mat([0x2f6bff, 0xf2c14e, 0x14a37f, 0xd6363b][i]), -4.1, 0.3 + i * 0.55, 1.6);
    k.plant(-3.8, -3.1, 0.85);
    k.plant(3.8, -3.1, 0.75);
    const plaque = signPlane(owner.name.toUpperCase().slice(0, 20), 1.6, 0.6, { bg: '#13213f', fg: '#f2c14e' });
    plaque.position.set(4.38, 1.9, 0.8);
    plaque.rotation.y = -Math.PI / 2;
    root.add(plaque);
    return finish(root, k, {
      id, title: owner.mine ? 'Your home' : `${owner.name}’s home`, sub: owner.title, indoor: true,
      cam: { pos: v3(OFF.x, OFF.y + 1.15, OFF.z + 2.1), look: v3(OFF.x, OFF.y + 1.55, OFF.z - D / 2), fov: 62 },
      actions: owner.mine ? [{ id: 'profile:payouts', label: 'Upload a payout' }, { id: 'profile:profile', label: 'My profile' }] : [],
    });
  }

  /* ---------------- tower: the top-floor lounge ---------------- */
  function penthouse(b: CityBuilding, owner: OwnerInfo): Interior {
    const t = b.tower!;
    const floorY = b.root.position.y + t.top.position.y - 0.2;
    const root = new THREE.Group();
    root.position.set(b.root.position.x, floorY, b.root.position.z);
    // face the city centre
    const yaw = Math.atan2(-b.root.position.x, -b.root.position.z);
    root.rotation.y = yaw + Math.PI;
    const k = kit(root);
    const W = Math.max(6.4, t.halfW * 2 - 1.6);
    const H = 3.2;
    hide(b.body);
    // stand-in shaft below the lounge so the tower still reads when you look down
    k.bx(W - 0.4, floorY - b.root.position.y - 0.2, W - 0.4, k.mat(0xeef2f8, { roughness: 0.4, metalness: 0.2 }), 0, -(floorY - b.root.position.y), 0);
    k.bx(W, 0.14, W, k.mat(0x2a2f3a, { roughness: 0.35 }), 0, -0.14, 0);
    k.bx(W, 0.2, W, k.mat(0xf6f7fa, { emissive: 0xffffff, emissiveIntensity: 0.08 }), 0, H, 0);
    const frame = k.mat(t.signature || owner.payouts >= 1e6 ? 0xc9973a : 0x2a3140, { metalness: 0.6, roughness: 0.3 });
    for (let i = 0; i <= 4; i++) {
      const p = -W / 2 + (W / 4) * i;
      for (const [x, z] of [[p, -W / 2], [p, W / 2], [-W / 2, p], [W / 2, p]]) k.bx(0.09, H, 0.09, frame, x, 0, z);
    }
    for (const [x, z, w, dd] of [[0, -W / 2, W, 0.09], [0, W / 2, W, 0.09], [-W / 2, 0, 0.09, W], [W / 2, 0, 0.09, W]]) {
      k.bx(w, 0.09, dd, frame, x, 0.95, z);
      k.bx(w, 0.12, dd, frame, x, H - 0.12, z);
    }
    // lounge (sofa faces local -z = toward the city centre)
    k.sofa(0, 1.2, 0, 3.2, 0x1d2a44);
    k.bx(3.6, 0.02, 2.4, k.mat(0xc9b28a, { roughness: 1 }), 0, 0, -0.2);
    k.rb(1.5, 0.06, 0.8, 0.03, k.mat(0x111111, { roughness: 0.2, metalness: 0.4 }), 0, 0.38, -0.3);
    k.bx(0.06, 0.38, 0.06, k.mat(0x111111), 0, 0, -0.3);
    k.plant(W / 2 - 0.7, -W / 2 + 0.7, 1.1);
    k.plant(-W / 2 + 0.7, W / 2 - 0.7, 0.9);
    // desk with screens along the side
    k.rb(0.8, 0.75, 2.2, 0.05, k.mat(0x2a2f3a), -W / 2 + 0.7, 0, 0.6);
    const scr = k.tex(512, 320);
    const g = scr.g;
    g.fillStyle = '#0b1530';
    g.fillRect(0, 0, 512, 320);
    g.fillStyle = '#f2c14e';
    g.font = `800 26px ${FONT}`;
    g.fillText(owner.name.toUpperCase().slice(0, 24), 24, 50);
    g.fillStyle = '#ffffff';
    g.font = `900 52px ${FONT}`;
    g.fillText(usd(owner.payouts), 24, 130);
    g.font = `700 24px ${FONT}`;
    g.fillStyle = '#9fb3d9';
    g.fillText(owner.title, 24, 180);
    g.strokeStyle = '#2bd4a0';
    g.lineWidth = 5;
    g.beginPath();
    for (let i = 0; i < 14; i++) g.lineTo(24 + i * 34, 290 - i * 6 - Math.sin(i) * 14);
    g.stroke();
    scr.tex.needsUpdate = true;
    for (const z of [0.15, 1.05]) {
      const m = k.add(new THREE.PlaneGeometry(0.8, 0.5), screen(scr.tex), -W / 2 + 0.55, 1.15, z);
      m.rotation.y = Math.PI / 2;
    }
    const camLocal = v3(0, 1.18, 1.25);
    const lookLocal = v3(0, -1.2, -12);
    return finish(root, k, {
      id: b.id, title: owner.mine ? 'Your tower · top floor' : `${owner.name} · top floor`, sub: `${owner.title} · ${usd(owner.payouts)} verified`, indoor: true,
      cam: { pos: root.localToWorld(camLocal.clone()), look: root.localToWorld(lookLocal.clone()), fov: 64 },
      actions: owner.mine ? [{ id: 'profile:payouts', label: 'Upload a payout' }, { id: 'profile:tower', label: 'My building' }] : [],
    });
  }

  /* ---------------- bank: trading floor ---------------- */
  function bank(): Interior {
    const root = new THREE.Group();
    root.position.copy(OFF).add(v3(200, 0, 0));
    const k = kit(root);
    const W = 34;
    const D = 24;
    const H = 10;
    const woodDark = k.mat(0x3a2416, { roughness: 0.5, emissive: 0x3a2416, emissiveIntensity: 0.15 });
    const gold = MAT.gold;
    k.bx(W, 0.1, D, k.mat(0x12161f, { roughness: 0.25, metalness: 0.3 }), 0, -0.1, 0);
    k.bx(W, 0.2, D, k.mat(0x1b1410, { emissive: 0x1b1410, emissiveIntensity: 0.3 }), 0, H, 0);
    for (const sx of [-1, 1]) k.bx(0.3, H, D, woodDark, sx * W / 2, 0, 0);
    k.bx(W, H, 0.3, woodDark, 0, 0, D / 2);
    k.bx(W, H, 0.3, k.mat(0x0b0d12), 0, 0, -D / 2);
    // gold floor ring + ceiling ring
    const ring = k.add(new THREE.TorusGeometry(6, 0.08, 6, 64), gold, 0, 0.02, -2);
    ring.rotation.x = Math.PI / 2;
    const cring = k.add(new THREE.TorusGeometry(8, 0.18, 8, 64), k.mat(0xffd58a, { emissive: 0xffc861, emissiveIntensity: 1.2 }), 0, H - 0.3, -2);
    cring.rotation.x = Math.PI / 2;
    // columns with gold capitals
    for (const sx of [-1, 1]) for (const z of [-8, -1, 6]) {
      k.add(new THREE.CylinderGeometry(0.45, 0.5, H, 16), woodDark, sx * (W / 2 - 1.6), H / 2, z);
      k.bx(1.2, 0.3, 1.2, gold, sx * (W / 2 - 1.6), H - 0.6, z);
    }
    // giant LED wall
    const wall = k.tex(2048, 440);
    const wallMesh = k.add(new THREE.PlaneGeometry(29, 6.2), screen(wall.tex), 0, 5.2, -D / 2 + 0.2);
    void wallMesh;
    // ticker pillar (MarketSite-style)
    const tick = k.tex(2048, 128);
    tick.tex.wrapS = THREE.RepeatWrapping;
    const pillarMat = screen(tick.tex);
    const PX = -11.2;
    const PZ = -4.5;
    k.add(new THREE.CylinderGeometry(1.9, 1.9, 7.2, 48, 1, true), k.mat(0x0b0d12), PX, 3.6, PZ);
    k.add(new THREE.CylinderGeometry(1.96, 1.96, 1.4, 48, 1, true), pillarMat, PX, 5.4, PZ);
    k.add(new THREE.CylinderGeometry(2.2, 2.2, 0.3, 48), gold, PX, 7.35, PZ);
    k.add(new THREE.CylinderGeometry(2.2, 2.2, 0.3, 48), gold, PX, 0.15, PZ);
    // trading desks with monitors (instanced)
    const desks: Array<[number, number]> = [];
    for (const z of [-6.5, -3, 1.5, 5]) for (let x = -12; x <= 12; x += 4) if (!(x < -8 && z < 0)) desks.push([x, z]);
    const deskMesh = new THREE.InstancedMesh(box(3.2, 0.75, 1.0), k.mat(0x2a1a10, { roughness: 0.5 }), desks.length);
    // every monitor shows a little chart
    const chart = k.tex(128, 80);
    chart.g.fillStyle = '#071226';
    chart.g.fillRect(0, 0, 128, 80);
    chart.g.strokeStyle = '#2bd4a0';
    chart.g.lineWidth = 3;
    chart.g.beginPath();
    for (let i = 0; i < 12; i++) chart.g.lineTo(6 + i * 10.5, 64 - i * 3.2 - Math.sin(i * 1.3) * 9);
    chart.g.stroke();
    chart.g.fillStyle = 'rgba(127,176,255,0.6)';
    for (let i = 0; i < 10; i++) chart.g.fillRect(8 + i * 12, 70 - (i % 4) * 3, 7, 6 + (i % 4) * 3);
    chart.tex.needsUpdate = true;
    const monMat = new THREE.MeshBasicMaterial({ map: chart.tex, toneMapped: false });
    const monMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.85, 0.5), monMat, desks.length * 3);
    const chairMesh = new THREE.InstancedMesh(rbox(0.6, 0.9, 0.6, 0.12), k.mat(0x111111), desks.length * 2);
    const m4 = new THREE.Matrix4();
    desks.forEach(([x, z], i) => {
      deskMesh.setMatrixAt(i, m4.makeTranslation(x, 0.375, z));
      for (let j = 0; j < 3; j++) monMesh.setMatrixAt(i * 3 + j, m4.makeTranslation(x - 1 + j, 1.05, z - 0.2));
      chairMesh.setMatrixAt(i * 2, m4.makeTranslation(x - 0.7, 0.45, z + 0.9));
      chairMesh.setMatrixAt(i * 2 + 1, m4.makeTranslation(x + 0.7, 0.45, z + 0.9));
    });
    root.add(deskMesh, monMesh, chairMesh);
    // balcony
    k.bx(W - 1, 3.2, 4, woodDark, 0, 0, D / 2 - 2.2);
    k.bx(W - 1, 0.1, 0.1, gold, 0, 4.2, D / 2 - 4.2);
    for (let x = -15; x <= 15; x += 1.5) k.bx(0.05, 1.0, 0.05, gold, x, 3.2, D / 2 - 4.2);
    const sign = signPlane('BANK OF GAINS', 10, 1.1, { bg: '#2a1a10', fg: '#f2c14e' });
    sign.position.set(0, H - 1.2, -D / 2 + 0.25);
    root.add(sign);

    let scroll = 0;
    let acc = 1;
    const draw = (dt: number) => {
      scroll += dt * 120;
      acc += dt;
      if (acc < 0.08) return;
      acc = 0;
      const top = d.topPayouts().slice(0, 8);
      const g = wall.g;
      g.fillStyle = '#05070c';
      g.fillRect(0, 0, 2048, 440);
      g.fillStyle = '#f2c14e';
      g.font = `900 46px ${FONT}`;
      g.fillText('BANK OF GAINS · TOTAL VERIFIED PAYOUTS', 40, 64);
      g.fillStyle = '#7fe0b8';
      g.font = `700 30px ${FONT}`;
      g.fillText(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date()) + ' NYC', 1700, 64);
      top.forEach((r, i) => {
        const col = i < 4 ? 0 : 1;
        const y = 130 + (i % 4) * 62;
        const x = 40 + col * 1000;
        g.fillStyle = i === 0 ? '#f2c14e' : '#ffffff';
        g.font = `800 38px ${FONT}`;
        g.fillText(`${i + 1}. ${r.name}`.slice(0, 26), x, y);
        g.fillStyle = '#2bd4a0';
        g.font = `900 38px ${FONT}`;
        g.fillText(`▲ ${usd(r.amount)}`, x + 560, y);
        g.fillStyle = '#8fa3c8';
        g.font = `700 22px ${FONT}`;
        g.fillText(r.title, x, y + 26);
      });
      // ticker strip
      g.fillStyle = '#0d2a1f';
      g.fillRect(0, 392, 2048, 48);
      const items = top.map((r) => `${r.name.toUpperCase()} ${usd(r.amount)} ▲`).join('   •   ') + '   •   ';
      g.font = `800 30px ${FONT}`;
      const tw = g.measureText(items).width || 1;
      g.fillStyle = '#2bd4a0';
      const off = -(scroll % tw);
      for (let x = off; x < 2048; x += tw) g.fillText(items, x, 426);
      wall.tex.needsUpdate = true;
      const tg = tick.g;
      tg.fillStyle = '#05070c';
      tg.fillRect(0, 0, 2048, 128);
      tg.font = `900 64px ${FONT}`;
      tg.fillStyle = '#f2c14e';
      const t2 = 'BANK OF GAINS  ' + items;
      const tw2 = tg.measureText(t2).width || 1;
      for (let x = -(scroll * 0.6 % tw2); x < 2048; x += tw2) tg.fillText(t2, x, 88);
      tick.tex.needsUpdate = true;
    };
    draw(1);
    return finish(root, k, {
      id: 'bank-of-gains', title: 'Bank of Gains · trading floor', sub: 'Live verified payouts on the wall', indoor: true,
      cam: { pos: v3(root.position.x + 2, root.position.y + 5.2, root.position.z + D / 2 - 3.4), look: v3(root.position.x + 0.5, root.position.y + 4.3, root.position.z - D / 2), fov: 66 },
      actions: [{ id: 'bank:single', label: 'Max single payout' }, { id: 'bank:total', label: 'Total payouts' }, { id: 'bank:rules', label: 'Rules · build your tower' }],
      update: (dt) => draw(dt),
    });
  }

  /* ---------------- THE LAB: mission control ---------------- */
  function missionControl(bayTextures: THREE.Texture[]): Interior {
    const root = new THREE.Group();
    root.position.copy(OFF).add(v3(0, 0, 200));
    const k = kit(root);
    const W = 24;
    const D = 18;
    const H = 7;
    const panel = k.mat(0x0f1626, { roughness: 0.5, emissive: 0x0f1626, emissiveIntensity: 0.3 });
    const cyan = k.mat(0x0b2a3a, { emissive: 0x31d8ff, emissiveIntensity: 1.3 });
    k.bx(W, 0.1, D, k.mat(0x1a2236, { roughness: 0.3, metalness: 0.3 }), 0, -0.1, 0);
    k.bx(W, 0.2, D, panel, 0, H, 0);
    for (const sx of [-1, 1]) k.bx(0.3, H, D, panel, sx * W / 2, 0, 0);
    k.bx(W, H, 0.3, panel, 0, 0, D / 2);
    k.bx(W, H, 0.3, k.mat(0x070b14), 0, 0, -D / 2);
    for (let z = -D / 2 + 2; z < D / 2; z += 3) k.bx(W - 1, 0.06, 0.12, cyan, 0, H - 0.08, z);
    // the wall: four bay screens + the THE LAB banner
    bayTextures.forEach((tex, i) => {
      const x = -8.4 + i * 5.6;
      k.bx(4.4, 5.3, 0.15, k.mat(0x1a2236), x, 0.9, -D / 2 + 0.25);
      k.add(new THREE.PlaneGeometry(4.0, 5.0), screen(tex), x, 3.55, -D / 2 + 0.36);
    });
    const banner = signPlane('THE LAB · MISSION CONTROL', 12, 0.9, { bg: '#0b1530', fg: '#31d8ff' });
    banner.position.set(0, 6.55, -D / 2 + 0.36);
    root.add(banner);
    // tiered rows of consoles facing the wall
    const cons = k.mat(0x2a3346, { roughness: 0.5 });
    const chart = k.tex(128, 80);
    chart.g.fillStyle = '#071226';
    chart.g.fillRect(0, 0, 128, 80);
    chart.g.strokeStyle = '#31d8ff';
    chart.g.lineWidth = 3;
    chart.g.beginPath();
    for (let i = 0; i < 12; i++) chart.g.lineTo(6 + i * 10.5, 62 - i * 3 - Math.sin(i * 1.7) * 10);
    chart.g.stroke();
    chart.tex.needsUpdate = true;
    const scrMat = screen(chart.tex);
    [[-2, 0], [1.6, 0.45], [5.2, 0.9]].forEach(([z, y]) => {
      k.bx(W - 3, y, 2.6, k.mat(0x151c2c), 0, 0, z + 0.4);
      for (let x = -9; x <= 9; x += 2.25) {
        k.rb(2.0, 0.8, 0.9, 0.06, cons, x, y, z);
        const s2 = k.add(new THREE.PlaneGeometry(0.62, 0.38), scrMat, x - 0.42, y + 1.05, z - 0.25);
        const s3 = k.add(new THREE.PlaneGeometry(0.62, 0.38), scrMat, x + 0.42, y + 1.05, z - 0.25);
        s2.rotation.x = -0.25;
        s3.rotation.x = -0.25;
        void s2; void s3;
      }
    });
    // a glowing globe in the middle of the room
    const globe = k.add(new THREE.SphereGeometry(1.1, 24, 16), k.mat(0x0b2a3a, { emissive: 0x31d8ff, emissiveIntensity: 0.6, wireframe: true }), 0, 2.2, -5.2);
    k.add(new THREE.CylinderGeometry(0.9, 1.1, 0.8, 24), panel, 0, 0.4, -5.2);
    return finish(root, k, {
      id: 'the-lab', title: 'THE LAB · mission control', sub: 'Live experiments on the wall · ask the Lab AI', indoor: true,
      cam: { pos: v3(root.position.x, root.position.y + 3.9, root.position.z + 8.0), look: v3(root.position.x, root.position.y + 3.3, root.position.z - D / 2), fov: 64 },
      actions: [{ id: 'lab:experiments', label: 'Experiments' }, { id: 'lab:ask', label: 'Ask the Lab AI' }, { id: 'lab:rent', label: 'Rent a bay' }],
      update: (_dt, t) => { globe.rotation.y = t * 0.3; },
    });
  }

  /* ---------------- firm HQ lobby ---------------- */
  function lobby(b: CityBuilding, firm: { id: string; name: string; color: number; plans: Array<{ program: string; sizes: string; price: string; target: string; dailyLoss: string; maxLoss: string; split: string; tiers?: string }>; split: string; payouts: string; checked: string; site: string }): Interior {
    const root = new THREE.Group();
    root.position.copy(OFF).add(v3(-200, 0, 0));
    const k = kit(root);
    const W = 16;
    const D = 12;
    const H = 5;
    const white = k.mat(0xf4f6fa, { emissive: 0xffffff, emissiveIntensity: 0.07 });
    k.bx(W, 0.1, D, k.mat(0xe9ecf2, { roughness: 0.15, metalness: 0.1 }), 0, -0.1, 0);
    k.bx(W, 0.2, D, white, 0, H, 0);
    for (const sx of [-1, 1]) k.bx(0.2, H, D, white, sx * W / 2, 0, 0);
    k.bx(W, H, 0.2, white, 0, 0, D / 2);
    const accent = k.mat(firm.color, { roughness: 0.5, emissive: firm.color, emissiveIntensity: 0.15 });
    k.bx(W, H, 0.2, accent, 0, 0, -D / 2);
    const nameSign = signPlane(firm.name.toUpperCase(), 8, 1.3, { bg: '#ffffff', fg: '#' + firm.color.toString(16).padStart(6, '0') });
    nameSign.position.set(0, 3.4, -D / 2 + 0.12);
    root.add(nameSign);
    for (let x = -6; x <= 6; x += 3) k.bx(1.6, 0.06, 0.2, k.mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 1 }), x, H - 0.1, 0);
    // reception desk with the AI guard behind it
    k.rb(6, 1.1, 1.2, 0.2, white, 0, 0, -2.4);
    k.bx(6.05, 0.12, 1.25, accent, 0, 1.1, -2.4);
    const navy = k.mat(0x1b2442);
    k.bx(0.44, 0.95, 0.3, k.mat(0x141a2e), 0.8, 0, -3.5);
    k.rb(0.66, 0.88, 0.4, 0.12, navy, 0.8, 0.95, -3.5);
    k.add(new THREE.SphereGeometry(0.26, 14, 10), k.mat(0xb98463), 0.8, 2.12, -3.5);
    k.add(new THREE.CylinderGeometry(0.28, 0.3, 0.16, 12), k.mat(0x0e1426), 0.8, 2.34, -3.5);
    const ai = signPlane('AI SUPPORT · ASK ME ANYTHING', 2.2, 0.5, { bg: '#0b1530', fg: '#7fb0ff' });
    ai.position.set(-1.2, 1.55, -1.75);
    ai.rotation.x = -0.3;
    root.add(ai);
    k.sofa(-6.6, 3.2, Math.PI / 2, 2.6, 0x2a3140);
    k.sofa(6.6, 3.2, -Math.PI / 2, 2.6, 0x2a3140);
    // the plans wall: every program with its real prices by account size (two screens, left and right)
    const hex = '#' + firm.color.toString(16).padStart(6, '0');
    const progs = firm.plans.slice(0, 6);
    const halves = [progs.slice(0, Math.ceil(progs.length / 2)), progs.slice(Math.ceil(progs.length / 2))];
    halves.forEach((list, side) => {
      const t = k.tex(1024, 1024);
      const g = t.g;
      g.fillStyle = '#0b1220';
      g.fillRect(0, 0, 1024, 1024);
      g.fillStyle = hex;
      g.fillRect(0, 0, 1024, 12);
      g.fillStyle = '#ffffff';
      g.font = `900 46px ${FONT}`;
      g.fillText(side === 0 ? `${firm.name.toUpperCase()} · PLANS` : 'PRICE BY ACCOUNT SIZE', 40, 82);
      g.fillStyle = '#9fb3d9';
      g.font = `700 24px ${FONT}`;
      g.fillText(side === 0 ? `Split ${firm.split}`.slice(0, 64) : `Terms checked ${firm.checked} · confirm on ${firm.site}`.slice(0, 70), 40, 122);
      let y = 180;
      if (!list.length) { g.fillStyle = '#ffffff'; g.font = `800 34px ${FONT}`; g.fillText(side === 0 ? 'Plans not published yet' : '', 40, y + 40); }
      for (const p of list) {
        if (y > 960) break;
        g.fillStyle = hex;
        g.font = `900 34px ${FONT}`;
        g.fillText(p.program.slice(0, 40), 40, y);
        g.fillStyle = '#e8eefc';
        g.font = `700 24px ${FONT}`;
        g.fillText(`Target ${p.target} · Daily ${p.dailyLoss} · Max ${p.maxLoss}`.slice(0, 74), 40, y + 36);
        y += 70;
        const tiers = (p.tiers ?? `${p.sizes}: ${p.price}`).split(' · ');
        g.font = `800 26px ${FONT}`;
        let x = 40;
        for (const tier of tiers) {
          const w = g.measureText(tier).width + 26;
          if (x + w > 990) { x = 40; y += 46; }
          if (y > 990) break;
          g.fillStyle = 'rgba(127,176,255,0.16)';
          g.beginPath();
          g.roundRect(x, y - 30, w, 40, 8);
          g.fill();
          g.fillStyle = '#ffffff';
          g.fillText(tier, x + 13, y);
          x += w + 10;
        }
        y += 74;
      }
      t.tex.needsUpdate = true;
      const sx = side === 0 ? -1 : 1;
      // on the back wall, either side of the firm's name
      k.bx(3.3, 3.3, 0.1, k.mat(0x141a2e), sx * 6.15, 0.6, -D / 2 + 0.16);
      k.add(new THREE.PlaneGeometry(3.1, 3.1), screen(t.tex), sx * 6.15, 2.25, -D / 2 + 0.23);
    });
    k.plant(-7.2, 5, 1.1);
    k.plant(7.2, 5, 1.1);
    return finish(root, k, {
      id: b.id, title: `${firm.name} · lobby`, sub: 'Plans and prices on the walls · AI support at the desk', indoor: true,
      cam: { pos: v3(root.position.x, root.position.y + 1.6, root.position.z + D / 2 - 1.6), look: v3(root.position.x, root.position.y + 2.1, root.position.z - D / 2), fov: 62 },
      actions: [{ id: 'firmcard:' + firm.id, label: 'Plans & prices' }, { id: 'guard:' + firm.id, label: 'Ask AI support' }],
    });
  }

  /* ---------------- airport terminal: departures hall ---------------- */
  function terminal(b: CityBuilding): Interior {
    const root = new THREE.Group();
    root.position.copy(b.root.position);
    hide(b.body);
    const k = kit(root);
    const X0 = -26;
    const X1 = 6;
    const W = X1 - X0;
    const cx = (X0 + X1) / 2;
    const H = 6.4;
    const white = k.mat(0xf6f7fa, { emissive: 0xffffff, emissiveIntensity: 0.06 });
    k.bx(W, 0.2, 11.4, k.mat(0xdfe4ec, { roughness: 0.2, metalness: 0.1 }), cx, 0.2, 0);
    k.bx(W, 0.3, 11.4, white, cx, H, 0);
    for (let x = X0 + 2; x < X1; x += 4) k.bx(0.3, 0.05, 10, k.mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 1 }), x, H - 0.05, 0);
    k.bx(W, H, 0.3, white, cx, 0, 5.6);
    for (const x of [X0, X1]) k.bx(0.3, H, 11.4, white, x, 0, 0);
    // glass façade toward the apron (-z): frames only
    const frame = k.mat(0x2a3140, { metalness: 0.5, roughness: 0.3 });
    for (let x = X0; x <= X1; x += 2) k.bx(0.12, H, 0.12, frame, x, 0, -5.65);
    k.bx(W, 0.15, 0.15, frame, cx, 0.4, -5.65);
    k.bx(W, 0.15, 0.15, frame, cx, 3.4, -5.65);
    // seats facing the apron
    const seat = k.mat(0x2f6bff, { roughness: 0.6 });
    for (const z of [-2, 0.2, 2.4]) for (let x = X0 + 2; x < X1 - 1; x += 0.75) {
      if (Math.abs(x - (cx - 2)) < 0.8) continue;
      k.rb(0.62, 0.12, 0.6, 0.05, seat, x, 0.6, z);
      k.rb(0.62, 0.6, 0.1, 0.04, seat, x, 0.7, z + 0.28);
    }
    k.plant(X0 + 1, -4.5, 1.2);
    k.plant(X1 - 1, -4.5, 1.2);
    // departures board on the back wall
    const brd = k.tex(1600, 640);
    const board = k.add(new THREE.PlaneGeometry(14, 5.6), screen(brd.tex), cx, 3.4, 5.4);
    board.rotation.y = Math.PI;
    const gate = signPlane('GATES 1–3 · DEPARTURES', 6, 0.7, { bg: '#f2c14e', fg: '#13213f' });
    gate.position.set(cx, 5.4, -5.4);
    gate.rotation.y = Math.PI;
    root.add(gate);
    let acc = 2;
    const draw = () => {
      const g = brd.g;
      g.fillStyle = '#0f1b36';
      g.fillRect(0, 0, 1600, 640);
      g.fillStyle = '#f2c14e';
      g.font = `900 48px ${FONT}`;
      g.fillText('DEPARTURES · ARRIVALS', 40, 70);
      g.font = `700 26px ${FONT}`;
      g.fillStyle = '#9fb3d9';
      g.fillText('FLIGHT', 40, 130); g.fillText('AIRCRAFT', 280, 130); g.fillText('ROUTE', 640, 130); g.fillText('STATUS', 1100, 130);
      d.flights().filter((f) => f.kind === 'airliner').slice(0, 7).forEach((f, i) => {
        const y = 190 + i * 62;
        g.fillStyle = '#ffffff';
        g.font = `800 34px ${FONT}`;
        g.fillText(f.flight, 40, y);
        g.font = `700 30px ${FONT}`;
        g.fillText(f.type.slice(0, 18), 280, y);
        g.fillText((f.to ? `→ ${f.to}` : f.from ? `← ${f.from}` : '—').slice(0, 24), 640, y);
        g.fillStyle = /board|gate|park/i.test(f.status) ? '#2bd4a0' : /land|approach/i.test(f.status) ? '#7fb0ff' : '#f2c14e';
        g.fillText(f.status.slice(0, 22), 1100, y);
      });
      brd.tex.needsUpdate = true;
    };
    draw();
    // a second board hangs over the gate area, facing the hall
    const board2 = k.add(new THREE.PlaneGeometry(7, 2.8), screen(brd.tex), cx - 6, 4.1, -3.6);
    void board2;
    k.bx(0.06, 0.9, 0.06, frame, cx - 9, 5.5, -3.6);
    k.bx(0.06, 0.9, 0.06, frame, cx - 3, 5.5, -3.6);
    const camW = v3(cx - 6, 1.75, 4.6).add(root.position);
    return finish(root, k, {
      id: b.id, title: 'Departures hall', sub: 'FUNDEDCITY International Airport', indoor: true,
      cam: { pos: camW, look: v3(camW.x - 1, 2.6, camW.z - 40), fov: 68 },
      actions: [{ id: 'airport:flights', label: 'Flight board' }, { id: 'airport:ads', label: 'Advertise on aircraft' }],
      update: (dt) => { acc += dt; if (acc > 2) { acc = 0; draw(); } },
    });
  }

  /* ---------------- control tower cab ---------------- */
  function tower(b: CityBuilding): Interior {
    const root = new THREE.Group();
    root.position.copy(b.root.position);
    hide(b.body);
    const k = kit(root);
    const FY = 24.2;
    k.add(new THREE.CylinderGeometry(1.8, 2.4, FY, 16), k.mat(0xf1f3f7), 0, FY / 2, 0);
    k.add(new THREE.CylinderGeometry(3.6, 3.6, 0.2, 24), k.mat(0x2a2f3a, { roughness: 0.4 }), 0, FY, 0);
    k.add(new THREE.CylinderGeometry(3.8, 3.6, 0.4, 24), k.mat(0xf1f3f7), 0, FY + 3.1, 0);
    const frame = k.mat(0x2a3140, { metalness: 0.5, roughness: 0.3 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      k.bx(0.12, 3.0, 0.12, frame, Math.cos(a) * 3.45, FY, Math.sin(a) * 3.45);
    }
    const ring = k.add(new THREE.TorusGeometry(3.45, 0.06, 6, 32), frame, 0, FY + 1.0, 0);
    ring.rotation.x = Math.PI / 2;
    // consoles around the windows, with screens; the radar scope faces the controller
    const lookDir = new THREE.Vector2(-b.root.position.x, -b.root.position.z).normalize();
    const ya = Math.atan2(lookDir.x, lookDir.y);
    const cons = k.mat(0x3a4150, { roughness: 0.5 });
    const scrMat = k.mat(0x0b1530, { emissive: 0x2bd4a0, emissiveIntensity: 0.9 });
    for (let i = -3; i <= 3; i++) {
      const a = ya + i * 0.5;
      const x = Math.sin(a) * 2.75;
      const z = Math.cos(a) * 2.75;
      const c = k.rb(1.2, 0.9, 0.6, 0.05, cons, x, FY + 0.1, z);
      c.rotation.y = a;
      const s = k.add(new THREE.PlaneGeometry(0.9, 0.5), scrMat, x * 0.94, FY + 1.3, z * 0.94);
      s.rotation.y = a + Math.PI;
      s.rotation.x = 0;
    }
    const radar = k.tex(512, 512);
    const rad = k.add(new THREE.PlaneGeometry(1.1, 1.1), screen(radar.tex), Math.sin(ya) * 1.6, FY + 1.05, Math.cos(ya) * 1.6);
    rad.rotation.order = 'YXZ';
    rad.rotation.y = ya + Math.PI;
    rad.rotation.x = -0.7;
    let sweep = 0;
    let acc = 0;
    const drawRadar = (dt: number) => {
      sweep += dt * 1.6;
      acc += dt;
      if (acc < 0.05) return;
      acc = 0;
      const g = radar.g;
      g.fillStyle = '#061a12';
      g.fillRect(0, 0, 512, 512);
      g.strokeStyle = 'rgba(43,212,160,0.35)';
      g.lineWidth = 2;
      for (const r of [80, 160, 240]) { g.beginPath(); g.arc(256, 256, r, 0, Math.PI * 2); g.stroke(); }
      g.beginPath(); g.moveTo(256, 16); g.lineTo(256, 496); g.moveTo(16, 256); g.lineTo(496, 256); g.stroke();
      g.save();
      g.translate(256, 256);
      g.rotate(sweep);
      const grad = g.createLinearGradient(0, 0, 240, 0);
      grad.addColorStop(0, 'rgba(43,212,160,0.6)');
      grad.addColorStop(1, 'rgba(43,212,160,0)');
      g.fillStyle = grad;
      g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 240, -0.3, 0); g.closePath(); g.fill();
      g.restore();
      g.fillStyle = '#7fffd0';
      g.font = `700 16px ${FONT}`;
      for (const f of d.flights()) {
        const x = 256 + (f.pos.x - b.root.position.x) * 0.8;
        const y = 256 + (f.pos.z - b.root.position.z) * 0.8;
        if (x < 10 || x > 502 || y < 10 || y > 502) continue;
        g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill();
        g.fillText(f.flight, x + 8, y - 6);
      }
      radar.tex.needsUpdate = true;
    };
    drawRadar(1);
    const camW = v3(-Math.sin(ya) * 1.2, FY + 1.75, -Math.cos(ya) * 1.2).add(root.position);
    return finish(root, k, {
      id: b.id, title: 'Control tower cab', sub: 'Live radar · the airport and the city below', indoor: true,
      cam: { pos: camW, look: v3(0, 4, 0), fov: 62 },
      actions: [{ id: 'airport:radar', label: 'Radar' }, { id: 'airport:flights', label: 'Flights' }],
      update: (dt) => drawRadar(dt),
    });
  }

  /* ---------------- open-air seats (no room needed) ---------------- */
  function seat(id: string, title: string, sub: string, pos: THREE.Vector3, look: THREE.Vector3, actions: InteriorAction[], fov = 60, props?: (k: ReturnType<typeof kit>) => void): Interior {
    const root = new THREE.Group();
    const k = kit(root);
    props?.(k);
    return finish(root, k, { id, title, sub, indoor: false, cam: { pos, look, fov }, actions });
  }

  function cafeSeat(b: CityBuilding): Interior {
    b.body.updateMatrixWorld(true);
    const pos = b.body.localToWorld(v3(1.2, 1.75, 6.2));
    const look = b.body.localToWorld(v3(1.2, 1.3, 20));
    const tableAt = b.body.localToWorld(v3(1.2, 0.2, 7.0));
    const cupAt = b.body.localToWorld(v3(1.0, 1.27, 6.85));
    return seat(b.id, 'Sip The Dip Cafe · terrace', 'Your coffee’s on the table. Chat with the traders here.', pos, look, [{ id: 'cafe:chat', label: 'Chat' }], 62, (k) => {
      k.add(new THREE.CylinderGeometry(0.45, 0.45, 0.05, 24), k.mat(0xffffff), tableAt.x, 1.12, tableAt.z);
      k.add(new THREE.CylinderGeometry(0.05, 0.05, 0.95, 8), k.mat(0x777777), tableAt.x, 0.62, tableAt.z);
      k.add(new THREE.CylinderGeometry(0.09, 0.07, 0.17, 16), k.mat(0xffffff), cupAt.x, cupAt.y, cupAt.z);
      k.add(new THREE.CylinderGeometry(0.078, 0.078, 0.01, 16), k.mat(0x5a3a22), cupAt.x, cupAt.y + 0.08, cupAt.z);
      k.add(new THREE.CylinderGeometry(0.16, 0.16, 0.01, 20), k.mat(0xf2f2f2), cupAt.x, cupAt.y - 0.085, cupAt.z);
    });
  }


  /* ---------------- THE PLAZA: the mall atrium ---------------- */
  function mallAtrium(): Interior {
    const root = new THREE.Group();
    root.position.copy(OFF).add(v3(200, 0, 200));
    const k = kit(root);
    const W = 16;
    const L = 38;
    const H = 11;
    const G = 5.2; // gallery level
    const cream = k.mat(0xf6f1e8, { emissive: 0xffffff, emissiveIntensity: 0.06 });
    const dark = k.mat(0x2a2a36, { roughness: 0.45 });
    const gold = MAT.gold;
    const glass = k.mat(0xcfe3f2, { transparent: true, opacity: 0.25, roughness: 0.05, metalness: 0.2 });
    // floor with stone strips, end walls, ceiling edges
    k.bx(W + 12, 0.1, L, k.mat(0xe9e3d8, { roughness: 0.2, metalness: 0.05 }), 0, -0.1, 0);
    for (let x = -W / 2 + 2; x < W / 2; x += 3) k.bx(0.12, 0.02, L, k.mat(0xcfc3ad), x, 0, 0);
    k.bx(W + 12, H, 0.3, cream, 0, 0, -L / 2);
    k.bx(W + 12, H, 0.3, cream, 0, 0, L / 2);
    // shops: three a side on the ground floor, one per section, signs facing the atrium
    SECTIONS.forEach((sec, i) => {
      const side = i < 3 ? -1 : 1;
      const z = -L / 2 + 6.5 + (i % 3) * 12.5;
      const col = new THREE.Color(sec.color);
      const xFront = side * (W / 2);
      // shop box (back wall + side walls) in a soft tint of the section colour
      const tint = k.mat(col.clone().lerp(new THREE.Color(0xffffff), 0.72).getHex(), { emissive: col.getHex(), emissiveIntensity: 0.08 });
      k.bx(0.3, G, 11, tint, side * (W / 2 + 5.5), 0, z);
      for (const dz of [-5.6, 5.6]) k.bx(5.5, G, 0.3, cream, side * (W / 2 + 2.75), 0, z + dz);
      // glass front with a dark frame and an open doorway
      k.bx(0.08, 3.6, 4, glass, xFront, 0, z - 3.4);
      k.bx(0.08, 3.6, 4, glass, xFront, 0, z + 3.4);
      k.bx(0.25, 0.3, 11.2, dark, xFront, 3.6, z);
      k.bx(0.3, G - 3.9, 11.2, cream, xFront, 3.9, z);
      const sign = signPlane(sec.label.toUpperCase(), 6.4, 0.9, { bg: '#ffffff', fg: '#1d1b2e', accent: sec.color });
      sign.position.set(xFront - side * 0.17, 4.55, z);
      sign.rotation.y = -side * Math.PI / 2;
      root.add(sign);
      // displays: shelves and product boxes in the section colour
      const prod = k.mat(col.getHex(), { roughness: 0.5, emissive: col.getHex(), emissiveIntensity: 0.12 });
      for (const dz of [-3.5, 0, 3.5]) {
        k.bx(0.8, 2.6, 2.6, k.mat(0xffffff), side * (W / 2 + 5), 0, z + dz);
        for (let y = 0.5; y < 2.6; y += 0.7) for (const pz of [-0.8, 0, 0.8]) k.bx(0.5, 0.42, 0.5, prod, side * (W / 2 + 4.85), y, z + dz + pz);
      }
      k.rb(1.6, 1.0, 2.4, 0.1, k.mat(0xffffff), side * (W / 2 + 2.2), 0, z);
      k.bx(0.9, 0.6, 0.9, prod, side * (W / 2 + 2.2), 1.0, z);
    });
    // gallery level: slabs, glass balustrade with a gold rail, warm shop windows above
    for (const side of [-1, 1]) {
      k.bx(5, 0.35, L, cream, side * (W / 2 + 0.5), G, 0);
      k.bx(0.06, 1.05, L, glass, side * (W / 2 - 2), G + 0.35, 0);
      k.bx(0.12, 0.08, L, gold, side * (W / 2 - 2), G + 1.4, 0);
      k.bx(0.3, H - G, L, cream, side * (W / 2 + 3), G, 0);
      for (let z = -L / 2 + 4; z < L / 2 - 2; z += 6.2) {
        k.bx(0.1, 2.6, 4.6, k.mat(0xfff2d6, { emissive: 0xffe2a8, emissiveIntensity: 0.55 }), side * (W / 2 + 2.84), G + 0.6, z);
      }
    }
    // barrel-vault skylight with ribs
    const vault = k.add(new THREE.CylinderGeometry(W / 2 + 3, W / 2 + 3, L, 32, 1, true, Math.PI / 2, Math.PI), k.mat(0xbfe0f7, { transparent: true, opacity: 0.45, side: THREE.DoubleSide, emissive: 0x9fd0f2, emissiveIntensity: 0.6 }), 0, H, 0);
    vault.rotation.x = Math.PI / 2;
    for (let z = -L / 2; z <= L / 2; z += L / 8) k.add(new THREE.TorusGeometry(W / 2 + 3, 0.09, 6, 32, Math.PI), k.mat(0xffffff), 0, H, z);
    // escalators up to a bridge between the galleries, at the far end of the atrium
    const stepMat = k.mat(0x9aa3b1, { metalness: 0.5, roughness: 0.4 });
    const EZ = -9;
    for (const sx of [-1.1, 1.1]) {
      const esc = k.add(box(1.6, 0.25, 9.4).clone(), stepMat, sx, G / 2, EZ);
      esc.rotation.x = Math.atan2(G, 8.4);
      for (const ex of [-0.85, 0.85]) {
        const side = k.add(box(0.08, 1.0, 9.4).clone(), glass, sx + ex, G / 2 + 0.55, EZ);
        side.rotation.x = esc.rotation.x;
      }
    }
    k.bx(W - 4, 0.35, 3, cream, 0, G, EZ - 5.6);
    k.bx(W - 4, 1.05, 0.06, glass, 0, G + 0.35, EZ - 4.1);
    k.bx(W - 4, 0.08, 0.12, gold, 0, G + 1.4, EZ - 4.1);
    // info kiosk and the fee banner
    k.add(new THREE.CylinderGeometry(1.6, 1.7, 1.1, 32), k.mat(0xffffff), 0, 0.55, 3);
    k.add(new THREE.CylinderGeometry(1.62, 1.62, 0.08, 32), gold, 0, 1.12, 3);
    const kiosk = signPlane('INFO · SELL HERE', 2.6, 0.5, { bg: '#1d1b2e', fg: '#f2c14e' });
    kiosk.position.set(0, 1.75, 4.62);
    root.add(kiosk);
    k.add(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 8), k.mat(0x1d1b2e), 0, 1.4, 4.0);
    const banner = signPlane('0 LISTING FEES', 9, 2.4, { bg: '#1d1b2e', fg: '#ffffff', sub: '75% TO THE SELLER · 25% TO THE PLAZA', subColor: '#f2c14e' });
    banner.position.set(0, 8.4, -L / 2 + 0.3);
    root.add(banner);
    const welcome = signPlane('THE PLAZA', 5, 0.9, { bg: '#f2c14e', fg: '#1d1b2e' });
    welcome.position.set(0, 6.95, -L / 2 + 0.3);
    root.add(welcome);
    // planters, benches and shoppers
    for (const z of [-14, 12]) for (const x of [-4.2, 4.2]) k.plant(x, z, 1.3);
    const wood = k.mat(0xb98a5a);
    for (const z of [-1.5, 9.5]) k.rb(0.6, 0.45, 2.6, 0.08, wood, -5.2, 0, z);
    const ppl = [[-3.4, -2], [2.6, -4], [-5.5, -6], [5, 0], [-2.2, 8], [3.6, 12.5], [-4.8, 11], [5.6, 6.5]];
    const tops = [0x2f6bff, 0xf2c14e, 0x14b88a, 0xe0457b, 0xffffff, 0x7c5cff, 0xff7a45, 0x13213f];
    ppl.forEach(([x, z], i) => {
      k.bx(0.4, 0.85, 0.26, k.mat(0x2a3140), x, 0, z);
      k.rb(0.52, 0.75, 0.32, 0.1, k.mat(tops[i]), x, 0.85, z);
      k.add(new THREE.SphereGeometry(0.21, 10, 8), k.mat([0xd9a77e, 0x8d5a3b, 0xf1c7a5][i % 3]), x, 1.82, z);
      k.bx(0.28, 0.32, 0.12, k.mat(new THREE.Color(SECTIONS[i % 6].color).getHex()), x + 0.35, 0.5, z);
    });
    return finish(root, k, {
      id: 'the-plaza', title: 'THE PLAZA · the atrium', sub: 'Six sections · 0 listing fees · 75% to sellers', indoor: true,
      cam: { pos: v3(root.position.x + 0.6, root.position.y + 2.1, root.position.z + L / 2 - 1.2), look: v3(root.position.x, root.position.y + 3.6, root.position.z - L / 2), fov: 66 },
      actions: [{ id: 'plaza:shop', label: 'Shop' }, { id: 'plaza:sell', label: 'Sell' }, { id: 'plaza:basket', label: 'Basket' }, { id: 'plaza:rules', label: 'Fees & rules' }],
    });
  }

  /* ---------------- Trading Floor: the five pits ---------------- */
  function tradingPits(ticker: THREE.Texture): Interior {
    const root = new THREE.Group();
    root.position.copy(OFF).add(v3(-200, 0, 200));
    const k = kit(root);
    const R = 15;
    const H = 9;
    const navy = k.mat(0x111a2e, { roughness: 0.5, emissive: 0x111a2e, emissiveIntensity: 0.4 });
    k.add(new THREE.CylinderGeometry(R, R, 0.1, 64), k.mat(0x1a2236, { roughness: 0.25, metalness: 0.3 }), 0, -0.05, 0);
    k.add(new THREE.CylinderGeometry(R, R, H, 64, 1, true), k.mat(0x151d31, { side: THREE.BackSide, emissive: 0x151d31, emissiveIntensity: 0.5 }), 0, H / 2, 0);
    k.add(new THREE.CylinderGeometry(R, R, 0.2, 64), navy, 0, H, 0);
    for (const y of [2.6, 6.4]) {
      const strip = k.add(new THREE.TorusGeometry(R - 0.1, 0.05, 6, 96), k.mat(0x0b2a3a, { emissive: 0x3d7bff, emissiveIntensity: 1.1 }), 0, y, 0);
      strip.rotation.x = Math.PI / 2;
    }
    // skylight
    k.add(new THREE.CircleGeometry(5, 48), k.mat(0xbfe0f7, { emissive: 0x9fd0f2, emissiveIntensity: 0.9, side: THREE.DoubleSide }), 0, H - 0.05, 0).rotation.x = Math.PI / 2;
    // the ticker ring hanging in the middle (the same LED feed as the drum outside)
    const ring = k.add(new THREE.CylinderGeometry(3.6, 3.6, 1.1, 48, 1, true), new THREE.MeshBasicMaterial({ map: ticker, toneMapped: false }), 0, 6.6, -3);
    void ring;
    // wall screens: sample charts, labelled
    const chart = k.tex(512, 288);
    const g = chart.g;
    g.fillStyle = '#071226';
    g.fillRect(0, 0, 512, 288);
    let s = 5;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    let p = 150;
    for (let i = 0; i < 40; i++) {
      const o = p;
      const c = o + (rnd() - 0.52) * 22;
      g.fillStyle = c < o ? '#2bd4a0' : '#ff6b6f';
      g.fillRect(14 + i * 12, Math.min(o, c), 8, Math.max(2, Math.abs(c - o)));
      p = Math.max(50, Math.min(240, c));
    }
    g.fillStyle = 'rgba(255,255,255,0.4)';
    g.font = `800 20px ${FONT}`;
    g.fillText('SAMPLE CHART · IDEAS, NOT ADVICE', 14, 276);
    chart.tex.needsUpdate = true;
    for (const a of [-1.15, -0.4, 0.4, 1.15]) {
      const sc = k.add(new THREE.PlaneGeometry(5, 2.8), screen(chart.tex), Math.sin(a) * (R - 0.25), 5.2, -Math.cos(a) * (R - 0.25));
      sc.rotation.y = -a;
    }
    // the pits: a ring of desks with monitors, a glowing floor ring and a hanging sign each
    const mon = k.mat(0x0b1220, { emissive: 0x2b5bd6, emissiveIntensity: 0.45 });
    const desk = k.mat(0x2a3346, { roughness: 0.5 });
    const pits = [[-9.6, -2.2], [-5, -6.6], [0, -8.4], [5, -6.6], [9.6, -2.2]];
    const skin = [0xd9a77e, 0x8d5a3b, 0xf1c7a5, 0xb98463, 0x6b4428];
    ROOMS.forEach((r, i) => {
      const [x, z] = pits[i];
      const glow = k.mat(r.hex, { emissive: r.hex, emissiveIntensity: 1.1 });
      const fl = k.add(new THREE.RingGeometry(2.3, 2.6, 48), glow, x, 0.02, z);
      fl.rotation.x = -Math.PI / 2;
      for (let j = 0; j < 6; j++) {
        const a = (j / 6) * Math.PI * 2 + 0.3;
        const dx = Math.sin(a) * 1.55;
        const dz = Math.cos(a) * 1.55;
        k.rb(1.3, 0.85, 0.6, 0.06, desk, x + dx, 0, z + dz, a);
        const m = k.add(new THREE.PlaneGeometry(0.62, 0.38), mon, x + Math.sin(a) * 1.35, 1.12, z + Math.cos(a) * 1.35, a);
        void m;
        // a trader at every other desk, standing outside the ring
        if (j % 2 === 0) {
          const px = x + Math.sin(a) * 2.2;
          const pz = z + Math.cos(a) * 2.2;
          k.bx(0.4, 0.85, 0.26, k.mat(0x2a3140), px, 0, pz, a);
          k.rb(0.52, 0.75, 0.32, 0.1, k.mat((i * 3 + j) % 2 ? 0xffffff : r.hex), px, 0.85, pz, a);
          k.add(new THREE.SphereGeometry(0.21, 10, 8), k.mat(skin[(i + j) % 5]), px, 1.82, pz);
        }
      }
      k.add(new THREE.CylinderGeometry(0.03, 0.03, 2.6, 6), k.mat(0x888888), x, H - 1.3, z);
      const sign = signPlane(`${r.label} PIT`, 3.2, 0.9, { bg: '#0d1424', fg: '#ffffff', accent: r.color });
      sign.position.set(x, 5.4, z + 0.03);
      root.add(sign);
      const back = signPlane(`${r.label} PIT`, 3.2, 0.9, { bg: '#0d1424', fg: '#ffffff', accent: r.color });
      back.position.set(x, 5.4, z - 0.03);
      back.rotation.y = Math.PI;
      root.add(back);
    });
    const title = signPlane('TRADING FLOOR', 8, 1.2, { bg: '#0d1424', fg: '#ffffff', sub: 'IDEAS · ENTRIES · EXITS · CHARTS', subColor: '#7fb0ff' });
    title.position.set(0, 7.9, -R + 0.6);
    root.add(title);
    return finish(root, k, {
      id: 'trading-floor', title: 'Trading Floor · the pits', sub: 'Pick a pit and talk trades · ideas, not advice', indoor: true,
      cam: { pos: v3(root.position.x, root.position.y + 3.7, root.position.z + R - 2.2), look: v3(root.position.x, root.position.y + 2.6, root.position.z - 6), fov: 66 },
      actions: ROOMS.map((r) => ({ id: 'floor:' + r.id, label: r.label })),
    });
  }

  /* ---------------- City Hall: the council chamber ---------------- */
  function councilChamber(boardTex: THREE.Texture, clockTex: THREE.Texture): Interior {
    const root = new THREE.Group();
    root.position.copy(OFF).add(v3(0, 0, -200));
    const k = kit(root);
    const W = 24;
    const D = 22;
    const H = 9;
    const stone = k.mat(0xf3eee4, { emissive: 0xffffff, emissiveIntensity: 0.05 });
    const wood = k.mat(0x6b4428, { roughness: 0.55 });
    const leather = k.mat(0x1f3b63, { roughness: 0.8 });
    const gold = MAT.gold;
    k.bx(W, 0.1, D, k.mat(0x8a2f2f, { roughness: 0.9 }), 0, -0.1, 0); // red carpet floor
    k.bx(W, 0.2, D, stone, 0, H, 0);
    for (const sx of [-1, 1]) k.bx(0.3, H, D, stone, sx * W / 2, 0, 0);
    k.bx(W, H, 0.3, stone, 0, 0, D / 2);
    k.bx(W, H, 0.3, k.mat(0xece4d4), 0, 0, -D / 2);
    // coffered dome over the chamber
    k.add(new THREE.SphereGeometry(7, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), k.mat(0xf7f2e8, { side: THREE.BackSide, emissive: 0xfff4dc, emissiveIntensity: 0.25 }), 0, H, -1);
    const oculus = k.add(new THREE.CircleGeometry(1.4, 32), k.mat(0xfff7e0, { emissive: 0xffe9b0, emissiveIntensity: 1.2, side: THREE.DoubleSide }), 0, H + 6.9, -1);
    oculus.rotation.x = Math.PI / 2;
    const dring = k.add(new THREE.TorusGeometry(7, 0.18, 8, 64), gold, 0, H, -1);
    dring.rotation.x = Math.PI / 2;
    // columns and tall windows along the sides
    const win = windowView(k, night());
    for (const sx of [-1, 1]) for (const z of [-7, -1, 5]) {
      k.add(new THREE.CylinderGeometry(0.38, 0.44, H, 16), stone, sx * (W / 2 - 1.2), H / 2, z);
      k.bx(1.0, 0.3, 1.0, gold, sx * (W / 2 - 1.2), H - 0.5, z);
    }
    for (const sx of [-1, 1]) for (const z of [-4, 2]) {
      const wm = k.add(new THREE.PlaneGeometry(2.4, 4.6), win, sx * (W / 2 - 0.17), 4.4, z, -sx * Math.PI / 2);
      void wm;
    }
    // the dais: platform, lectern, the mayor's chair, flags, the seal, the screen and the clock
    k.rb(12, 0.6, 4.2, 0.1, wood, 0, 0, -D / 2 + 2.6);
    k.rb(12.2, 0.08, 4.4, 0.04, gold, 0, 0.6, -D / 2 + 2.6);
    k.rb(1.4, 1.2, 0.8, 0.08, wood, 0, 0.68, -D / 2 + 4.2);
    k.bx(1.5, 0.06, 0.9, gold, 0, 1.88, -D / 2 + 4.2);
    k.rb(1.3, 0.5, 1.1, 0.1, leather, 0, 0.68, -D / 2 + 1.5);
    k.rb(1.3, 2.4, 0.25, 0.1, leather, 0, 0.68, -D / 2 + 1.0);
    k.add(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 16), gold, 0, 3.15, -D / 2 + 0.94).rotation.x = Math.PI / 2;
    for (const [sx, col] of [[-1, 0x2f6bff], [1, 0xe6b95a]] as const) {
      k.add(new THREE.CylinderGeometry(0.05, 0.06, 3.6, 8), gold, sx * 5.2, 2.4, -D / 2 + 1.4);
      k.bx(0.04, 1.4, 1.0, k.mat(col), sx * 5.2, 2.6, -D / 2 + 1.95);
    }
    k.add(new THREE.PlaneGeometry(7.2, 4.6), screen(boardTex), 0, 5.6, -D / 2 + 0.2);
    k.bx(7.6, 5.0, 0.12, k.mat(0x1d2433), 0, 3.1, -D / 2 + 0.12);
    k.add(new THREE.CircleGeometry(0.95, 40), screen(clockTex), 8, 6.4, -D / 2 + 0.2);
    k.add(new THREE.CircleGeometry(0.95, 40), screen(clockTex), -8, 6.4, -D / 2 + 0.2);
    const name = signPlane('FUNDEDCITY COUNCIL', 7, 0.6, { bg: '#f3eee4', fg: '#22314f' });
    name.position.set(0, 8.45, -D / 2 + 0.2);
    root.add(name);
    // curved benches in tiers facing the dais
    const cz = -D / 2 + 2.6;
    [5.6, 7.6, 9.6].forEach((r, row) => {
      const y = row * 0.32;
      if (y > 0) for (let a = -1.0; a <= 1.0; a += 0.1) k.bx(1.1, y, 1.9, wood, Math.sin(a) * r, 0, cz + Math.cos(a) * r, -a);
      for (let a = -0.95; a <= 0.96; a += 0.19) {
        const x = Math.sin(a) * r;
        const z = cz + Math.cos(a) * r;
        k.rb(1.6, 0.75, 0.55, 0.06, wood, x, y, z - 0.45 * Math.cos(a), -a);
        k.rb(0.55, 0.45, 0.5, 0.08, leather, x, y, z + 0.2 * Math.cos(a), -a);
      }
    });
    return finish(root, k, {
      id: 'city-hall', title: 'City Hall · council chamber', sub: 'Announcements, votes and the mayoral election', indoor: true,
      cam: { pos: v3(root.position.x + 0.5, root.position.y + 3.6, root.position.z + D / 2 - 1.4), look: v3(root.position.x, root.position.y + 3.4, root.position.z - D / 2), fov: 64 },
      actions: [{ id: 'hall:news', label: 'Announcements' }, { id: 'hall:reviews', label: 'Reviews' }, { id: 'hall:votes', label: 'Votes' }, { id: 'hall:mayor', label: 'Mayor' }, { id: 'hall:rules', label: 'Rules' }],
    });
  }

  return {
    home, penthouse, bank, lobby, terminal, tower, cafeSeat, seat, missionControl, mallAtrium, tradingPits, councilChamber,
    statueCrown(): Interior {
      const s = d.statue;
      return seat('statue-of-liberty', 'Set For Life Statue · the crown', 'The whole city from the bay', v3(s.x + 1.2, s.height * 0.86, s.z - 1.2), v3(20, 8, -10), [], 58);
    },
  };
}

export type Interiors = ReturnType<typeof createInteriors>;
