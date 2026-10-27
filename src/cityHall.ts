// FUNDEDCITY CITY HALL: on Capital Square's west side, facing the Bank of Gains across the fountain. White stone, a six-column portico with
// a pediment, a slate roof and a clock tower showing live New York time under a copper dome. A digital board
// by the steps shows the mayor and the election; inside is the council chamber (see interiors.ts).
import * as THREE from 'three';
import { mesh, box, rbox, signPlane, makeBuildingMaterials, MAT } from './buildings';
import { bake, noBake } from './bake';

/** on Capital Square's west side (the café's old spot), its portico facing east across the fountain */
export const HALL = { x: -33.5, z: 0, w: 13, d: 7, rot: Math.PI / 2 };
/** local (building) offset → world */
function toWorld(lx: number, lz: number) {
  const c = Math.cos(HALL.rot);
  const s = Math.sin(HALL.rot);
  return { x: HALL.x + lx * c + lz * s, z: HALL.z - lx * s + lz * c };
}
function rectW(lx: number, lz: number, hw: number, hd: number) {
  const p = toWorld(lx, lz);
  const side = Math.abs(Math.sin(HALL.rot)) > 0.5;
  return { kind: 'rect' as const, x: p.x, z: p.z, hw: side ? hd : hw, hd: side ? hw : hd };
}
const FONT = 'Manrope, Inter, system-ui, sans-serif';

export interface HallBoard { mayor: string | null; term: string; candidates: number; closesIn: string; polls: number; open?: boolean }

function canvasTex(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { c, g: c.getContext('2d')!, tex };
}

