# Intelligent loop — smoke / E2E (Pro 2)

Verifica manuale del ciclo: **reality → expected vs obtained → staging → manual action → memoria atleta → VIRYA/nutrition → calendar trace**.

## Prerequisiti

- Migrazione `035_athlete_coach_application_traces.sql` applicata su Supabase Pro 2 (tabella + RLS). Dopo l’apply, `PATCH /api/manual-actions/:id` con `applied` deve rispondere con `persistence.coachApplicationTrace` senza 500.
- Atleta con dati minimi: profilo, eventuale seduta planned/executed nella finestra date.
- Coach loggato con accesso all’atleta.

## Sequenza

1. **Expected vs obtained**  
   `GET` o `POST /api/training/expected-vs-obtained` con `athleteId` e finestra `from`/`to`.  
   Verifica risposta: ogni `deltas[].adaptationHint.loop_closure` (confronto vs giorno precedente: `compliance_vs_prior`, `recovery_vs_prior`, `summary_it`) e, se esistono trace, `recent_coach_application_traces`. Dopo `POST`, lo stesso payload è persistito in `training_expected_obtained_deltas.adaptation_hint`.

2. **Staging** (se delta `adapt`/`recover`)  
   Controlla `interpretation_staging_runs` in stato `pending_validation`. In `source_refs` devono comparire (se esistono) anche voci `table: "athlete_coach_application_traces"` oltre a planned/executed/delta.

3. **Commit staging**  
   `PATCH /api/health/staging-runs/:id` → `committed`.  
   Verifica `manual_actions` in `pending`.

4. **Applica manual action**  
   `PATCH /api/manual-actions/:id` → `applied`.  
   Verifica:
   - riga in `athlete_coach_application_traces` (unique su `manual_action_id`);
   - `interpretation_staging_commits` se collegata a staging.

5. **Memoria atleta**  
   Ricarica contesto che chiama `resolveAthleteMemory` (es. `/api/training/virya-context`, `/api/nutrition/module`).  
   In `athleteMemory.evidenceMemory.items` devono comparire voci con `source: "coach_manual_action"`.

6. **VIRYA**  
   Apri Training VIRYA: sezione **Proposta retune server (strutturata)** con `viryaRetuneProposal` (load suggestion, rationale, trace ids se presenti). Nella barra **Riepilogo passi 1–4** deve comparire il link **Builder sessione** → `/training/builder`.

7. **Calendar / trace salvataggio**  
   Da VIRYA genera e salva piano su calendario.  
   Verifica in `planned_workouts.notes` suffisso `[EMPATHY_CAL|src=...|mode=...|tr=...]` su almeno una riga del batch.

8. **Nutrition**  
   Modulo Nutrition: directive mostra righe **Memoria coach (validate)** se applicabili. Con `pathwayDate` nella finestra, `functionalMealSelector.notes` deve includere righe **Direttiva applicativa** / **Memoria coach validate** quando la direttiva ha focus o voci coach. In **Meal plan**, verifica blocco **Contesto applicativo** e `<details>` note selettore (allineato al client con `approvedNutritionPatches` + directive). Dopo **Genera il mio piano pasti**, nella risposta JSON il campo **`dayInteractionSummary`** (o equivalente nel body assemblato) deve riportare in testo anche le righe **Directive focus** / **Memoria coach validate** passate in `plan.contextLines` (tracciabilità senza solver parallelo).

9. **Reasoning dashboard**  
   `GET /api/dashboard/reasoning?athleteId=…`: verificare carte **Memoria applicazione coach (validate)** e, se presenti altri hit, **Evidenza / ipotesi** vs **Evidenza strutturata**. Nella prima carta bundle, riga evidenza su **Memoria applicazioni coach** se `coachValidatedApplicationTraceCount > 0`.

10. **Hub operativo**  
   `GET /api/dashboard/athlete-hub?…includeOperationalSignals=1`: verificare `expectedVsObtainedPreview` (data, status, `loopClosureSummary`, `recentCoachTracesInHint`) e nel bundle `operationalSignals.coachValidatedApplicationTraceCount`.

11. **Builder da VIRYA**  
   Da VIRYA → link **Builder sessione** deve aprire `/training/builder?src=virya` e mostrare il banner contestuale (chiudibile).

## Esito

- **Pass**: tutti i passaggi sopra osservabili senza errore 500.
- **Fail parziale**: tabella `035` non applicata → trace non persistono; API manual-actions restituisce errore esplicito su insert.
