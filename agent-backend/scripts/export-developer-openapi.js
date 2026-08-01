import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import developerOpenapiSpec from '../src/docs/swagger.developer.config.js';

/**
 * Exports the Developer Platform's scoped OpenAPI spec (Phase 12 API-2) to a
 * static JSON file consumed by the separate `developer-docs/` Mintlify
 * project — never served live from this process. Run manually
 * (`npm run docs:export`) and commit the result whenever a
 * `developer*.routes.js` file's `@openapi` annotations change.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.resolve(__dirname, '../../developer-docs/openapi.json');

fs.writeFileSync(outputPath, JSON.stringify(developerOpenapiSpec, null, 2) + '\n');

console.log(`Wrote Developer Platform OpenAPI spec to ${outputPath}`);
console.log(`Endpoints: ${Object.keys(developerOpenapiSpec.paths || {}).length}`);
