# Nutrizione — Meal plan: regole generative fisse (Pro 2)

Documento di riferimento stabile per prodotti e agenti. **Non** sostituisce `empathy_generative_core.mdc`; lo specializza per il meal plan.

## Principio

Ogni atleta ha un **Diet per giorno della settimana** in Profile. Ogni data del calendario nutrizione usa il Diet del **weekday** corrispondente. Il generativo **si adatta** a quel profilo; non applica numeri universali.

## Cosa legge il sistema (per data `D`)

1. `weekday` da `D` (es. 2026-05-26 → `Tue`)
2. `nutrition_config.week_plan[Tue]` (Profile → Diet):
   - numero pasti (`meal_count_mode`)
   - ripartizione % (`caloric_distribution` o `caloric_split` sul giorno)
   - macro giorno (`daily_macros`)
   - scala energetica (`day_type_pct`)
3. **Fallback** (stesso atleta, stessa data) se il giorno in `week_plan` non ha %: `nutrition_config.meal_plan.caloric_split` o root `caloric_split` (salvati da Nutrizione in passato), poi `meal_strategy` per il numero pasti.
4. Routine → orari pasti (`routine_config.week_plan` / `meal_times`)
5. Solver → budget kcal pasti del giorno (BMR + lifestyle + training × `day_type_pct`)
6. `buildDietMealSlotBudgets` → kcal/macro **per slot**
7. Composer → **quali alimenti** (USDA/canonical per composizione)

## Cosa NON fa il sistema

- Non usa la somma USDA per ridefinire % colazione/pranzo/cena
- Non sovrascrive Diet salvando da Nutrizione
- Non usa default 30/35/25/10 se il giorno Diet è configurato
- **Non riduce il fabbisogno energetico totale** con l'indicatore recovery/bio `trainingEnergyScale`: il fabbisogno = BMR + lifestyle + training pianificato (e poi eseguito quando importato). L'indicatore recovery/bio modula **solo** distribuzione pasti↔fueling, CHO/h, proteine e idratazione.

## Riferimento numerico (esempio)

Atleta 70 kg, BMR Cunningham ≈ 1900, lifestyle 20% ≈ 380. Seduta pianificata 5h = 4179 kcal metaboliche (calendario/Builder).

- `dailyKcal` = 1900 + 380 + 4179 = **6459 kcal** (fabbisogno reale del giorno)
- `mealsKcal` (40% training nei pasti) = 1900 + 380 + 4179×0,40 = **3952 kcal**
- `fuelingKcal` (60% training in pre/intra/post) = 4179×0,60 = **2507 kcal**
- `mealsKcal + fuelingKcal` = 6459 → coerente col fabbisogno totale.

Se `trainingEnergyScale = 0,57` (atleta in stato protective): **non** entra nelle formule sopra; `mealTrainingFraction` può passare 0,40 → 0,48 (sposta energia dal fueling ai pasti), ma la somma resta 6459.

## 6 pasti

Con `meal_count_mode = 6`: colazione, spuntino mattina, pranzo, spuntino pomeriggio, cena, **spuntino serale** (`snack_evening`).

- In **Profile → Diet** con 6 pasti: tre campi % (mattina / pomeriggio / serale); `snacks` in DB = **somma** dei tre (es. 10+10+10 = **30%** totale spuntini).
- Se nel JSON c’è solo `snacks: 10` con colazione+pranzo+cena = 70% (totale 80%), il motore interpreta **10% per ciascuno** dei tre spuntini (caso 25/25/20 + tre spuntini da 10).
- Se `snacks: 30` con stessi pasti principali, divide **30÷3 = 10%** per slot spuntino.

## Memoria alimenti (canonical + USDA)

Il composer deterministico pesca gli alimenti dalla **memoria**:

- `CANONICAL_FOOD_TABLE` (TS, `apps/web/lib/nutrition/canonical-food-composition.ts`) — riga per ogni canonical food key con macro/micro USDA-like per 100 g.
- `nutrition_fdc_foods` (Supabase cache, mappata via `canonical-food-fdc-aliases.ts`) — single source of truth lato server quando disponibile.

