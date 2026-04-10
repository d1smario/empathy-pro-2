# Supabase: cosa incollare e in che ordine (V1 + Pro 2)

> **Non incollare questo file `.md` nel Supabase SQL Editor** (il `#` dà errore 42601).  
> Per istruzioni incollabili come SQL usa `PASTE_SUPABASE_ORDINE_E_FILE.sql` (solo commenti + `select 1`).

Le due app leggono **lo stesso database** se `NEXT_PUBLIC_SUPABASE_URL` / chiavi puntano allo **stesso progetto**. Il seed non va “importato in Pro 2” come codice: va **eseguito una volta sul progetto Supabase**; poi Pro 2 mostra i dati solo se sei loggato come utente con `app_user_profiles.athlete_id` corretto.

## File in questa cartella (`empathy-pro-2-cursor/supabase/`)

| Ordine | File | Scopo |
|--------|------|--------|
| 0 (opz.) | `PASTE_VERIFY_ATHLETE_BY_EMAIL.sql` | Controlla che `m@d1s.ch` abbia `athlete_id` e conteggi planned/executed. |
| 0b (se serve) | `PASTE_LINK_APP_USER_ATHLETE.sql` | Se `athlete_id` è NULL, lo aggancia a `athlete_profiles` con la stessa email. |
| 1 | `migrations/005_device_sync_exports_provider_ecosystem.sql` **oppure** solo l’`ALTER` all’inizio di `PASTE_DEMO_SEED_MARIO_ROVALETTI.sql` | Estende `device_sync_exports` per `whoop` + ecosistema (suunto, apple_watch, …). |
| 2 | `PASTE_DEMO_SEED_MARIO_ROVALETTI.sql` **intero** | Dati demo per l’atleta risolto da email `m@d1s.ch` (include già l’`ALTER` del passo 1: puoi eseguire solo questo file se preferisci un unico incolla). |

## Perché Pro 2 “non vedeva” i dati

1. **`.env.local` di Pro 2** diverso da V1 → progetto Supabase diverso (nessun seed lì).
2. **`app_user_profiles.athlete_id` nullo** per `m@d1s.ch` → l’API non carica l’atleta giusto; usa `PASTE_LINK_APP_USER_ATHLETE.sql` dopo verifica.
3. Seed non completato (errore SQL precedente) → riesegui `PASTE_DEMO_SEED_MARIO_ROVALETTI.sql` dopo fix.

## Repo V1

Stesso seed e migration equivalente: `nextjs-empathy-pro/supabase/PASTE_DEMO_SEED_MARIO_ROVALETTI.sql` e `migrations/028_device_sync_exports_provider_ecosystem.sql`.
