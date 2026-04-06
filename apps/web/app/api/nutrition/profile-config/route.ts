import { NextRequest, NextResponse } from "next/server";
import { writeAthleteMemoryDomainPatch } from "@/lib/memory/athlete-memory-domain-writer";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      athleteId?: string;
      nutrition_config?: Record<string, unknown>;
      routine_config?: Record<string, unknown>;
    };
    const athleteId = (body.athleteId ?? "").trim();
    if (!athleteId) return NextResponse.json({ error: "Missing athleteId" }, { status: 400 });
    const result = await writeAthleteMemoryDomainPatch({
      domain: "nutrition",
      action: "config",
      athleteId,
      nutritionConfig: body.nutrition_config,
      routineConfig: body.routine_config,
    });
    return NextResponse.json({ status: result.status, athleteMemory: result.athleteMemory });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Nutrition profile config update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

