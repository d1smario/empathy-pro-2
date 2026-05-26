# Nutrizione — Meal plan: regole generative fisse (Pro 2)

Documento di riferimento stabile per prodotti e agenti. **Non** sostituisce `empathy_generative_core.mdc`; lo specializza per il meal plan.

## Principio

Ogni atleta ha un **Diet per giorno della settimana** in Profile. Ogni data del calendario nutrizione usa il Diet del **weekday** corrispondente. Il generativo **si adatta** a quel profilo; non applica numeri universali.

## Cosa legge il sistema (per data `D`)

1. `weekday` da `D` (es. 2026-05-26 → `Tue`)
2. `nutrition_config.week_plan[Tue]`:
   - numero pasti (`meal_count_mode`)
   - ripartizione % (`caloric_distribution`)
   - macro giorno (`daily_macros`)
   - scala energetica (`day_type_pct`)
3. Routine → orari pasti (`routine_config.week_plan` / `meal_times`)
4. Solver → budget kcal pasti del giorno (BMR + lifestyle + training × `day_type_pct`)
5. `buildDietMealSlotBudgets` → kcal/macro **per slot**
6. Composer → **quali alimenti** (USDA/canonical per composizione)

## Cosa NON fa il sistema

- Non usa la somma USDA per ridefinire % colazione/pranzo/cena
- Non sovrascrive Diet salvando da Nutrizione
- Non usa default 30/35/25/10 se il giorno Diet è configurato

## 6 pasti

Con `meal_count_mode = 6`: colazione, spuntino mattina, pranzo, spuntino pomeriggio, cena, **spuntino serale** (`snack_evening`). La quota `snacks` del Diet è divisa in tre parti uguali.

## Codice

Vedi `.cursor/rules/empathy_nutrition_diet_meal_plan_generative.mdc`.