Ogni item emesso dal composer è descritto da `name + portionHint + approxKcal`:

1. `inferCanonicalFoodKeyPreferName(name, portionHint)` → canonical key (prima sul `name`, poi sul `name + portionHint`).
2. `nutrientsForMealPlanItem` o `nutrientsForMealPlanItemFromCache` → scala i nutrienti per la quantità (grammi parsati dall'hint, ml × densità per liquidi-latte, o fallback `approxKcal`).
3. Se il name non risolve nessuna rule INFER → `compositionStatus="unresolved"` → 0 kcal silenzioso = **bug strutturale**.

Il guardrail `apps/web/lib/nutrition/meal-plan-memory-guardrail.test.ts` esercita tutto il composer (slot × dietType × kcal range) e fallisce se anche un solo item non risolve in memoria.

Aggiungere un nuovo alimento al composer = aggiungere riga in `CANONICAL_FOOD_TABLE` + rule INFER + (se liquido) `LIQUIDS_AS_GRAMS_KEYS`.

## Composizione CHO per slot (regola nutrizionista)

Il composer applica le seguenti regole sulla quantità e numero di fonti CHO in base al target del pasto:

### Colazione

| CHO target (g) | Fonti CHO solide complesse |
|---------------:|----------------------------|
| < 130 | 1 fonte (cereali / avena / muesli / pane / fette biscottate) + frutta |
| ≥ 130 | **2 fonti distinte** (es. cereali soffiati / muesli / avena / porridge **+** pane tostato / fette biscottate) |

La quota della 1ª fonte si riduce automaticamente (~36–43% del CHO target invece del 55–70% standard) per fare spazio alla 2ª senza sforare le kcal del pasto.

### Pranzo / Cena

| CHO target (g) | Carb principale | Carb secondario (pane / focaccia) |
|---------------:|-----------------|------------------------------------|
| ≤ 100 | pasta · riso · farro · orzo · quinoa · patate **OPPURE** pane (cene leggere) | 0 g |
| 100 – 130 | pasta · riso · farro · orzo · quinoa · patate (**pane vietato come principale**) | 20–35 g (accompagnamento) |
| 130 – 180 | pasta · riso · farro · orzo · quinoa · patate (**pane vietato come principale**) | **40–80 g (2ª fonte CHO)** |
| > 180 | pasta · riso · farro · orzo · quinoa · patate (**pane vietato come principale**) | **70–110 g (2ª fonte CHO)** |

### Pool carb principale (lunch/dinner)

5 amidi complessi (pasta · riso · farro/orzo · quinoa · patate) + pane (solo se CHO ≤ 100 g) = pool sufficiente per rispettare `MAX_STAPLE_USES_PER_WEEK = 3` su 14 pasti principali settimanali (5 × 3 = 15 ≥ 14).

### Implementazione

- `apps/web/lib/nutrition/mediterranean-meal-composer.ts` — filtro `carbOrder` esclude `"pane"` quando lunch/dinner ha `m.carbsG > 100`; `paneG` scala su `m.carbsG`; etichetta dell'item pane diventa "Pane / focaccia (2ª fonte CHO)" quando attiva la 2ª fonte.
- `apps/web/lib/nutrition/breakfast-meal-archetypes.ts` — `appendBreakfastSecondaryCarb()` aggiunge la 2ª fonte CHO solida (pane tostato se la 1ª è cereali/avena/muesli/granola; fiocchi d'avena se la 1ª è pane/fette).
- `apps/web/lib/nutrition/meal-plan-memory-guardrail.test.ts` — guardrail 6, 7, 8 verificano in test che la regola sia rispettata su tutti i `dietType × date × kcal range`.

## Codice

Vedi `.cursor/rules/empathy_nutrition_diet_meal_plan_generative.mdc`.
