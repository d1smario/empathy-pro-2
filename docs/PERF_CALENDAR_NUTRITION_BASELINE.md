# Performance baseline — Calendario · Nutrizione · Fueling

Documento operativo per misurare l’impatto delle ottimizzazioni Fase 1–2.

## Route da profilare

| Route | Header `Server-Timing` | Uso |
|-------|------------------------|-----|
| `GET /api/training/planned-window` | `auth`, `window`, `total` | Griglia calendario |
| `GET /api/nutrition/module` | `auth`, `window`, `total` | Contesto nutrizione |
| `GET /api/operational/day-hub` | `auth`, `hub`, `total` | Giorno singolo (flag `NEXT_PUBLIC_USE_DAY_HUB=1`) |

## Come leggere i tempi

1. DevTools → Network → seleziona la request → Response Headers → `Server-Timing`.
2. Oppure: `curl -sI -H "Cookie: …" "https://…/api/training/planned-window?…" | grep -i server-timing`

Esempio: `window;dur=842.3;desc="planned executed window", total;dur=1120.5;desc="planned-window"`

## Target Fase 1 (p95, atleta con piano normale)

| Flusso | Obiettivo |
|--------|-----------|
| Calendario — griglia mese | &lt; 1,5 s `total` |
| Nutrizione — first paint (`mode=light`, ±7 gg) | &lt; 2 s `total` |
| Nutrizione — pathway giorno | &lt; 1 s `total` |
| Day hub (se abilitato) | &lt; 800 ms `total` |

## Registrare baseline

Prima/dopo ogni PR performance, annotare su un atleta reale (stesso `athleteId`, stessa finestra):

```bash
# Da root monorepo (unit + DB window + health opzionale)
node apps/web/scripts/perf-calendar-nutrition-smoke.mjs [athleteId]
```


```
Data:
Atleta:
planned-window (mese): total=… window=…
nutrition/module (light ±7): total=… window=…
nutrition/module (pathway 1 gg): total=…
day-hub (1 gg, se flag): total=… hub=…
```

## Feature flag day-hub

In `apps/web/.env.local` (manuale):

```
NEXT_PUBLIC_USE_DAY_HUB=1
```

Default **off** in produzione finché la baseline post-Fase-1 è stabile.

## Modifiche Fase 1 implementate

- Nutrition: fetch iniziale `mode=light` senza `pathwayDate`; finestra ±7 + espansione background ±30.
- `nutrition/module`: `trace_summary` solo su `mode=pathway` finestra 1 giorno.
- Calendario: cache client + debounce 250 ms sul fetch trace del giorno selezionato.
- Calendario griglia (sequenziale, una chiamata alla volta): (1) `includePlanned=1` `includeExecuted=0` `includePlannedNotes=0` → chip PLAN; (2) `includePlanned=0` `includeExecuted=1` → device EXEC; (3) wellness; (4) VIRYA. `includePlannedNotes=1` solo sul giorno selezionato (pannello Builder sotto, non griglia).
