// Image uploads (charts on the Trading Floor, product pictures in THE PLAZA) through the page's `assets`
// runtime capability. Images are re-encoded through a canvas first (smaller, and it drops photo metadata).
// Stored ids are only ever shown as <img> sources ("/_blob/" + id), never run or inserted as markup.
// Off the published page there is no asset store: a small data URL is kept in this browser instead.
/* eslint-disable @typescript-eslint/no-explicit-any */
let cached: Promise<any | null> | null = null;
export function getAssets(): Promise<any | null> {
  if (cached) return cached;
  cached = (async () => {
    const c = (window as any).claude;
    if (!c || typeof c.use !== 'function') return null;
    try { return (await c.use('assets')) ?? null; } catch { return null; }
  })();
  return cached;
}
export const blobUrl = (id: string) => '/_blob/' + id;
/** only 32-hex asset ids or our own data URLs ever become an image source */
export function imgSrc(ref: string | undefined | null): string | null {
  if (!ref) return null;
  if (/^[0-9a-f]{32}$/.test(ref)) return blobUrl(ref);
  if (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(ref)) return ref;
  return null;
}

const OK_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
async function toCanvas(file: File, max: number) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('bad image')); i.src = url; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * k));
    c.height = Math.max(1, Math.round(img.naturalHeight * k));
    const g = c.getContext('2d')!;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally { URL.revokeObjectURL(url); }
}

export type UploadResult = { ref: string; local: boolean } | { error: string };
/** Upload an image: an asset id on the published page, a small data URL elsewhere. */
export async function uploadImage(file: File, opts: { shared: boolean }): Promise<UploadResult> {
  if (!OK_TYPES.includes(file.type)) return { error: 'Use a PNG, JPG, WebP or GIF image.' };
  if (file.size > 15 * 1024 * 1024) return { error: 'That image is over 15 MB.' };
  let canvas: HTMLCanvasElement;
  try { canvas = await toCanvas(file, opts.shared ? 1600 : 900); } catch { return { error: 'Couldn’t read that image.' }; }
  if (!opts.shared) return { ref: canvas.toDataURL('image/jpeg', 0.78), local: true };
  const assets = await getAssets();
  if (!assets) return { error: 'Image uploads aren’t available with your access to this city.' };
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.86));
  if (!blob) return { error: 'Couldn’t prepare that image.' };
  try {
    const res = await assets.upload(blob);
    return { ref: String(res.id), local: false };
  } catch (e) {
    const code = (e as { code?: string })?.code ?? '';
    return { error: code === 'quota_exceeded' ? 'The city’s image storage is full.' : code === 'rate_limited' ? 'Too many uploads: try again in a minute.' : 'The upload didn’t go through.' };
  }
}
