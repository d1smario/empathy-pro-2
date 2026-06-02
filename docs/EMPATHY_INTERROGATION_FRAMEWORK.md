# EMPATHY — Framework interrogativo L1–L10 (Pro 2)

## Ruolo nel piano generativo

| Piano | Contenuto |
|-------|-----------|
| **Compute** | Pathway modulation, daily energy / fueling solver, twin, lab bridges |
| **Interpretation** | `EmpathyInterrogationMap` (domande L1–L10) + `EmpathyApplicationPlaybook` (consigli operativi) |
| **Application** | Meal plan request (`contextLines`, `integrationLeverLines`, `pathwayTimingLines`), UI Integrazione / Dashboard |

L’AI **non** inventa kcal, CHO/h o macro: il playbook cita riferimenti al solver (`dailyEnergyModel.fueling.adjustedChoGPerHour`, ecc.).

## File canonici

- Contratti: `packages/contracts/src/schemas/empathy-interrogation-framework.ts`
- Catalogo 14 domande L9: `packages/domain-knowledge/src/interrogation/catalog-v1.ts`
- Map: `apps/web/lib/interpretation/build-empathy-interrogation-map.ts`
- Playbook: `apps/web/lib/interpretation/empathy-application-playbook.ts`
- Bundle: `apps/web/lib/interpretation/resolve-empathy-interrogation-bundle.ts`
- Materialize → meal plan: `apps/web/lib/interpretation/materialize-application-playbook.ts`

## API

`GET /api/nutrition/module` con `pathwayDate` nella finestra `from`…`to` restituisce:

- `interrogationMap`
- `applicationPlaybook`

`mode=pathway` restituisce lo stesso playbook per un refresh leggero del giorno.

## UI

- **Nutrition · Integrazione** (e predictor): sezione collapsible “Playbook applicazione · EMPATHY”
- **Dashboard hub**: preview 3 directives (fetch `mode=pathway` per oggi) + link a `/nutrition/integration`

## Test

`apps/web/lib/interpretation/build-empathy-interrogation-map.test.ts`

## Estensioni future (non in MVP)

- Binding ontology SIRT1 / training-hypoxia → HIF estesi
- Narrazione LLM su L10 (solo dopo gate stabilità)
- `includeInterrogation` inline su `athlete-hub` (oggi: riuso nutrition module dal client dashboard)
