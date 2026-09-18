import { build } from 'esbuild'

await build({
  entryPoints: ['.smoke/app-bundle.jsx'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: '.smoke/app.mjs',
  jsx: 'automatic',
  loader: { '.css': 'empty' },
  define: {
    'import.meta.env.VITE_API_URL': '"http://localhost:8090/index.php"',
    'import.meta.env.VITE_API_KEY': '"smoke-key"',
  },
  external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client', 'react-dom/test-utils', 'jsdom'],
  logLevel: 'error',
})

await import('./interactive.mjs')
