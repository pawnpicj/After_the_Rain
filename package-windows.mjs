import { packager } from '@electron/packager';

const files = new Set([
  '', '/package.json', '/index.html', '/style.css',
  '/desktop', '/desktop/main.cjs', '/desktop/preload.cjs',
  '/dist', '/dist/game.js', '/dist/THREE-LICENSE.txt',
]);
const paths = await packager({
  dir: '.',
  out: 'release',
  platform: 'win32',
  arch: 'x64',
  overwrite: true,
  asar: true,
  prune: false,
  ignore: file => !files.has(file),
});
console.log(paths.join('\n'));
