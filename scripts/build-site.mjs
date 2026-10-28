// Build the public website for www.thefundedcity.com into site/ (plain static files, any host).
//   node scripts/build-site.mjs            -> site/
// Deploy: point the host at the site/ folder (Vercel: Root Directory = site, no build step).
// PREVIEW = true keeps search engines out until the full launch (accounts, shared chat, AI guides).
import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { basename } from 'node:path';

const PREVIEW = true;
// HIDDEN = true: thefundedcity.com shows a "Coming soon" page and the city lives at a private link
// (https://www.thefundedcity.com/<CITY_PATH>/). Set HIDDEN = false on launch day to open the city at the root.
const HIDDEN = true;
const CITY_PATH = 'build-2n4ylshhex'; // work in progress (private)
// The DEMO link for prop firm marketing teams, /enter-zzty7pf84p/, is a frozen snapshot kept in
// public/enter-zzty7pf84p/ with its own copy of the code. Builds never touch it.
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
if (HIDDEN) {
  mkdirSync(`site/${CITY_PATH}`, { recursive: true });
  writeFileSync(`site/${CITY_PATH}/index.html`, html.replace('<meta name="description"', '<meta name="robots" content="noindex, nofollow">\n<meta name="description"').replace(/<meta name="robots" content="noindex, nofollow">\n(?=<link rel="canonical")/, ''));
  writeFileSync('site/index.html', comingSoon());
} else {
  writeFileSync('site/index.html', html);
}

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

console.log('site/ ready:', js, css, PREVIEW ? '(preview: search engines kept out)' : '', HIDDEN ? `· city at /${CITY_PATH}/ · coming soon at /` : '');

function comingSoon() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${TITLE} · Opening soon</title>
<meta name="description" content="${DESC}">
${PREVIEW ? '<meta name="robots" content="noindex, nofollow">\n' : ''}<link rel="canonical" href="${ORIGIN}/">
<meta name="theme-color" content="#13213f">
<link rel="icon" href="/icons/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/icons/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="FundedCity">
<meta property="og:title" content="${TITLE}">
<meta property="og:description" content="${DESC}">
<meta property="og:url" content="${ORIGIN}/">
<meta property="og:image" content="${ORIGIN}/icons/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@kareemcapital">
<meta name="twitter:image" content="${ORIGIN}/icons/og-image.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&family=Sora:wght@700;800&display=swap">
<style>
*{box-sizing:border-box}
html,body{margin:0;height:100%}
body{min-height:100vh;min-height:100dvh;display:grid;place-items:center;padding:max(24px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));
  background:#a9def4 url(/brand/city-wide.jpg) center/cover no-repeat;font-family:Manrope,system-ui,sans-serif;color:#13213f}
main{width:min(620px,100%);background:#ffffff;border-radius:28px;padding:clamp(28px,5vw,48px);box-shadow:0 24px 70px rgba(19,33,63,.25);display:flex;flex-direction:column;gap:18px}
.brand{display:flex;align-items:center;gap:12px}
.brand img{width:44px;height:52px}
.brand b{font-family:Sora,Manrope,sans-serif;font-size:30px;font-weight:800;letter-spacing:-.03em}
.brand b span{color:#2f6bff}
.eyebrow{font-size:13px;font-weight:800;letter-spacing:.24em;color:#8a6414;margin:6px 0 0}
h1{margin:0;font-family:Sora,Manrope,sans-serif;font-size:clamp(38px,7vw,58px);font-weight:800;letter-spacing:-.035em;line-height:1.04;text-wrap:balance}
h1 span{color:#2f6bff}
p{margin:0;font-size:18px;line-height:1.55;color:#3c4a66;font-weight:600}
.row{display:flex;flex-wrap:wrap;align-items:center;gap:12px 18px;padding-top:18px;border-top:2px solid #e6eaf2}
.pill{display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border-radius:999px;background:#13213f;color:#fff;font-size:13px;font-weight:800;letter-spacing:.12em}
.pill i{width:9px;height:9px;border-radius:50%;background:#f2c14e}
a{color:#2f6bff;font-weight:800;text-decoration:none}
a:hover{text-decoration:underline}
</style>
</head>
<body>
<main>
  <div class="brand"><img src="/icons/favicon.svg" alt=""><b>Funded<span>City</span></b></div>
  <div class="eyebrow">THE CITY OF FUNDED TRADERS</div>
  <h1>The city is being built. <span>Opening soon.</span></h1>
  <div class="row"><span class="pill"><i></i>UNDER CONSTRUCTION</span><a href="https://x.com/kareemcapital" rel="noopener">Follow the launch on X · @kareemcapital</a></div>
</main>
</body>
</html>
`;
}
