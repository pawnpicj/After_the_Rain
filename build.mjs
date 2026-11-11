import { copyFile } from 'node:fs/promises';
import { build } from 'esbuild';

await build({
  entryPoints: ['src/game.js'],
  outfile: 'dist/game.js',
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2022',
});
await copyFile('node_modules/three/LICENSE', 'dist/THREE-LICENSE.txt');
