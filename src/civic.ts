// Capital Square landmarks: SIP THE DIP CAFE (traders' meeting place with a terrace) and the
// BANK OF GAINS (classical bank where traders register their max single payout).
// Both are built facing +z; the city rotates them toward the plaza.
import * as THREE from 'three';
import { MAT, mesh, rbox, box, signPlane, getGlassMaterial, makeBuildingMaterials, type BuildingMaterials } from './buildings';
import { bake, noBake } from './bake';

export interface CivicBuilding { root: THREE.Group; body: THREE.Group; mats: BuildingMaterials; height: number; radius: number; update: (dt: number, t: number) => void }

export function buildCafe(): CivicBuilding {
  const mats = makeBuildingMaterials();
  mats.white.color.setHex(0xf3e6d3);
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const green = new THREE.MeshStandardMaterial({ color: 0x1f5f4a, roughness: 0.5 });
  const wood = new THREE.MeshStandardMaterial({ color: 0xb98a5c, roughness: 0.8 });
  const deck = new THREE.MeshStandardMaterial({ color: 0xd9b98f, roughness: 0.85 });
  // building
  const W = 13;
  const D = 7;
  const H = 4.4;
  const shell = mesh(box(W, H, D), mats.white);
  shell.position.set(0, H / 2 + 0.2, -6.5);
  const glass = mesh(box(W - 1.6, H - 1.4, 0.1), getGlassMaterial());
  glass.position.set(0, (H - 1.4) / 2 + 0.4, -6.5 + D / 2 + 0.03);
  const frame = mesh(box(W + 0.3, 0.35, D + 0.3), green);
  frame.position.set(0, H + 0.35, -6.5);
  const door = mesh(rbox(1.5, 2.5, 0.1, 0.04), green);
  door.position.set(-3.6, 1.45, -6.5 + D / 2 + 0.06);
  body.add(shell, glass, frame, door);
  // striped awning
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 32;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#1f5f4a'; g.fillRect(i * 16, 0, 16, 32); }
  const at = new THREE.CanvasTexture(c);
  at.colorSpace = THREE.SRGBColorSpace;
  const awning = mesh(box(W - 0.4, 0.08, 2.4), new THREE.MeshStandardMaterial({ map: at, roughness: 0.7 }));
  awning.position.set(0, H - 0.2, -6.5 + D / 2 + 1.1);
  awning.rotation.x = 0.3;
  body.add(awning);
  // sign
  const sign = signPlane('SIP THE DIP CAFE', 10, 1.4, { bg: '#1f5f4a', fg: '#f2c14e' });
  sign.position.set(0, H + 1.45, -6.5 + D / 2 + 0.05);
  const signBack = mesh(rbox(10.3, 1.6, 0.2, 0.08), green);
  signBack.position.set(0, H + 1.45, -6.5 + D / 2 - 0.08);
  body.add(sign, signBack);
  // rooftop coffee cup (with steam that rises)
  const cup = mesh(new THREE.CylinderGeometry(1.1, 0.8, 1.6, 20), MAT.white);
  cup.position.set(4.5, H + 1.4, -7.5);
  const sleeve = mesh(new THREE.CylinderGeometry(1.02, 0.9, 0.6, 20), green);
  sleeve.position.set(4.5, H + 1.35, -7.5);
  const handle = mesh(new THREE.TorusGeometry(0.42, 0.12, 8, 16), MAT.white);
  handle.position.set(5.7, H + 1.45, -7.5);
  const coffee = mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.05, 20), new THREE.MeshStandardMaterial({ color: 0x6b3f22, roughness: 0.3 }));
  coffee.position.set(4.5, H + 2.17, -7.5);
  body.add(cup, sleeve, handle, coffee);
  // terrace deck with tables, chairs and umbrellas
  const terrace = mesh(rbox(W + 4, 0.2, 10, 0.1), deck, false);
  terrace.position.set(0, 0.2, 2);
  body.add(terrace);
  const umbrellaCols = [0x1f5f4a, 0xf2c14e, 0xffffff];
  const seats: THREE.Vector3[] = [];
  const tables: Array<[number, number]> = [[-6, 0], [-1.8, 0], [2.4, 0], [6.6, 0], [-4, 4], [0.3, 4], [4.6, 4]];
  tables.forEach(([x, z], i) => {
    const top = mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.08, 16), MAT.white);
    top.position.set(x, 1.15, z);
    const leg = mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.9, 6), MAT.darkGrey, false);
    leg.position.set(x, 0.7, z);
    const pole = mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), wood, false);
    pole.position.set(x, 2.2, z);
    const umb = mesh(new THREE.ConeGeometry(1.6, 0.7, 10), new THREE.MeshStandardMaterial({ color: umbrellaCols[i % 3], roughness: 0.6 }));
    umb.position.set(x, 3.4, z);
    body.add(top, leg, pole, umb);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + i;
      const cx = x + Math.cos(a) * 1.2;
      const cz = z + Math.sin(a) * 1.2;
      const chair = mesh(box(0.55, 0.6, 0.55), green, false);
      chair.position.set(cx, 0.6, cz);
      body.add(chair);
      if ((i + k) % 3 !== 2) seats.push(new THREE.Vector3(cx, 1.15, cz));
    }
  });
  // planters
  for (const x of [-8.6, 8.6]) {
    const pl = mesh(rbox(1.2, 0.8, 9, 0.1), green);
    pl.position.set(x, 0.6, 2);
    const hedge = mesh(rbox(1.0, 0.6, 8.6, 0.25), new THREE.MeshStandardMaterial({ color: 0x6fbb5f, roughness: 0.9 }));
    hedge.position.set(x, 1.2, 2);
    body.add(pl, hedge);
  }
  bake(body);
  // people sitting at the terrace (instanced; they nod/chat)
  const people = new THREE.InstancedMesh(box(0.42, 0.7, 0.34), new THREE.MeshStandardMaterial({ roughness: 0.75 }), seats.length);
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshStandardMaterial({ roughness: 0.6 }), seats.length);
  const shirt = [0x2f6bff, 0x13213f, 0xe5383b, 0x14a37f, 0xffffff, 0xc9973a, 0x7c5cff];
  const skin = [0xf2d3b3, 0xe0b48f, 0xc68a62, 0x9c6644, 0x6f4a32];
  const col = new THREE.Color();
  seats.forEach((_, i) => {
    people.setColorAt(i, col.setHex(shirt[i % shirt.length]));
    heads.setColorAt(i, col.setHex(skin[(i * 3) % skin.length]));
  });
  noBake(people);
  noBake(heads);
  people.castShadow = true;
  body.add(people, heads);
  const steamMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, roughness: 1 });
  const steam: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const s = mesh(new THREE.SphereGeometry(0.35, 10, 8), steamMat, false);
    noBake(s);
    body.add(s);
    steam.push(s);
  }
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  return {
    root,
    body,
    mats,
    height: H + 3,
    radius: 9,
    update(_dt, t) {
      seats.forEach((s, i) => {
        q.setFromAxisAngle(up, Math.sin(t * 0.8 + i) * 0.5 + i);
        m4.compose(s.clone().setY(s.y - 0.1), q, one);
        people.setMatrixAt(i, m4);
        m4.compose(new THREE.Vector3(s.x, s.y + 0.48 + Math.abs(Math.sin(t * 2.6 + i * 1.7)) * 0.05, s.z), q, one);
        heads.setMatrixAt(i, m4);
      });
      people.instanceMatrix.needsUpdate = true;
      heads.instanceMatrix.needsUpdate = true;
      steam.forEach((s, i) => {
        const k = ((t * 0.4 + i / 3) % 1);
        s.position.set(4.5 + Math.sin(t + i) * 0.2, H + 2.4 + k * 2.4, -7.5);
        s.scale.setScalar(0.6 + k * 1.2);
      });
      steamMat.opacity = 0.35;
    },
  };
}

