import { redirect } from "next/navigation";

/** Una schermata per area: meal plan è l'hub di default (come V1 con tab dedicate). */
export default function NutritionIndexPage() {
  redirect("/nutrition/meal-plan");
}
