// The official FundedCity logo (Oct 2026): a blue map pin holding an isometric city block (windows on
// one face, gold rising payout bars on the other, a gold spark on the roof) with a gold "verified" check,
// beside the "FundedCity" wordmark and the line THE CITY OF FUNDED TRADERS. The original artwork is in
// public/brand/fundedcity-official-logo.png; this is a vector redraw for crisp use at every size.
import * as THREE from 'three';

export const BRAND = {
  navy: '#13213f',
  royal: '#2f6bff',
  gold: '#e0ad48',
  tagline: 'THE CITY OF FUNDED TRADERS',
};
const TOP = '#6f8ff2';
const LEFT = '#3a63e8';

/** The pin mark as an SVG string. `mono` = the one-colour navy version (for print and tiny sizes). */
export function markSvg(size: number, opts: { mono?: boolean; ring?: string; title?: string } = {}) {
  const pin = opts.mono ? BRAND.navy : BRAND.royal;
  const badgeStroke = opts.ring ?? '#ffffff';
  const top = opts.mono ? '#ffffff' : TOP;
  const left = opts.mono ? BRAND.navy : LEFT;
  const right = BRAND.navy;
  const accent = opts.mono ? '#ffffff' : BRAND.gold;
  const label = opts.title ? `role="img" aria-label="${opts.title}"` : 'aria-hidden="true"';
  const h = Math.round(size * 140 / 120);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 140" width="${size}" height="${h}" ${label}>
<circle cx="60" cy="58" r="52" fill="${pin}"/><path d="M23.2 94.8 L60 137 L96.8 94.8 Z" fill="${pin}"/>
<circle cx="60" cy="58" r="38" fill="#ffffff"/>
<polygon points="60,30 84,44 60,58 36,44" fill="${top}"${opts.mono ? ` stroke="${BRAND.navy}" stroke-width="2.4" stroke-linejoin="round"` : ''}/>
<polygon points="36,44 60,58 60,86 36,72" fill="${left}"/>
<polygon points="60,58 84,44 84,72 60,86" fill="${right}"/>
<polygon points="60,37.6 66.2,41.2 60,44.8 53.8,41.2" fill="${opts.mono ? BRAND.navy : BRAND.gold}"/>
<g transform="matrix(1,0.5833,0,1,0,0)">
<rect x="39" y="27" width="4.6" height="4.6" fill="#ffffff"/><rect x="46.6" y="27" width="4.6" height="4.6" fill="${accent}"/><rect x="54" y="27" width="4.6" height="4.6" fill="#ffffff" fill-opacity="${opts.mono ? 1 : 0.7}"/>
<rect x="39" y="34.4" width="4.6" height="4.6" fill="#ffffff" fill-opacity="${opts.mono ? 1 : 0.7}"/><rect x="46.6" y="34.4" width="4.6" height="4.6" fill="#ffffff"/><rect x="54" y="34.4" width="4.6" height="4.6" fill="${accent}"/>
<rect x="39" y="41.8" width="4.6" height="4.6" fill="#ffffff"/><rect x="46.6" y="41.8" width="4.6" height="4.6" fill="#ffffff" fill-opacity="${opts.mono ? 1 : 0.7}"/><rect x="54" y="41.8" width="4.6" height="4.6" fill="#ffffff"/>
</g>
<g transform="matrix(1,-0.5833,0,1,0,0)">
<rect x="65.5" y="110" width="4.2" height="7.5" fill="${accent}"/><rect x="72" y="104.5" width="4.2" height="13" fill="${accent}"/><rect x="78.5" y="98" width="4.2" height="19.5" fill="${accent}"/>
</g>
<circle cx="97" cy="19" r="16" fill="${opts.mono ? BRAND.navy : BRAND.gold}" stroke="${badgeStroke}" stroke-width="4.5"/>
<path d="M89.6 19.4 L94.8 24.4 L104.4 14.2" fill="none" stroke="#ffffff" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}

/** The mark as a data: URL (favicons, canvas drawing). */
export function markDataUrl(opts: { mono?: boolean; ring?: string } = {}) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markSvg(120, opts));
}

/** Give the page the logo as its browser-tab icon. */
export function setFavicon() {
  try {
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    link.href = markDataUrl();
    document.head.appendChild(link);
  } catch { /* no head in this context */ }
}

const markImage = (() => {
  let p: Promise<HTMLImageElement> | null = null;
  return () => (p ??= new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = markDataUrl({ ring: '#ffffff' });
  }));
})();

/**
 * A texture with the logo for signs and flags in the 3D city. It starts white and fills in once the
 * mark and the wordmark font are ready.
 *  'lockup': mark + FundedCity + tagline (wide sign), 'flag': the mark centred on white.
 */
export function logoTexture(kind: 'lockup' | 'flag') {
  const c = document.createElement('canvas');
  c.width = kind === 'lockup' ? 1024 : 512;
  c.height = kind === 'lockup' ? 384 : 308;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, c.width, c.height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const fontReady = (document.fonts?.load?.('800 120px Sora') ?? Promise.resolve()).catch(() => undefined);
  Promise.all([markImage(), fontReady]).then(([img]) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, c.width, c.height);
    if (kind === 'flag') {
      const h = 250, w = h * 120 / 140;
      g.drawImage(img, (c.width - w) / 2, (c.height - h) / 2, w, h);
    } else {
      const h = 300, w = h * 120 / 140;
      g.drawImage(img, 40, (c.height - h) / 2, w, h);
      const x = 40 + w + 34;
      g.textBaseline = 'alphabetic';
      // fit the wordmark to the space beside the mark, whatever font the browser ended up with
      let size = 132;
      g.font = `800 ${size}px Sora, Manrope, system-ui, sans-serif`;
      const room = c.width - x - 36;
      const wide = g.measureText('FundedCity').width;
      if (wide > room) { size = Math.floor(size * room / wide); g.font = `800 ${size}px Sora, Manrope, system-ui, sans-serif`; }
      g.fillStyle = BRAND.navy;
      g.fillText('Funded', x, 222);
      const fw = g.measureText('Funded').width;
      g.fillStyle = BRAND.royal;
      g.fillText('City', x + fw, 222);
      const total = fw + g.measureText('City').width;
      g.font = '600 30px Manrope, system-ui, sans-serif';
      g.fillStyle = BRAND.navy;
      // spread the tagline across the wordmark's width
      const chars = [...BRAND.tagline];
      const plain = chars.reduce((s, ch) => s + g.measureText(ch).width, 0);
      const gap = Math.max(2, (total - plain) / (chars.length - 1));
      let tx = x + 4;
      for (const ch of chars) { g.fillText(ch, tx, 286); tx += g.measureText(ch).width + gap; }
    }
    tex.needsUpdate = true;
  }).catch(() => { /* keep the plain sign */ });
  return tex;
}
