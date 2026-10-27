// The key game mechanic: a verified payout grows the trader's tower to its new level (or crown)
// with a construction animation, warm windows, crown flourish and gold sparkles.
import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { tween, after, ease, cancelGroup } from './anim';
import type { City, CityBuilding } from './city';
import type { Trader } from './data';

const G = 'payout';

/* ---------------- shared FX resources ---------------- */

let dotTexture: THREE.Texture | null = null;
function getDotTexture() {
  if (dotTexture) return dotTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,248,225,1)');
  grad.addColorStop(0.3, 'rgba(255,220,140,0.9)');
  grad.addColorStop(1, 'rgba(255,200,100,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  dotTexture = new THREE.CanvasTexture(c);
  dotTexture.colorSpace = THREE.SRGBColorSpace;
  return dotTexture;
}

let glowTexture: THREE.Texture | null = null;
function getGlowTexture() {
  if (glowTexture) return glowTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(128, 128, 30, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,214,120,0.95)');
  grad.addColorStop(0.45, 'rgba(255,200,100,0.45)');
  grad.addColorStop(1, 'rgba(255,190,90,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  glowTexture = new THREE.CanvasTexture(c);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

export interface PayoutContext {
  city: City;
  scene: THREE.Scene;
  trader: Trader;
  focus: (b: CityBuilding) => void;
  /** Called mid-sequence once the tower has visibly upgraded. */
  onLevelUp: () => void;
  onDataUpdate: () => void;
  onDone: () => void;
  makeToast: () => HTMLElement;
  makeLevelChip: (level: number, crown?: Trader['crown']) => HTMLElement;
  /** Rebuild the tower at the trader's new level / crown and return the new building. */
  upgrade: () => CityBuilding;
  /** Keep the floating name pin at the top of the tower. */
  setPinHeight: (y: number) => void;
}

const effects: THREE.Object3D[] = [];
function track<T extends THREE.Object3D>(o: T): T {
  effects.push(o);
  return o;
}

/** Remove any in-flight payout effects (used by Reset demo and before a new run). */
export function clearPayoutEffects(scene: THREE.Scene) {
  cancelGroup(G);
  for (const o of effects) {
    o.removeFromParent();
    if (o instanceof CSS2DObject) o.element.remove();
    scene.remove(o);
  }
  effects.length = 0;
}

export function runPayout(ctx: PayoutContext, willLevelUp: boolean) {
  const { city, scene } = ctx;
  const b = city.buildings.get(ctx.trader.id)!;
  const tower = b.tower!;
  const base = b.root.position.clone();

  // 1. floating "+$25,000 VERIFIED PAYOUT" notification above the tower
  const toast = track(new CSS2DObject(ctx.makeToast()));
  toast.position.set(0, b.height + 3, 0);
  b.root.add(toast);
  after(2.8, () => {
    toast.removeFromParent();
    toast.element.remove();
  }, G);

  // 3. camera attention
  ctx.focus(b);

  // 4. gold glow blooming at the base
  const glowMat = new THREE.MeshBasicMaterial({ map: getGlowTexture(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const glow = track(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat));
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(base.x, base.y + 0.33, base.z);
  glow.scale.setScalar(tower.radius * 3.4);
  glow.renderOrder = 3;
  scene.add(glow);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xf1c96b, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const ring = track(new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 80), ringMat));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(base.x, base.y + 0.36, base.z);
  scene.add(ring);
  tween({ duration: 2.9, delay: 0.25, easing: ease.linear, group: G }, (v) => {
    const k = v < 0.2 ? v / 0.2 : 1 - (v - 0.2) / 0.8;
    glowMat.opacity = 0.85 * Math.max(0, k) * (0.85 + 0.15 * Math.sin(v * 30));
  });
  tween({ duration: 1.4, delay: 0.3, easing: ease.outCubic, group: G }, (v) => {
    ring.scale.setScalar(tower.radius * (0.9 + v * 1.1));
    ringMat.opacity = 0.9 * (1 - v);
  });

  // 5–6. architectural upgrade
  let growDone = 0.6;
  if (willLevelUp) growDone = growTower(ctx, b.height);

  // 7. windows illuminate (warm, staggered with construction)
  tween({ duration: 1.5, delay: 0.9, easing: ease.linear, group: G, onComplete: () => { const l = city.buildings.get(ctx.trader.id); if (l) l.windowGlow = 0; } }, (v) => {
    const live = city.buildings.get(ctx.trader.id);
    if (live) live.windowGlow = ease.bell(v) * 0.9;
  });

  // 8. crown flourish
  after(growDone - 0.1, () => {
    const crown = city.buildings.get(ctx.trader.id)?.tower?.crown;
    if (!crown) return;
    const s0 = crown.scale.x;
    const r0 = crown.rotation.y;
    tween({ duration: 1.1, easing: ease.outCubic, group: G }, (v) => {
      crown.rotation.y = r0 + v * Math.PI * 2;
      crown.scale.setScalar(s0 * (1 + 0.2 * ease.bell(v)));
    });
  }, G);

  // 9. restrained gold sparkles
  after(growDone - 0.2, () => sparkles(scene, base, city.buildings.get(ctx.trader.id)!), G);

  // 10–13. data/UI updates
  after(0.4, ctx.onDataUpdate, G);
  if (willLevelUp) {
    after(growDone, () => {
      ctx.onLevelUp();
      const chip = track(new CSS2DObject(ctx.makeLevelChip(ctx.trader.level, ctx.trader.crown)));
      const live = city.buildings.get(ctx.trader.id)!;
      chip.position.set(0, live.height + 0.5, 0);
      live.root.add(chip);
      after(2.2, () => { chip.removeFromParent(); chip.element.remove(); }, G);
    }, G);
  }
  after(Math.max(3.0, growDone + 1.55), () => {
    clearPayoutEffects(scene);
    ctx.onDone();
  }, G);
}

/**
 * Swap in the bigger tower and grow it out of the old one: the new body rises from the old height
 * to full height with a little overshoot, then settles. Returns when the growth completes.
 */
function growTower(ctx: PayoutContext, oldHeight: number): number {
  const nb = ctx.upgrade();
  const body = nb.body;
  const from = Math.min(0.98, Math.max(0.2, oldHeight / nb.height));
  body.scale.y = from;
  const start = 0.55;
  const dur = 1.5;
  tween({ duration: dur, delay: start, easing: ease.outBack, group: G }, (v) => {
    const k = from + (1 - from) * v;
    body.scale.y = k;
    ctx.setPinHeight(nb.height * k);
  });
  after(start + dur, () => { body.scale.y = 1; ctx.setPinHeight(nb.height); }, G);
  return start + dur;
}

function sparkles(scene: THREE.Scene, base: THREE.Vector3, b: CityBuilding) {
  const N = 90;
  const pos = new Float32Array(N * 3);
  const vel: THREE.Vector3[] = [];
  const h = b.height;
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 2.5 + Math.random() * 3.2;
    const y = Math.random() * h * 0.9 + 1;
    pos.set([base.x + Math.cos(a) * r, base.y + y, base.z + Math.sin(a) * r], i * 3);
    vel.push(new THREE.Vector3(Math.cos(a) * 0.6, 1.4 + Math.random() * 2.2, Math.sin(a) * 0.6));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    map: getDotTexture(), size: 0.75, sizeAttenuation: true, transparent: true, opacity: 1,
    depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffe2a0,
  });
  const pts = track(new THREE.Points(geo, mat));
  pts.renderOrder = 4;
  scene.add(pts);
  let last = 0;
  tween({ duration: 1.7, easing: ease.linear, group: G, onComplete: () => { scene.remove(pts); geo.dispose(); mat.dispose(); } }, (v) => {
    const dt = (v - last) * 1.7;
    last = v;
    for (let i = 0; i < N; i++) {
      pos[i * 3] += vel[i].x * dt;
      pos[i * 3 + 1] += vel[i].y * dt;
      pos[i * 3 + 2] += vel[i].z * dt;
      vel[i].y *= 0.985;
    }
    geo.attributes.position.needsUpdate = true;
    mat.opacity = v < 0.15 ? v / 0.15 : 1 - (v - 0.15) / 0.85;
    mat.size = 0.75 * (1 - v * 0.4) * (0.85 + 0.15 * Math.sin(v * 40));
  });
}
