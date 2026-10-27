// Isometric orthographic camera + constrained, damped controls (the city view), plus a third-person
// perspective chase camera for the walk / drive / sail / fly views.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { tween, ease, cancelGroup, lerp } from './anim';

export interface CameraRig {
  camera: THREE.OrthographicCamera;
  controls: OrbitControls;
  resize: (w: number, h: number) => void;
  focusOn: (point: THREE.Vector3, opts?: { zoom?: number; duration?: number; blend?: number }) => void;
  /** Zoom in or out to an exact level, keeping the current target and angle. */
  zoomTo: (zoom: number, duration?: number) => void;
  reset: (duration?: number) => void;
  update: (dt?: number) => void;
  /** Keep the camera centred on a moving point (the walking avatar); null stops following. */
  follow: (get: (() => THREE.Vector3) | null) => void;
  readonly animating: boolean;
  rotateBy: (deg: number) => void;
  /** The camera to render with right now (city view or chase view). */
  readonly view: THREE.Camera;
  readonly chasing: boolean;
  /** Start a chase view behind a moving subject; null returns to the city view. */
  setChase: (get: (() => ChaseSubject) | null) => void;
  /** Sit at a fixed spot inside a building (look around by dragging); null leaves. */
  setInterior: (v: InteriorCam | null) => void;
  readonly interior: boolean;
  /** Horizontal forward direction of the current view. */
  forward: (out: THREE.Vector3) => THREE.Vector3;
  setOrbit: (on: boolean) => void;
  onOrbit: (cb: (on: boolean) => void) => void;
}

export type ChaseKind = 'walk' | 'car' | 'boat' | 'plane' | 'heli' | 'cable';
export interface ChaseSubject {
  pos: THREE.Vector3;
  /** heading in the XZ plane: forward = (sin h, cos h) */
  heading: number;
  kind: ChaseKind;
  /** rough half-length of the subject (world units) */
  size: number;
}

export interface InteriorCam { pos: THREE.Vector3; look: THREE.Vector3; fov?: number }

const HOME_TARGET = new THREE.Vector3(66, 2, 12);
const HOME_AZIMUTH = Math.PI / 4; // 45° — camera sits south-east of the city
const HOME_POLAR = THREE.MathUtils.degToRad(54); // elevated, looking down
const DISTANCE = 420;
const VIEW_HEIGHT = 196; // world units visible vertically at zoom 1
const HOME_ZOOM = 0.66;

