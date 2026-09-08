import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

console.log("Building Persona Shadcn Registry...");

try {
  execSync("npx shadcn build", {
    cwd: rootDir,
    stdio: "inherit",
  });

  const rDir = path.join(rootDir, "public", "r");
  const registryJson = path.join(rDir, "registry.json");
  const indexJson = path.join(rDir, "index.json");

  if (fs.existsSync(registryJson)) {
    fs.copyFileSync(registryJson, indexJson);
    console.log("✔ Copied registry.json -> index.json for maximum CLI compatibility");
  }

  console.log("✔ Persona Shadcn Registry built successfully at public/r");
} catch (err) {
  console.error("Failed to build shadcn registry:", err);
  process.exit(1);
}

