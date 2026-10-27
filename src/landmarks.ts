// Waterfront landmarks: the Statue of Liberty on its star-fort island, and a Brooklyn-Bridge-style
// suspension bridge (gothic stone towers, main cables, suspenders and diagonal stays).
import * as THREE from 'three';
import { MAT, ENV, mesh, rbox, box, signPlane } from './buildings';

const WATER_Y = -2.2;

/* ======================================================================= */
/* Statue of Liberty                                                        */
/* ======================================================================= */

export function buildStatueOfLiberty(): { group: THREE.Group; update: (dt: number, t: number) => void; height: number } {
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0xd8cdb6, roughness: 0.9 });
  const granite = new THREE.MeshStandardMaterial({ color: 0xcdbfa6, roughness: 0.85 });
  const patina = new THREE.MeshStandardMaterial({ color: 0x7dbfa7, roughness: 0.55, metalness: 0.25 });
  const flameMat = new THREE.MeshStandardMaterial({ color: 0xf2c14e, emissive: 0xffa630, emissiveIntensity: 0.4, roughness: 0.3, metalness: 0.5 });
  const grass = new THREE.MeshStandardMaterial({ color: 0x9fd27f, roughness: 0.9 });
  const sand = new THREE.MeshStandardMaterial({ color: 0xeadfc3, roughness: 0.95 });

  // Liberty Island
  const shore = mesh(new THREE.CylinderGeometry(15.5, 16.5, 2.4, 40), sand, false);
  shore.position.y = WATER_Y + 0.9;
  const lawn = mesh(new THREE.CylinderGeometry(14.2, 14.6, 0.5, 40), grass, false);
  lawn.position.y = WATER_Y + 2.3;
  g.add(shore, lawn);
  const ground = WATER_Y + 2.55;
  // 11-pointed star fort (Fort Wood)
  const star = new THREE.Shape();
  const N = 11;
  for (let i = 0; i <= N * 2; i++) {
    const a = (i / (N * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? 9.2 : 6.6;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) star.moveTo(x, y);
    else star.lineTo(x, y);
  }
  const starGeo = new THREE.ExtrudeGeometry(star, { depth: 1.6, bevelEnabled: false });
  starGeo.rotateX(-Math.PI / 2);
  const fort = mesh(starGeo, stone);
  fort.position.y = ground;
  g.add(fort);
  let y = ground + 1.6;
  // pedestal: base, tapered shaft, cornice, top
  const base = mesh(rbox(7.2, 2.0, 7.2, 0.15), granite);
  base.position.y = y + 1.0;
  y += 2.0;
  const shaftGeo = new THREE.CylinderGeometry(2.05 * Math.SQRT2, 2.6 * Math.SQRT2, 7.0, 4);
  shaftGeo.rotateY(Math.PI / 4);
  const shaft = mesh(shaftGeo, granite);
  shaft.position.y = y + 3.5;
  y += 7.0;
  const cornice = mesh(rbox(5.6, 0.5, 5.6, 0.1), stone);
  cornice.position.y = y + 0.25;
  y += 0.5;
  const top = mesh(rbox(4.4, 1.0, 4.4, 0.1), granite);
  top.position.y = y + 0.5;
  y += 1.0;
  g.add(base, shaft, cornice, top);
  // pedestal band details (windows / loggia hints)
  for (let i = 0; i < 4; i++) {
    const loggia = mesh(box(1.6, 1.4, 0.1), new THREE.MeshStandardMaterial({ color: 0x9a8f7c, roughness: 0.9 }), false);
    const a = (i * Math.PI) / 2;
    loggia.position.set(Math.sin(a) * 1.74, y - 3.2, Math.cos(a) * 1.74);
    loggia.rotation.y = a;
    g.add(loggia);
  }

  // name plaques on the pedestal
  for (let i = 0; i < 4; i++) {
    const plaque = signPlane('SET FOR LIFE', 3.6, 0.9, { bg: '#1f3b33', fg: '#f2c14e' });
    const a = (i * Math.PI) / 2;
    plaque.position.set(Math.sin(a) * 2.5, y - 5.6, Math.cos(a) * 2.5);
    plaque.rotation.y = a;
    plaque.rotation.x = 0;
    g.add(plaque);
  }

  // the statue (front faces +z)
  const fig = new THREE.Group();
  fig.position.y = y;
  // robe: lathe profile (radius, height)
  const prof = [
    [1.55, 0], [1.6, 0.4], [1.45, 1.6], [1.25, 3.2], [1.05, 4.6], [1.0, 5.6], [1.15, 6.6], [1.05, 7.3], [0.55, 7.8], [0.3, 7.95],
  ].map(([r, h]) => new THREE.Vector2(r, h));
  const robe = mesh(new THREE.LatheGeometry(prof, 24), patina);
  robe.scale.z = 0.82;
  fig.add(robe);
  // drapery folds (thin ribs down the robe)
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const rib = mesh(new THREE.CylinderGeometry(0.08, 0.12, 4.2, 5), patina);
    rib.position.set(Math.sin(a) * 1.3, 2.4, Math.cos(a) * 1.3 * 0.82);
    rib.rotation.z = Math.sin(a) * 0.08;
    rib.rotation.x = -Math.cos(a) * 0.08;
    fig.add(rib);
  }
  // sash across the chest
  const sash = mesh(new THREE.TorusGeometry(1.05, 0.12, 6, 20), patina);
  sash.position.y = 6.2;
  sash.rotation.set(Math.PI / 2, 0.45, 0);
  fig.add(sash);
  // neck + head
  const neck = mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.6, 10), patina);
  neck.position.y = 8.1;
  const head = mesh(new THREE.SphereGeometry(0.62, 16, 12), patina);
  head.position.y = 8.75;
  head.scale.set(1, 1.12, 1);
  fig.add(neck, head);
  // crown band + seven rays across the front half
  const band = mesh(new THREE.TorusGeometry(0.62, 0.11, 6, 20), patina);
  band.position.y = 9.1;
  band.rotation.x = Math.PI / 2;
  fig.add(band);
  for (let i = 0; i < 7; i++) {
    const a = -1.25 + (i / 6) * 2.5; // spread over the front
    const ray = mesh(new THREE.ConeGeometry(0.1, 1.25, 5), patina);
    const dir = new THREE.Vector3(Math.sin(a), 0.5, Math.cos(a)).normalize();
    ray.position.set(0, 9.15, 0).addScaledVector(dir, 0.62 + 0.6);
    ray.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    fig.add(ray);
  }
  // raised right arm (statue's right = −x when facing +z) with the torch
  const shoulder = new THREE.Vector3(-0.85, 7.35, 0.05);
  const hand = new THREE.Vector3(-1.35, 11.2, 0.25);
  const armDir = hand.clone().sub(shoulder);
  const arm = mesh(new THREE.CylinderGeometry(0.22, 0.3, armDir.length(), 8), patina);
  arm.position.copy(shoulder).addScaledVector(armDir, 0.5);
  arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), armDir.clone().normalize());
  fig.add(arm);
  const handle = mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.9, 8), patina);
  handle.position.copy(hand).add(new THREE.Vector3(0, 0.35, 0));
  const cup = mesh(new THREE.CylinderGeometry(0.42, 0.2, 0.42, 12), MAT.gold);
  cup.position.copy(hand).add(new THREE.Vector3(0, 0.95, 0));
  const flame = mesh(new THREE.ConeGeometry(0.34, 0.95, 10), flameMat, false);
  flame.position.copy(hand).add(new THREE.Vector3(0, 1.6, 0));
  fig.add(handle, cup, flame);
  // left arm holding the tablet
  const lArm = mesh(new THREE.CylinderGeometry(0.22, 0.26, 2.3, 8), patina);
  lArm.position.set(0.95, 6.3, 0.35);
  lArm.rotation.set(0.5, 0, 0.25);
  const tablet = mesh(rbox(0.85, 1.55, 0.24, 0.05), patina);
  tablet.position.set(1.15, 5.6, 0.8);
  tablet.rotation.set(0.15, -0.35, -0.2);
  fig.add(lArm, tablet);
  g.add(fig);
  // face the city and the default south-east camera
  fig.rotation.y = Math.PI * 0.62;
  fig.scale.setScalar(1.3);

  // torch glow sprite
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const cg = c.getContext('2d')!;
  const grad = cg.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,214,140,1)');
  grad.addColorStop(1, 'rgba(255,170,60,0)');
  cg.fillStyle = grad;
  cg.fillRect(0, 0, 64, 64);
  const glowMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.setScalar(5);
  const flameWorld = new THREE.Vector3();
  g.add(glow);

  const total = y + 12.6 * 1.3 - WATER_Y;
  return {
    group: g,
    height: total,
    update(_dt, t) {
      flameMat.emissiveIntensity = 0.4 + ENV.night * 2.6 + Math.sin(t * 9) * 0.08 * ENV.night;
      glowMat.opacity = ENV.night * 0.85;
      glow.visible = ENV.night > 0.02;
      if (glow.visible) {
        flame.getWorldPosition(flameWorld);
        g.worldToLocal(flameWorld);
        glow.position.copy(flameWorld);
      }
    },
  };
}

