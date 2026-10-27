import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'fs';
await build({ entryPoints: ['src/main.ts'], bundle: true, minify: true, format: 'esm', outdir: 'dist/single', loader: { '.css': 'css' }, target: 'es2022', logLevel: 'error' });
const js = readFileSync('dist/single/main.js', 'utf8').replace(/<\/script/gi, '<\\/script');
const css = readFileSync('dist/single/main.css', 'utf8');
const html = `<title>FUNDEDCITY</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Sora:wght@700;800&display=swap">
<style>${css}</style>
<div id="app"></div>
<script type="module">${js}</script>
`;
writeFileSync('dist/fundedid-city.html', html);
writeFileSync('dist/fundedcity.html', html);
console.log('bytes', html.length);
