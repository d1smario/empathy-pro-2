# EMPATHY Pro 2 — Architettura del sistema generativo

**Repo:** `empathy-pro-2-cursor` · **App:** `apps/web` · **Solo Pro 2** (non confondere con V1 `nextjs-empathy-pro`).

Questo file è il **punto d’ingresso** per “come funziona il generativo” in Pro 2: i **4 piani** (Ingest → Compute → Interpretation → Application), chi produce numeri canonici, dove sta l’AI. La **mappa operativa unica** (organigramma, file, API, matrice piano × artefatto) vive in:

→ **`docs/EMPATHY_MULTILAYER_COMPLETE_ARCHITECTURE.md`** (“EMPATHY — Architettura multilayer completa”).

Leggere sempre insieme:

| Documento | Ruolo |
|-------------|--------|
| `CONSTITUTION.md` | Invarianti prodotto/tecnici |
| `docs/ARCHITECTURE.md` | Piani dati e confini monorepo |
| `docs/EMPATHY_MULTILAYER_COMPLETE_ARCHITECTURE.md` | Indice organizzativo + diagrammi + matrice API/file |
| `docs/EMPATHY_PRO2_DATA_AND_GENERATION_NETWORK.md` | Rete dati, flussi (es. nutrizione), gap noti |
| `docs/EMPATHY_OPERATIONAL_REALIZATION_MAP.md` | L1–L4 operativi, spina lettura, fasi |
| `.cursor/rules/empathy_generative_core.mdc` | Regole Cursor (reality > plan, AI non motore numerico) |

## Sintesi normativa (4 piani)

1. **Ingest** — reality: device, lab, profilo, calendario, diario; record DB e qualità.
2. **Compute** — verità numerica: motori, twin, **solver** (nutrizione, bioenergetica), **builder** sessione; un solo canone per struttura/numeri dove definito.
3. **Interpretation** — senso senza riscrivere i numeri: pathway, knowledge, trace, staging L2 verso memoria.
4. **Application** — UI e API sottili: moduli, gate `requireAthleteReadContext`, export.

**AI / LLM:** interpretazione, ricerca, etichettatura; **non** genera piano pasto canonico né sostituisce i motori per i numeri (vedi route deterministiche nutrizione).

## Integrazione con la mappa multilayer

- **Un solo posto** per “dove sta il file X e che piano tocca”: `EMPATHY_MULTILAYER_COMPLETE_ARCHITECTURE.md` (§ matrice + § API).
- Quando aggiungi una route modulo, un gate lettura o una pipeline deterministica, **aggiorna la mappa multilayer** e, se cambia il significato dei 4 piani, **una riga in questo file** (sintesi) basta; il dettaglio resta nella mappa.

## Nota lettura profilo → Compute (nutrizione)

Il contesto modulo nutrizione deve esporre antropometria coerente con la **read spine** (`requireAthleteReadContext` → `db`): oltre a `resolveAthleteMemory`, `GET /api/nutrition/module` arricchisce il `profile` con i campi chiave da `athlete_profiles` (merge in `lib/nutrition/nutrition-module-profile-merge.ts`). Così il solver BMR non dipende da un solo client Supabase parallelo.

---

*Documento di orchestrazione Pro 2 — aprile 2026. Dettaglio strutturale: `EMPATHY_MULTILAYER_COMPLETE_ARCHITECTURE.md`.*
