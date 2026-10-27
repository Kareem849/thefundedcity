// Liquidation Arena (the city stadium): an elliptical bowl with stepped stands, a crowd, roof canopy, floodlights,
// a tournament floor with competitor desks, a central screen tower, and two big screens (inside + on the city façade)
// that rotate through the prop-firm tournaments published for the arena.
import * as THREE from 'three';
import { MAT, ENV, mesh, rbox, box, makeBuildingMaterials, type BuildingMaterials } from './buildings';
import { bake, noBake } from './bake';
import { tourStatus, countdown, fmtMoney, type Tournament } from './tournaments';

const FONT = 'Manrope, Inter, system-ui, sans-serif';

export interface Stadium {
  root: THREE.Group;
  body: THREE.Group;
  mats: BuildingMaterials;
  height: number;
  radius: number;
  /** half extents of the outer ellipse */
  rx: number;
  rz: number;
  update: (dt: number, t: number, list: Tournament[]) => void;
}

function ellipseRing(a0: number, b0: number, a1: number, b1: number, h: number) {
  const s = new THREE.Shape();
  s.absellipse(0, 0, a1, b1, 0, Math.PI * 2, false, 0);
  const hole = new THREE.Path();
  hole.absellipse(0, 0, a0, b0, 0, Math.PI * 2, true, 0);
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 48 });
  g.rotateX(-Math.PI / 2);
  return g;
}

