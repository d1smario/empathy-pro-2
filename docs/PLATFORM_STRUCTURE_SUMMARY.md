# Sintesi struttura piattaforma Empathy Pro 2.0

Documento di **riferimento rapido** (non sostituisce `CONSTITUTION.md` né `docs/ARCHITECTURE.md`).

## Piani (4 livelli)

1. **Ingest** — device, lab, sensori continui, file, LogMeal → eventi normalizzati (`docs/INGEST_DEVICE_AND_LAB_MATRIX.md`).
2. **Compute** — motori deterministici → **digital twin**.
3. **Interpretation** — knowledge, research trace; AI struttura fatti ed evidenza, **non** sostituisce i motori.
4. **Application** — moduli prodotto, auth, coach/atleta, Stripe; home pubblica (cos’è Empathy, piani, iscrizione); UI/3D come presentazione.

## Memoria e generazione

- **Una linea di verità per `athlete_id`**; coach = accesso tramite membership, non fork dati (`docs/ATHLETE_MEMORY_AND_COACH_SCOPE.md`).
- **Builder** = unico generatore canonico di **singola sessione**; **calendar** operativo; orchestrazione annuale (Virya-equivalent) verso builder, senza secondo motore sessione.
- **Nutrition** consuma twin + training + profile + health & bio; output da motori/solver deterministici.
- **Dashboard / adattamento** richiude il loop su carico e supporti quando l’adattamento non segue il piano.

## Commercio e superficie pubblica

- **Stripe** per abbonamenti; dettaglio ruoli in `docs/COMMERCIAL_AND_ROLES.md`.

## Regole operative

- Cursor: `empathy_generative_core`, `empathy_architecture_gate`, `empathy_athlete_memory`, `empathy_ingest_envelope`, oltre a stability/secrets/module scope.
- **Riallineamento sessione:** `docs/CURSOR_REALIGN_DAILY.md` (rapido) e `docs/CURSOR_REALIGN_DEEP.md` (profondo); istruzioni in `docs/CURSOR_REALIGN_HOWTO.md`.
- **UI modulo Pro 2:** replicare shell/sezioni come in `docs/PRO2_UI_PAGE_CANON.md` (riferimento: `TrainingBuilderRichPageView`).
- **Training operativo:** builder salva contratto `BUILDER_SESSION_JSON::` in `planned_workouts.notes`; calendario legge `GET /api/training/planned-window` e visualizza per famiglia (`CalendarPlannedBuilderDetail` + `parsePro2BuilderSessionFromNotes`).

---

*Versione 1.1.*
