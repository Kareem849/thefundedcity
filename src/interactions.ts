// Hover + click picking, highlight and selection visuals.
import * as THREE from 'three';
import type { City, CityBuilding } from './city';
import { COLORS, ENV } from './buildings';

export interface InteractionHandlers {
  onSelect: (b: CityBuilding) => void;
  onDeselect: () => void;
  onHover: (b: CityBuilding | null, clientX: number, clientY: number) => void;
  /** Click on empty ground (point on the island surface), used to walk there. */
  onGround?: (point: THREE.Vector3) => void;
  /** Rideable vehicles: objects to test, plus hover/click callbacks. */
  vehicleTargets?: () => THREE.Object3D[];
  onVehicleHover?: (id: string | null, x: number, y: number) => void;
  onVehicleClick?: (id: string) => void;
}

export interface Interactions {
  select: (id: string | null, notify?: boolean) => void;
  selectedId: () => string | null;
  /** Re-tag a building's meshes (after rebuilding a tower). */
  tag: (b: CityBuilding) => void;
  update: (dt: number, t: number) => void;
}

const HOVER_WHITE = 0.13;
const HOVER_GLASS = new THREE.Color(0x3d7bff);
const WARM = new THREE.Color(0xffb04a);
const NIGHT_WINDOWS = new THREE.Color(0xfff1d6);

