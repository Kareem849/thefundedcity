// The user's walking character: path-following, keyboard control, discovery and skip.
import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { buildAvatar, type Avatar, type AvatarConfig } from './avatar';
import type { NavGrid, P2 } from './navigation';
import type { CameraRig } from './camera';
import { tween, ease } from './anim';

export interface Place {
  id: string;
  name: string;
  kind: 'trader' | 'firm' | 'commercial' | 'landmark' | 'media' | 'stadium' | 'cafe' | 'bank' | 'airport' | 'lab' | 'reset' | 'plaza' | 'floor' | 'hall' | 'founders';
  x: number;
  z: number;
  /** discovery radius (distance from the place centre) */
  r: number;
}

export interface PlayerProfile {
  name: string;
  status: 'guest' | 'member';
  email?: string;
  config: AvatarConfig;
}

export interface WalkState {
  label: string;
  remaining: number; // metres (world units)
  eta: number; // seconds
}

interface Deps {
  scene: THREE.Scene;
  nav: NavGrid;
  rig: CameraRig;
  groundY: number;
  /** Optional terrain height (e.g. the bridge deck). */
  heightAt?: (x: number, z: number) => number;
  places: Place[];
  makePin: (p: PlayerProfile) => HTMLElement;
  onDiscover: (place: Place) => void;
  onArrive: (placeId: string | null) => void;
  onWalkState: (s: WalkState | null) => void;
  /** pause keyboard control while typing in an input */
  isTyping: () => boolean;
}

const AVATAR_SCALE = 1.5;
const WALK_SPEED = 5.2; // world units per second
const SPAWN: P2 = { x: 5.5, z: 6.5 };

