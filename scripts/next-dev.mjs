/**
 * Avvia Next dev su apps/web dalla root del monorepo.
 * Se PORT (default 3020) è occupata, prova 3021, 3022, … fino a trovarne una libera.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import net from "node:net";
import {
  empathyPro2DevOutputAbsPath,
  windowsDevDistDirRelative,
} from "./windows-dev-cache-path.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

/** Workspaces di solito hoistano `next` in root; in alcuni casi resta sotto apps/web. */
function resolveNextCli() {
  const candidates = [
    join(root, "node_modules", "next", "dist", "bin", "next"),
    join(root, "apps", "web", "node_modules", "next", "dist", "bin", "next"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

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

const nextCli = resolveNextCli();
const appDir = join(root, "apps", "web");
if (!nextCli) {
  console.error(
    "\n\x1b[31m[empathy-pro-2]\x1b[0m Next non trovato in node_modules (né in root né in apps/web).\n" +
      "  Dalla \x1b[1mroot del monorepo\x1b[0m (cartella con package-lock.json) esegui: \x1b[1mnpm install\x1b[0m\n" +
      "  Poi di nuovo: \x1b[1mnpm run dev\x1b[0m\n" +
      "  Nota: \x1b[1mnpm run dev:clean\x1b[0m rimuove solo .next / cache build, \x1b[1mnon\x1b[0m cancella node_modules.\n" +
      "  Se il clone è sotto OneDrive e npm fallisce con EPERM, chiudi editor/process che tengono file in node_modules e riprova.\n",
  );
  process.exit(1);
}

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
    "\n\x1b[36m[empathy-pro-2]\x1b[0m Env: \x1b[1mapps/web/.env.local\x1b[0m (NEXT_PUBLIC_SUPABASE_*). Windows: build in \x1b[1mapps/.empathy-pro2-next-dev\x1b[0m (`NEXT_DIST_DIR` relativo). Cache webpack disattiva.\n" +
      "  Se compaiono \x1b[33mEBUSY\x1b[0m su `webpack-runtime.js` o \x1b[33m404\x1b[0m su `/_next/static/chunks/.../physiology/page.js`: chiudi \x1b[1mtutte\x1b[0m le istanze `next dev` (anche altre finestre/IDE), \x1b[1mnpm run dev:clean\x1b[0m, riavvia `npm run dev`, poi hard refresh (Ctrl+Shift+R).\n" +
      "  Con \x1b[1mOneDrive\x1b[0m in sync sulla repo, la cartella di build può restare bloccata: pausa sync su `apps/.empathy-pro2-next-dev` o sposta il clone fuori da OneDrive.\n" +
      "  \x1b[90mNon incollare l’output del server in PowerShell (righe GET/POST/✓): non sono comandi.\x1b[0m\n" +
      "  \x1b[90mRighe `npm error … ENOWORKSPACES` all’avvio: filtrate (noto Next 14 + npm workspaces); se compare altro `npm error`, è visibile.\x1b[0m\n",
  );
}

/**
 * Next 14.x in monorepo npm a volte invoca `npm` all'avvio → `ENOWORKSPACES` su stderr (noto, innocuo).
 * Non usare NPM_CONFIG_WORKSPACES=false (conflitto `--workspace` / `--no-workspaces`).
 * Qui filtriamo solo quel blocco di righe sullo stream del processo figlio.
 */
function attachFilteredStderr(child) {
  if (!child.stderr) return;
  let buf = "";
  const dropLine = (line) => {
    const t = line.trimEnd();
    if (/npm error code ENOWORKSPACES/i.test(t)) return true;
    if (/This command does not support workspaces/i.test(t)) return true;
    if (/npm error This command does not support workspaces/i.test(t)) return true;
    if (/npm error A complete log of this run can be found in:/i.test(t)) return true;
    return false;
  };
  child.stderr.on("data", (chunk) => {
    buf += chunk.toString("utf8");
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i + 1);
      buf = buf.slice(i + 1);
      if (!dropLine(line)) process.stderr.write(line);
    }
  });
  child.stderr.on("end", () => {
    if (buf && !dropLine(buf)) process.stderr.write(buf);
  });
}

// `cwd` = `apps/web` così Next carica `.env.local` accanto a `next.config.mjs` (stesso criterio di `npm run build`).
const child = spawn(
  process.execPath,
  [nextCli, "dev", ".", "-p", String(port)],
  { stdio: ["inherit", "inherit", "pipe"], cwd: appDir, env },
);

attachFilteredStderr(child);

child.on("exit", (code) => process.exit(code ?? 0));
