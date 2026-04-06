/**
 * Avvia Next dev su apps/web dalla root del monorepo.
 * Se PORT (default 3020) è occupata, prova 3021, 3022, … fino a trovarne una libera.
 */
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import net from "node:net";
import {
  empathyPro2DevOutputAbsPath,
  windowsDevDistDirRelative,
} from "./windows-dev-cache-path.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function portFree(port) {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once("error", (err) => {
      if (err.code === "EADDRINUSE") resolve(false);
      else reject(err);
    });
    // Stesso comportamento di default di Next su Windows: ascolto su `::` (IPv6),
    // altrimenti un check su 0.0.0.0 risulta “libero” mentre la porta è presa → EADDRINUSE.
    s.listen(port, () => {
      s.close(() => resolve(true));
    });
  });
}

async function findPort(start, maxAttempts = 40) {
  for (let p = start; p < start + maxAttempts; p++) {
    if (await portFree(p)) return p;
  }
  throw new Error(
    `Nessuna porta libera tra ${start} e ${start + maxAttempts - 1}`,
  );
}

// Non usare `PORT` globale (spesso =3000 su Windows e collide con V1): solo variabile dedicata.
const preferred =
  Number(process.env.EMPATHY_PRO2_DEV_PORT) || 3020;
const port = await findPort(preferred);
if (port !== preferred) {
  console.log(
    `\n\x1b[33m[empathy-pro-2]\x1b[0m Porta ${preferred} occupata → uso \x1b[1m${port}\x1b[0m\n`,
  );
}

const nextCli = join(root, "node_modules", "next", "dist", "bin", "next");
const appDir = join(root, "apps", "web");

const env = { ...process.env };
if (process.platform === "win32") {
  if (env.NEXT_DIST_DIR === undefined || env.NEXT_DIST_DIR === "") {
    env.NEXT_DIST_DIR = windowsDevDistDirRelative() ?? ".next-dev";
  }
  try {
    mkdirSync(empathyPro2DevOutputAbsPath(), { recursive: true });
  } catch {
    /* Next creerà comunque se possibile */
  }
  if (env.EMPATHY_PRO2_NO_WEBPACK_CACHE === undefined || env.EMPATHY_PRO2_NO_WEBPACK_CACHE === "") {
    env.EMPATHY_PRO2_NO_WEBPACK_CACHE = "1";
  }
  if (env.WATCHPACK_POLLING === undefined || env.WATCHPACK_POLLING === "") {
    env.WATCHPACK_POLLING = "true";
  }
  console.log(
    "\n\x1b[36m[empathy-pro-2]\x1b[0m Windows: dev Next in \x1b[1mapps/.empathy-pro2-next-dev\x1b[0m (`NEXT_DIST_DIR` relativo; no path assoluti). Cache webpack disattiva. Problemi: \x1b[1mnpm run dev:clean\x1b[0m poi \x1b[1mnpm run dev\x1b[0m.\n",
  );
}

const child = spawn(
  process.execPath,
  [nextCli, "dev", appDir, "-p", String(port)],
  { stdio: "inherit", cwd: root, env },
);

child.on("exit", (code) => process.exit(code ?? 0));