export function createInteractions(
  dom: HTMLElement,
  camera: THREE.Camera | (() => THREE.Camera),
  scene: THREE.Scene,
  city: City,
  h: InteractionHandlers,
): Interactions {
  const raycaster = new THREE.Raycaster();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.12);
  const ndc = new THREE.Vector2();
  let hovered: CityBuilding | null = null;
  let selected: CityBuilding | null = null;
  let down: { x: number; y: number; t: number } | null = null;
  let lastMove: { x: number; y: number } | null = null;

  const tag = (b: CityBuilding) => {
    b.root.traverse((o) => (o.userData.buildingId = b.id));
  };
  city.buildings.forEach(tag);

  // selection ring (two rings: a crisp one + a soft expanding pulse)
  const ringMat = new THREE.MeshBasicMaterial({ color: COLORS.royal, transparent: true, opacity: 0.9, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 72), ringMat);
  ring.rotation.x = -Math.PI / 2;
  const pulseMat = new THREE.MeshBasicMaterial({ color: COLORS.royal, transparent: true, opacity: 0.4, depthWrite: false });
  const pulse = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 72), pulseMat);
  pulse.rotation.x = -Math.PI / 2;
  const discMat = new THREE.MeshBasicMaterial({ color: COLORS.royal, transparent: true, opacity: 0.07, depthWrite: false });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 64), discMat);
  disc.rotation.x = -Math.PI / 2;
  const selGroup = new THREE.Group();
  selGroup.add(disc, ring, pulse);
  selGroup.visible = false;
  selGroup.renderOrder = 2;
  scene.add(selGroup);

  const pickables = () => [...city.buildings.values()].map((b) => b.root);

  const pick = (clientX: number, clientY: number): CityBuilding | null => {
    const r = dom.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, typeof camera === 'function' ? camera() : camera);
    const hits = raycaster.intersectObjects(pickables(), true);
    for (const hit of hits) {
      if (!(hit.object as THREE.Mesh).isMesh) continue;
      const id = hit.object.userData.buildingId as string | undefined;
      if (id) { lastBuildingDist = hit.distance; return city.buildings.get(id) ?? null; }
    }
    lastBuildingDist = Infinity;
    return null;
  };
  let lastBuildingDist = Infinity;
  /** Vehicle under the pointer (uses the ray from the last pick), if it is in front of any building. */
  const pickVehicle = (): string | null => {
    if (!h.vehicleTargets) return null;
    const hits = raycaster.intersectObjects(h.vehicleTargets(), true);
    for (const hit of hits) {
      const id = hit.object.userData.vehicleId as string | undefined;
      if (id && hit.distance <= lastBuildingDist + 0.5) return id;
    }
    return null;
  };
  let hoveredVehicle: string | null = null;

  const setHovered = (b: CityBuilding | null, x: number, y: number) => {
    if (hovered && hovered !== b) hovered.hoverTarget = 0;
    hovered = b;
    if (b) b.hoverTarget = 1;
    dom.style.cursor = b ? 'pointer' : '';
    h.onHover(b, x, y);
  };

  let raf = 0;
  dom.addEventListener('pointermove', (e) => {
    lastMove = { x: e.clientX, y: e.clientY };
    if (down && e.buttons) {
      // dragging: no hover changes, hide tooltip
      if (hovered) setHovered(null, e.clientX, e.clientY);
      return;
    }
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (!lastMove) return;
      let b = pick(lastMove.x, lastMove.y);
      const vid = pickVehicle();
      if (vid) b = null;
      if (vid !== hoveredVehicle) { hoveredVehicle = vid; h.onVehicleHover?.(vid, lastMove.x, lastMove.y); }
      else if (vid) h.onVehicleHover?.(vid, lastMove.x, lastMove.y);
      if (vid) { if (hovered) setHovered(null, lastMove.x, lastMove.y); dom.style.cursor = 'pointer'; return; }
      if (b !== hovered) setHovered(b, lastMove.x, lastMove.y);
      else if (b) h.onHover(b, lastMove.x, lastMove.y);
    });
  });
  dom.addEventListener('pointerleave', () => setHovered(null, 0, 0));
  dom.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  dom.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.t < 600;
    down = null;
    if (e.button !== 0 || moved > 6 || !quick) return;
    const b = pick(e.clientX, e.clientY);
    const vid = pickVehicle();
    if (vid && h.onVehicleClick) { h.onVehicleClick(vid); return; }
    if (b) api.select(b.id);
    else {
      api.select(null);
      const hit = new THREE.Vector3();
      if (h.onGround && raycaster.ray.intersectPlane(ground, hit)) h.onGround(hit);
    }
  });

  const api: Interactions = {
    select(id, notify = true) {
      const b = id ? city.buildings.get(id) ?? null : null;
      selected = b;
      if (!b) {
        selGroup.visible = false;
        if (notify) h.onDeselect();
        return;
      }
      selGroup.visible = true;
      selGroup.userData.age = 0;
      if (notify) h.onSelect(b);
    },
    selectedId: () => selected?.id ?? null,
    tag,
    update(dt, t) {
      // keep `selected` pointing at the live building object (towers can be rebuilt)
      if (selected) selected = city.buildings.get(selected.id) ?? null;
      if (hovered) {
        const live = city.buildings.get(hovered.id);
        if (live && live !== hovered) { hovered = live; live.hoverTarget = 1; }
      }
      for (const b of city.buildings.values()) {
        const target = Math.max(b.hoverTarget, b === selected ? 0.55 : 0);
        b.hover += (target - b.hover) * Math.min(1, dt * 12);
        const k = b.hover * HOVER_WHITE;
        b.mats.white.emissive.setRGB(k, k, k * 1.05);
        b.mats.trim.emissive.setRGB(k, k, k * 1.05);
        const g = b.mats.glass.emissive;
        // glass emissive is masked by the lit-window pattern
        g.copy(HOVER_GLASS).multiplyScalar(b.hover * 0.45);
        if (ENV.night > 0) g.add(NIGHT_WINDOWS.clone().multiplyScalar(ENV.night * 1.15));
        if (b.windowGlow > 0) g.add(WARM.clone().multiplyScalar(b.windowGlow * 0.9));
      }
      if (selected && selGroup.visible) {
        const p = selected.root.position;
        const r = selected.radius + 0.6;
        selGroup.position.set(p.x, p.y + 0.06, p.z);
        const age = (selGroup.userData.age = (selGroup.userData.age ?? 0) + dt);
        const intro = Math.min(1, age / 0.35);
        const e = 1 - Math.pow(1 - intro, 3);
        ring.scale.setScalar(r * (0.7 + 0.3 * e));
        disc.scale.setScalar(r * (0.7 + 0.3 * e));
        ringMat.opacity = 0.85 * e;
        discMat.opacity = 0.08 * e;
        const ph = (t * 0.7) % 1;
        pulse.scale.setScalar(r * (1 + ph * 0.35));
        pulseMat.opacity = 0.35 * (1 - ph) * e;
      }
    },
  };
  return api;
}
