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

## 6 pasti

Con `meal_count_mode = 6`: colazione, spuntino mattina, pranzo, spuntino pomeriggio, cena, **spuntino serale** (`snack_evening`).

- In **Profile → Diet** con 6 pasti: tre campi % (mattina / pomeriggio / serale); `snacks` in DB = **somma** dei tre (es. 10+10+10 = **30%** totale spuntini).
- Se nel JSON c’è solo `snacks: 10` con colazione+pranzo+cena = 70% (totale 80%), il motore interpreta **10% per ciascuno** dei tre spuntini (caso 25/25/20 + tre spuntini da 10).
- Se `snacks: 30` con stessi pasti principali, divide **30÷3 = 10%** per slot spuntino.

## Codice

Vedi `.cursor/rules/empathy_nutrition_diet_meal_plan_generative.mdc`.
