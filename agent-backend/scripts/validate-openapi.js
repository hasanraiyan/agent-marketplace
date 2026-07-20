/**
 * OpenAPI Spec Validation Script
 *
 * Imports the auto-generated OpenAPI spec (compiled from route-file @openapi
 * JSDoc annotations) and validates that it has at least one path. Exits with
 * code 1 if the spec fails to compile or has no paths.
 *
 * Used by:
 *   - lint-staged (runs on changed *.routes.js files before commit)
 *   - CI pipeline (pnpm run validate:openapi)
 */

import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function validate() {
  try {
    // Import the swagger config relative to the project root
    // Use pathToFileURL for cross-platform compatibility (Windows needs file:// URLs)
    const specPath = resolve(__dirname, '../src/docs/swagger.config.js');
    const spec = (await import(pathToFileURL(specPath).href)).default;

    const pathCount = Object.keys(spec.paths || {}).length;
    const methodCount = Object.values(spec.paths || {}).reduce(
      (sum, methods) => sum + Object.keys(methods).length,
      0
    );

    if (pathCount === 0) {
      console.error('FAIL: OpenAPI spec has 0 paths — route files may be missing @openapi annotations.');
      process.exit(1);
    }

    console.log(
      `OK: OpenAPI spec compiled successfully — ${pathCount} path objects, ${methodCount} HTTP methods, ` +
        `${Object.keys(spec.components?.schemas || {}).length} schemas`
    );
    process.exit(0);
  } catch (err) {
    console.error('FAIL: OpenAPI spec compilation error —', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

validate();
