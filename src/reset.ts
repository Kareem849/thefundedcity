// RESET: the yoga & mindset deck in Touch The Grass Park. A timber deck under a shade sail, two rows of
// mats facing the pond, traders sitting cross-legged and breathing with the instructor, a glowing breath
// orb that swells and settles (4 in · 4 hold · 6 out), lanterns for the evening sessions.
import * as THREE from 'three';
import { mesh, box, rbox, signPlane, makeBuildingMaterials } from './buildings';
import { bake, noBake } from './bake';

/** Touch The Grass Park: on the PLAZA district land east of Brooklyn (swapped with the Trading Floor) */
export const PARK = { x: 344, z: 28 };
export const RESET = { x: PARK.x - 2, z: PARK.z - 15, w: 13, d: 8 };
/** breath cycle shared with the panel: 0..1 fullness */
export function breathAt(t: number) {
  const c = t % 14;
  if (c < 4) return c / 4;
  if (c < 8) return 1;
  return 1 - (c - 8) / 6;
}

export function buildResetDeck() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  root.position.set(RESET.x, 0.12, RESET.z);
  const mats = makeBuildingMaterials();
  const wood = new THREE.MeshStandardMaterial({ color: 0xb98a5a, roughness: 0.8 });
  const post = new THREE.MeshStandardMaterial({ color: 0x8a6440, roughness: 0.7 });
  const sail = new THREE.MeshStandardMaterial({ color: 0xfffaf0, roughness: 0.9, side: THREE.DoubleSide });
  const deck = mesh(rbox(RESET.w, 0.3, RESET.d, 0.12), wood);
  deck.position.y = 0.15;
  body.add(deck);
  for (let x = -RESET.w / 2 + 0.8; x < RESET.w / 2; x += 0.8) {
    const plank = mesh(box(0.04, 0.02, RESET.d - 0.2), post, false);
    plank.position.set(x, 0.31, 0);
    body.add(plank);
  }
  // shade sail on four posts
  for (const [x, z, h] of [[-6, -3.6, 4.2], [6, -3.6, 3.6], [-6, 3.6, 3.4], [6, 3.6, 4.0]]) {
    const p = mesh(new THREE.CylinderGeometry(0.09, 0.11, h, 8), post);
    p.position.set(x, h / 2, z);
    body.add(p);
  }
  const sailGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-6, 4.1, -3.6), new THREE.Vector3(6, 3.5, -3.6), new THREE.Vector3(-6, 3.3, 3.6),
    new THREE.Vector3(6, 3.5, -3.6), new THREE.Vector3(6, 3.9, 3.6), new THREE.Vector3(-6, 3.3, 3.6),
  ]);
  sailGeo.computeVertexNormals();
  const sailM = new THREE.Mesh(sailGeo, sail);
  sailM.castShadow = true;
  body.add(sailM);
  // mats: two rows of five facing the pond (+z), plus the instructor's mat at the front
  const matCols = [0x7fd3c3, 0xf2c14e, 0xb9a6f2, 0xf29e8e, 0x8fb8f2];
  const spots: Array<{ x: number; z: number; face: number; teacher?: boolean }> = [];
  for (const z of [-2.4, -0.2]) for (let i = 0; i < 5; i++) {
    const x = -4.8 + i * 2.4;
    const m = mesh(box(0.9, 0.03, 1.9), new THREE.MeshStandardMaterial({ color: matCols[(i + (z > -1 ? 2 : 0)) % 5], roughness: 0.9 }), false);
    m.position.set(x, 0.32, z);
    body.add(m);
    spots.push({ x, z, face: 0 });
  }
  const tm = mesh(box(1.1, 0.03, 2.1), new THREE.MeshStandardMaterial({ color: 0x2bb894, roughness: 0.9 }), false);
  tm.position.set(0, 0.32, 2.7);
  body.add(tm);
  // sign + lanterns
  const sign = signPlane('RESET', 3.4, 1.2, { bg: '#1f5f4a', fg: '#ffffff', sub: 'YOGA · MINDSET · AI GUIDE', subColor: '#bff3e2' });
  sign.position.set(-7.4, 1.5, 2.6);
  sign.rotation.y = Math.PI / 2;
  const signBack = mesh(box(0.12, 1.3, 3.5), post);
  signBack.position.set(-7.5, 1.5, 2.6);
  const signLeg = mesh(box(0.12, 0.9, 0.12), post);
  signLeg.position.set(-7.5, 0.45, 2.6);
  body.add(sign, signBack, signLeg);
  const glow = new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0xffc861, emissiveIntensity: 0.4 });
  for (const [x, z] of [[-6.8, -4.2], [6.8, -4.2], [-6.8, 4.2], [6.8, 4.2]]) {
    const l = mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 6), post);
    l.position.set(x, 0.55, z);
    const head = mesh(new THREE.SphereGeometry(0.18, 10, 8), glow, false);
    head.position.set(x, 1.2, z);
    body.add(l, head);
  }
  bake(body);

  // people: seated, breathing (instanced legs / torso / head)
  const n = spots.length + 1;
  const legs = new THREE.InstancedMesh(box(0.9, 0.24, 0.55), new THREE.MeshStandardMaterial({ roughness: 0.8 }), n);
  const torso = new THREE.InstancedMesh(rbox(0.6, 0.78, 0.36, 0.12), new THREE.MeshStandardMaterial({ roughness: 0.7 }), n);
  const head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.25, 12, 10), new THREE.MeshStandardMaterial({ roughness: 0.6 }), n);
  for (const m of [legs, torso, head]) { m.castShadow = true; noBake(m); root.add(m); }
  const col = new THREE.Color();
  const tops = [0xffffff, 0x7fd3c3, 0xb9a6f2, 0xf29e8e, 0x13213f, 0xf2c14e];
  const skin = [0xd9a77e, 0x8d5a3b, 0xf1c7a5, 0xb98463, 0x6b4428];
  const people = [...spots, { x: 0, z: 2.7, face: Math.PI, teacher: true }];
  people.forEach((p, i) => {
    legs.setColorAt(i, col.setHex(p.teacher ? 0x2bb894 : 0x2a3140));
    torso.setColorAt(i, col.setHex(p.teacher ? 0x2bb894 : tops[i % tops.length]));
    head.setColorAt(i, col.setHex(skin[i % skin.length]));
  });
  // the breath orb above the instructor
  const orbMat = new THREE.MeshStandardMaterial({ color: 0xbff3e2, emissive: 0x2bd4a0, emissiveIntensity: 0.8, transparent: true, opacity: 0.55 });
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), orbMat);
  orb.position.set(0, 2.6, 2.7);
  noBake(orb);
  root.add(orb);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const p3 = new THREE.Vector3();
  const s3 = new THREE.Vector3(1, 1, 1);
  return {
    root, body, mats,
    height: 4.2,
    radius: 7.5,
    update(_dt: number, t: number) {
      const b = breathAt(t);
      people.forEach((p, i) => {
        q.setFromAxisAngle(up, p.face);
        const sway = Math.sin(t * 0.4 + i) * 0.02;
        m4.compose(p3.set(p.x, 0.45, p.z), q, s3.set(1, 1, 1));
        legs.setMatrixAt(i, m4);
        const sy = 1 + b * 0.06;
        m4.compose(p3.set(p.x + sway, 0.95 + b * 0.03, p.z), q, s3.set(1 + b * 0.04, sy, 1 + b * 0.04));
        torso.setMatrixAt(i, m4);
        m4.compose(p3.set(p.x + sway, 1.6 + b * 0.05, p.z), q, s3.set(1, 1, 1));
        head.setMatrixAt(i, m4);
      });
      legs.instanceMatrix.needsUpdate = true;
      torso.instanceMatrix.needsUpdate = true;
      head.instanceMatrix.needsUpdate = true;
      orb.scale.setScalar(0.7 + b * 0.9);
      orbMat.opacity = 0.35 + b * 0.35;
    },
  };
}
