// Fallback dev/build script used when Vite isn't installable (e.g. offline sandboxes).
// Normal use: `npm install && npm run dev` (Vite). This script only needs esbuild.
//   node scripts/dev-esbuild.mjs build   -> dist/
//   node scripts/dev-esbuild.mjs serve   -> http://localhost:5173
import { build, context } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';

const mode = process.argv[2] ?? 'build';
mkdirSync('dist', { recursive: true });
const html = readFileSync('index.html', 'utf8')
  .replace('<script type="module" src="/src/main.ts"></script>', '<link rel="stylesheet" href="./main.css" />\n    <script type="module" src="./main.js"></script>');
writeFileSync('dist/index.html', html);
if (existsSync('public')) cpSync('public', 'dist', { recursive: true });

const opts = {
  entryPoints: { main: 'src/main.ts' },
  bundle: true,
  format: 'esm',
  outdir: 'dist',
  minify: mode === 'build',
  sourcemap: mode !== 'build',
  target: 'es2020',
  logLevel: 'info',
};

if (mode === 'serve') {
  const ctx = await context(opts);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: 'dist', port: 5173, host: '0.0.0.0' });
  console.log(`Local: http://localhost:${port}/`);
} else {
  await build(opts);
}
