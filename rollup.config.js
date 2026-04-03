import typescript  from '@rollup/plugin-typescript';
import resolve     from '@rollup/plugin-node-resolve';
import dts         from 'rollup-plugin-dts';

const banner = `/*!
 * AmarWave JS Client v2.0.0
 * Real-time WebSocket client for AmarWave servers
 * (c) 2024 AmarWave — MIT License
 * https://amarwave.io
 */`;

// ── Shared TS plugin config ───────────────────────────────────────────────────
const tsPlugin = () => typescript({
  tsconfig: './tsconfig.json',
  compilerOptions: { declaration: false },
  sourceMap: true,
});

export default [
  // ── UMD bundle for CDN / <script> tag ─────────────────────────────────────
  // Entry: src/cdn.ts  →  single default export
  // Result: window.AmarWave = AmarWave class  (used directly in HTML)
  {
    input: 'src/cdn.ts',
    output: {
      file:      'dist/amarwave.umd.js',
      format:    'umd',
      name:      'AmarWave',   // ← window.AmarWave = the class itself
      banner,
      exports:   'default',
      sourcemap: true,
    },
    plugins: [resolve(), tsPlugin()],
  },

  // ── ESM bundle (import AmarWave from 'amarwave' / bundlers) ───────────────
  // Entry: src/index.ts  →  all named + default exports
  {
    input: 'src/index.ts',
    output: {
      file:      'dist/amarwave.esm.js',
      format:    'esm',
      banner,
      sourcemap: true,
    },
    plugins: [resolve(), tsPlugin()],
  },

  // ── CJS bundle (const { AmarWave } = require('amarwave')) ─────────────────
  {
    input: 'src/index.ts',
    output: {
      file:      'dist/amarwave.cjs',
      format:    'cjs',
      banner,
      exports:   'named',
      sourcemap: true,
    },
    plugins: [resolve(), tsPlugin()],
  },

  // ── Type declarations bundle (single dist/index.d.ts) ─────────────────────
  {
    input:  'dist/types/index.d.ts',
    output: { file: 'dist/index.d.ts', format: 'esm' },
    plugins: [dts()],
  },
];
