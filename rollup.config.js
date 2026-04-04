import typescript  from '@rollup/plugin-typescript';
import resolve     from '@rollup/plugin-node-resolve';
import dts         from 'rollup-plugin-dts';

const banner = `/*!
 * AmarWave JS Client v2.0.5
 * Real-time WebSocket client for AmarWave servers
 * (c) 2024 AmarWave — MIT License
 * https://amarwave.io
 */`;

// Prepended only to the CJS build — auto-injects the ws WebSocket polyfill
// when running in Node.js < 21 (which has no global WebSocket).
// In Node.js 21+ and all browsers, globalThis.WebSocket is already defined
// so this block is skipped entirely.
const nodeCjsPreamble = `
if (typeof globalThis.WebSocket === 'undefined') {
  try {
    var _WS = require('ws');
    if (!process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }
    globalThis.WebSocket = /** @class */ (function (_Super) {
      function _AW(u, p) {
        return _Super.call(this, u, p, {
          headers: {
            Origin: 'https://amarwave.com',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          },
          perMessageDeflate: false,
        }) || this;
      }
      _AW.prototype = Object.create(_Super.prototype);
      _AW.prototype.constructor = _AW;
      return _AW;
    }(_WS));
  } catch (_) { /* ws not installed — Node.js 21+ has WebSocket built-in */ }
}
`;

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
  // Includes the Node.js WebSocket polyfill preamble — auto-skipped in browsers
  // and Node.js 21+ where WebSocket is already globally available.
  {
    input: 'src/index.ts',
    output: {
      file:      'dist/amarwave.cjs',
      format:    'cjs',
      banner:    banner + nodeCjsPreamble,
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
