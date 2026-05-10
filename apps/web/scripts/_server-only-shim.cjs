/**
 * CJS preload per neutralizzare `server-only` da script CLI standalone (recovery / ops).
 *
 * Use:
 *   node --require ./scripts/_server-only-shim.cjs --import tsx scripts/<your-script>.ts ...
 *
 * Sicurezza: questi script girano su Node con SUPABASE_SERVICE_ROLE_KEY (workload server),
 * quindi la sentinella `server-only` (pensata per Client Components Next) è inapplicabile.
 */
const Module = require("node:module");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function patched(request, parent, ...rest) {
  if (request === "server-only") {
    return require.resolve("./_server-only-noop.cjs", { paths: [__dirname] });
  }
  return origResolve.call(this, request, parent, ...rest);
};
