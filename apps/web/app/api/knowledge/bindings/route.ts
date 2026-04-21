import type { KnowledgeBindingViewModel } from "@/api/knowledge/contracts";
import { RequestAuthError, requireRequestAthleteAccess } from "@/lib/auth/request-auth";
import { resolveAthleteKnowledgeMemory } from "@/lib/knowledge/knowledge-memory-resolver";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
  if (!athleteId) {
    return NextResponse.json<KnowledgeBindingViewModel>(
      {
        athleteId: "",
        bindings: [],
        activeModulations: [],
        recentSessionPackets: [],
        error: "Missing athleteId",
      },
      { status: 400 },
    );
  }

  try {
    await requireRequestAthleteAccess(req, athleteId);
    const knowledge = await resolveAthleteKnowledgeMemory(athleteId);
    return NextResponse.json<KnowledgeBindingViewModel>({
      athleteId,
      bindings: knowledge.bindings,
      activeModulations: knowledge.activeModulations,
      recentSessionPackets: knowledge.recentSessionPackets,
      error: null,
    });
  } catch (error) {
    const status = error instanceof RequestAuthError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Unable to resolve athlete knowledge bindings";
    return NextResponse.json<KnowledgeBindingViewModel>(
      {
        athleteId,
        bindings: [],
        activeModulations: [],
        recentSessionPackets: [],
        error: message,
      },
      { status },
    );
  }
}
