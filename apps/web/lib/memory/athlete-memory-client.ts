import type { AthleteMemory } from "@/lib/empathy/schemas";

export async function fetchAthleteMemory(athleteId: string): Promise<AthleteMemory> {
  const response = await fetch(`/api/athlete-memory?athleteId=${encodeURIComponent(athleteId)}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? "Fetch athlete memory failed");
  }

  return (await response.json()) as AthleteMemory;
}
