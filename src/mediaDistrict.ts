// MEDIA DISTRICT (north-east): an open-air theater with a giant screen, a live price ticker and a red
// URGENT news crawl, the Media Center newsroom with its economic-calendar board, and a countdown pylon.
import * as THREE from 'three';
import { MAT, mesh, rbox, box, makeBuildingMaterials, type BuildingMaterials } from './buildings';
import {
  getMediaFeed, IMPACT_COLOR, fmtCountdown, fmtPrice, changePct, upcoming, nowShowing, type CalEvent,
} from './media';

export interface MediaBuilding {
  id: string;
  name: string;
  root: THREE.Group;
  body: THREE.Group;
  mats: BuildingMaterials;
  height: number;
  radius: number;
}

export interface MediaDistrict {
  buildings: MediaBuilding[];
  obstacles: Array<{ kind: 'rect'; x: number; z: number; hw: number; hd: number } | { kind: 'circle'; x: number; z: number; r: number }>;
  treeSpots: Array<{ x: number; z: number; s: number; kind: 'round' | 'cone' }>;
  update: (dt: number) => void;
}

const FONT = 'Manrope, Inter, system-ui, sans-serif';
const BLOCK_Y = 0.12;

/** Focus point of the amphitheater (screen centre on the ground). */
export const THEATER = { x: 88, z: -80 };

function canvasTex(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { c, g: c.getContext('2d')!, tex };
}

function screenMat(tex: THREE.Texture) {
  return new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
}

function sectorShape(r1: number, r2: number, a0: number, a1: number) {
  // angles measured from +z toward +x; shape y = −z (geometry is rotated −90° about X afterwards)
  const s = new THREE.Shape();
  const P = (r: number, a: number) => new THREE.Vector2(r * Math.sin(a), -r * Math.cos(a));
  const n = 28;
  const p0 = P(r2, a0);
  s.moveTo(p0.x, p0.y);
  for (let i = 1; i <= n; i++) { const p = P(r2, a0 + ((a1 - a0) * i) / n); s.lineTo(p.x, p.y); }
  for (let i = n; i >= 0; i--) { const p = P(r1, a0 + ((a1 - a0) * i) / n); s.lineTo(p.x, p.y); }
  s.closePath();
  return s;
}

const ET = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: '2-digit' });
const UTC_FMT = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', hour: '2-digit', minute: '2-digit' });

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

