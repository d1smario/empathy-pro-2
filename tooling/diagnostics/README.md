# Diagnostics scripts (Pro 2)

One-off athlete/DB diagnostic scripts live under `apps/web/scripts/` (`diag-*`, `fix-*`).

They are **not** part of the product runtime. Run manually from repo root, e.g.:

```bash
node apps/web/scripts/diag-grant-owners.mjs
```

Do not import these from `apps/web/app` or module code.