/* ======================================================================= */
/* Brooklyn Bridge                                                          */
/* ======================================================================= */

export interface BridgeSpec {
  x0: number;
  x1: number;
  z: number;
  /** tower x positions */
  towers: [number, number];
  rise: number;
  ground: number;
}

/** Deck height along the bridge (gentle arch). */
export function bridgeDeckY(s: BridgeSpec, x: number) {
  const t = THREE.MathUtils.clamp((x - s.x0) / (s.x1 - s.x0), 0, 1);
  return s.ground + s.rise * Math.sin(Math.PI * t);
}

export function buildBrooklynBridge(s: BridgeSpec): { group: THREE.Group; update: (dt: number, t: number) => void } {
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0xc9b79a, roughness: 0.92 });
  const stoneDark = new THREE.MeshStandardMaterial({ color: 0xa8957a, roughness: 0.95 });
  const deckMat = new THREE.MeshStandardMaterial({ color: 0xbcc6d2, roughness: 0.9 });
  const walkMat = new THREE.MeshStandardMaterial({ color: 0xb98d5f, roughness: 0.85 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x8c96a6, roughness: 0.5, metalness: 0.5 });
  const DECK_W = 7.2;

  // deck: short tilted segments following the arch
  const SEG = 52;
  for (let i = 0; i < SEG; i++) {
    const xa = s.x0 + ((s.x1 - s.x0) * i) / SEG;
    const xb = s.x0 + ((s.x1 - s.x0) * (i + 1)) / SEG;
    const ya = bridgeDeckY(s, xa);
    const yb = bridgeDeckY(s, xb);
    const len = Math.hypot(xb - xa, yb - ya) + 0.06;
    const ang = Math.atan2(yb - ya, xb - xa);
    const road = mesh(box(len, 0.35, DECK_W), deckMat, true, true);
    road.position.set((xa + xb) / 2, (ya + yb) / 2 - 0.17, s.z);
    road.rotation.z = ang;
    const truss = mesh(box(len, 0.9, DECK_W - 0.6), steel, true, false);
    truss.position.set((xa + xb) / 2, (ya + yb) / 2 - 0.8, s.z);
    truss.rotation.z = ang;
    // raised timber promenade down the middle
    const walk = mesh(box(len, 0.12, 1.5), walkMat, false, true);
    walk.position.set((xa + xb) / 2, (ya + yb) / 2 + 0.06, s.z);
    walk.rotation.z = ang;
    // railings
    for (const sz of [-1, 1]) {
      const rail = mesh(box(len, 0.5, 0.08), steel, false, false);
      rail.position.set((xa + xb) / 2, (ya + yb) / 2 + 0.25, s.z + sz * (DECK_W / 2 - 0.05));
      rail.rotation.z = ang;
      g.add(rail);
    }
    g.add(road, truss, walk);
  }
  // white lane dashes
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  for (let x = s.x0 + 2; x < s.x1 - 2; x += 2.6) {
    for (const lz of [-1.6, 1.6]) {
      const d = mesh(box(1.1, 0.03, 0.14), lineMat, false, false);
      const y0 = bridgeDeckY(s, x);
      d.position.set(x, y0 + 0.02, s.z + lz);
      d.rotation.z = Math.atan2(bridgeDeckY(s, x + 0.5) - bridgeDeckY(s, x - 0.5), 1);
      g.add(d);
    }
  }

  // anchorages at both ends
  for (const ax of [s.x0 + 3.5, s.x1 - 3.5]) {
    const top = Math.min(bridgeDeckY(s, ax - 3.5), bridgeDeckY(s, ax + 3.5)) - 0.6;
    const ah = top - WATER_Y;
    const a = mesh(rbox(7, ah, DECK_W + 3, 0.2), stoneDark);
    a.position.set(ax, WATER_Y + ah / 2, s.z);
    g.add(a);
  }

  // gothic towers: a stone slab with two pointed arches
  const TW = DECK_W + 4.2; // across the deck (z)
  const TH = 24;
  const TD = 3.4; // along the bridge (x)
  const towerShape = new THREE.Shape();
  towerShape.moveTo(-TW / 2, 0);
  towerShape.lineTo(TW / 2, 0);
  towerShape.lineTo(TW / 2 - 0.4, TH);
  towerShape.lineTo(-TW / 2 + 0.4, TH);
  towerShape.lineTo(-TW / 2, 0);
  const archH = (cx: number, base: number) => {
    const w = 3.2;
    const h = new THREE.Path();
    h.moveTo(cx - w / 2, base);
    h.lineTo(cx + w / 2, base);
    h.lineTo(cx + w / 2, base + 9);
    h.quadraticCurveTo(cx + w / 2, base + 10.6, cx, base + 11.8);
    h.quadraticCurveTo(cx - w / 2, base + 10.6, cx - w / 2, base + 9);
    h.lineTo(cx - w / 2, base);
    return h;
  };
  for (const tx of s.towers) {
    const deckAt = bridgeDeckY(s, tx) - WATER_Y;
    const sh = towerShape.clone();
    sh.holes = [archH(-1.95, deckAt - 1.4), archH(1.95, deckAt - 1.4)];
    const geo = new THREE.ExtrudeGeometry(sh, { depth: TD, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 1, curveSegments: 8 });
    geo.translate(0, 0, -TD / 2);
    geo.rotateY(Math.PI / 2); // shape x → world z
    const tower = mesh(geo, stone);
    tower.position.set(tx, WATER_Y, s.z);
    // caisson base + cornice
    const caisson = mesh(rbox(TD + 2.4, 3.0, TW + 2.4, 0.3), stoneDark);
    caisson.position.set(tx, WATER_Y + 0.9, s.z);
    const cornice = mesh(rbox(TD + 0.9, 0.7, TW + 0.5, 0.12), stoneDark);
    cornice.position.set(tx, WATER_Y + TH + 0.1, s.z);
    g.add(tower, caisson, cornice);
    // name plaques above the arches, on both faces
    for (const side of [1, -1]) {
      const plaque = signPlane('RAT RACE EXIT', 8.6, 1.5, { bg: '#2a2f3a', fg: '#f2c14e' });
      plaque.position.set(tx + side * (TD / 2 + 0.16), WATER_Y + TH - 3.2, s.z);
      plaque.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      g.add(plaque);
    }
  }
  const towerTop = WATER_Y + TH + 0.4;

  // main cables (4: two on each side) — anchor → tower → sag → tower → anchor
  const cableZ = [-DECK_W / 2 + 0.3, -1.0, 1.0, DECK_W / 2 - 0.3];
  const [t0, t1] = s.towers;
  const mid = (t0 + t1) / 2;
  const sagY = bridgeDeckY(s, mid) + 1.4;
  const anchorY0 = bridgeDeckY(s, s.x0 + 3.5) + 0.6;
  const anchorY1 = bridgeDeckY(s, s.x1 - 3.5) + 0.6;
  const cableY = (x: number) => {
    if (x <= t0) { // side span: mild sag between anchorage and tower
      const u = (x - (s.x0 + 3.5)) / (t0 - (s.x0 + 3.5));
      return anchorY0 + (towerTop - anchorY0) * u - Math.sin(Math.PI * u) * 1.6;
    }
    if (x >= t1) {
      const u = (x - t1) / (s.x1 - 3.5 - t1);
      return towerTop + (anchorY1 - towerTop) * u - Math.sin(Math.PI * u) * 1.6;
    }
    const u = (x - mid) / ((t1 - t0) / 2);
    return sagY + (towerTop - sagY) * u * u;
  };
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x9aa3b1, roughness: 0.45, metalness: 0.55 });
  for (const cz of cableZ) {
    const pts: THREE.Vector3[] = [];
    for (let x = s.x0 + 3.5; x <= s.x1 - 3.5 + 0.01; x += 1.0) pts.push(new THREE.Vector3(x, cableY(x), s.z + cz));
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = mesh(new THREE.TubeGeometry(curve, pts.length * 2, 0.11, 5, false), cableMat, true, false);
    g.add(tube);
  }
  // vertical suspenders + diagonal stays (one LineSegments draw call)
  const lp: number[] = [];
  for (let x = s.x0 + 5; x < s.x1 - 5; x += 1.25) {
    if (Math.abs(x - t0) < 2.2 || Math.abs(x - t1) < 2.2) continue;
    const dy = bridgeDeckY(s, x);
    for (const cz of [cableZ[0], cableZ[3]]) lp.push(x, cableY(x), s.z + cz, x, dy + 0.3, s.z + cz);
  }
  for (const tx of s.towers) {
    for (let k = 1; k <= 9; k++) {
      for (const dir of [-1, 1]) {
        const x = tx + dir * k * 2.0;
        const dy = bridgeDeckY(s, x);
        for (const cz of [cableZ[0], cableZ[3]]) lp.push(tx + dir * 1.8, towerTop - 1.2, s.z + cz, x, dy + 0.3, s.z + cz);
      }
    }
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
  const stays = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x8a94a3, transparent: true, opacity: 0.85 }));
  g.add(stays);

  // "necklace" lights along the outer main cables (glow at night)
  const bulbs: THREE.Vector3[] = [];
  for (let x = s.x0 + 5; x < s.x1 - 5; x += 2.2) for (const cz of [cableZ[0], cableZ[3]]) bulbs.push(new THREE.Vector3(x, cableY(x) + 0.12, s.z + cz));
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff0c8, emissiveIntensity: 0 });
  const bulbMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 6, 4), bulbMat, bulbs.length);
  const m4 = new THREE.Matrix4();
  bulbs.forEach((p, i) => bulbMesh.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z)));
  g.add(bulbMesh);
  // deck lamp posts
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2cc, emissiveIntensity: 0.4 });
  for (let x = s.x0 + 8; x < s.x1 - 6; x += 9) {
    for (const sz of [-1, 1]) {
      const y0 = bridgeDeckY(s, x);
      const post = mesh(new THREE.CylinderGeometry(0.06, 0.07, 2.4, 5), steel, false, false);
      post.position.set(x, y0 + 1.2, s.z + sz * (DECK_W / 2 - 0.2));
      const lamp = mesh(new THREE.SphereGeometry(0.2, 8, 6), lampMat, false, false);
      lamp.position.set(x, y0 + 2.5, s.z + sz * (DECK_W / 2 - 0.2));
      g.add(post, lamp);
    }
  }
  return {
    group: g,
    update() {
      bulbMat.emissiveIntensity = ENV.night * 3;
      lampMat.emissiveIntensity = 0.4 + ENV.night * 3;
    },
  };
}