function fitText(g: CanvasRenderingContext2D, text: string, maxW: number) {
  if (g.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 3 && g.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

export function buildMediaDistrict(): MediaDistrict {
  const feed = () => getMediaFeed();
  const buildings: MediaBuilding[] = [];
  const obstacles: MediaDistrict['obstacles'] = [];
  const treeSpots: MediaDistrict['treeSpots'] = [];
  const redraws: Array<(now: number) => void> = [];
  const scrollers: Array<{ tex: THREE.Texture; speed: number }> = [];

  /* ================= THEATER ================= */
  const tMats = makeBuildingMaterials();
  const theater = new THREE.Group();
  const tBody = new THREE.Group();
  theater.add(tBody);
  theater.position.set(THEATER.x, BLOCK_Y, THEATER.z);

  // plaza floor of the bowl
  // sector opening toward +z (θ = −π/2 maps to +z after the −90° X rotation)
  const floor = mesh(new THREE.CircleGeometry(21, 48, -Math.PI / 2 - 1.0, 2.0), new THREE.MeshStandardMaterial({ color: 0xdfe4ec, roughness: 0.9 }), false);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.13;
  tBody.add(floor);

  // stepped seating tiers
  const A0 = -0.95;
  const A1 = 0.95;
  const ROWS = 8;
  const tierMat = new THREE.MeshStandardMaterial({ color: 0xeef1f6, roughness: 0.8 });
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x2f4f9e, roughness: 0.6 });
  const rows: Array<{ r: number; y: number }> = [];
  for (let i = 0; i < ROWS; i++) {
    const r1 = 8.2 + i * 1.45;
    const r2 = r1 + 1.45;
    const h = 0.32 + i * 0.36;
    const geo = new THREE.ExtrudeGeometry(sectorShape(r1, r2, A0, A1), { depth: h, bevelEnabled: false, curveSegments: 4 });
    geo.rotateX(-Math.PI / 2);
    const tier = mesh(geo, i % 2 ? tierMat : tMats.white, true, true);
    tier.position.y = 0.12;
    tBody.add(tier);
    // seat strip on each tier
    const sgeo = new THREE.ExtrudeGeometry(sectorShape(r1 + 0.35, r1 + 0.85, A0 + 0.02, A1 - 0.02), { depth: 0.22, bevelEnabled: false, curveSegments: 4 });
    sgeo.rotateX(-Math.PI / 2);
    const seats = mesh(sgeo, seatMat, false, true);
    seats.position.y = 0.12 + h;
    tBody.add(seats);
    rows.push({ r: r1 + 0.6, y: 0.12 + h + 0.22 });
  }
  // back wall + aisle stairs
  const wallGeo = new THREE.ExtrudeGeometry(sectorShape(8.2 + ROWS * 1.45, 8.2 + ROWS * 1.45 + 0.5, A0, A1), { depth: 0.32 + ROWS * 0.36 + 1.1, bevelEnabled: false, curveSegments: 4 });
  wallGeo.rotateX(-Math.PI / 2);
  const wall = mesh(wallGeo, tMats.trim, true, true);
  wall.position.y = 0.12;
  tBody.add(wall);
  for (const a of [-0.32, 0.32]) {
    const stair = mesh(box(1.1, 0.06, ROWS * 1.45), new THREE.MeshStandardMaterial({ color: 0xc9973a, roughness: 0.6 }), false);
    const rm = 8.2 + (ROWS * 1.45) / 2;
    stair.position.set(Math.sin(a) * rm, 0.32 + ROWS * 0.18, Math.cos(a) * rm);
    stair.rotation.y = a;
    stair.rotation.x = -Math.atan((ROWS * 0.36) / (ROWS * 1.45));
    tBody.add(stair);
  }

  // audience (instanced): ~70% occupancy, everyone facing the screen
  const seatsXZ: Array<{ x: number; z: number; y: number; rot: number }> = [];
  const rng = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  for (const row of rows) {
    const arc = row.r * (A1 - A0 - 0.08);
    const n = Math.floor(arc / 0.95);
    for (let k = 0; k < n; k++) {
      const a = A0 + 0.04 + ((k + 0.5) / n) * (A1 - A0 - 0.08);
      if (Math.abs(a - 0.32) < 0.05 || Math.abs(a + 0.32) < 0.05) continue; // aisles
      if (rng() > 0.72) continue;
      seatsXZ.push({ x: Math.sin(a) * row.r, z: Math.cos(a) * row.r, y: row.y, rot: a + Math.PI });
    }
  }
  const bodyGeo = box(0.5, 0.62, 0.42);
  const headGeo = new THREE.SphereGeometry(0.19, 10, 8);
  const people = new THREE.InstancedMesh(bodyGeo, new THREE.MeshStandardMaterial({ roughness: 0.75 }), seatsXZ.length);
  const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshStandardMaterial({ roughness: 0.6 }), seatsXZ.length);
  const shirts = [0x2f6bff, 0x14a37f, 0x7c5cff, 0xe5383b, 0xf08c2e, 0x13213f, 0xffffff, 0xc9973a, 0x5aa9e6, 0x8f9bb3];
  const skins = [0xf2d3b3, 0xe0b48f, 0xc68a62, 0x9c6644, 0x6f4a32, 0xf6dfc6];
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const col = new THREE.Color();
  seatsXZ.forEach((s, i) => {
    q.setFromAxisAngle(up, s.rot);
    m4.compose(new THREE.Vector3(s.x, s.y + 0.31, s.z), q, new THREE.Vector3(1, 1, 1));
    people.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(s.x, s.y + 0.86, s.z), q, new THREE.Vector3(1, 1, 1));
    heads.setMatrixAt(i, m4);
    people.setColorAt(i, col.setHex(shirts[Math.floor(rng() * shirts.length)]));
    heads.setColorAt(i, col.setHex(skins[Math.floor(rng() * skins.length)]));
  });
  people.castShadow = true;
  heads.castShadow = true;
  tBody.add(people, heads);

  // stage
  const stage = mesh(rbox(20, 1.0, 4.2, 0.2), tMats.white);
  stage.position.set(0, 0.62, 2.6);
  const stageEdge = mesh(box(20.2, 0.12, 0.2), MAT.gold, false);
  stageEdge.position.set(0, 1.08, 4.7);
  tBody.add(stage, stageEdge);

  // screen structure (faces +z, i.e. toward the seats and the default camera)
  const SW = 22;
  const SH = 9.0;
  const SY = 6.2; // bottom of screen
  const frame = mesh(rbox(SW + 1.6, SH + 5.0, 0.9, 0.3), new THREE.MeshStandardMaterial({ color: 0x1a2440, roughness: 0.5, metalness: 0.2 }));
  frame.position.set(0, 3.0 + (SH + 5.0) / 2 - 0.2, -0.2);
  tBody.add(frame);
  for (const x of [-(SW / 2 + 1.2), SW / 2 + 1.2]) {
    const post = mesh(rbox(1.0, SY + SH + 1.4, 1.2, 0.2), tMats.white);
    post.position.set(x, (SY + SH + 1.4) / 2, -0.2);
    tBody.add(post);
  }
  const roof = mesh(rbox(SW + 3.6, 0.6, 3.0, 0.2), tMats.white);
  roof.position.set(0, SY + SH + 1.6, 0.4);
  tBody.add(roof);
  for (const x of [-8, -4, 0, 4, 8]) {
    const spot = mesh(new THREE.CylinderGeometry(0.28, 0.2, 0.5, 10), MAT.darkGrey, false);
    spot.position.set(x, SY + SH + 1.1, 1.6);
    spot.rotation.x = 0.6;
    tBody.add(spot);
  }

  // main screen
  const scr = canvasTex(1100, 450);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), screenMat(scr.tex));
  screen.position.set(0, SY + SH / 2, 0.27);
  tBody.add(screen);

  // ticker band (under the screen): fixed MARKETS label + scrolling tape
  const BAND_H = 1.15;
  const tickerY = SY - 0.15 - BAND_H / 2;
  const urgentY = tickerY - BAND_H - 0.12;
  const label = (text: string, bg: string, fg: string, w: number) => {
    const t = canvasTex(256, 64);
    t.g.fillStyle = bg;
    t.g.fillRect(0, 0, 256, 64);
    t.g.fillStyle = fg;
    t.g.font = `800 34px ${FONT}`;
    t.g.textAlign = 'center';
    t.g.textBaseline = 'middle';
    t.g.fillText(text, 128, 34);
    t.tex.needsUpdate = true;
    return new THREE.Mesh(new THREE.PlaneGeometry(w, BAND_H), screenMat(t.tex));
  };
  const LABEL_W = 3.0;
  const tapeW = SW - LABEL_W;
  const mkLabel = label('MARKETS', '#2f6bff', '#ffffff', LABEL_W);
  mkLabel.position.set(-SW / 2 + LABEL_W / 2, tickerY, 0.27);
  const urLabel = label('URGENT', '#ffffff', '#d4161b', LABEL_W);
  urLabel.position.set(-SW / 2 + LABEL_W / 2, urgentY, 0.27);
  tBody.add(mkLabel, urLabel);

  const TAPE_PX = 4096;
  const TAPE_H = 72;
  const tape = canvasTex(TAPE_PX, TAPE_H);
  tape.tex.wrapS = THREE.RepeatWrapping;
  tape.tex.repeat.x = (tapeW / BAND_H) / (TAPE_PX / TAPE_H);
  const tapeMesh = new THREE.Mesh(new THREE.PlaneGeometry(tapeW, BAND_H), screenMat(tape.tex));
  tapeMesh.position.set(LABEL_W / 2, tickerY, 0.27);
  tBody.add(tapeMesh);
  scrollers.push({ tex: tape.tex, speed: 0.018 });

  const urg = canvasTex(TAPE_PX, TAPE_H);
  urg.tex.wrapS = THREE.RepeatWrapping;
  urg.tex.repeat.x = (tapeW / BAND_H) / (TAPE_PX / TAPE_H);
  const urgMesh = new THREE.Mesh(new THREE.PlaneGeometry(tapeW, BAND_H), screenMat(urg.tex));
  urgMesh.position.set(LABEL_W / 2, urgentY, 0.27);
  tBody.add(urgMesh);
  scrollers.push({ tex: urg.tex, speed: 0.014 });

  const drawTape = () => {
    const g = tape.g;
    g.fillStyle = '#0d1630';
    g.fillRect(0, 0, TAPE_PX, TAPE_H);
    g.textBaseline = 'middle';
    // repeat the list until the tape is full so the wrap is seamless
    let x = 20;
    const qs = feed().quotes();
    let guard = 0;
    while (x < TAPE_PX && guard++ < 6) {
      for (const q of qs) {
        const ch = changePct(q);
        const upMove = ch >= 0;
        g.font = `800 34px ${FONT}`;
        g.fillStyle = '#ffffff';
        const s1 = q.sym + ' ';
        g.fillText(s1, x, 38);
        x += g.measureText(s1).width;
        g.font = `600 34px ${FONT}`;
        g.fillStyle = '#c8d3ea';
        const s2 = fmtPrice(q) + ' ';
        g.fillText(s2, x, 38);
        x += g.measureText(s2).width;
        g.fillStyle = upMove ? '#2bd4a0' : '#ff5a5f';
        g.font = `800 30px ${FONT}`;
        const s3 = `${upMove ? '▲' : '▼'} ${Math.abs(ch).toFixed(2)}%`;
        g.fillText(s3, x, 38);
        x += g.measureText(s3).width + 54;
        if (x > TAPE_PX) break;
      }
    }
    tape.tex.needsUpdate = true;
  };
  const drawUrgent = () => {
    const g = urg.g;
    g.fillStyle = '#c8101a';
    g.fillRect(0, 0, TAPE_PX, TAPE_H);
    g.textBaseline = 'middle';
    g.font = `700 32px ${FONT}`;
    const hs = feed().headlines();
    const list = [...hs.filter((h) => h.urgent), ...hs.filter((h) => !h.urgent).slice(0, 2)];
    let x = 24;
    let guard = 0;
    while (x < TAPE_PX && guard++ < 4) {
      for (const h of list) {
        g.fillStyle = '#ffffff';
        g.fillText(h.text.toUpperCase(), x, 38);
        x += g.measureText(h.text.toUpperCase()).width + 30;
        g.fillStyle = '#ffd2d4';
        g.fillText('◆', x, 38);
        x += 70;
        if (x > TAPE_PX) break;
      }
    }
    urg.tex.needsUpdate = true;
  };

  let tapeClock = 0;
  const drawScreen = (now: number) => {
    const g = scr.g;
    const W = scr.c.width;
    const Hh = scr.c.height;
    const grad = g.createLinearGradient(0, 0, W, Hh);
    grad.addColorStop(0, '#0b1a3d');
    grad.addColorStop(1, '#142a63');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, Hh);
    // subtle studio grid
    g.strokeStyle = 'rgba(255,255,255,0.05)';
    g.lineWidth = 1;
    for (let x = 0; x < W; x += 44) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, Hh); g.stroke(); }
    g.textBaseline = 'alphabetic';
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.font = `800 22px ${FONT}`;
    g.fillText('FUNDEDCITY MEDIA  ·  THEATER', 40, 52);
    const { b, live } = nowShowing(feed().broadcasts(), now);
    if (b) {
      if (live) {
        rr(g, 40, 82, 150, 48, 10);
        g.fillStyle = '#e5383b';
        g.fill();
        g.fillStyle = '#fff';
        g.font = `800 28px ${FONT}`;
        g.fillText('●  LIVE', 60, 116);
      } else {
        g.fillStyle = '#e8bf62';
        g.font = `800 26px ${FONT}`;
        g.fillText('NEXT ON SCREEN', 40, 116);
      }
      g.fillStyle = '#ffffff';
      let fs = 60;
      g.font = `800 ${fs}px ${FONT}`;
      while (fs > 40 && g.measureText(b.title.toUpperCase()).width > W - 80) g.font = `800 ${(fs -= 2)}px ${FONT}`;
      g.fillText(fitText(g, b.title.toUpperCase(), W - 80), 40, 196);
      g.fillStyle = '#c8d3ea';
      g.font = `600 28px ${FONT}`;
      const when = b.t ? `${UTC_FMT.format(b.t)} GMT  ·  ${ET.format(b.t)} ET` : 'Times announced at short notice';
      g.fillText(`${b.host}  ·  ${when}`, 40, 244);
      if (b.t) {
        const ms = live ? b.t + b.minutes * 60_000 - now : b.t - now;
        g.fillStyle = 'rgba(255,255,255,0.6)';
        g.font = `700 22px ${FONT}`;
        g.fillText(live ? 'ON AIR · ENDS IN ABOUT' : 'STARTS IN', 40, 312);
        g.fillStyle = live ? '#ff8f92' : '#ffffff';
        g.font = `800 96px ${FONT}`;
        g.fillText(fmtCountdown(ms), 36, 400);
      }
    } else {
      g.fillStyle = '#ffffff';
      g.font = `800 60px ${FONT}`;
      g.fillText('MEDIA DISTRICT', 40, 200);
      g.fillStyle = '#c8d3ea';
      g.font = `600 28px ${FONT}`;
      g.fillText('Open the Media Center for the calendar and live links', 40, 250);
    }
    // corner hint
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.font = `700 20px ${FONT}`;
    g.textAlign = 'right';
    g.fillText('Click the screen to watch', W - 40, 52);
    g.textAlign = 'left';
    scr.tex.needsUpdate = true;
  };
  redraws.push(drawScreen);

  theater.updateMatrixWorld(true);
  buildings.push({ id: 'media-theater', name: 'Media Theater', root: theater, body: tBody, mats: tMats, height: SY + SH + 2, radius: 12 });
  // seating bowl + screen are solid; the stage apron and aisles stay walkable in front
  obstacles.push({ kind: 'rect', x: THEATER.x, z: THEATER.z - 0.4, hw: SW / 2 + 2, hd: 1.4 });
  for (let a = A0; a <= A1 + 0.001; a += (A1 - A0) / 10) {
    const rm = 8.2 + (ROWS * 1.45) / 2 + 0.3;
    obstacles.push({ kind: 'circle', x: THEATER.x + Math.sin(a) * rm, z: THEATER.z + Math.cos(a) * rm, r: (ROWS * 1.45) / 2 + 0.6 });
  }

  /* ================= MEDIA CENTER (newsroom + calendar board) ================= */
  const cMats = makeBuildingMaterials();
  const center = new THREE.Group();
  const cBody = new THREE.Group();
  center.add(cBody);
  center.position.set(79, BLOCK_Y, -50);
  const CW = 10;
  const CD = 7;
  const floors = 4;
  const FH = 1.5;
  const podium = mesh(rbox(CW + 0.8, 0.5, CD + 0.8, 0.15), MAT.stone, false);
  podium.position.y = 0.25;
  cBody.add(podium);
  for (let i = 0; i < floors; i++) {
    const glass = mesh(rbox(CW - 0.6, FH - 0.25, CD - 0.6, 0.05), cMats.glass);
    glass.position.y = 0.5 + i * FH + FH / 2;
    const slabM = mesh(rbox(CW, 0.24, CD, 0.08), cMats.white);
    slabM.position.y = 0.5 + i * FH + 0.12;
    cBody.add(glass, slabM);
  }
  const cap = mesh(rbox(CW + 0.3, 0.4, CD + 0.3, 0.12), cMats.white);
  cap.position.y = 0.5 + floors * FH + 0.2;
  cBody.add(cap);
  const topY = 0.5 + floors * FH + 0.4;
  // red accent fin with the district name
  const fin = mesh(rbox(0.5, topY + 1.8, 1.6, 0.12), new THREE.MeshStandardMaterial({ color: 0xd4161b, roughness: 0.5 }));
  fin.position.set(-CW / 2 - 0.1, (topY + 1.8) / 2, CD / 2 - 0.8);
  cBody.add(fin);
  // rooftop calendar board (faces +z)
  const cal = canvasTex(1024, 600);
  const BW = 11;
  const BH = 6.4;
  const bframe = mesh(rbox(BW + 0.6, BH + 0.6, 0.5, 0.15), new THREE.MeshStandardMaterial({ color: 0x1a2440, roughness: 0.5 }));
  bframe.position.set(0, topY + 1.4 + BH / 2, 0);
  const bplane = new THREE.Mesh(new THREE.PlaneGeometry(BW, BH), screenMat(cal.tex));
  bplane.position.set(0, topY + 1.4 + BH / 2, 0.27);
  for (const x of [-3, 3]) {
    const leg = mesh(rbox(0.3, 1.6, 0.3, 0.06), MAT.white);
    leg.position.set(x, topY + 0.8, 0);
    cBody.add(leg);
  }
  cBody.add(bframe, bplane);
  // entrance canopy
  const canopy = mesh(rbox(4.2, 0.18, 1.6, 0.06), cMats.white);
  canopy.position.set(1.5, 2.1, CD / 2 + 0.7);
  cBody.add(canopy);

  const DAY = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric' });
  const HM = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' });
  const drawCal = (now: number) => {
    const g = cal.g;
    const W = cal.c.width;
    const Hh = cal.c.height;
    g.fillStyle = '#0d1630';
    g.fillRect(0, 0, W, Hh);
    g.fillStyle = '#ffffff';
    g.font = `800 40px ${FONT}`;
    g.textBaseline = 'alphabetic';
    g.fillText('ECONOMIC CALENDAR', 36, 62);
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.font = `700 22px ${FONT}`;
    g.textAlign = 'right';
    g.fillText('GMT · NEXT HIGH & MEDIUM IMPACT', W - 36, 60);
    g.textAlign = 'left';
    const evs: CalEvent[] = feed().calendar().filter((e) => !e.allDay && (e.impact === 'high' || e.impact === 'medium') && e.t > now - 5 * 60_000).slice(0, 6);
    if (!evs.length) {
      g.fillStyle = '#c8d3ea';
      g.font = `600 30px ${FONT}`;
      g.fillText('This week’s snapshot is complete — connect a live feed.', 36, 160);
    }
    evs.forEach((e, i) => {
      const y = 92 + i * 84;
      rr(g, 24, y, W - 48, 74, 12);
      g.fillStyle = i === 0 ? 'rgba(229,56,59,0.18)' : 'rgba(255,255,255,0.05)';
      g.fill();
      g.fillStyle = IMPACT_COLOR[e.impact];
      rr(g, 40, y + 18, 22, 38, 5);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.65)';
      g.font = `700 22px ${FONT}`;
      g.fillText(DAY.format(e.t).toUpperCase(), 80, y + 32);
      g.fillStyle = '#ffffff';
      g.font = `800 26px ${FONT}`;
      g.fillText(HM.format(e.t), 80, y + 62);
      g.fillStyle = '#e8bf62';
      g.font = `800 26px ${FONT}`;
      g.fillText(e.cur, 190, y + 48);
      g.fillStyle = '#ffffff';
      g.font = `700 28px ${FONT}`;
      g.fillText(fitText(g, e.title, 520), 272, y + 48);
      g.textAlign = 'right';
      g.fillStyle = e.t <= now ? '#ff8f92' : '#2bd4a0';
      g.font = `800 28px ${FONT}`;
      g.fillText(e.t <= now ? 'NOW' : fmtCountdown(e.t - now), W - 44, y + 48);
      g.textAlign = 'left';
    });
    cal.tex.needsUpdate = true;
  };
  redraws.push(drawCal);
  buildings.push({ id: 'media-center', name: 'Media Center', root: center, body: cBody, mats: cMats, height: topY + 8, radius: 6.5 });
  obstacles.push({ kind: 'rect', x: 79, z: -50, hw: CW / 2 + 0.7, hd: CD / 2 + 0.7 });

  /* ================= COUNTDOWN PYLON ================= */
  const pMats = makeBuildingMaterials();
  const pylon = new THREE.Group();
  const pBody = new THREE.Group();
  pylon.add(pBody);
  pylon.position.set(98, BLOCK_Y, -51);
  const base = mesh(rbox(4.6, 0.5, 3.0, 0.15), MAT.stone, false);
  base.position.y = 0.25;
  const shaft = mesh(rbox(4.0, 10.5, 1.4, 0.3), pMats.white);
  shaft.position.y = 0.5 + 5.25;
  const pc = canvasTex(512, 900);
  const pplane = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 6.15), screenMat(pc.tex));
  pplane.position.set(0, 0.5 + 5.25 + 0.9, 0.71);
  const redCap = mesh(rbox(4.2, 0.5, 1.6, 0.15), new THREE.MeshStandardMaterial({ color: 0xd4161b, roughness: 0.5 }));
  redCap.position.y = 11.25;
  pBody.add(base, shaft, pplane, redCap);
  pBody.rotation.y = Math.PI / 4; // face the plaza and the default south-east view
  const drawPylon = (now: number) => {
    const g = pc.g;
    const W = pc.c.width;
    g.fillStyle = '#0d1630';
    g.fillRect(0, 0, W, pc.c.height);
    g.textAlign = 'center';
    g.fillStyle = '#ff5a5f';
    g.font = `800 34px ${FONT}`;
    g.fillText('HEADS-UP', W / 2, 70);
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.font = `700 24px ${FONT}`;
    g.fillText('NEXT MAJOR EVENT', W / 2, 110);
    const [e, e2] = upcoming(feed().calendar(), now, ['high'], 2);
    if (e) {
      g.fillStyle = '#e8bf62';
      g.font = `800 64px ${FONT}`;
      g.fillText(e.cur, W / 2, 210);
      g.fillStyle = '#ffffff';
      g.font = `800 34px ${FONT}`;
      // wrap title over two lines
      const words = e.title.split(' ');
      let line = '';
      const lines: string[] = [];
      for (const w of words) {
        const t = line ? line + ' ' + w : w;
        if (g.measureText(t).width > W - 60 && line) { lines.push(line); line = w; } else line = t;
      }
      if (line) lines.push(line);
      lines.slice(0, 3).forEach((l, i) => g.fillText(l, W / 2, 270 + i * 44));
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.font = `700 26px ${FONT}`;
      g.fillText(`${UTC_FMT.format(e.t)} GMT`, W / 2, 420);
      g.fillStyle = e.t - now < 3_600_000 ? '#ff8f92' : '#2bd4a0';
      g.font = `800 ${e.t - now > 86_400_000 ? 64 : 84}px ${FONT}`;
      g.fillText(e.t <= now ? 'NOW' : fmtCountdown(e.t - now), W / 2, 540);
      if (e2) {
        g.fillStyle = 'rgba(255,255,255,0.08)';
        rr(g, 30, 620, W - 60, 220, 18);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.6)';
        g.font = `700 22px ${FONT}`;
        g.fillText('THEN', W / 2, 666);
        g.fillStyle = '#ffffff';
        g.font = `800 28px ${FONT}`;
        g.fillText(fitText(g, `${e2.cur} · ${e2.title}`, W - 90), W / 2, 716);
        g.fillStyle = '#c8d3ea';
        g.font = `800 48px ${FONT}`;
        g.fillText(fmtCountdown(e2.t - now), W / 2, 790);
      }
    } else {
      g.fillStyle = '#ffffff';
      g.font = `800 34px ${FONT}`;
      g.fillText('No upcoming events', W / 2, 300);
    }
    g.textAlign = 'left';
    pc.tex.needsUpdate = true;
  };
  redraws.push(drawPylon);
  buildings.push({ id: 'media-countdown', name: 'Heads-up Pylon', root: pylon, body: pBody, mats: pMats, height: 11.5, radius: 3.4 });
  obstacles.push({ kind: 'rect', x: 98, z: -51, hw: 2.6, hd: 1.9 });

  // plaza trees between the newsroom and the theater
  for (const [x, z] of [[72.5, -60], [103, -58], [86, -46], [91, -46], [72.5, -66]]) treeSpots.push({ x, z, s: 0.7, kind: 'round' });

  /* ================= updates ================= */
  drawTape();
  drawUrgent();
  const now0 = Date.now();
  for (const r of redraws) r(now0);
  let clock = 0;
  return {
    buildings,
    obstacles,
    treeSpots,
    update(dt) {
      feed().tick?.(dt);
      for (const s of scrollers) s.tex.offset.x = (s.tex.offset.x + dt * s.speed) % 1;
      clock += dt;
      tapeClock += dt;
      if (clock >= 1) {
        clock = 0;
        const now = Date.now();
        for (const r of redraws) r(now);
      }
      if (tapeClock >= 3) {
        tapeClock = 0;
        drawTape();
      }
    },
  };
}
