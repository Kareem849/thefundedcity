// Character creator page: live 3D preview, appearance options, guest entry or (demo) sign-up.
import * as THREE from 'three';
import {
  buildAvatar, randomAvatar, DEFAULT_AVATAR, SKIN_TONES, HAIR_STYLES, HAIR_COLORS, OUTFITS, OUTFIT_COLORS, ACCESSORIES,
  type Avatar, type AvatarConfig, type Option,
} from './avatar';
import type { PlayerProfile } from './player';
import { markSvg } from './brand';

export type CreatorMode = 'create' | 'edit' | 'signup';

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function createCreator(host: HTMLElement) {
  const el = document.createElement('div');
  el.className = 'creator';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'cr-title');
  el.hidden = true;
  host.appendChild(el);

  /* ---------------- 3D preview ---------------- */
  let renderer: THREE.WebGLRenderer | null = null;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
  camera.position.set(0, 1.7, 8.4);
  camera.lookAt(0, 0.88, 0);
  scene.add(new THREE.HemisphereLight(0xf4f8ff, 0xd9e2d0, 1.6));
  const key = new THREE.DirectionalLight(0xfff3e0, 2.4);
  key.position.set(-3, 5, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfd4ff, 1.2);
  rim.position.set(3, 3, -4);
  scene.add(rim);
  const turntable = new THREE.Group();
  scene.add(turntable);
  const podium = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.93, 0.16, 48), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }));
  podium.position.y = -0.08;
  const podRing = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.02, 8, 64), new THREE.MeshStandardMaterial({ color: 0xe6b95a, metalness: 0.7, roughness: 0.3 }));
  podRing.rotation.x = Math.PI / 2;
  podRing.position.y = 0.005;
  scene.add(podium, podRing);
  let avatar: Avatar | null = null;
  let spin = 0.35;
  let dragX: number | null = null;
  let rafId = 0;
  let last = 0;

  const rebuild = (cfg: AvatarConfig) => {
    if (avatar) {
      turntable.remove(avatar.root);
      avatar.dispose();
    }
    avatar = buildAvatar(cfg);
    turntable.add(avatar.root);
  };

  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    if (dragX === null) turntable.rotation.y += dt * spin;
    avatar?.update(dt, 0);
    if (renderer) {
      const c = renderer.domElement;
      const w = c.clientWidth;
      const h = c.clientHeight;
      if (c.width !== Math.floor(w * renderer.getPixelRatio()) || c.height !== Math.floor(h * renderer.getPixelRatio())) {
        renderer.setSize(w, h, false);
        camera.aspect = w / Math.max(1, h);
        camera.updateProjectionMatrix();
      }
      renderer.render(scene, camera);
    }
    rafId = requestAnimationFrame(loop);
  };

  /* ---------------- state ---------------- */
  let cfg: AvatarConfig = { ...DEFAULT_AVATAR };
  let name = 'Kareem';
  let mode: CreatorMode = 'create';
  let current: PlayerProfile | null = null;
  let resolve: ((p: PlayerProfile | null) => void) | null = null;
  let view: 'look' | 'signup' = 'look';

  const swatchGroup = (key: keyof AvatarConfig, label: string, opts: Option<number>[]) => `
    <fieldset class="cr-group">
      <legend>${label}<span class="cr-value" data-value="${key}">${opts.find((o) => o.id === cfg[key])?.label ?? ''}</span></legend>
      <div class="swatches" role="radiogroup" aria-label="${label}">
        ${opts.map((o) => `<button type="button" role="radio" class="swatch" data-key="${key}" data-val="${o.id}" aria-checked="${o.id === cfg[key]}" aria-label="${o.label}" title="${o.label}" style="--sw:${hex(o.id)}"></button>`).join('')}
      </div>
    </fieldset>`;
  const chipGroup = (key: keyof AvatarConfig, label: string, opts: Option<string>[]) => `
    <fieldset class="cr-group">
      <legend>${label}</legend>
      <div class="chips" role="radiogroup" aria-label="${label}">
        ${opts.map((o) => `<button type="button" role="radio" class="chip" data-key="${key}" data-val="${o.id}" aria-checked="${o.id === cfg[key]}">${o.label}</button>`).join('')}
      </div>
    </fieldset>`;

  const title = () => (mode === 'edit' ? 'Edit your trader' : mode === 'signup' ? 'Save your trader' : 'Create your trader');

  const lookBody = () => `
    <label class="field">
      <span>Display name</span>
      <input id="cr-name" type="text" maxlength="20" autocomplete="nickname" value="${esc(name)}" />
    </label>
    ${swatchGroup('skin', 'Skin tone', SKIN_TONES)}
    <div class="cr-pair">
      ${chipGroup('hairStyle', 'Hair', HAIR_STYLES)}
      ${swatchGroup('hairColor', 'Hair colour', HAIR_COLORS)}
    </div>
    <div class="cr-pair">
      ${chipGroup('outfit', 'Clothes', OUTFITS)}
      ${swatchGroup('outfitColor', 'Clothes colour', OUTFIT_COLORS)}
    </div>
    ${chipGroup('accessory', 'Accessory', ACCESSORIES)}`;

  const lookActions = () => {
    if (mode === 'edit') {
      return `
        <button type="button" class="btn btn-ghost" id="cr-random">Randomize</button>
        <button type="button" class="btn btn-ghost" id="cr-cancel">Cancel</button>
        ${current?.status === 'guest' ? '<button type="button" class="btn btn-ghost" id="cr-signup">Sign up &amp; save</button>' : ''}
        <button type="button" class="btn btn-primary" id="cr-save">Save changes</button>`;
    }
    return `
      <button type="button" class="btn btn-ghost" id="cr-random">Randomize</button>
      <button type="button" class="btn btn-ghost" id="cr-guest">Play as guest</button>
      <button type="button" class="btn btn-primary" id="cr-signup">Sign up &amp; save</button>`;
  };

  const signupBody = () => `
    <p class="cr-note">Members keep their character, discoveries and progress. Guests can explore, but nothing is kept after you close the page.</p>
    <form id="cr-form" novalidate>
      <label class="field"><span>Display name</span><input id="su-name" type="text" maxlength="20" autocomplete="nickname" value="${esc(name)}" required /></label>
      <label class="field"><span>Email</span><input id="su-email" type="email" autocomplete="email" placeholder="you@example.com" value="${esc(current?.email ?? '')}" required /></label>
      <label class="field"><span>Password</span><input id="su-pass" type="password" autocomplete="new-password" placeholder="At least 8 characters" required /></label>
      <label class="check"><input id="su-terms" type="checkbox" /> <span>I agree to the FUNDEDCITY terms</span></label>
      <p class="cr-error" id="su-error" role="alert"></p>
      <p class="cr-demo">Preview: your account is saved in this browser only until accounts open at launch. Nothing is sent to a server and your password is not stored.</p>
    </form>`;

  const signupActions = () => `
    <button type="button" class="btn btn-ghost" id="cr-back">Back</button>
    <button type="submit" form="cr-form" class="btn btn-primary" id="cr-create">Create account</button>`;

  // static stage (one WebGL context for the life of the page) + a panel that re-renders
  el.innerHTML = `
    <div class="creator-stage">
      <canvas id="cr-canvas" aria-label="Character preview"></canvas>
      <div class="stage-top"><span class="eyebrow cr-brand">${markSvg(18)}FundedCity</span></div>
      <div class="stage-caption"><b id="cr-preview-name"></b><span id="cr-preview-status"></span></div>
      <div class="stage-hint">Drag to turn</div>
    </div>
    <div class="creator-panel" id="cr-panel"></div>`;
  const panel = el.querySelector<HTMLElement>('#cr-panel')!;
  const canvas = el.querySelector<HTMLCanvasElement>('#cr-canvas')!;
  const ensureRenderer = () => {
    if (renderer) return;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
  };
  canvas.addEventListener('pointerdown', (e) => { dragX = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (dragX === null) return;
    turntable.rotation.y += (e.clientX - dragX) * 0.012;
    dragX = e.clientX;
  });
  const endDrag = () => { dragX = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  const render = () => {
    el.querySelector('#cr-preview-name')!.textContent = name || 'Trader';
    el.querySelector('#cr-preview-status')!.textContent = current?.status === 'member' ? 'Member' : view === 'signup' ? 'Member after sign-up' : 'Trader';
    panel.innerHTML = `
        <div class="cp-head">
          <h1 id="cr-title">${view === 'signup' ? 'Create your account' : title()}</h1>
          <p>${view === 'signup' ? 'Sign up to save this character.' : 'Pick a look, then walk the city: visit towers, firm HQs and landmarks, and discover places on foot.'}</p>
        </div>
        <div class="cp-body">${view === 'signup' ? signupBody() : lookBody()}</div>
        <div class="cp-actions ${view === 'signup' ? 'two' : ''}">${view === 'signup' ? signupActions() : lookActions()}</div>`;
    wire();
  };

  const finish = (p: PlayerProfile | null) => {
    el.hidden = true;
    document.body.classList.remove('creator-open');
    cancelAnimationFrame(rafId);
    const r = resolve;
    resolve = null;
    r?.(p);
  };

  const readName = () => {
    const v = (el.querySelector<HTMLInputElement>('#cr-name')?.value ?? name).trim();
    name = v || 'Trader';
  };

  const wire = () => {
    el.querySelectorAll<HTMLButtonElement>('[data-key]').forEach((b) =>
      b.addEventListener('click', () => {
        const k = b.dataset.key as keyof AvatarConfig;
        const raw = b.dataset.val!;
        const val = k === 'skin' || k === 'hairColor' || k === 'outfitColor' ? Number(raw) : raw;
        (cfg as unknown as Record<string, unknown>)[k] = val;
        el.querySelectorAll<HTMLButtonElement>(`[data-key="${k}"]`).forEach((x) => x.setAttribute('aria-checked', String(x === b)));
        const label = el.querySelector<HTMLElement>(`[data-value="${k}"]`);
        if (label) label.textContent = b.getAttribute('aria-label') ?? '';
        rebuild(cfg);
      }),
    );
    const nameInput = el.querySelector<HTMLInputElement>('#cr-name');
    nameInput?.addEventListener('input', () => {
      el.querySelector('#cr-preview-name')!.textContent = nameInput.value.trim() || 'Trader';
    });
    el.querySelector('#cr-random')?.addEventListener('click', () => {
      readName();
      cfg = randomAvatar();
      rebuild(cfg);
      render();
    });
    el.querySelector('#cr-guest')?.addEventListener('click', () => {
      readName();
      finish({ name, status: 'guest', config: { ...cfg } });
    });
    el.querySelector('#cr-save')?.addEventListener('click', () => {
      readName();
      finish({ ...(current as PlayerProfile), name, config: { ...cfg } });
    });
    el.querySelector('#cr-cancel')?.addEventListener('click', () => finish(null));
    el.querySelector('#cr-signup')?.addEventListener('click', () => {
      readName();
      view = 'signup';
      render();
      el.querySelector<HTMLInputElement>('#su-email')?.focus();
    });
    el.querySelector('#cr-back')?.addEventListener('click', () => {
      const n = el.querySelector<HTMLInputElement>('#su-name')?.value.trim();
      if (n) name = n;
      if (mode === 'signup') return finish(null);
      view = 'look';
      render();
    });
    el.querySelector('#su-name')?.addEventListener('input', (e) => {
      el.querySelector('#cr-preview-name')!.textContent = (e.target as HTMLInputElement).value.trim() || 'Trader';
    });
    el.querySelector<HTMLFormElement>('#cr-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const n = el.querySelector<HTMLInputElement>('#su-name')!.value.trim();
      const email = el.querySelector<HTMLInputElement>('#su-email')!.value.trim();
      const pass = el.querySelector<HTMLInputElement>('#su-pass')!.value;
      const terms = el.querySelector<HTMLInputElement>('#su-terms')!.checked;
      const err = el.querySelector<HTMLElement>('#su-error')!;
      const fail = (msg: string, field?: string) => {
        err.textContent = msg;
        if (field) el.querySelector<HTMLInputElement>(field)?.focus();
      };
      if (!n) return fail('Enter a display name for your trader.', '#su-name');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Enter a valid email address, like name@example.com.', '#su-email');
      if (pass.length < 8) return fail('Use a password with at least 8 characters.', '#su-pass');
      if (!terms) return fail('Tick the box to agree to the terms.', '#su-terms');
      finish({ name: n, status: 'member', email, config: { ...cfg } });
    });
  };

  // Escape closes edit / sign-up (the first-run page needs a choice)
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mode !== 'create') finish(null);
  });

  return {
    get open() { return !el.hidden; },
    /** Resolves with the new profile, or null when cancelled. */
    show(opts: { mode: CreatorMode; profile?: PlayerProfile | null }): Promise<PlayerProfile | null> {
      mode = opts.mode;
      current = opts.profile ?? null;
      cfg = current ? { ...current.config } : { ...DEFAULT_AVATAR };
      name = current?.name ?? 'Kareem';
      view = mode === 'signup' ? 'signup' : 'look';
      el.hidden = false;
      document.body.classList.add('creator-open');
      ensureRenderer();
      render();
      rebuild(cfg);
      turntable.rotation.y = -0.35;
      last = performance.now();
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(loop);
      setTimeout(() => el.querySelector<HTMLElement>(view === 'signup' ? '#su-email' : '#cr-name')?.focus(), 50);
      return new Promise((r) => (resolve = r));
    },
  };
}
