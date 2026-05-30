# Schema mirror plan (Pro 2)

Gradual re-export from `@empathy/contracts` into `apps/web/lib/empathy/schemas/index.ts`.

No big-bang: migrate domain-by-domain when touching related API routes.

Current source of truth: `packages/contracts/src/schemas/`.
