# Empathy Pro 2 — App mobile (`/m/*`)

Esperienza **telefono** parallela al desktop. Stesso deploy Vercel, stesso auth Supabase, stessi moduli dominio — solo shell e subset route diversi.

## URL

| Desktop (invariato) | App mobile |
|---------------------|------------|
| `/dashboard` | `/m/dashboard` (Oggi) |
| `/training/calendar` | `/m/training/calendar` |
| `/training/session/[date]` | `/m/training/session/[date]` |
| `/nutrition/meal-plan` | `/m/nutrition` → hub |
| `/nutrition/diary` | `/m/nutrition/diary` |
| `/profile` | `/m/profile` |
| `/settings` | `/m/settings` |

Builder, VIRYA, coach `/athletes`, lab staging: **solo desktop** (nessun redirect automatico).

## Redirect automatico

Su client mobile (User-Agent / `Sec-CH-UA-Mobile`), le route desktop mappate redirectano a `/m/...`.

**Opt-out:** cookie `empathy_desktop=1` oppure **Impostazioni → Usa versione desktop** (drawer menu o `/m/settings`).

## PWA

- Manifest: `start_url` = `/m/dashboard`, `display: standalone`
- Install: Safari iOS → Condividi → Aggiungi a Home; Chrome Android → Installa app

## Sviluppo locale

1. `npm run dev` (porta 3020)
2. Desktop: http://localhost:3020/dashboard
3. Mobile: http://localhost:3020/m/dashboard
4. Emulazione telefono: DevTools → responsive + UA mobile, oppure dispositivo reale sulla stessa rete

## File chiave

- Registry: `apps/web/core/navigation/mobile-module-registry.ts`
- Shell mobile: `apps/web/components/shell/MobileShellWithAdaptiveBackdrop.tsx`
- Route group: `apps/web/app/(mobile-shell)/`
- Middleware redirect: `apps/web/middleware.ts`

## QA smoke

- [ ] Login atleta su telefono → `/m/dashboard`
- [ ] Bottom nav: Oggi, Training, Nutrition, Profile
- [ ] Cookie desktop → `/dashboard` con sidebar PC
- [ ] Desktop browser invariato (nessun redirect senza UA mobile)
- [ ] `npm run verify` verde
