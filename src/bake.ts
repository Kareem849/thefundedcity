// Static geometry baking: merges every plain mesh under a root into one mesh per material
// (and shadow flags). Keeps per-building materials, so hover/night effects still work, while
// cutting draw calls from dozens per building to a handful.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Mark an object (and its subtree) to be left alone by `bake`. */
export function noBake(o: THREE.Object3D) {
  o.userData.noBake = true;
  return o;
}

function normalise(g: THREE.BufferGeometry): THREE.BufferGeometry {
  let geo = g.index ? g.toNonIndexed() : g.clone();
  for (const name of Object.keys(geo.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') geo.deleteAttribute(name);
  if (!geo.attributes.normal) geo.computeVertexNormals();
  if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
  geo.clearGroups();
  geo.morphAttributes = {};
  return geo;
}

/**
 * Merge static meshes under `root` (in root-local space). Instanced meshes, multi-material meshes,
 * lines and anything under a `noBake` object are kept as they are.
 */
export function bake(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map<string, { mat: THREE.Material; cast: boolean; receive: boolean; geos: THREE.BufferGeometry[] }>();
  const victims: THREE.Mesh[] = [];
  const walk = (o: THREE.Object3D) => {
    if (o !== root && o.userData.noBake) return;
    const m = o as THREE.Mesh;
    if (m.isMesh && !(m as unknown as THREE.InstancedMesh).isInstancedMesh && !Array.isArray(m.material) && m.visible) {
      const key = `${m.material.uuid}|${m.castShadow ? 1 : 0}|${m.receiveShadow ? 1 : 0}`;
      let b = buckets.get(key);
      if (!b) { b = { mat: m.material, cast: m.castShadow, receive: m.receiveShadow, geos: [] }; buckets.set(key, b); }
      const geo = normalise(m.geometry);
      geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      b.geos.push(geo);
      victims.push(m);
    }
    for (const c of o.children) walk(c);
  };
  walk(root);
  if (victims.length < 2) return;
  for (const v of victims) v.removeFromParent();
  // drop now-empty groups
  const prune = (o: THREE.Object3D) => {
    for (const c of [...o.children]) {
      prune(c);
      if (c.type === 'Group' && c.children.length === 0 && !c.userData.noBake && !c.name) c.removeFromParent();
    }
  };
  prune(root);
  for (const b of buckets.values()) {
    const merged = b.geos.length === 1 ? b.geos[0] : mergeGeometries(b.geos, false);
    if (!merged) continue;
    merged.computeBoundingSphere();
    const mm = new THREE.Mesh(merged, b.mat);
    mm.castShadow = b.cast;
    mm.receiveShadow = b.receive;
    mm.userData.baked = true;
    root.add(mm);
    for (const g of b.geos) if (g !== merged) g.dispose();
  }
}
