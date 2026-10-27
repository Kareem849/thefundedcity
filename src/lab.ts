// THE LAB: where prop firms rent a bay to launch limited-time offers and experiments for traders.
// A NASA-style campus on the City Spaces block (next to Kareem Capital): mission control, a geodesic dome,
// a rocket on its launch pad, a tracking dish, and four launch bays whose screens count down each
// experiment (time left, or releases left). The same bay screens fill the mission-control wall inside.
import * as THREE from 'three';
import { mesh, box, rbox, signPlane, makeBuildingMaterials, getGlassMaterial } from './buildings';
import { bake, noBake } from './bake';

/* ---------------- experiments ---------------- */
export interface Experiment {
  id: string;
  firm: string;
  firmId?: string;
  sample: boolean;
  publishedBy?: string;
  title: string;
  /** what traders get */
  offer: string;
  /** count down to a time, or count releases (accounts / slots) left */
  kind: 'time' | 'releases';
  startsAt: number;
  endsAt: number;
  releasesTotal?: number;
  releasesLeft?: number;
  conditions: string[];
  code?: string;
  link?: string;
}
export type ExpStatus = 'live' | 'soon' | 'ended';
const DAY = 86_400_000;

/** Releases left right now (sample experiments tick down on their own; firms update theirs). */
export function releasesLeft(e: Experiment, now = Date.now()) {
  if (e.kind !== 'releases') return null;
  if (!e.sample) return Math.max(0, e.releasesLeft ?? e.releasesTotal ?? 0);
  const total = e.releasesTotal ?? 100;
  const per = (e.endsAt - e.startsAt) / total;
  return Math.max(0, Math.min(total, total - Math.floor((now - e.startsAt) / Math.max(1, per)) + Math.floor(total * 0.35)));
}
export function expStatus(e: Experiment, now = Date.now()): ExpStatus {
  if (now < e.startsAt) return 'soon';
  if (now > e.endsAt) return 'ended';
  if (e.kind === 'releases' && releasesLeft(e, now) === 0) return 'ended';
  return 'live';
}
export function countdownText(ms: number) {
  if (ms <= 0) return '00:00:00';
  const d = Math.floor(ms / DAY);
  const h = Math.floor((ms % DAY) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d ? d + 'd ' : ''}${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** SAMPLE experiments, positioned relative to now so some are always live. */
export function sampleExperiments(now = Date.now()): Experiment[] {
  const h0 = Math.floor(now / 3_600_000) * 3_600_000;
  return [
    {
      id: 's-zero-fee', firm: 'Sample firm', sample: true, title: 'Zero-Fee Reset Experiment', kind: 'time', startsAt: h0 - 20 * 3_600_000, endsAt: h0 + 52 * 3_600_000,
      offer: 'Free resets on any $100K 2-step challenge bought during the experiment',
      conditions: ['New challenges only', 'One free reset per account', 'Standard drawdown rules apply', 'Ends when the timer hits zero'],
    },
    {
      id: 's-100-accounts', firm: 'Sample firm', sample: true, title: '100 Instant-Funded Seats', kind: 'releases', startsAt: h0 - 30 * 3_600_000, endsAt: h0 + 5 * DAY, releasesTotal: 100,
      offer: '100 instant-funded $50K accounts at 40% off: first come, first served',
      conditions: ['Verified FUNDEDCITY payout history of $10K+', 'One seat per trader', '90/10 split after the first payout', 'Seats can’t be transferred'],
    },
    {
      id: 's-news-lab', firm: 'Sample firm', sample: true, title: 'News-Trading Sandbox', kind: 'time', startsAt: h0 + 6 * 3_600_000, endsAt: h0 + 4 * DAY,
      offer: 'Trade high-impact news on a test account with live-style spreads: top 10 get a funded account',
      conditions: ['Free entry', 'NFP, CPI and FOMC weeks only', 'Max 2% risk per trade', 'Ranked by risk-adjusted return'],
    },
    {
      id: 's-scaling', firm: 'Sample firm', sample: true, title: 'Fast-Track Scaling Trial', kind: 'releases', startsAt: h0 - 3 * DAY, endsAt: h0 + 9 * DAY, releasesTotal: 40,
      offer: 'Scale from $100K to $400K after two profitable months instead of four',
      conditions: ['Two consecutive profitable months', 'Consistency score above 60%', 'Max 40 traders in the trial'],
    },
  ];
}

/* ---------------- 3D campus ---------------- */
export const LAB = { x: -58, z: 0, w: 15, d: 35 };
const FONT = 'Manrope, Inter, system-ui, sans-serif';

function canvasTex(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { c, g: c.getContext('2d')!, tex };
}

export function buildLab() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const mats = makeBuildingMaterials();
  mats.white.color.setHex(0xf6f8fb);
  const white = mats.white;
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a2236, roughness: 0.4, metalness: 0.4 });
  const cyan = new THREE.MeshStandardMaterial({ color: 0x0b2a3a, emissive: 0x31d8ff, emissiveIntensity: 1.2, roughness: 0.3 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xc9d0da, roughness: 0.35, metalness: 0.7 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x2f6bff, roughness: 0.4, metalness: 0.2 });
  const obstacles: Array<{ kind: 'rect'; x: number; z: number; hw: number; hd: number } | { kind: 'circle'; x: number; z: number; r: number }> = [];
  // base platform with a glowing edge
  const base = mesh(rbox(LAB.w - 1, 0.3, LAB.d - 1, 0.4), new THREE.MeshStandardMaterial({ color: 0xe9edf3, roughness: 0.6 }), false);
  base.position.y = 0.15;
  const edge = mesh(rbox(LAB.w - 0.6, 0.12, LAB.d - 0.6, 0.4), cyan, false);
  edge.position.y = 0.06;
  body.add(base, edge);

  // mission control (middle): low white block, glass front facing Capital Square (+x), big sign on the roof
  const mc = mesh(rbox(8, 4.2, 11, 0.5), white);
  mc.position.set(-1.8, 0.3 + 2.1, -1);
  const mcGlass = mesh(box(0.12, 2.6, 9.4), getGlassMaterial());
  mcGlass.position.set(2.24, 0.3 + 1.7, -1);
  const mcBand = mesh(box(8.1, 0.18, 11.1), cyan, false);
  mcBand.position.set(-1.8, 0.3 + 3.6, -1);
  const sign = signPlane('THE LAB', 7.5, 1.7, { bg: '#0b1530', fg: '#ffffff', sub: 'OFFERS · EXPERIMENTS · LAUNCHES', subColor: '#31d8ff' });
  sign.position.set(-1.8 + 0.07, 0.3 + 5.4, -1);
  sign.rotation.y = Math.PI / 2;
  const signBack = sign.clone();
  signBack.rotation.y = -Math.PI / 2;
  signBack.position.x = -1.8 - 0.07;
  const signFrame = mesh(box(0.1, 1.9, 7.7), dark, false);
  signFrame.position.set(-1.83, 0.3 + 5.4, -1);
  for (const z of [-4, 2]) {
    const leg = mesh(box(0.14, 1.2, 0.14), steel);
    leg.position.set(-1.8, 0.3 + 4.4, z);
    body.add(leg);
  }
  body.add(mc, mcGlass, mcBand, sign, signBack, signFrame);
  obstacles.push({ kind: 'rect', x: LAB.x - 1.8, z: LAB.z - 1, hw: 4.3, hd: 5.8 });

  // geodesic dome (south end) with a strut frame
  const dome = new THREE.Group();
  const shell = mesh(new THREE.SphereGeometry(4.6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.55 }));
  const struts = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(4.65, 1)), new THREE.LineBasicMaterial({ color: 0x8aa0c0 }));
  const domeRing = mesh(new THREE.CylinderGeometry(4.75, 4.75, 0.4, 32), white);
  domeRing.position.y = 0.2;
  const core = mesh(new THREE.CylinderGeometry(0.6, 0.6, 2.4, 16), cyan, false);
  core.position.y = 1.5;
  dome.add(shell, domeRing, core);
  dome.position.set(-1.5, 0.3, 11.2);
  noBake(struts);
  body.add(dome);
  // only the upper half of the icosahedron edges (above ground)
  const pos = struts.geometry.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) < 0) pos.setY(i, 0);
  root.add(struts);
  struts.position.set(-1.5, 0.3, 11.2);
  obstacles.push({ kind: 'circle', x: LAB.x - 1.5, z: LAB.z + 11.2, r: 4.9 });
  // orbit ring hologram above the dome
  const holo = mesh(new THREE.TorusGeometry(5.6, 0.06, 6, 64), cyan, false);
  holo.rotation.x = Math.PI / 2.3;
  holo.position.set(-1.5, 6.2, 11.2);
  noBake(holo);
  root.add(holo);

  // rocket on its launch pad (north end)
  const padX = -2.4;
  const padZ = -12.8;
  const pad = mesh(new THREE.CylinderGeometry(3, 3.2, 0.5, 24), new THREE.MeshStandardMaterial({ color: 0x9aa3b1, roughness: 0.8 }));
  pad.position.set(padX, 0.55, padZ);
  const tower = mesh(box(0.7, 13, 0.7), steel);
  tower.position.set(padX - 2.3, 0.8 + 6.5, padZ);
  for (let y = 2; y < 13; y += 2) {
    const arm = mesh(box(1.6, 0.12, 0.12), steel);
    arm.position.set(padX - 1.6, 0.8 + y, padZ);
    body.add(arm);
  }
  body.add(pad, tower);
  obstacles.push({ kind: 'circle', x: LAB.x + padX, z: LAB.z + padZ, r: 3.3 });
  const rocket = new THREE.Group();
  const rBody = mesh(new THREE.CylinderGeometry(0.85, 0.85, 8, 20), white);
  rBody.position.y = 4;
  const rStripe = mesh(new THREE.CylinderGeometry(0.87, 0.87, 0.5, 20), dark, false);
  rStripe.position.y = 6.2;
  const nose = mesh(new THREE.ConeGeometry(0.85, 2.4, 20), blue);
  nose.position.y = 9.2;
  const rText = signPlane('THE LAB', 1.2, 4.2, { bg: '#ffffff', fg: '#0b1530' });
  rText.rotation.y = Math.PI / 2;
  rText.position.set(0.87, 3.6, 0);
  rText.rotation.z = Math.PI / 2;
  for (let i = 0; i < 4; i++) {
    const fin = mesh(box(0.1, 1.6, 1.0), blue);
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    fin.position.set(Math.cos(a) * 0.95, 0.9, Math.sin(a) * 0.95);
    fin.rotation.y = -a;
    rocket.add(fin);
  }
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0, toneMapped: false });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.7, 3, 16), flameMat);
  flame.rotation.x = Math.PI;
  flame.position.y = -1.4;
  rocket.add(rBody, rStripe, nose, rText, flame);
  rocket.position.set(padX, 0.8, padZ);
  noBake(rocket);
  root.add(rocket);

  // tracking dish (north-west corner)
  const dish = new THREE.Group();
  const dishPost = mesh(new THREE.CylinderGeometry(0.25, 0.4, 3, 10), steel);
  dishPost.position.y = 1.5;
  const bowl = mesh(new THREE.SphereGeometry(2.2, 24, 10, 0, Math.PI * 2, 0, 0.9), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, side: THREE.DoubleSide }));
  bowl.rotation.x = Math.PI;
  const feed = mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), steel);
  feed.position.y = -1.1;
  const head = new THREE.Group();
  head.add(bowl, feed);
  head.position.y = 3.6;
  head.rotation.x = -0.9;
  dish.add(dishPost, head);
  dish.position.set(4.2, 0.3, -14.6);
  noBake(dish);
  root.add(dish);

  // four launch bays along the Capital Square side, each with a countdown screen
  const bayZ = [-9.5, -3.2, 3.1, 9.4];
  const screens = bayZ.map((z, i) => {
    const t = canvasTex(512, 640);
    const ped = mesh(rbox(2.6, 0.4, 2.6, 0.2), white);
    ped.position.set(4.4, 0.3 + 0.2, z);
    const ring = mesh(new THREE.TorusGeometry(1.15, 0.07, 6, 32), cyan, false);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(4.4, 0.75, z);
    const frame = mesh(rbox(0.22, 3.4, 2.8, 0.08), dark);
    frame.position.set(4.4, 0.7 + 1.9, z);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.25), new THREE.MeshBasicMaterial({ map: t.tex, toneMapped: false }));
    scr.position.set(4.52, 0.7 + 1.9, z);
    scr.rotation.y = Math.PI / 2;
    const back = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.25), new THREE.MeshBasicMaterial({ map: t.tex, toneMapped: false }));
    back.position.set(4.28, 0.7 + 1.9, z);
    back.rotation.y = -Math.PI / 2;
    const tag = signPlane(`BAY ${'ABCD'[i]}`, 1.4, 0.42, { bg: '#31d8ff', fg: '#0b1530' });
    tag.position.set(4.52, 0.7 + 3.85, z);
    tag.rotation.y = Math.PI / 2;
    body.add(ped, ring, frame, tag);
    noBake(scr);
    noBake(back);
    root.add(scr, back);
    obstacles.push({ kind: 'rect', x: LAB.x + 4.4, z: LAB.z + z, hw: 1.4, hd: 1.4 });
    return t;
  });
  bake(body);

  /* draw a bay screen */
  const drawBay = (i: number, e: Experiment | null, now: number) => {
    const { g, tex } = screens[i];
    const grad = g.createLinearGradient(0, 0, 0, 640);
    grad.addColorStop(0, '#071226');
    grad.addColorStop(1, '#0b2440');
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 640);
    g.strokeStyle = 'rgba(49,216,255,0.15)';
    g.lineWidth = 1;
    for (let x = 0; x < 512; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 640); g.stroke(); }
    for (let y = 0; y < 640; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
    g.fillStyle = '#31d8ff';
    g.font = `800 26px ${FONT}`;
    g.fillText(`BAY ${'ABCD'[i]} · ${e ? (expStatus(e, now) === 'soon' ? 'LAUNCHING SOON' : 'LIVE EXPERIMENT') : 'AVAILABLE TO RENT'}`, 28, 52);
    if (!e) {
      g.fillStyle = '#ffffff';
      g.font = `900 52px ${FONT}`;
      g.fillText('YOUR', 28, 250);
      g.fillText('OFFER', 28, 310);
      g.fillText('HERE', 28, 370);
      g.fillStyle = '#9fb3d9';
      g.font = `700 24px ${FONT}`;
      g.fillText('Firms: rent this bay', 28, 440);
      g.fillText('inside THE LAB', 28, 474);
      tex.needsUpdate = true;
      return;
    }
    g.fillStyle = e.sample ? '#9fb3d9' : '#f2c14e';
    g.font = `800 24px ${FONT}`;
    g.fillText((e.sample ? 'SAMPLE · ' : '') + e.firm.toUpperCase().slice(0, 26), 28, 104);
    g.fillStyle = '#ffffff';
    g.font = `900 40px ${FONT}`;
    const words = e.title.split(' ');
    let line = '';
    let y = 160;
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (g.measureText(t).width > 456 && line) { g.fillText(line, 28, y); y += 46; line = w; if (y > 260) break; }
      else line = t;
    }
    if (y <= 260) g.fillText(line, 28, y);
    const st = expStatus(e, now);
    g.fillStyle = '#31d8ff';
    g.font = `800 24px ${FONT}`;
    g.fillText(e.kind === 'releases' ? 'RELEASES LEFT' : st === 'soon' ? 'LAUNCHES IN' : 'ENDS IN', 28, 352);
    g.fillStyle = '#ffffff';
    g.font = `900 ${e.kind === 'releases' ? 110 : 70}px ${FONT}`;
    const big = e.kind === 'releases' ? `${releasesLeft(e, now)}` : countdownText((st === 'soon' ? e.startsAt : e.endsAt) - now);
    g.fillText(big, 28, e.kind === 'releases' ? 460 : 440);
    if (e.kind === 'releases') {
      g.fillStyle = '#9fb3d9';
      g.font = `700 26px ${FONT}`;
      g.fillText(`of ${e.releasesTotal}`, 32, 500);
      const left = releasesLeft(e, now) ?? 0;
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.fillRect(28, 530, 456, 16);
      g.fillStyle = '#2bd4a0';
      g.fillRect(28, 530, 456 * (left / Math.max(1, e.releasesTotal ?? 1)), 16);
    } else {
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.fillRect(28, 470, 456, 16);
      const k = st === 'soon' ? 0 : Math.min(1, (now - e.startsAt) / Math.max(1, e.endsAt - e.startsAt));
      g.fillStyle = '#f2c14e';
      g.fillRect(28, 470, 456 * (1 - k), 16);
    }
    g.fillStyle = '#7fe0b8';
    g.font = `700 22px ${FONT}`;
    g.fillText('Conditions & Lab AI inside', 28, 604);
    tex.needsUpdate = true;
  };

  let bays: Array<Experiment | null> = [null, null, null, null];
  let acc = 1;
  let launchT = -1;
  return {
    root,
    body,
    mats,
    height: 13.6,
    radius: 10,
    obstacles,
    /** the bay screens (shared with the mission-control interior) */
    screenTextures: screens.map((s) => s.tex),
    setBays(list: Array<Experiment | null>) { bays = list.slice(0, 4); while (bays.length < 4) bays.push(null); acc = 1; },
    /** a new experiment launched: the rocket lifts off, then is back on the pad */
    launch() { launchT = 0; },
    update(dt: number, t: number) {
      acc += dt;
      if (acc >= 1) {
        acc = 0;
        const now = Date.now();
        bays.forEach((e, i) => drawBay(i, e, now));
      }
      head.rotation.y = Math.sin(t * 0.15) * 1.2;
      holo.rotation.z = t * 0.3;
      core.scale.y = 1 + Math.sin(t * 2) * 0.05;
      if (launchT >= 0) {
        launchT += dt;
        const k = launchT;
        flameMat.opacity = k < 6 ? 0.9 : 0;
        flame.scale.setScalar(1 + Math.sin(t * 40) * 0.15);
        rocket.position.y = 0.8 + (k > 1 ? Math.pow(k - 1, 2.2) * 2.2 : 0);
        if (k > 6) {
          rocket.visible = false;
          if (k > 8) { rocket.visible = true; rocket.position.y = 0.8; launchT = -1; flameMat.opacity = 0; }
        }
      }
    },
  };
}
export type Lab = ReturnType<typeof buildLab>;
