# Ingest: device, sensori continui, laboratorio

Documento **vincolante** per il piano **Ingest**. Incrocia `docs/ARCHITECTURE.md`, `docs/ATHLETE_MEMORY_AND_COACH_SCOPE.md`, `CONSTITUTION.md` e `.cursor/rules/empathy_ingest_envelope.mdc`.

## 1. Principio

Ogni sorgente esterna entra tramite **adapter** che emette **eventi normalizzati** (timestamp, tipo, unità, qualità, provenienza, `athlete_id`). **Nessun modulo prodotto** implementa integrazione device-specific senza passare da questo percorso.

Un nuovo dispositivo o formato = **nuovo adapter + mapping a contract** in `packages/contracts` / dominio ingest — **non** nuova memoria parallela.

## 2. Categorie di sorgente

| Categoria | Esempi | Note architetturali |
|-----------|--------|---------------------|
| **Wearable / sport** | Garmin, Polar, Apple Health, Wahoo, … | Spesso cloud OAuth o export file; normalizzazione verso eventi sessione / giornalieri |
| **Sensori continui** | CGM glicemia; futuri flussi ormonali dove esistono | Serie temporali ad alta frequenza: storage dedicato, downsampling, retention; twin consuma **aggregati** definiti dai motori |
| **Laboratorio / metabolic cart** | Cosmed, analizzatori VO₂ max, protocolli cardiopolmonari | Import file (CSV/XML/PDF strutturato se possibile) o API vendor; parser **versionati** |
| **Periferica ossigenazione / muscolo** | SmO₂ (es. Moxy), analoghi | BLE, vendor cloud o file; stesso envelope |
| **Manuale / coach** | Inserimento, correzione | Stessi gate di validazione della memoria atleta |

## 3. Compliance e UX

- Dati sanitari sensibili (es. glicemia): trattamento **privacy-first**, permessi chiari, copy che non supera **evidenza** e confini prodotto (non diagnosi).
- **LogMeal** (solo 2.0): ingest **reality** nutrizionale; vedi `docs/INTEGRATIONS_LOGMEAL.md`.

## 4. Roadmap adapter (indicativa)

Le righe seguenti sono **obiettivi di integrazione**, non architetture separate. Ogni voce richiede adapter + schema + test.

- Wearable major brands (priorità da prodotto)
- CGM / continuous glucose (API o partner)
- File / export Cosmed e equivalenti
- VO₂ / spiroergometria (lab export)
- SmO₂ / NIRS muscolare
- BIA / bioimpedenza (allineamento `CONSTITUTION.md` §G)
- Pedane di forza, EMG dove previsto in roadmap biomeccanica

## 5. Applicazione pubblica (fuori ingest atleta)

- **Home**, presentazione piani, **registrazione e abbonamento** vivono nel layer **Application** pubblico.
- **Stripe**: `packages/integrations-stripe` e `docs/COMMERCIAL_AND_ROLES.md` — legato ad **account / fatturazione**, non sostituisce `athlete_id` come chiave del twin.
- Grafica “high tech” / 3D marketing: `docs/DESIGN_SYSTEM_AND_FIGMA.md`, `docs/INTEGRATIONS_SPLINE.md` — **presentazione**; fallimenti non devono rompere auth o ingest (vedi `docs/ARCHITECTURE_SAFETY_AND_RISKS.md`).

## 6. Chiusura del loop (richiamo)

Dopo ingest validato → **compute** → **twin**; moduli e generatori leggono dalla **memoria canonica** per `athlete_id` (`docs/ATHLETE_MEMORY_AND_COACH_SCOPE.md`).

---

*Versione 1.0 — matrice viva: aggiornare quando si aggiunge un adapter.*