export function buildStadium(): Stadium {
  const mats = makeBuildingMaterials();
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const PW = 12.6; // pitch width (x)
  const PL = 20.4; // pitch length (z)
  const A0 = 8.4;
  const B0 = 12.0;
  const STEP = 1.35;
  const TIERS = 5;
  const tierH = (i: number) => 0.7 + i * 0.78;
  const seatBlue = new THREE.MeshStandardMaterial({ color: 0x2f6bff, roughness: 0.6 });
  const seatWhite = new THREE.MeshStandardMaterial({ color: 0xe9eef7, roughness: 0.7 });
  // apron / running area
  const apron = mesh(new THREE.CylinderGeometry(1, 1, 0.2, 48), new THREE.MeshStandardMaterial({ color: 0x5e8f5a, roughness: 0.95 }), false);
  apron.scale.set(A0 + 0.1, 1, B0 + 0.1);
  apron.position.y = 0.15;
  body.add(apron);
  // arena floor: tournament stage with a grid of competitor desks
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 830;
  const g = c.getContext('2d')!;
  g.fillStyle = '#0d1a36';
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = 'rgba(232,191,98,0.18)';
  g.lineWidth = 2;
  for (let x = 0; x <= c.width; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, c.height); g.stroke(); }
  for (let y = 0; y <= c.height; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(c.width, y); g.stroke(); }
  g.strokeStyle = '#e8bf62';
  g.lineWidth = 8;
  g.strokeRect(14, 14, c.width - 28, c.height - 28);
  g.fillStyle = '#e8bf62';
  g.textAlign = 'center';
  g.font = `900 44px ${FONT}`;
  g.fillText('PROP FIRM', c.width / 2, c.height / 2 - 18);
  g.fillText('TOURNAMENTS', c.width / 2, c.height / 2 + 34);
  const pitchTex = new THREE.CanvasTexture(c);
  pitchTex.colorSpace = THREE.SRGBColorSpace;
  pitchTex.anisotropy = 8;
  const pitch = mesh(new THREE.PlaneGeometry(PW, PL), new THREE.MeshStandardMaterial({ map: pitchTex, roughness: 0.6 }), false);
  pitch.rotation.x = -Math.PI / 2;
  pitch.position.y = 0.26;
  body.add(pitch);
  // competitor desks with glowing screens (16 desks, centre kept clear for the screen tower)
  const deskMat = new THREE.MeshStandardMaterial({ color: 0xf4f6fb, roughness: 0.5 });
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x0b1530, emissive: 0x3d7bff, emissiveIntensity: 0.9, roughness: 0.3 });
  const desks: Array<[number, number]> = [];
  for (const dx of [-4.5, -1.5, 1.5, 4.5]) for (const dz of [-7.6, -4.2, 4.2, 7.6]) desks.push([dx, dz]);
  for (const [dx, dz] of desks) {
    const top = mesh(box(1.9, 0.12, 0.8), deskMat);
    top.position.set(dx, 0.85, dz);
    const leg = mesh(box(1.7, 0.6, 0.1), deskMat, false);
    leg.position.set(dx, 0.55, dz - 0.3 * Math.sign(dz));
    const scr = mesh(box(1.2, 0.62, 0.06), screenMat, false);
    scr.position.set(dx, 1.28, dz - 0.25 * Math.sign(dz));
    body.add(top, leg, scr);
  }
  // central screen tower (four faces show the featured tournament)
  const pole = mesh(new THREE.CylinderGeometry(0.22, 0.3, 5.6, 10), MAT.darkGrey);
  pole.position.set(0, 3.0, 0);
  const stage = mesh(new THREE.CylinderGeometry(1.8, 2.0, 0.4, 24), MAT.gold, false);
  stage.position.set(0, 0.4, 0);
  body.add(pole, stage);

  // stepped stands
  for (let i = 0; i < TIERS; i++) {
    const a = A0 + i * STEP;
    const b = B0 + i * STEP;
    const tier = mesh(ellipseRing(a, b, a + STEP, b + STEP, tierH(i)), i % 2 ? seatWhite : seatBlue, true, true);
    tier.position.y = 0.12;
    body.add(tier);
  }
  const AO = A0 + TIERS * STEP;
  const BO = B0 + TIERS * STEP;
  const topH = tierH(TIERS - 1);
  // outer shell + façade ribs
  const shell = mesh(ellipseRing(AO, BO, AO + 0.55, BO + 0.55, topH + 2.6), mats.white, true, true);
  shell.position.y = 0.12;
  body.add(shell);
  const ribs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 36; i++) {
    const t = (i / 36) * Math.PI * 2;
    const rg = box(0.32, topH + 4.6, 0.5).clone();
    rg.rotateY(-t);
    rg.translate(Math.cos(t) * (AO + 0.75), (topH + 4.6) / 2 + 0.12, Math.sin(t) * (BO + 0.75));
    ribs.push(rg);
  }
  for (const rg of ribs) body.add(mesh(rg, seatBlue, true, false));
  // roof canopy (outer band of the stands)
  const roofY = topH + 4.7;
  const canopy = mesh(ellipseRing(AO - 3.2, BO - 3.2, AO + 1.0, BO + 1.0, 0.28), mats.white, true, true);
  canopy.position.y = roofY;
  const canopyEdge = mesh(ellipseRing(AO - 3.25, BO - 3.25, AO - 2.95, BO - 2.95, 0.5), MAT.gold, false, false);
  canopyEdge.position.y = roofY - 0.1;
  body.add(canopy, canopyEdge);

  // crowd (instanced): one person per seat on each tier, ~85% occupancy
  const people: Array<{ x: number; y: number; z: number; rot: number }> = [];
  const rnd = (() => { let s = 99; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  for (let i = 0; i < TIERS; i++) {
    const a = A0 + i * STEP + STEP * 0.5;
    const b = B0 + i * STEP + STEP * 0.5;
    const per = Math.PI * Math.sqrt((a * a + b * b) * 2);
    const n = Math.floor(per / 0.62);
    for (let k = 0; k < n; k++) {
      if (rnd() > 0.86) continue;
      const t = (k / n) * Math.PI * 2;
      const x = Math.cos(t) * a;
      const z = Math.sin(t) * b;
      people.push({ x, y: 0.12 + tierH(i), z, rot: Math.atan2(-x, -z) });
    }
  }
  const crowd = new THREE.InstancedMesh(box(0.36, 0.62, 0.3), new THREE.MeshStandardMaterial({ roughness: 0.8 }), people.length);
  const shirt = [0x2f6bff, 0x2f6bff, 0x2f6bff, 0xffffff, 0x2f6bff, 0xd9483b, 0xd9483b, 0x13213f, 0xf2c14e, 0x14a37f];
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  const col = new THREE.Color();
  const base: THREE.Vector3[] = [];
  people.forEach((p, i) => {
    q.setFromAxisAngle(up, p.rot);
    const v = new THREE.Vector3(p.x, p.y + 0.31, p.z);
    base.push(v);
    m4.compose(v, q, one);
    crowd.setMatrixAt(i, m4);
    crowd.setColorAt(i, col.setHex(shirt[Math.floor(rnd() * shirt.length)]));
  });
  crowd.castShadow = false;
  crowd.receiveShadow = true;
  noBake(crowd);
  body.add(crowd);

  // floodlight masts
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4f8ff, emissiveIntensity: 0.2, roughness: 0.4 });
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const x = sx * (AO - 1.2);
    const z = sz * (BO - 2.2);
    const mast = mesh(new THREE.CylinderGeometry(0.22, 0.32, 15, 8), MAT.darkGrey);
    mast.position.set(x, 7.6, z);
    const panel = mesh(rbox(2.6, 1.5, 0.3, 0.08), lampMat, false, false);
    panel.position.set(x, 15.3, z);
    panel.lookAt(0, 0, 0);
    body.add(mast, panel);
  }
  // night light pool over the pitch
  const poolMat = new THREE.MeshBasicMaterial({ color: 0xf6f9ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(PW + 3, PL + 3), poolMat);
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.3;
  noBake(pool);
  body.add(pool);

  // scoreboards: inside (north end, on the roof) and outside (south façade), both face +z
  const sb = document.createElement('canvas');
  sb.width = 1024;
  sb.height = 360;
  const sg = sb.getContext('2d')!;
  const sbTex = new THREE.CanvasTexture(sb);
  sbTex.colorSpace = THREE.SRGBColorSpace;
  sbTex.anisotropy = 4;
  const sbMat = new THREE.MeshBasicMaterial({ map: sbTex, toneMapped: false });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1a2440, roughness: 0.5 });
  const addBoard = (z: number, y: number, w: number, outside: boolean) => {
    const h = (w * sb.height) / sb.width;
    const fr = mesh(rbox(w + 0.5, h + 0.5, 0.4, 0.1), frameMat);
    fr.position.set(0, y, z - 0.25);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), sbMat);
    face.position.set(0, y, z);
    noBake(face);
    body.add(fr, face);
    if (!outside) {
      for (const lx of [-w / 3, w / 3]) {
        const leg = mesh(box(0.3, y - roofY, 0.3), MAT.darkGrey);
        leg.position.set(lx, roofY + (y - roofY) / 2, z - 0.3);
        body.add(leg);
      }
    }
  };
  addBoard(-(BO - 1.6), roofY + 3.6, 8.6, false);
  addBoard(BO + 1.1, topH + 0.6 + 1.9, 8.2, true);

  // tournament competitors seated at the desks (one instanced draw call)
  const N = desks.length;
  const players = new THREE.InstancedMesh(box(0.42, 0.8, 0.32), new THREE.MeshStandardMaterial({ roughness: 0.6 }), N);
  players.castShadow = true;
  noBake(players);
  body.add(players);
  const kit = [0x2f6bff, 0xffffff, 0xe8bf62, 0x14a37f, 0x7c5cff, 0xe5383b];
  desks.forEach((_, i) => players.setColorAt(i, col.setHex(kit[i % kit.length])));
  // screen tower faces (+z, -z, +x, -x)
  const towerY = 5.4;
  const TW = 4.4;
  const TH = (TW * 360) / 1024;
  const towerFrame = new THREE.Mesh(box(TW + 0.3, TH + 0.3, TW + 0.3), new THREE.MeshStandardMaterial({ color: 0x1a2440, roughness: 0.5 }));
  towerFrame.position.set(0, towerY, 0);
  noBake(towerFrame);
  body.add(towerFrame);

  let lastDraw = -1;
  let lastKey = '';
  let featured = 0;
  let featureT = 0;
  const statusText = (tr: Tournament, now: number) => {
    const st = tourStatus(tr, now);
    return st === 'live' ? `●  LIVE · ends in ${countdown(tr.end - now)}` : st === 'upcoming' ? `STARTS IN ${countdown(tr.start - now)}` : 'ENDED';
  };
  const fit = (text: string, max: number, weight: number, size: number) => {
    let sz = size;
    sg.font = `${weight} ${sz}px ${FONT}`;
    while (sg.measureText(text).width > max && sz > 18) sg.font = `${weight} ${(sz -= 2)}px ${FONT}`;
  };
  const draw = (tr: Tournament | undefined, idx: number, total: number) => {
    const W = sb.width;
    const H = sb.height;
    const now = Date.now();
    sg.fillStyle = '#0b1530';
    sg.fillRect(0, 0, W, H);
    sg.textBaseline = 'alphabetic';
    sg.fillStyle = 'rgba(255,255,255,0.65)';
    sg.font = `800 26px ${FONT}`;
    sg.textAlign = 'left';
    sg.fillText('LIQUIDATION ARENA · PROP FIRM TOURNAMENTS', 34, 50);
    if (!tr) {
      sg.textAlign = 'center';
      sg.fillStyle = '#ffffff';
      sg.font = `900 64px ${FONT}`;
      sg.fillText('TOURNAMENTS COMING SOON', W / 2, 210);
      sbTex.needsUpdate = true;
      return;
    }
    const st = tourStatus(tr, now);
    sg.textAlign = 'right';
    sg.fillStyle = st === 'live' ? '#ff5a5f' : '#e8bf62';
    sg.fillText(statusText(tr, now), W - 34, 50);
    sg.textAlign = 'left';
    sg.fillStyle = tr.sample ? 'rgba(255,255,255,0.55)' : '#9fc0ff';
    sg.font = `800 28px ${FONT}`;
    sg.fillText(tr.sample ? 'SAMPLE LISTING' : tr.organizer.toUpperCase(), 34, 104);
    sg.fillStyle = '#ffffff';
    fit(tr.title.toUpperCase(), W - 68, 900, 76);
    sg.fillText(tr.title.toUpperCase(), 34, 182);
    sg.fillStyle = '#f2c14e';
    sg.font = `900 54px ${FONT}`;
    sg.fillText(`${fmtMoney(tr.prizePool)} PRIZE POOL`, 34, 252);
    sg.fillStyle = 'rgba(255,255,255,0.8)';
    const foot = st === 'live' && tr.leaders?.length
      ? `LEADERS  ${tr.leaders.slice(0, 3).map((l, i) => `${i + 1}. ${l.name} +${l.pct.toFixed(1)}%`).join('   ')}`
      : `ENTRY ${tr.entry.toUpperCase()}  ·  ${tr.format.toUpperCase()}`;
    fit(foot, W - 68, 700, 26);
    sg.fillText(foot, 34, 312);
    sg.textAlign = 'right';
    sg.fillStyle = 'rgba(255,255,255,0.45)';
    sg.font = `700 22px ${FONT}`;
    sg.fillText(`${idx + 1} / ${total}`, W - 34, 252);
    sbTex.needsUpdate = true;
  };
  // the screen tower shares the scoreboard texture
  for (const [x, z, ry] of [[0, TW / 2 + 0.16, 0], [0, -TW / 2 - 0.16, Math.PI], [TW / 2 + 0.16, 0, Math.PI / 2], [-TW / 2 - 0.16, 0, -Math.PI / 2]] as const) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(TW, TH), sbMat);
    f.position.set(x, towerY, z);
    f.rotation.y = ry;
    noBake(f);
    body.add(f);
  }

  bake(body);

  return {
    root,
    body,
    mats,
    height: roofY + 7,
    radius: Math.max(AO, BO) * 0.72,
    rx: AO + 0.6,
    rz: BO + 0.6,
    update(dt, t, list) {
      // featured tournament rotates every 8 s (live ones first)
      featureT += dt;
      if (featureT > 8) { featureT = 0; featured++; }
      const now = Date.now();
      const shown = list.filter((x) => tourStatus(x, now) !== 'ended')
        .sort((a, b) => (tourStatus(a, now) === 'live' ? 0 : 1) - (tourStatus(b, now) === 'live' ? 0 : 1) || a.start - b.start);
      const idx = shown.length ? featured % shown.length : 0;
      const tr = shown[idx];
      const key = `${tr?.id}|${idx}|${shown.length}`;
      if (key !== lastKey || t - lastDraw > 1) { lastKey = key; lastDraw = t; draw(tr, idx, shown.length); }
      lampMat.emissiveIntensity = 0.2 + ENV.night * 3.5;
      screenMat.emissiveIntensity = 0.6 + ENV.night * 1.2 + Math.sin(t * 3) * 0.08;
      poolMat.opacity = ENV.night * 0.22;
      pool.visible = ENV.night > 0.02;
      desks.forEach(([dx, dz], i) => {
        q.setFromAxisAngle(up, dz > 0 ? Math.PI : 0);
        m4.compose(new THREE.Vector3(dx, 0.66 + Math.abs(Math.sin(t * 2 + i)) * 0.02, dz + 0.55 * Math.sign(dz)), q, one);
        players.setMatrixAt(i, m4);
      });
      players.instanceMatrix.needsUpdate = true;
    },
  };
}
