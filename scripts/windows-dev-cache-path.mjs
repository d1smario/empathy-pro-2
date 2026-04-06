/**
 * Next.js 14: `distDir` / `NEXT_DIST_DIR` deve essere **relativo** a `apps/web`
 * (path assoluti vengono concatenati e creano `apps\web\C:\...` → ENOENT).
 *
 * Questa cartella è `apps/.empathy-pro2-next-dev` (un livello sopra `apps/web`),
 * spesso più stabile con OneDrive che `.next` dentro `web`.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Segmento da passare a `NEXT_DIST_DIR` (relativo a `apps/web`). */
export function windowsDevDistDirRelative() {
  if (process.platform !== "win32") return null;
  return "../.empathy-pro2-next-dev";
}

/** Path assoluto per pulizia (`npm run dev:clean`). */
export function empathyPro2DevOutputAbsPath() {
  return join(root, "apps", ".empathy-pro2-next-dev");
}
