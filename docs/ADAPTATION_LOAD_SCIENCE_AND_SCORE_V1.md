# Carico giornaliero, adattamento e score — letteratura vs modelli Empathy (v1)

Documento **prodotto + ingegneria**: definisce cosa calcoliamo oggi, su quali categorie pubbliche di letteratura ci appoggiamo, e cosa **non** garantiamo (in particolare: **equivalenza** con metriche chiuse di app o wearable).

**Norma di governance:** principio trasversale in `CONSTITUTION.md` §J (`docs/archive/CONSTITUTION_pre_science_principle_20260515.md` per snapshot pre-§J).

## 1. Scopo

- Dare un **linguaggio comune** tra training (carico esterno/interno), twin e future metriche di **readiness / adattamento**.
- Separare nettamente: **segnale misurato** (ingest) → **modello deterministico versionato** (`packages/domain-*`, route sottili) → **interpretazione** (AI, copy, insight) senza sostituire i motori.

## 2. Cosa la letteratura supporta (alto livello)

Modelli classici di **carico cumulato** e **impulso–risposta** descrivono come un **impulso giornaliero** (stress/allenamento) influenza componenti lente e veloci dello stato (spesso approssimate con **filtri esponenziali** su serie giornaliere). La letteratura discute anche **impulso interno** basato su FC, durata, percezione dello sforzo, ecc., con molte varianti pubblicate — **nessuna** di queste è obbligo di “fare come un’app”.

Per **HRV, sonno, FC a riposo**: evidenza su validazione dispositivi, variabilità free-living, limiti PPG — utili come **ingressi** con incertezza e tier di completezza, non come etichette vendor da replicare.

## 3.1 Audit percorsi (no doppioni carico / guidance)

- **EWMA giornaliero:** una sola implementazione numerica in `@empathy/domain-training`; `computeDailyLoadSeries` in `load-series.ts` è l’unico punto che produce `ctl`/`atl`/interni — tutti i caller (`athlete-state-resolver`, `internal-load-resolver`, `adaptation-regeneration-loop`, `expected-vs-obtained-engine`, `GET …/training/analytics`) importano quello.
- **Guidance atteso/osservato:** `twinExpectedAdaptationForGuidance` / `twinObservedAdaptationForGuidance` (`apps/web/lib/twin/twin-adaptation-fallbacks.ts`) centralizzano la priorità sui campi twin; evitano di usare lo stesso `adaptationScore` composito per entrambi i rami quando `expected`/`real` mancano in modo incoerente.

## 3. Implementazione Empathy oggi (v1 operativa)

| Costrutto | Ruolo | Dove | Note |
|-----------|-------|------|------|
| Impulso esterno giornaliero (EWMA "cronico/acuto") | `empathyExternalDailyImpulseFromSession`: TSS se presente; se TSS = 0 e c’è FC, proxy ordinamento-grandezza TSS da impulso cardio (v0, cap 150) | `load-series.ts` → `@empathy/domain-training` | Stesso ramo che alimenta `ctl`/`atl`/`tsb` sulla colonna `external` aggregata |
| Serie EWMA cronica / acuta | Smoothing \(k = e^{-1/\tau}\) con **τ = 42 g** e **τ = 7 g** sugli impulsi esterni (e stessa ricorrenza per ramo interno) | `@empathy/domain-training` (`ewmaDailyStep`, `DEFAULT_*_TAU_DAYS`), usato da `computeDailyLoadSeries` | Parametri versionabili; test golden in `packages/domain-training/src/daily-load-ewma.test.ts` |
| **`internalLoadScore`** (seduta) | Euristica proprietaria (TSS scalato + `empathyCardioImpulseDailyFromSession` + RPE/lattato/…) | `load-series.ts` + `@empathy/domain-training` | HR stress da `empathyCardioImpulseDailyFromSession` (v0) |

**TSB analogo empatico**: `ctl - atl` (e corrispettivi `iCtl - iAtl` sul ramo interno) sono **somme EWMA sugli impulsi scelti** — etichettatura prodotto deve evitare claim “identico a …” verso marchi esterni.

## 4. Vendor e divieto di parità

- **Non** usiamo definizioni proprietarie chiuse come specifica (**WHOOP strain**, **TrainingPeaks** numeri equivalenti, **Oura readiness**, ecc.).
- I dati che arrivano da tali fonti restano **eventi ingest normalizzati**; eventuali “score” del vendor possono essere mostrati come **metadati** se presenti, ma **non** definiscono il motore Empathy.
- **methodVersion** e **confidence** (introduzione progressiva su contratti/API) devono rendere esplicito quando mancano segnali (es. sonno, HRV, RR).

## 5. Roadmap tecnica (coerente col piano prodotto)

1. **Contratto `AdaptationScoreV1`** — tipi in `packages/contracts` e `apps/web/lib/empathy/schemas/adaptation.ts`; campo opzionale `adaptationScoreV1` su `TwinState`; valorizzazione in `apps/web/lib/twin/athlete-state-resolver.ts` (stesso composito numerico del legacy `adaptationScore`, più assi 0–1 e `confidence` da copertura sorgenti). Estensioni API/dashboard da allineare in passo successivo.
2. **Tier recupero (`RecoveryDataTier`)** — `minimal` | `standard` | `extended` da copertura ultimi 7 giorni (HRV, RHR, sonno, score vendor, RR, lab, BIA); pesi `recoveryCapacity` in `internal-load-resolver` (nessuna seconda pipeline).
3. **RR notturno** — campo `respiratoryRateRpm` su segnale sleep/recovery + coverage; canale autonomico include respiri/min da ingest.
4. **Impulso cardiovascolare giornaliero** proprietario (nome tipo `empathyCardioImpulseDaily`) dove manca potenza, con golden test su fixture — **non** target di uguaglianza con TRIMP di un paper o di un’app.
5. Superficie API/dashboard: **un solo loader** / estensione risposta esistente; guidance usa `twin-adaptation-fallbacks` (unica priorità expected vs observed vs composito).

## 6. Test

- Parte numerica EWMA: test `node:test` + `tsx` in `@empathy/domain-training` (`npm run test -w @empathy/domain-training`).
- Regressione su formule / impulsi: seguire `empathy_testing_engines` (fixture golden nel repo).

---

*v1 — allineato a Costituzione §J; aggiornare quando cambiano parametri o contratti.*