export function createPlayer(d: Deps) {
  const root = new THREE.Group();
  root.visible = false;
  d.scene.add(root);
  let avatar: Avatar | null = null;
  let profile: PlayerProfile | null = null;
  let listening = false; // the city radio is on: the character wears headphones
  const pos = new THREE.Vector3(SPAWN.x, d.groundY, SPAWN.z);
  let yaw = Math.PI / 4;
  let path: P2[] = [];
  let pathIdx = 0;
  let targetPlace: string | null = null;
  let targetLabel = '';
  let speedNow = 0;
  let stateTimer = 0;
  let discoverTimer = 0;
  let followLinger = 0;
  let spawning = false;
  /** while riding a vehicle: where the character is (the vehicle's position) */
  let ride: (() => THREE.Vector3) | null = null;
  let rideVisible = false;
  const discovered = new Set<string>();
  const keys = new Set<string>();
  let pin: CSS2DObject | null = null;

  /* route line + destination marker */
  const routeMat = new THREE.LineDashedMaterial({ color: 0x2f6bff, dashSize: 0.5, gapSize: 0.32, transparent: true, opacity: 0.9, depthWrite: false });
  let route: THREE.Line | null = null;
  const destMat = new THREE.MeshBasicMaterial({ color: 0x2f6bff, transparent: true, opacity: 0.8, depthWrite: false });
  const dest = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 40), destMat);
  dest.rotation.x = -Math.PI / 2;
  dest.visible = false;
  d.scene.add(dest);
  const ghostMat = new THREE.MeshBasicMaterial({ color: 0x2f6bff, transparent: true, opacity: 0.45, depthWrite: false, depthFunc: THREE.GreaterDepth });
  const spawnRingMat = new THREE.MeshBasicMaterial({ color: 0xe8bf62, transparent: true, opacity: 0, depthWrite: false });
  const spawnRing = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), spawnRingMat);
  spawnRing.rotation.x = -Math.PI / 2;
  d.scene.add(spawnRing);

  const clearRoute = () => {
    if (route) {
      d.scene.remove(route);
      route.geometry.dispose();
      route = null;
    }
    dest.visible = false;
  };

  const drawRoute = () => {
    clearRoute();
    const pts = [new THREE.Vector3(pos.x, d.groundY + 0.12, pos.z), ...path.slice(pathIdx).map((p) => new THREE.Vector3(p.x, d.groundY + 0.12, p.z))];
    if (pts.length < 2) return;
    route = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), routeMat);
    route.computeLineDistances();
    route.renderOrder = 2;
    d.scene.add(route);
    const last = path[path.length - 1];
    dest.position.set(last.x, d.groundY + 0.1, last.z);
    dest.visible = true;
  };

  const remainingDistance = () => {
    let dist = 0;
    let prev: P2 = { x: pos.x, z: pos.z };
    for (let i = pathIdx; i < path.length; i++) {
      dist += Math.hypot(path[i].x - prev.x, path[i].z - prev.z);
      prev = path[i];
    }
    return dist;
  };

  const pulseRing = () => {
    spawnRing.position.set(pos.x, d.groundY + 0.08, pos.z);
    tween({ duration: 0.9, easing: ease.outCubic }, (v) => {
      spawnRing.scale.setScalar(0.6 + v * 1.8);
      spawnRingMat.opacity = 0.9 * (1 - v);
    });
  };

  const checkDiscoveries = (force?: string) => {
    for (const p of d.places) {
      if (discovered.has(p.id)) continue;
      if (p.id === force || Math.hypot(p.x - pos.x, p.z - pos.z) <= p.r) {
        discovered.add(p.id);
        d.onDiscover(p);
      }
    }
  };

  const arrive = () => {
    path = [];
    pathIdx = 0;
    clearRoute();
    d.onWalkState(null);
    if (targetPlace) checkDiscoveries(targetPlace);
    const id = targetPlace;
    targetPlace = null;
    followLinger = 1.2;
    d.onArrive(id);
  };

  const startWalk = (to: P2, label: string, placeId: string | null) => {
    const p = d.nav.findPath({ x: pos.x, z: pos.z }, to);
    if (!p || p.length < 2) {
      // already there (or unreachable): treat as arrival
      targetPlace = placeId;
      arrive();
      return false;
    }
    path = p;
    pathIdx = 1;
    targetPlace = placeId;
    targetLabel = label;
    drawRoute();
    d.rig.follow(() => pos);
    if (!d.rig.chasing && d.rig.camera.zoom < 3) d.rig.focusOn(pos.clone(), { zoom: 3.4, blend: 1, duration: 0.7 });
    const dist = remainingDistance();
    d.onWalkState({ label, remaining: dist, eta: dist / WALK_SPEED });
    return true;
  };

  /* keyboard: WASD / arrow keys walk relative to the camera */
  const keyMap: Record<string, string> = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
  window.addEventListener('keydown', (e) => {
    if (!root.visible || ride || d.isTyping() || d.rig.interior) return;
    const k = keyMap[e.code];
    if (!k) return;
    e.preventDefault();
    keys.add(k);
    if (path.length) {
      path = [];
      clearRoute();
      d.onWalkState(null);
      targetPlace = null;
    }
  });
  window.addEventListener('keyup', (e) => {
    const k = keyMap[e.code];
    if (k) keys.delete(k);
  });
  window.addEventListener('blur', () => keys.clear());

  const api = {
    get active() { return root.visible; },
    get profile() { return profile; },
    get walking() { return path.length > 0; },
    get position() { return pos; },
    get riding() { return !!ride; },
    /** facing direction: forward = (sin h, cos h) */
    get heading() { return yaw; },
    /** Put the character somewhere directly (e.g. turned back at a gate). */
    teleport(x: number, z: number, face?: number) {
      path = [];
      clearRoute();
      targetPlace = null;
      d.onWalkState(null);
      pos.set(x, d.groundY, z);
      root.position.set(x, d.heightAt ? d.heightAt(x, z) : d.groundY, z);
      if (face !== undefined) yaw = face;
    },
    /** Board a vehicle: the avatar hides and the name pin rides along. */
    /** `visible`: stay in view (riding in a glass cable-car cabin), facing `yaw`. */
    startRide(get: () => THREE.Vector3, opts: { visible?: boolean; yaw?: number } = {}) {
      path = [];
      clearRoute();
      targetPlace = null;
      d.onWalkState(null);
      keys.clear();
      ride = get;
      rideVisible = !!opts.visible;
      if (opts.yaw !== undefined) yaw = opts.yaw;
      if (avatar) avatar.root.visible = rideVisible;
      if (pin) pin.position.y = rideVisible ? 2.85 : 5;
    },
    /** Step out at (x, z). */
    endRide(x: number, z: number) {
      ride = null;
      rideVisible = false;
      if (pin) pin.visible = true;
      pos.set(x, d.groundY, z);
      root.position.set(x, d.heightAt ? d.heightAt(x, z) : d.groundY, z);
      if (avatar) avatar.root.visible = true;
      if (pin) pin.position.y = 2.85;
      pulseRing();
      checkDiscoveries();
    },
    discovered,
    /** Radio on/off: put headphones on (or take them off) without touching the saved look. */
    setListening(on: boolean) {
      if (on === listening) return;
      listening = on;
      if (profile && profile.config.accessory !== 'headphones') api.setProfile(profile);
    },
    setProfile(p: PlayerProfile) {
      profile = p;
      if (avatar) {
        root.remove(avatar.root);
        avatar.dispose();
      }
      avatar = buildAvatar(listening && p.config.accessory !== 'headphones' ? { ...p.config, accessory: 'headphones' } : p.config);
      avatar.root.scale.setScalar(AVATAR_SCALE);
      if (ride) avatar.root.visible = rideVisible;
      root.add(avatar.root);
      // x-ray silhouette: drawn only where a building hides the character
      const solids: THREE.Mesh[] = [];
      avatar.root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && !(m.material as THREE.MeshBasicMaterial).map) solids.push(m);
      });
      for (const m of solids) {
        const g = new THREE.Mesh(m.geometry, ghostMat);
        g.renderOrder = 999;
        m.add(g);
      }
      if (pin) { pin.removeFromParent(); pin.element.remove(); }
      pin = new CSS2DObject(d.makePin(p));
      pin.position.set(0, ride && !rideVisible ? 5 : 2.85, 0);
      pin.center.set(0.5, 1); // anchor the label's bottom edge above the head
      root.add(pin);
    },
    spawn(p: PlayerProfile) {
      api.setProfile(p);
      const s = d.nav.nearestWalkable(SPAWN.x, SPAWN.z) ?? SPAWN;
      pos.set(s.x, d.groundY, s.z);
      root.position.copy(pos);
      root.visible = true;
      yaw = Math.PI / 4;
      // drop in
      spawning = true;
      setTimeout(() => (spawning = false), 800);
      tween({ duration: 0.7, easing: ease.outBack }, (v) => {
        root.position.y = d.groundY + (1 - v) * 5;
        avatar!.root.scale.setScalar(AVATAR_SCALE * Math.max(0.3, v));
      });
      setTimeout(pulseRing, 450);
      d.rig.focusOn(pos.clone(), { zoom: 3.6, blend: 1, duration: 1.0 });
      checkDiscoveries();
    },
    walkToPoint(x: number, z: number) {
      if (!root.visible || ride) return false;
      const near = d.nav.walkable(x, z) ? { x, z } : d.nav.nearestWalkable(x, z, 8);
      if (!near) return false;
      return startWalk(near, 'your marker', null);
    },
    walkToPlace(place: Place) {
      if (!root.visible || ride) return false;
      const approach = place.kind === 'landmark' || d.nav.walkable(place.x, place.z)
        ? (d.nav.walkable(place.x, place.z) ? { x: place.x, z: place.z } : d.nav.nearestWalkable(place.x, place.z))
        : d.nav.approachPoint({ x: place.x, z: place.z }, { x: pos.x, z: pos.z });
      if (!approach) return false;
      // the first guess can sit in a pocket the walker can't reach (a courtyard, between seats):
      // then try points all round the place, nearest first, until one has a path
      const from = { x: pos.x, z: pos.z };
      let to: P2 = approach;
      if (!d.nav.findPath(from, approach)) {
        let best: P2 | null = null;
        for (let r = 1.5; r < 24 && !best; r += 1.5) {
          for (let k = 0; k < 16; k++) {
            const a = (k / 16) * Math.PI * 2;
            const q = { x: place.x + Math.cos(a) * r, z: place.z + Math.sin(a) * r };
            if (d.nav.walkable(q.x, q.z) && d.nav.findPath(from, q)) { best = q; break; }
          }
        }
        if (best) to = best;
      }
      return startWalk(to, place.name, place.id);
    },
    skip() {
      if (!path.length || !avatar) return;
      const last = path[path.length - 1];
      const a = avatar;
      clearRoute();
      d.onWalkState(null);
      tween({ duration: 0.18, easing: ease.linear }, (v) => a.root.scale.setScalar(AVATAR_SCALE * (1 - v)));
      setTimeout(() => {
        const prev = path[path.length - 2] ?? { x: pos.x, z: pos.z };
        yaw = Math.atan2(last.x - prev.x, last.z - prev.z);
        pos.set(last.x, d.groundY, last.z);
        root.position.copy(pos);
        tween({ duration: 0.3, easing: ease.outBack }, (v) => a.root.scale.setScalar(AVATAR_SCALE * Math.max(0.01, v)));
        pulseRing();
        arrive();
      }, 190);
    },
    stop() {
      if (!path.length) return;
      path = [];
      clearRoute();
      targetPlace = null;
      d.onWalkState(null);
    },
    setDiscovered(ids: string[]) {
      discovered.clear();
      ids.forEach((i) => discovered.add(i));
    },
    update(dt: number, t: number) {
      if (!root.visible || !avatar) return;
      ghostMat.visible = !d.rig.chasing; // x-ray silhouette only in the city view
      if (ride) {
        const p = ride();
        pos.set(p.x, d.groundY, p.z);
        root.position.copy(p);
        root.rotation.y = yaw;
        if (rideVisible) avatar.update(dt, 0);
        if (pin) pin.visible = !d.rig.chasing; // the vehicle view already centres on you
        discoverTimer -= dt;
        if (discoverTimer <= 0) { discoverTimer = 0.3; checkDiscoveries(); }
        return;
      }
      let moving = false;
      if (keys.size) {
        const mv = new THREE.Vector3();
        if (d.rig.chasing) {
          // walk view: A/D turn, W/S forward / back
          const turn = (keys.has('l') ? 1 : 0) - (keys.has('r') ? 1 : 0);
          yaw += turn * 2.6 * dt;
          const dir = (keys.has('f') ? 1 : 0) - (keys.has('b') ? 1 : 0);
          if (dir) mv.set(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(dir);
          if (turn && !dir) { d.rig.follow(() => pos); followLinger = 0.8; }
        } else {
          // camera-relative movement
          const fwd = d.rig.forward(new THREE.Vector3());
          const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
          if (keys.has('f')) mv.add(fwd);
          if (keys.has('b')) mv.sub(fwd);
          if (keys.has('r')) mv.add(right);
          if (keys.has('l')) mv.sub(right);
        }
        if (mv.lengthSq() > 0) {
          mv.normalize().multiplyScalar(WALK_SPEED * dt);
          const nx = pos.x + mv.x;
          const nz = pos.z + mv.z;
          if (d.nav.walkable(nx, nz)) pos.set(nx, pos.y, nz);
          else if (d.nav.walkable(nx, pos.z)) pos.x = nx; // slide along walls
          else if (d.nav.walkable(pos.x, nz)) pos.z = nz;
          if (!d.rig.chasing) yaw = yawToward(yaw, Math.atan2(mv.x, mv.z), dt * 12);
          moving = true;
          d.rig.follow(() => pos);
          followLinger = 0.8;
        }
      } else if (path.length) {
        let step = WALK_SPEED * dt;
        while (step > 0 && pathIdx < path.length) {
          const tgt = path[pathIdx];
          const dx = tgt.x - pos.x;
          const dz = tgt.z - pos.z;
          const dist = Math.hypot(dx, dz);
          if (dist <= step) {
            pos.x = tgt.x;
            pos.z = tgt.z;
            step -= dist;
            pathIdx++;
          } else {
            pos.x += (dx / dist) * step;
            pos.z += (dz / dist) * step;
            yaw = yawToward(yaw, Math.atan2(dx, dz), dt * 10);
            step = 0;
          }
        }
        moving = true;
        stateTimer -= dt;
        if (stateTimer <= 0) {
          stateTimer = 0.25;
          const rem = remainingDistance();
          d.onWalkState({ label: targetLabel, remaining: rem, eta: rem / WALK_SPEED });
        }
        if (pathIdx >= path.length) arrive();
      }
      if (!moving && followLinger > 0) {
        followLinger -= dt;
        if (followLinger <= 0) d.rig.follow(null);
      }
      speedNow = moving ? 1 : 0;
      root.position.x = pos.x;
      root.position.z = pos.z;
      if (d.heightAt && !spawning) root.position.y = d.heightAt(pos.x, pos.z);
      root.rotation.y = yaw;
      avatar.update(dt, speedNow);
      // gentle pulse of the destination marker
      if (dest.visible) {
        const s = 1 + Math.sin(t * 5) * 0.12;
        dest.scale.set(s, s, s);
      }
      discoverTimer -= dt;
      if (discoverTimer <= 0) {
        discoverTimer = 0.2;
        checkDiscoveries();
      }
    },
  };
  return api;
}

function yawToward(cur: number, target: number, k: number) {
  let diff = target - cur;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return cur + diff * Math.min(1, k);
}

export type Player = ReturnType<typeof createPlayer>;