export function buildBank(): CivicBuilding & { setTopPayout: (text: string) => void } {
  const mats = makeBuildingMaterials();
  // City Hall's palette (cream stone, slate-blue lettering) with gold details and the golden dome
  mats.white.color.setHex(0xf3eee4);
  mats.white.roughness = 0.7;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const stone = mats.white;
  const darker = new THREE.MeshStandardMaterial({ color: 0xe6dfd1, roughness: 0.8 });
  const column = new THREE.MeshStandardMaterial({ color: 0xf7f3eb, roughness: 0.55 });
  const slate = new THREE.MeshStandardMaterial({ color: 0x55657a, roughness: 0.6 });
  const gold = MAT.gold;
  // podium + front steps
  const podium = mesh(rbox(16, 1.2, 13, 0.1), darker);
  podium.position.y = 0.6;
  body.add(podium);
  for (let i = 0; i < 4; i++) {
    const st = mesh(box(12, 0.3, 0.7), darker, true, true);
    st.position.set(0, 0.15 + i * 0.3, 6.5 + 2.1 - i * 0.7);
    body.add(st);
  }
  // cella
  const cella = mesh(box(13, 7, 8), stone);
  cella.position.set(0, 1.2 + 3.5, -1.8);
  body.add(cella);
  // portico columns
  for (let i = 0; i < 6; i++) {
    const x = -6 + i * 2.4;
    const colm = mesh(new THREE.CylinderGeometry(0.45, 0.52, 7, 16), column);
    colm.position.set(x, 1.2 + 3.5, 4.6);
    const cap = mesh(box(1.2, 0.3, 1.2), gold);
    cap.position.set(x, 1.2 + 7.1, 4.6);
    body.add(colm, cap);
  }
  // entablature + frieze sign + pediment
  const ent = mesh(box(14.6, 1.4, 11), stone);
  ent.position.set(0, 1.2 + 7.9, 0.2);
  body.add(ent);
  const frieze = signPlane('BANK OF GAINS', 12, 1.1, { bg: '#f3eee4', fg: '#22314f' });
  frieze.position.set(0, 1.2 + 7.9, 5.73);
  body.add(frieze);
  const ped = new THREE.Shape();
  ped.moveTo(-7.4, 0);
  ped.lineTo(7.4, 0);
  ped.lineTo(0, 2.6);
  ped.lineTo(-7.4, 0);
  const pedGeo = new THREE.ExtrudeGeometry(ped, { depth: 11, bevelEnabled: false });
  pedGeo.translate(0, 0, -11 / 2);
  const pediment = mesh(pedGeo, stone);
  pediment.position.set(0, 1.2 + 8.6, 0.2);
  body.add(pediment);
  // slate roof over the pediment, as on City Hall
  const pedRoofGeo = new THREE.ExtrudeGeometry(ped, { depth: 10.7, bevelEnabled: false });
  pedRoofGeo.translate(0, 0, -11 / 2);
  const pedRoof = mesh(pedRoofGeo, slate, false);
  pedRoof.scale.set(1.03, 1.05, 1);
  pedRoof.position.set(0, 1.2 + 8.64, 0.2);
  body.add(pedRoof);
  // gold dome with lantern
  const drum = mesh(new THREE.CylinderGeometry(3, 3, 1.2, 24), stone);
  const drumBand = mesh(new THREE.CylinderGeometry(3.05, 3.05, 0.18, 24), gold, false);
  drumBand.position.set(0, 1.2 + 11.85, -1.8);
  body.add(drumBand);
  drum.position.set(0, 1.2 + 11.3, -1.8);
  const dome = mesh(new THREE.SphereGeometry(3, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), gold);
  dome.position.set(0, 1.2 + 11.9, -1.8);
  const lantern = mesh(new THREE.CylinderGeometry(0.4, 0.5, 1.2, 10), gold);
  lantern.position.set(0, 1.2 + 15.4, -1.8);
  body.add(drum, dome, lantern);
  // vault door
  const vault = mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.25, 32), gold);
  vault.rotation.x = Math.PI / 2;
  vault.position.set(0, 1.2 + 1.9, 2.25);
  const spokes = mesh(new THREE.TorusGeometry(0.7, 0.08, 6, 20), MAT.darkGrey);
  spokes.position.set(0, 1.2 + 1.9, 2.42);
  body.add(vault, spokes);
  bake(body);
  // live board beside the steps: the city's #1 max single payout
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d')!;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.8), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  board.position.set(6.6, 2.6, 7.6);
  const post = mesh(box(0.2, 2.4, 0.2), MAT.darkGrey);
  post.position.set(6.6, 1.2, 7.5);
  noBake(board);
  body.add(board, post);
  const setTopPayout = (text: string) => {
    g.fillStyle = '#22314f';
    g.fillRect(0, 0, 512, 256);
    g.fillStyle = '#f2c14e';
    g.font = '800 30px Manrope, Inter, system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText('TOP SINGLE PAYOUT', 256, 62);
    g.fillStyle = '#ffffff';
    let size = 70;
    g.font = `900 ${size}px Manrope, Inter, system-ui, sans-serif`;
    while (g.measureText(text).width > 470 && size > 30) g.font = `900 ${(size -= 2)}px Manrope, Inter, system-ui, sans-serif`;
    g.fillText(text, 256, 160);
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.font = '700 22px Manrope, Inter, system-ui, sans-serif';
    g.fillText('Rankings & rules inside', 256, 220);
    tex.needsUpdate = true;
  };
  setTopPayout('—');
  return {
    root,
    body,
    mats,
    height: 17,
    radius: 9,
    update() { /* the dome uses the shared gold material, which already glows at night */ },
    setTopPayout,
  };
}
