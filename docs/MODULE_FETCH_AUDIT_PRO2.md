# EMPATHY Pro 2 — Audit fetch client (`apps/web`)

**Scopo:** inventario statico delle chiamate `fetch` / `fetchWithTimeout` verso route `/api/*` lato browser, per allineare la **spina di lettura** (`GET /api/athlete-memory`, API modulo che wrappano `resolveAthleteMemory`) come da `docs/EMPATHY_OPERATIONAL_REALIZATION_MAP.md`.

**Metodo:** `rg` su `apps/web` (`.ts`, `.tsx`). Aggiornare questo file quando si aggiungono viste o servizi.

---

## `fetch("/api/...")` o template literal

| Percorso | Endpoint |
|----------|----------|
| `modules/nutrition/views/NutritionPageView.tsx` | `/api/nutrition/usda-by-nutrient` |
| `modules/physiology/views/PhysiologyPageView.tsx` | `/api/knowledge/pubmed` |
| `modules/health/services/health-module-api.ts` | `/api/health/panels-timeline`, `/api/health/upload-document` |
| `modules/physiology/services/physiology-profile-api.ts` | `/api/physiology/profile` |
| `modules/physiology/services/physiology-api.ts` | `/api/physiology` |
| `modules/training/views/TrainingSessionPageView.tsx` | `/api/training/planned-window` |
| `modules/profile/services/profile-api.ts` | `/api/profile` (GET/POST/PUT) |
| `modules/training/views/TrainingBuilderRichPageView.tsx` | `/api/training/planned-window` |
| `components/training/ReplicateStatusStrip.tsx` | `/api/training/builder/replicate-status` |
| `modules/training/views/TrainingCalendarPageView.tsx` | `/api/training/planned-window` |
| `modules/nutrition/components/FoodDiaryPanel.tsx` | `/api/nutrition/diary/micronutrients`, `/api/nutrition/food-lookup`, `/api/nutrition/food-photo-estimate` |
| `modules/training/services/training-write-api.ts` | `/api/training/planned`, `/api/training/executed`, `/api/training/import` |
| `modules/training/services/training-virya-api.ts` | `/api/training/virya-context` |
| `modules/training/services/training-import-api.ts` | `/api/training/import`, `/api/training/import-planned` |
| `modules/training/services/training-executed-api.ts` | `/api/training/executed` |
| `modules/training/services/training-engine-api.ts` | `/api/training/engine/generate` |
| `modules/training/services/training-builder-catalog-api.ts` | `/api/training/builder/unified-exercises` |
| `modules/training/services/training-planned-api.ts` | `/api/training/planned/insert` |
| `lib/use-active-athlete.ts` | `/api/auth/session`, `/api/access/ensure-profile` |
| `components/training/TrainingPlannedWindowCard.tsx` | `/api/training/planned-window` |
| `components/dashboard/DashboardAthleteHubCard.tsx` | `/api/dashboard/athlete-hub` |
| `components/coach/CoachRosterCard.tsx` | `/api/athletes/roster` |
| `components/profile/ProfileAthleteCard.tsx` | `/api/profile/athlete-row` |
| `components/health/HealthBiomarkerPanelsCard.tsx` | `/api/health/panels-latest` |
| `components/physiology/PhysiologyProfileStripCard.tsx` | via `fetchCanonicalPhysiologyProfile` → `/api/physiology/profile` |
| `components/nutrition/NutritionAthleteSummaryCard.tsx` | `/api/nutrition/athlete-summary` |
| `app/invite/[token]/InviteTokenClient.tsx` | `/api/auth/session`, `/api/invites/accept` |
| `components/coach/CoachInviteLinksCard.tsx` | `/api/coach/invites` |
| `components/navigation/SidebarSessionActions.tsx` | `/api/auth/session` |
| `components/settings/SettingsAuthSessionDiagnostics.tsx` | `/api/auth/session` |
| `components/settings/SettingsIntegrationsDiagnostics.tsx` | `/api/settings/integration-flags` |
| `components/settings/SettingsBillingDiagnostics.tsx` | `/api/billing/checkout-config` |
| `components/commerce/PricingHostedCheckout.tsx` | `/api/billing/checkout-session` |
| `modules/nutrition/services/pathway-meal-usda-client.ts` | `/api/nutrition/usda-by-nutrient` |
| `modules/nutrition/services/food-diary-api.ts` | `/api/nutrition/diary` |
| `modules/nutrition/services/nutrition-actions-api.ts` | `/api/nutrition/catalog`, `/api/nutrition/device-export`, `/api/nutrition/media`, `/api/nutrition/profile-config` |
| `lib/memory/athlete-memory-client.ts` | `/api/athlete-memory` |

**Nota:** `NutritionPageView` costruisce anche URL per food-lookup con query aggiuntive (stesso path base di `FoodDiaryPanel`).

**`GET /api/training/planned-window`:** oltre a `planned` / `executed`, espone `readSpineCoverage` e `twinContextStrip` (da `resolveAthleteMemory` in parallelo alle query calendario), salvo **`includeAthleteContext=0|false|no|off|skip`** → contesto `null`, meno latenza. Componente UI: `components/training/TrainingPlannedWindowContextStrip.tsx`.

**Legacy:** `GET /api/physiology/profile-latest` resta disponibile (cookie session) ed è marcato `@deprecated`; nessun componente prodotto elencato sopra dovrebbe dipendervi.

---

## `fetchWithTimeout("/api/...")`

| Percorso | Endpoint |
|----------|----------|
| `modules/physiology/services/physiology-snapshot-api.ts` | `/api/physiology/history`, `/api/physiology/snapshot` |
| `modules/nutrition/services/nutrition-api.ts` | `/api/nutrition` |
| `modules/training/services/training-analytics-api.ts` | `/api/training/analytics` |
| `modules/nutrition/services/intelligent-meal-plan-api.ts` | `/api/nutrition/intelligent-meal-plan` |
| `lib/knowledge/knowledge-research-traces-client.ts` | `/api/knowledge/research-traces` |
| `modules/nutrition/services/nutrition-module-api.ts` | `/api/nutrition/module` |

---

## Allineamento spina lettura (indicativo)

- **Preferito per stato atleta aggregato:** `GET /api/athlete-memory?athleteId=` (o `fetchProfileViewModel` → include `athleteMemory` + `physiologyState`).
- **Endpoint paralleli da convergere nel tempo:** `profile-latest`, strip fisiologia solo DB, dove esiste già risoluzione canonica in `GET /api/profile` o in memory.

---

*Generato come baseline Pro 2; rieseguire grep prima di PR che tocchi moduli prodotto.*
