// Runs after the Tailwind CLI build (see package.json's build:css) to fold
// katex/dist/katex.min.css into dist/styles.css and copy its font files
// alongside it, so `import "@personaai/ui/styles.css"` is enough on its own
// -- no separate `import "katex/dist/katex.min.css"` required downstream.
import { appendFileSync, cpSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const katexCssPath = path.join(root, 'node_modules/katex/dist/katex.min.css');
const katexFontsDir = path.join(root, 'node_modules/katex/dist/fonts');
const distStylesPath = path.join(root, 'dist/styles.css');
const distFontsDir = path.join(root, 'dist/fonts');

const katexCss = readFileSync(katexCssPath, 'utf-8');
appendFileSync(
  distStylesPath,
  `\n/* katex/dist/katex.min.css, bundled -- see fonts/ next to this file for its relative url() references. */\n${katexCss}`
);

// katex.min.css references its fonts via relative `url(fonts/...)` paths,
// so they must land in dist/fonts (next to dist/styles.css) unmodified.
cpSync(katexFontsDir, distFontsDir, { recursive: true });

console.log('[build:css] appended katex.min.css and copied fonts/ into dist/');