export function createCameraRig(dom: HTMLElement, bounds: { minX: number; maxX: number; minZ: number; maxZ: number }): CameraRig {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 1600);
  const setFromAngles = (target: THREE.Vector3, az: number, polar: number) => {
    const s = new THREE.Spherical(DISTANCE, polar, az);
    camera.position.setFromSpherical(s).add(target);
    camera.lookAt(target);
  };
  setFromAngles(HOME_TARGET, HOME_AZIMUTH, HOME_POLAR);
  camera.zoom = HOME_ZOOM;

  const controls = new OrbitControls(camera, dom);
  controls.target.copy(HOME_TARGET);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = false; // pan across the ground plane
  controls.zoomToCursor = true;
  controls.minZoom = 0.3;
  controls.maxZoom = 7;
  controls.zoomSpeed = 1.1;
  controls.panSpeed = 1.0;
  controls.rotateSpeed = 0.6;
  controls.autoRotateSpeed = 0.8;
  // full 360° orbit around the city; only the tilt is limited so you can't go underneath
  controls.minPolarAngle = THREE.MathUtils.degToRad(30);
  controls.maxPolarAngle = THREE.MathUtils.degToRad(64);
  // left-drag orbits 360°, right-drag (or shift+drag) pans
  controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  // any manual interaction stops auto-orbit
  controls.addEventListener('start', () => { if (controls.autoRotate) { controls.autoRotate = false; onOrbitChange?.(false); } });
  controls.update();

  // keep the target on the island so users can't lose the city
  const margin = 6;
  const clampTarget = () => {
    const t = controls.target;
    const cx = THREE.MathUtils.clamp(t.x, bounds.minX + margin, bounds.maxX - margin);
    const cz = THREE.MathUtils.clamp(t.z, bounds.minZ + margin, bounds.maxZ - margin);
    const dx = cx - t.x;
    const dz = cz - t.z;
    if (dx || dz) {
      t.x = cx;
      t.z = cz;
      camera.position.x += dx;
      camera.position.z += dz;
    }
  };
  controls.addEventListener('change', clampTarget);

  let animating = false;
  let onOrbitChange: ((on: boolean) => void) | null = null;
  let followGet: (() => THREE.Vector3) | null = null;

  /* ---------------- chase view ---------------- */
  const chaseCam = new THREE.PerspectiveCamera(55, 1, 0.3, 2200);
  let chaseGet: (() => ChaseSubject) | null = null;
  let camYaw = 0;
  let userYaw = 0;
  let userPitch = 0;
  let zoomMul = 1;
  let dragging = false;
  let lastDrag = 0;
  let snapNext = true;
  const look = new THREE.Vector3();
  const want = new THREE.Vector3();
  let dragX = 0;
  let dragY = 0;
  let interior: InteriorCam | null = null;
  let iYaw = 0;
  let iPitch = 0;
  let iFov = 55;
  dom.addEventListener('pointerdown', (e) => {
    if ((!chaseGet && !interior) || e.button !== 0) return;
    dragging = true;
    dragX = e.clientX;
    dragY = e.clientY;
  });
  window.addEventListener('pointermove', (e) => {
    if (!dragging || (!chaseGet && !interior)) return;
    if (interior) {
      iYaw += (e.clientX - dragX) * 0.005;
      iPitch = THREE.MathUtils.clamp(iPitch + (e.clientY - dragY) * 0.004, -0.75, 0.75);
    } else {
      userYaw -= (e.clientX - dragX) * 0.006;
      userPitch = THREE.MathUtils.clamp(userPitch + (e.clientY - dragY) * 0.004, -0.5, 0.9);
    }
    dragX = e.clientX;
    dragY = e.clientY;
    lastDrag = performance.now();
  });
  window.addEventListener('pointerup', () => { dragging = false; });
  dom.addEventListener('wheel', (e) => {
    if (interior) {
      e.preventDefault();
      iFov = THREE.MathUtils.clamp(iFov * (e.deltaY > 0 ? 1.08 : 0.92), 28, 80);
      return;
    }
    if (!chaseGet) return;
    e.preventDefault();
    zoomMul = THREE.MathUtils.clamp(zoomMul * (e.deltaY > 0 ? 1.1 : 0.9), 0.55, 2.6);
  }, { passive: false });
  const CHASE: Record<ChaseKind, { dist: number; height: number; ahead: number; lookY: number; perSize: number }> = {
    walk: { dist: 7.5, height: 3.4, ahead: 3, lookY: 1.6, perSize: 0 },
    car: { dist: 9, height: 3.8, ahead: 5, lookY: 1.2, perSize: 1.5 },
    boat: { dist: 10, height: 5, ahead: 8, lookY: 1, perSize: 1.9 },
    plane: { dist: 12, height: 4.5, ahead: 14, lookY: 1, perSize: 2.4 },
    heli: { dist: 13, height: 6, ahead: 6, lookY: 0, perSize: 1.6 },
    cable: { dist: 11, height: 5.2, ahead: 10, lookY: -1.4, perSize: 0 },
  };
  const angDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const updateChase = (dt: number) => {
    const s = chaseGet!();
    const c = CHASE[s.kind];
    const goalYaw = s.heading + userYaw;
    if (snapNext) camYaw = goalYaw;
    else camYaw += angDiff(goalYaw, camYaw) * Math.min(1, dt * (s.kind === 'walk' ? 3.2 : 2.6));
    if (!dragging && performance.now() - lastDrag > 2500) {
      userYaw *= Math.pow(0.35, dt);
      userPitch *= Math.pow(0.35, dt);
    }
    const dist = (c.dist + s.size * c.perSize) * zoomMul;
    const height = (c.height + s.size * c.perSize * 0.35) * zoomMul * (1 + userPitch);
    want.set(s.pos.x - Math.sin(camYaw) * dist, s.pos.y + height, s.pos.z - Math.cos(camYaw) * dist);
    want.y = Math.max(want.y, 1.2);
    if (snapNext) chaseCam.position.copy(want);
    else chaseCam.position.lerp(want, Math.min(1, dt * 7));
    look.set(s.pos.x + Math.sin(camYaw) * c.ahead, s.pos.y + c.lookY, s.pos.z + Math.cos(camYaw) * c.ahead);
    chaseCam.lookAt(look);
    snapNext = false;
  };

  const dirV = new THREE.Vector3();
  const updateInterior = (dt: number) => {
    const v = interior!;
    dirV.subVectors(v.look, v.pos);
    const baseYaw = Math.atan2(dirV.x, dirV.z);
    const basePitch = Math.atan2(dirV.y, Math.hypot(dirV.x, dirV.z));
    const yaw = baseYaw - iYaw;
    const pitch = THREE.MathUtils.clamp(basePitch - iPitch, -1.3, 1.3);
    chaseCam.position.copy(v.pos);
    look.set(v.pos.x + Math.sin(yaw) * Math.cos(pitch), v.pos.y + Math.sin(pitch), v.pos.z + Math.cos(yaw) * Math.cos(pitch));
    chaseCam.lookAt(look);
    if (Math.abs(chaseCam.fov - iFov) > 0.05) {
      chaseCam.fov += (iFov - chaseCam.fov) * Math.min(1, dt * 8);
      chaseCam.updateProjectionMatrix();
    }
  };

  const resize = (w: number, h: number) => {
    const aspect = w / h;
    chaseCam.aspect = aspect;
    chaseCam.updateProjectionMatrix();
    // on narrow / short screens show a bit more of the world
    const vh = VIEW_HEIGHT * (aspect < 1.3 ? 1.3 / aspect : 1);
    camera.left = (-vh * aspect) / 2;
    camera.right = (vh * aspect) / 2;
    camera.top = vh / 2;
    camera.bottom = -vh / 2;
    camera.updateProjectionMatrix();
  };

  const animateTo = (target: THREE.Vector3, az: number, polar: number, zoom: number, duration: number) => {
    cancelGroup('camera');
    // flush any damped pan/rotate momentum so it can't drift the camera after the animation
    const damping = controls.enableDamping;
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = damping;
    const fromT = controls.target.clone();
    const offset = camera.position.clone().sub(controls.target);
    const fromS = new THREE.Spherical().setFromVector3(offset);
    const fromZ = camera.zoom;
    // take the shortest way round
    while (az - fromS.theta > Math.PI) az -= Math.PI * 2;
    while (az - fromS.theta < -Math.PI) az += Math.PI * 2;
    animating = true;
    controls.enabled = false;
    tween(
      { duration, easing: ease.inOutCubic, group: 'camera', onComplete: () => { animating = false; controls.enabled = !chaseGet; } },
      (v) => {
        controls.target.lerpVectors(fromT, target, v);
        const s = new THREE.Spherical(DISTANCE, lerp(fromS.phi, polar, v), lerp(fromS.theta, az, v));
        camera.position.setFromSpherical(s).add(controls.target);
        camera.zoom = lerp(fromZ, zoom, v);
        camera.updateProjectionMatrix();
        camera.lookAt(controls.target);
      },
    );
  };

  return {
    camera,
    controls,
    resize,
    focusOn(point, opts = {}) {
      const blend = opts.blend ?? 0.75;
      const cur = controls.target.clone();
      const target = new THREE.Vector3(lerp(cur.x, point.x, blend), lerp(cur.y, point.y, blend), lerp(cur.z, point.z, blend));
      const offset = camera.position.clone().sub(controls.target);
      const s = new THREE.Spherical().setFromVector3(offset);
      animateTo(target, s.theta, s.phi, Math.max(camera.zoom, opts.zoom ?? 1.5), opts.duration ?? 0.9);
    },
    zoomTo(zoom, duration = 0.8) {
      const offset = camera.position.clone().sub(controls.target);
      const s = new THREE.Spherical().setFromVector3(offset);
      animateTo(controls.target.clone(), s.theta, s.phi, THREE.MathUtils.clamp(zoom, controls.minZoom, controls.maxZoom), duration);
    },
    reset(duration = 1.0) {
      animateTo(HOME_TARGET.clone(), HOME_AZIMUTH, HOME_POLAR, HOME_ZOOM, duration);
    },
    update(dt = 1 / 60) {
      if (interior) updateInterior(dt);
      else if (chaseGet) updateChase(dt);
      if (animating) return;
      if (followGet) {
        const p = followGet();
        const k = Math.min(1, dt * 4.5);
        const dx = (p.x - controls.target.x) * k;
        const dz = (p.z - controls.target.z) * k;
        const dy = (Math.max(2, p.y) - controls.target.y) * k; // rise with aircraft
        controls.target.x += dx;
        controls.target.y += dy;
        controls.target.z += dz;
        camera.position.x += dx;
        camera.position.y += dy;
        camera.position.z += dz;
      }
      controls.update();
    },
    follow(get) {
      followGet = get;
    },
    get view() {
      return chaseGet || interior ? chaseCam : camera;
    },
    get chasing() {
      return !!chaseGet || !!interior;
    },
    get interior() {
      return !!interior;
    },
    setInterior(v) {
      interior = v;
      iYaw = 0;
      iPitch = 0;
      iFov = v?.fov ?? 58;
      if (v) {
        chaseCam.fov = iFov;
        chaseCam.updateProjectionMatrix();
        controls.enabled = false;
        controls.autoRotate = false;
      } else {
        chaseCam.fov = 55;
        chaseCam.updateProjectionMatrix();
        controls.enabled = !chaseGet && !animating;
      }
    },
    setChase(get) {
      if (get && !chaseGet) { snapNext = true; userYaw = 0; userPitch = 0; }
      chaseGet = get;
      controls.enabled = !get && !animating;
      if (get) { controls.autoRotate = false; onOrbitChange?.(false); }
    },
    forward(out) {
      if (chaseGet) out.set(Math.sin(camYaw), 0, Math.cos(camYaw));
      else out.subVectors(controls.target, camera.position).setY(0).normalize();
      return out;
    },
    get animating() {
      return animating;
    },
    rotateBy(deg) {
      const offset = camera.position.clone().sub(controls.target);
      const s = new THREE.Spherical().setFromVector3(offset);
      animateTo(controls.target.clone(), s.theta + THREE.MathUtils.degToRad(deg), s.phi, camera.zoom, 0.8);
    },
    setOrbit(on) {
      controls.autoRotate = on;
      onOrbitChange?.(on);
    },
    onOrbit(cb) {
      onOrbitChange = cb;
    },
  };
}
