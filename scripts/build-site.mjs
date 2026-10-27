// Build the public website for www.thefundedcity.com into site/ (plain static files, any host).
//   node scripts/build-site.mjs            -> site/
// Deploy: point the host at the site/ folder (Vercel: Root Directory = site, no build step).
// PREVIEW = true keeps search engines out until the full launch (accounts, shared chat, AI guides).
import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { basename } from 'node:path';

const PREVIEW = true;
const ORIGIN = 'https://www.thefundedcity.com';
const TITLE = 'FundedCity · The city of funded traders';
const DESC = 'A 3D city for prop-firm traders: walk the city, compare prop firm plans, grow your tower with verified payouts, ride the cable car to Founders’ Summit and meet other funded traders.';

rmSync('site', { recursive: true, force: true });
mkdirSync('site/assets', { recursive: true });
if (existsSync('public')) cpSync('public', 'site', { recursive: true });

const r = await build({
  entryPoints: { app: 'src/main.ts' },
  bundle: true,
  format: 'esm',
  splitting: false,
  outdir: 'site/assets',
  entryNames: '[name]-[hash]',
  assetNames: '[name]-[hash]',
  minify: true,
  sourcemap: false,
  target: 'es2020',
  define: { __PUBLIC_SITE__: 'true' },
  metafile: true,
  logLevel: 'error',
});
const outs = Object.keys(r.metafile.outputs);
const js = basename(outs.find((f) => f.endsWith('.js')));
const css = basename(outs.find((f) => f.endsWith('.css')));

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${TITLE}</title>
<meta name="description" content="${DESC}">
${PREVIEW ? '<meta name="robots" content="noindex, nofollow">\n' : ''}<link rel="canonical" href="${ORIGIN}/">
<meta name="theme-color" content="#13213f">
<link rel="icon" href="/icons/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/icons/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta property="og:type" content="website">
<meta property="og:site_name" content="FundedCity">
<meta property="og:title" content="${TITLE}">
<meta property="og:description" content="${DESC}">
<meta property="og:url" content="${ORIGIN}/">
<meta property="og:image" content="${ORIGIN}/icons/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@kareemcapital">
<meta name="twitter:title" content="${TITLE}">
<meta name="twitter:description" content="${DESC}">
<meta name="twitter:image" content="${ORIGIN}/icons/og-image.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Sora:wght@700;800&display=swap">
<link rel="stylesheet" href="/assets/${css}">
</head>
<body>
<div id="app"></div>
<noscript><p style="font:16px system-ui;padding:24px">FundedCity is a 3D city and needs JavaScript and WebGL turned on.</p></noscript>
<script type="module" src="/assets/${js}"></script>
</body>
</html>
`;
writeFileSync('site/index.html', html);

writeFileSync('site/404.html', `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Not found · FundedCity</title><meta name="robots" content="noindex"><link rel="icon" href="/icons/favicon.svg" type="image/svg+xml">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f6fa;color:#13213f;font:16px/1.5 system-ui,sans-serif;text-align:center;padding:24px}a{color:#2f6bff;font-weight:700}</style></head>
<body><main><img src="/icons/icon-192.png" width="96" height="96" alt="FundedCity"><h1>This street isn’t on the map</h1><p><a href="/">Back to FundedCity</a></p></main></body></html>
`);

writeFileSync('site/robots.txt', PREVIEW ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`);
if (!PREVIEW) writeFileSync('site/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${ORIGIN}/</loc></url></urlset>\n`);

writeFileSync('site/site.webmanifest', JSON.stringify({
  name: 'FundedCity', short_name: 'FundedCity', description: DESC, start_url: '/', display: 'standalone',
  background_color: '#f5f6fa', theme_color: '#13213f',
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
  ],
}, null, 2));

// host settings: caching + security headers (Vercel reads vercel.json; Netlify / Cloudflare Pages read _headers)
const SEC = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};
writeFileSync('site/vercel.json', JSON.stringify({
  cleanUrls: true,
  headers: [
    { source: '/(.*)', headers: Object.entries(SEC).map(([key, value]) => ({ key, value })) },
    { source: '/assets/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
    { source: '/', headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }] },
  ],
  redirects: [{ source: '/:path*', has: [{ type: 'host', value: 'thefundedcity.com' }], destination: `${ORIGIN}/:path*`, permanent: true }],
}, null, 2));
writeFileSync('site/_headers', `/*\n${Object.entries(SEC).map(([k, v]) => `  ${k}: ${v}`).join('\n')}\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n`);

console.log('site/ ready:', js, css, PREVIEW ? '(preview: search engines kept out)' : '');
