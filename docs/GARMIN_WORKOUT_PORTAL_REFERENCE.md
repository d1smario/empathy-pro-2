# Garmin Workout Portal — riferimento archiviato (non implementato in Pro 2)

**Stato:** documentazione di supporto raccolta dal team. **Non** fa parte della pipeline Garmin attiva in Empathy Pro 2.0.

**Pipeline attuale Pro 2 (Garmin):** Garmin Connect Developer **Health API** — push notifiche → `garmin_pull_jobs` → pull `activities` / `activityDetails` / `activityFile` (FIT) → `garmin-activity-materialize.ts` → `executed_workouts` / wellness. Vedi `apps/web/lib/integrations/garmin-*.ts` e `docs/GARMIN_OAUTH2_TEST_RUNBOOK.md`.

**Workout Portal:** API per **workout prescrittivi** (definizione strutturata, step, segmenti) e **schedule** sul dispositivo/account Garmin. È un asse **piano prescritto ↔ Garmin**, ortogonale all’ingest delle **sessioni eseguite**.

---

## Perché tenerlo in archivio

- Utile se in futuro si vuole **push/pull workout strutturati** verso Garmin (come linea separata da Wahoo `wahoo-cloud-service` workout).
- La **v2** introduce `segments[]` e `isSessionTransitionEnabled` rispetto alla forma “flat” con solo `steps[]`.

---

## Workout Portal V1 (estratto)

Base path tipico del prodotto “Workout” nel portale Garmin (host/versione da documentazione ufficiale del proprio ambiente registrato).

| Metodo | Path | Note |
|--------|------|------|
| GET | `/workout/{workoutId}` | `workoutId` int64 |
| PUT | `/workout/{workoutId}` | body = workout |
| DELETE | `/workout/{workoutId}` | 204 |
| POST | `/workout` | creazione |
| GET | `/schedule/{workoutScheduleId}` | `scheduleId`, `workoutId`, `date` |
| PUT | `/schedule/{workoutScheduleId}` | |
| DELETE | `/schedule/{workoutScheduleId}` | |
| GET | `/schedule` | query `startDate`, `endDate` (date) |
| POST | `/schedule` | creazione schedule |

**Schema v1 (campi principali):** `workoutId`, `ownerId`, `workoutName`, `description`, date/timestamp, `sport`, stime/pool, `workoutProvider`, `workoutSourceId`, **`steps[]`** (ordine, tipo, intensity, duration/target, stroke/drill/equipment, peso, ecc.).

Risposte: 200 JSON, 204 no content, 403 `{ message, error }`.

---

## Workout Portal V2 (estratto)

| Metodo | Path | Note |
|--------|------|------|
| GET | `/workout/v2/{workoutId}` | |
| PUT | `/workout/v2/{workoutId}` | body = workout v2 |
| DELETE | `/workout/v2/{workoutId}` | 204 |

**Differenze rispetto a v1 (da esempio schema):**

- `isSessionTransitionEnabled` (boolean).
- Al posto di un solo array `steps` a livello root: **`segments[]`**, ognuno con `segmentOrder`, `sport`, stime/pool propri, e annidato **`steps[]`** per quel segmento.

Il resto dei campi di testata workout (`workoutName`, `sport`, provider/source, stime, pool, ecc.) resta allineato al modello v1.

---

## Integrazione futura (checklist tecnica, non impegnativa)

1. Confermare **base URL**, versione API e **OAuth / permessi** richiesti nel portale Garmin per l’app registrata.
2. Non mescolare con **Health API pull token** su `activities` — sono prodotti e flussi diversi.
3. Se si mappa su Empathy: contratto verso `planned_workouts` / builder export, regole di conflitto e idempotenza (`workoutSourceId` / id Garmin).

---

*Archiviato per decisione esplicita: informazioni utili ma fuori scope pipeline ingest attuale.*