export function buildCityHall() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const mats = makeBuildingMaterials();
  mats.white.color.setHex(0xf3eee4);
  const { w: W, d: D } = HALL;
  const stone = new THREE.MeshStandardMaterial({ color: 0xe6dfd1, roughness: 0.8 });
  const cornice = new THREE.MeshStandardMaterial({ color: 0xd8cdb8, roughness: 0.7 });
  const slate = new THREE.MeshStandardMaterial({ color: 0x55657a, roughness: 0.6 });
  const copper = new THREE.MeshStandardMaterial({ color: 0x6fb39a, roughness: 0.5, metalness: 0.3 });
  const win = new THREE.MeshStandardMaterial({ color: 0x2c3e5c, roughness: 0.15, metalness: 0.5, emissive: 0x1a2a44, emissiveIntensity: 0.3 });
  const P = 0.6; // plinth height
  const BH = 4.6; // body height
  const plinth = mesh(box(W + 0.6, P, D + 0.6), stone);
  plinth.position.y = P / 2;
  const main = mesh(box(W, BH, D), mats.white);
  main.position.y = P + BH / 2;
  const band = mesh(box(W + 0.1, 0.18, D + 0.1), cornice, false);
  band.position.y = P + 1.5;
  const top = mesh(box(W + 0.5, 0.4, D + 0.5), cornice);
  top.position.y = P + BH + 0.2;
  body.add(plinth, main, band, top);
  // slate hipped roof
  const roof = mesh(new THREE.ConeGeometry(1, 1.4, 4, 1).rotateY(Math.PI / 4), slate);
  roof.scale.set((W + 0.2) / Math.SQRT2, 1, (D + 0.2) / Math.SQRT2);
  roof.position.y = P + BH + 0.4 + 0.7;
  body.add(roof);
  // windows: front (+z) either side of the portico, back and ends
  for (const x of [-5.4, -4.3, 4.3, 5.4]) {
    for (const y of [P + 0.9, P + 2.6]) {
      const wn = mesh(box(0.7, 1.2, 0.08), win, false);
      wn.position.set(x, y + 0.6, D / 2 + 0.03);
      body.add(wn);
    }
  }
  for (let x = -5.4; x <= 5.5; x += 1.35) {
    const wn = mesh(box(0.7, 1.3, 0.08), win, false);
    wn.position.set(x, P + 2.9, -D / 2 - 0.03);
    body.add(wn);
  }
  for (const sx of [-1, 1]) for (const z of [-1.6, 1.6]) {
    const wn = mesh(box(0.08, 1.3, 0.8), win, false);
    wn.position.set(sx * (W / 2 + 0.03), P + 2.9, z);
    body.add(wn);
  }
  // portico: porch, six columns, entablature with the name, pediment
  const PZ = D / 2 + 1.2;
  const porch = mesh(box(8.8, P, 2.6), stone);
  porch.position.set(0, P / 2, PZ);
  body.add(porch);
  for (let i = 0; i < 3; i++) {
    const step = mesh(box(6.6, P - i * 0.2, 0.45), stone, false);
    step.position.set(0, (P - i * 0.2) / 2, PZ + 1.3 + 0.22 + i * 0.45);
    body.add(step);
  }
  const colH = 3.9;
  for (let i = 0; i < 6; i++) {
    const x = -3.6 + i * 1.44;
    const col = mesh(new THREE.CylinderGeometry(0.24, 0.29, colH, 14), mats.white);
    col.position.set(x, P + colH / 2, PZ + 0.6);
    const cap = mesh(box(0.7, 0.18, 0.7), cornice, false);
    cap.position.set(x, P + colH + 0.09, PZ + 0.6);
    const base = mesh(box(0.66, 0.16, 0.66), cornice, false);
    base.position.set(x, P + 0.08, PZ + 0.6);
    body.add(col, cap, base);
  }
  const ent = mesh(box(9, 0.75, 2.7), mats.white);
  ent.position.set(0, P + colH + 0.18 + 0.37, PZ - 0.05);
  body.add(ent);
  const name = signPlane('CITY HALL', 5.6, 0.6, { bg: '#f3eee4', fg: '#22314f' });
  name.position.set(0, P + colH + 0.55, PZ + 1.31);
  body.add(name);
  const tri = new THREE.Shape();
  tri.moveTo(-4.6, 0);
  tri.lineTo(4.6, 0);
  tri.lineTo(0, 1.6);
  tri.lineTo(-4.6, 0);
  const pedGeo = new THREE.ExtrudeGeometry(tri, { depth: 2.7, bevelEnabled: false });
  const ped = mesh(pedGeo, mats.white);
  ped.position.set(0, P + colH + 0.93, PZ - 1.4);
  body.add(ped);
  const pedRoof = mesh(new THREE.ExtrudeGeometry(tri, { depth: 2.6, bevelEnabled: false }), slate, false);
  pedRoof.scale.set(1.04, 1.06, 1);
  pedRoof.position.set(0, P + colH + 0.97, PZ - 1.42);
  body.add(pedRoof);
  // gold seal in the pediment
  const seal = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 24), MAT.gold, false);
  seal.rotation.x = Math.PI / 2;
  seal.position.set(0, P + colH + 1.45, PZ + 1.32);
  body.add(seal);
  // doors
  const door = mesh(box(1.6, 2.4, 0.1), new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.6 }), false);
  door.position.set(0, P + 1.2, D / 2 + 0.04);
  body.add(door);

  // clock tower
  const TY = P + BH + 0.4;
  const shaft = mesh(box(2.8, 4.4, 2.8), mats.white);
  shaft.position.set(0, TY + 2.2, -0.6);
  const ring1 = mesh(box(3.1, 0.25, 3.1), cornice, false);
  ring1.position.set(0, TY + 4.5, -0.6);
  const clockBox = mesh(box(3.0, 2.8, 3.0), mats.white);
  clockBox.position.set(0, TY + 6.0, -0.6);
  const ring2 = mesh(box(3.3, 0.3, 3.3), cornice, false);
  ring2.position.set(0, TY + 7.5, -0.6);
  body.add(shaft, ring1, clockBox, ring2);
  // belfry: four corner posts and a copper dome
  for (const [x, z] of [[-1.25, -1.25], [1.25, -1.25], [-1.25, 1.25], [1.25, 1.25]]) {
    const p = mesh(box(0.32, 1.5, 0.32), mats.white);
    p.position.set(x, TY + 8.4, -0.6 + z);
    body.add(p);
  }
  const bell = mesh(new THREE.CylinderGeometry(0.35, 0.55, 0.7, 16), MAT.gold, false);
  bell.position.set(0, TY + 8.4, -0.6);
  const deck = mesh(box(3.0, 0.25, 3.0), cornice, false);
  deck.position.set(0, TY + 9.25, -0.6);
  const domeM = mesh(new THREE.SphereGeometry(1.45, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), copper);
  domeM.position.set(0, TY + 9.35, -0.6);
  const finial = mesh(new THREE.ConeGeometry(0.16, 1.1, 10), MAT.gold);
  finial.position.set(0, TY + 11.3, -0.6);
  body.add(bell, deck, domeM, finial);
  // flags at the front corners
  const flagCols = [0x2f6bff, 0xe6b95a];
  [-1, 1].forEach((sx, i) => {
    const pole = mesh(new THREE.CylinderGeometry(0.05, 0.07, 5.2, 8), mats.white);
    pole.position.set(sx * 5.9, 2.6, D / 2 + 2.2);
    const flag = mesh(box(1.3, 0.8, 0.03), new THREE.MeshStandardMaterial({ color: flagCols[i], roughness: 0.6 }), false);
    flag.position.set(sx * 5.9 + 0.68, 4.75, D / 2 + 2.2);
    body.add(pole, flag);
  });
  // the digital board by the steps (frame; the screen is live)
  const BX = -5.1;
  const BZ = D / 2 + 3.6;
  const frame = mesh(rbox(2.9, 1.9, 0.22, 0.08), new THREE.MeshStandardMaterial({ color: 0x1d2433, roughness: 0.5 }));
  frame.position.set(BX, 1.95, BZ);
  const leg = mesh(box(0.25, 1.0, 0.25), new THREE.MeshStandardMaterial({ color: 0x1d2433, roughness: 0.5 }));
  leg.position.set(BX, 0.5, BZ);
  body.add(frame, leg);
  bake(body);

  // clock faces (live New York time), one texture on all four sides
  const clock = canvasTex(256, 256);
  const faceMat = new THREE.MeshBasicMaterial({ map: clock.tex, toneMapped: false });
  const faceGeo = new THREE.CircleGeometry(1.15, 40);
  const faces: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const f = new THREE.Mesh(faceGeo, faceMat);
    f.position.set(Math.sin(a) * 1.52, TY + 6.0, -0.6 + Math.cos(a) * 1.52);
    f.rotation.y = a;
    noBake(f);
    root.add(f);
    faces.push(f);
  }
  const drawClock = () => {
    const g = clock.g;
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date());
    const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 12;
    const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
    g.clearRect(0, 0, 256, 256);
    g.fillStyle = '#c9973a';
    g.beginPath();
    g.arc(128, 128, 127, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fbf7ee';
    g.beginPath();
    g.arc(128, 128, 116, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#22314f';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r1 = i % 3 === 0 ? 88 : 96;
      g.save();
      g.translate(128 + Math.sin(a) * ((r1 + 106) / 2), 128 - Math.cos(a) * ((r1 + 106) / 2));
      g.rotate(a);
      g.fillRect(i % 3 === 0 ? -4 : -2, -(106 - r1) / 2, i % 3 === 0 ? 8 : 4, 106 - r1);
      g.restore();
    }
    g.font = `800 18px ${FONT}`;
    g.textAlign = 'center';
    g.fillText('NYC', 128, 176);
    const hand = (a: number, len: number, w: number, col: string) => {
      g.strokeStyle = col;
      g.lineWidth = w;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(128, 128);
      g.lineTo(128 + Math.sin(a) * len, 128 - Math.cos(a) * len);
      g.stroke();
    };
    hand(((h + m / 60) / 12) * Math.PI * 2, 58, 9, '#22314f');
    hand((m / 60) * Math.PI * 2, 88, 6, '#22314f');
    g.fillStyle = '#c9973a';
    g.beginPath();
    g.arc(128, 128, 8, 0, Math.PI * 2);
    g.fill();
    clock.tex.needsUpdate = true;
  };
  drawClock();

  // the board: mayor + election status (both faces)
  const boardT = canvasTex(560, 360);
  const boardMat = new THREE.MeshBasicMaterial({ map: boardT.tex, toneMapped: false });
  for (const [z, ry] of [[BZ + 0.12, 0], [BZ - 0.12, Math.PI]] as const) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.72), boardMat);
    s.position.set(BX, 1.95, z);
    s.rotation.y = ry;
    noBake(s);
    root.add(s);
  }
  const drawBoard = (b: HallBoard) => {
    const g = boardT.g;
    const grd = g.createLinearGradient(0, 0, 0, 360);
    grd.addColorStop(0, '#16213a');
    grd.addColorStop(1, '#22314f');
    g.fillStyle = grd;
    g.fillRect(0, 0, 560, 360);
    g.fillStyle = '#f2c14e';
    g.font = `900 30px ${FONT}`;
    g.textAlign = 'left';
    g.fillText('CITY HALL', 28, 52);
    g.fillStyle = '#9fb3d9';
    g.font = `800 20px ${FONT}`;
    g.fillText(`MAYOR OF FUNDEDCITY · ${b.term.toUpperCase()}`, 28, 100);
    g.fillStyle = '#ffffff';
    g.font = `900 ${b.mayor && b.mayor.length > 16 ? 34 : 44}px ${FONT}`;
    g.fillText(b.mayor ?? 'Election running', 28, 152);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(28, 182, 504, 2);
    g.fillStyle = '#7fe0b8';
    g.font = `800 24px ${FONT}`;
    g.fillText(`Next mayor: ${b.candidates} founder${b.candidates === 1 ? '' : 's'} on the ballot`, 28, 228);
    g.fillStyle = '#ffffff';
    g.fillText(b.open ? `Traders vote now · closes in ${b.closesIn}` : `Voting opens in ${b.closesIn}`, 28, 266);
    g.fillStyle = '#9fb3d9';
    g.font = `700 22px ${FONT}`;
    g.fillText(`${b.polls} open vote${b.polls === 1 ? '' : 's'} · go inside to vote`, 28, 318);
    boardT.tex.needsUpdate = true;
  };
  drawBoard({ mayor: null, term: 'this month', candidates: 0, closesIn: '…', polls: 0 });
  root.rotation.y = HALL.rot;
  let acc = 0;
  return {
    root, body, mats,
    height: TY + 11.9,
    radius: 9,
    obstacles: [rectW(0, 0, W / 2 + 0.5, D / 2 + 0.5), rectW(0, PZ, 4.5, 1.4), rectW(BX, BZ, 1.5, 0.4)],
    clockTexture: clock.tex,
    boardTexture: boardT.tex,
    setBoard: drawBoard,
    update(dt: number) {
      acc += dt;
      if (acc > 10) { acc = 0; drawClock(); }
    },
  };
}
export type CityHallBuilding = ReturnType<typeof buildCityHall>;
