// Tiny tween engine — keeps all animation on the main render loop, no dependencies.

export type Easing = (t: number) => number;

export const ease = {
  linear: (t: number) => t,
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuint: (t: number) => 1 - Math.pow(1 - t, 5),
  outBack: (t: number) => {
    const c1 = 1.25;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  /** 0 → 1 → 0 bell, handy for pulses. */
  bell: (t: number) => Math.sin(Math.PI * t),
};

interface Tween {
  delay: number;
  duration: number;
  elapsed: number;
  easing: Easing;
  onUpdate: (v: number) => void;
  onComplete?: () => void;
  group?: string;
  started: boolean;
  onStart?: () => void;
}

const tweens: Tween[] = [];

export interface TweenOptions {
  duration: number;
  delay?: number;
  easing?: Easing;
  group?: string;
  onStart?: () => void;
  onComplete?: () => void;
}

/** Calls onUpdate with an eased 0→1 value over `duration` seconds. */
export function tween(opts: TweenOptions, onUpdate: (v: number) => void): void {
  tweens.push({
    delay: opts.delay ?? 0,
    duration: Math.max(0.0001, opts.duration),
    elapsed: 0,
    easing: opts.easing ?? ease.outCubic,
    onUpdate,
    onComplete: opts.onComplete,
    onStart: opts.onStart,
    group: opts.group,
    started: false,
  });
}

/** Run a callback after `delay` seconds (on the render clock). */
export function after(delay: number, fn: () => void, group?: string): void {
  tween({ duration: 0.0001, delay, group, onComplete: fn }, () => {});
}

/** Cancel every tween in a group without completing it. */
export function cancelGroup(group: string): void {
  for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].group === group) tweens.splice(i, 1);
}

export function updateTweens(dt: number): void {
  // iterate over a snapshot: callbacks may add or cancel tweens
  const list = tweens.slice();
  for (const tw of list) {
    if (tweens.indexOf(tw) === -1) continue;
    if (tw.delay > 0) {
      tw.delay -= dt;
      if (tw.delay > 0) continue;
    }
    if (!tw.started) {
      tw.started = true;
      tw.onStart?.();
    }
    tw.elapsed += dt;
    const t = Math.min(1, tw.elapsed / tw.duration);
    tw.onUpdate(tw.easing(t));
    if (t >= 1) {
      const i = tweens.indexOf(tw);
      if (i !== -1) tweens.splice(i, 1);
      tw.onComplete?.();
    }
  }
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
