// AI customer-service guards: one in front of every prop-firm HQ, beside a small "Ask AI" podium.
// Walk up (or click the tag) to ask them anything; answers come from Claude via the guard panel.
import * as THREE from 'three';
import { box, rbox } from './buildings';
import { noBake } from './bake';
import type { CityBuilding } from './city';
import type { NavGrid } from './navigation';

export interface Guard { firmId: string; firmName: string; x: number; z: number; yaw: number; color: number }

export function buildGuards(scene: THREE.Scene, firms: Array<{ b: CityBuilding; name: string; color: number }>, nav: NavGrid) {
  const guards: Guard[] = [];
  for (const { b, name, color } of firms) {
    const rot = b.body.rotation.y;
    const fx = Math.sin(rot);
    const fz = Math.cos(rot);
    // right of the entrance, a step in front of the façade
    const rx = Math.cos(rot);
    const rz = -Math.sin(rot);
    let gx = b.root.position.x + fx * 5.6 + rx * 2.4;
    let gz = b.root.position.z + fz * 5.6 + rz * 2.4;
    if (!nav.walkable(gx, gz)) {
      const near = nav.nearestWalkable(gx, gz, 6);
      if (!near) continue;
      gx = near.x;
      gz = near.z;
    }
    guards.push({ firmId: b.id, firmName: name, x: gx, z: gz, yaw: Math.atan2(fx, fz), color });
  }
  const n = guards.length;
  const Y = 0.12;
  const mk = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
    const m = new THREE.InstancedMesh(geo, mat, n);
    m.castShadow = true;
    noBake(m);
    scene.add(m);
    return m;
  };
  const navy = new THREE.MeshStandardMaterial({ color: 0x1b2442, roughness: 0.6 });
  const legs = mk(box(0.44, 0.95, 0.3), new THREE.MeshStandardMaterial({ color: 0x141a2e, roughness: 0.7 }));
  const torso = mk(rbox(0.66, 0.88, 0.4, 0.12), navy);
  const head = mk(new THREE.SphereGeometry(0.26, 12, 10), new THREE.MeshStandardMaterial({ roughness: 0.6 }));
  const cap = mk(new THREE.CylinderGeometry(0.28, 0.3, 0.16, 12), new THREE.MeshStandardMaterial({ color: 0x0e1426, roughness: 0.5 }));
  const vest = mk(box(0.68, 0.18, 0.42), new THREE.MeshStandardMaterial({ roughness: 0.5 }));
  const podium = mk(rbox(0.7, 1.15, 0.55, 0.1), new THREE.MeshStandardMaterial({ color: 0xf4f6fb, roughness: 0.4 }));
  const screen = mk(box(0.58, 0.4, 0.06), new THREE.MeshStandardMaterial({ color: 0x0b1530, emissive: 0x3d7bff, emissiveIntensity: 1.1, roughness: 0.3 }));
  const SKIN = [0xd9a77e, 0x8d5a3b, 0xf1c7a5, 0xb98463, 0x6b4428];
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  const p = new THREE.Vector3();
  const col = new THREE.Color();
  const place = (m: THREE.InstancedMesh, i: number, x: number, y: number, z: number, yaw: number) => {
    q.setFromAxisAngle(up, yaw);
    m4.compose(p.set(x, y, z), q, one);
    m.setMatrixAt(i, m4);
  };
  const pose = (t: number) => {
    guards.forEach((g, i) => {
      const look = g.yaw + Math.sin(t * 0.5 + i) * 0.35;
      const breathe = Math.sin(t * 2 + i) * 0.012;
      place(legs, i, g.x, Y + 0.5, g.z, g.yaw);
      place(torso, i, g.x, Y + 1.43 + breathe, g.z, g.yaw);
      place(vest, i, g.x, Y + 1.66 + breathe, g.z, g.yaw);
      place(head, i, g.x, Y + 2.12 + breathe, g.z, look);
      place(cap, i, g.x, Y + 2.34 + breathe, g.z, look);
      // podium to the guard's left, screen tilted toward the street
      const lx = g.x - Math.cos(g.yaw) * 0.95;
      const lz = g.z + Math.sin(g.yaw) * 0.95;
      place(podium, i, lx, Y + 0.58, lz, g.yaw);
      q.setFromEuler(new THREE.Euler(-0.5, g.yaw, 0, 'YXZ'));
      m4.compose(p.set(lx + Math.sin(g.yaw) * 0.2, Y + 1.25, lz + Math.cos(g.yaw) * 0.2), q, one);
      screen.setMatrixAt(i, m4);
    });
    for (const m of [legs, torso, vest, head, cap, podium, screen]) m.instanceMatrix.needsUpdate = true;
  };
  guards.forEach((g, i) => {
    head.setColorAt(i, col.setHex(SKIN[i % SKIN.length]));
    vest.setColorAt(i, col.setHex(g.color));
  });
  pose(0);
  let acc = 0;
  return {
    guards,
    update(dt: number, t: number, night: number) {
      (screen.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.9 + night * 1.2 + Math.sin(t * 4) * 0.1;
      acc += dt;
      if (acc > 0.1) { acc = 0; pose(t); }
    },
  };
}
