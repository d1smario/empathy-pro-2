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
| `/health` | `/m/health` |
| `/physiology` | `/m/physiology` |
| `/bioenergetics` | `/m/bioenergetics` |
| `/biomechanics` | `/m/biomechanics` |
| `/aerodynamics` | `/m/aerodynamics` |
| `/longevity` | `/m/longevity` |

Builder, VIRYA, coach `/athletes`, lab staging: **solo desktop** (nessun redirect automatico).

## Redirect automatico

Su client mobile (User-Agent / `Sec-CH-UA-Mobile`), le route desktop mappate redirectano a `/m/...`.

**Opt-out:** cookie `empathy_desktop=1` oppure **Impostazioni → Usa versione desktop** (drawer menu o `/m/settings`).

**Recupero app mobile:** se vedi ancora la sidebar PC su telefono:

1. Apri **`/m/dashboard?app=1`** (link diretto o banner in alto nella versione desktop)
2. Oppure **Impostazioni → Usa app mobile** (`/m/settings`)
3. Cancella cookie `empathy_desktop` dal browser se persiste

**Nota coach:** account coach → `/athletes` resta desktop (app mobile atleta in fase 2).

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
- [ ] Bottom nav: Oggi, Training, Nutrition, Profile, Moduli (drawer)
- [ ] Drawer: griglia moduli (Health, Physiology, BioEnergetics, Longevity, Biomechanics, Aerodynamics)
- [ ] Link «Giornata» calendario resta su `/m/training/session/...`
- [ ] Cookie desktop → `/dashboard` con sidebar PC
- [ ] Desktop browser invariato (nessun redirect senza UA mobile)
- [ ] `npm run verify` verde

## Fase 2 (roadmap)

- Layout mobile dedicati (calendar/nutrition compatti)
- Coach mobile (`/m/athletes`)
- Icone PNG maskable 192/512
- Nascondere CTA builder su shell mobile
