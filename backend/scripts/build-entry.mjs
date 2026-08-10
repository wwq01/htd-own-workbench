import { build } from 'esbuild';

await build({
  entryPoints: ['src/server.js'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  packages: 'external',
  outfile: 'build/server.cjs',
  sourcemap: false,
  logLevel: 'info',
});
