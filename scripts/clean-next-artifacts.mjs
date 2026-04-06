/**
 * Rimuove output Next e cache webpack sotto apps/web (OneDrive / dev instabili).
 * Uso: `npm run dev:clean` o prima di `npm run dev:safe`.
 */
import { existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { empathyPro2DevOutputAbsPath } from "./windows-dev-cache-path.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const web = join(root, "apps", "web");

const paths = [
  join(web, ".next"),
  join(web, ".next-dev"),
  join(web, "node_modules", ".cache"),
  empathyPro2DevOutputAbsPath(),
];

const rmOpts =
  process.platform === "win32"
    ? { recursive: true, force: true, maxRetries: 5, retryDelay: 150 }
    : { recursive: true, force: true };

let removed = 0;
for (const p of paths) {
  if (existsSync(p)) {
    rmSync(p, rmOpts);
    console.log("[clean-next-artifacts] removed:", p);
    removed++;
  }
}
if (removed === 0) {
  console.log("[clean-next-artifacts] nothing to remove (.next / .next-dev / node_modules/.cache)");
}
