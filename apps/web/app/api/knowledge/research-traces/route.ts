import type {
  KnowledgeResearchTraceListViewModel,
  KnowledgeResearchTraceSaveInput,
  KnowledgeResearchTraceViewModel,
} from "@/api/knowledge/contracts";
import {
  AthleteReadContextError,
  requireAthleteReadContext,
  requireAuthenticatedTrainingUser,
} from "@/lib/auth/athlete-read-context";
import { isMissingKnowledgeFoundationError } from "@/lib/knowledge/knowledge-foundation";
import {
  getKnowledgeExpansionTraceById,
  listKnowledgeExpansionTraceSummaries,
  listKnowledgeExpansionTraces,
  summarizeKnowledgeExpansionTrace,
} from "@/lib/knowledge/knowledge-research-trace-store";
import { syncResearchTracePlans } from "@/lib/knowledge/virya-research-trace-sync";
import type { ResearchPlan } from "@/lib/empathy/schemas";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireAuthenticatedTrainingUser(req);
    const athleteId = req.nextUrl.searchParams.get("athleteId")?.trim() ?? "";
    if (!athleteId) {
      return NextResponse.json<KnowledgeResearchTraceListViewModel>(
        { athleteId: "", traces: [], error: "Missing athleteId" },
        { status: 400 },
      );
    }
    await requireAthleteReadContext(req, athleteId);
    const expand = (req.nextUrl.searchParams.get("expand") ?? "").trim().toLowerCase();
    const limitRaw = req.nextUrl.searchParams.get("limit");
    const limitParsed = limitRaw ? Number(limitRaw) : 12;
    const limit = Number.isFinite(limitParsed) ? limitParsed : 12;

    if (expand === "expansion") {
      const expansionTraces = await listKnowledgeExpansionTraces(athleteId, { limit });
      const traces = expansionTraces.map((trace) => summarizeKnowledgeExpansionTrace(trace));
      return NextResponse.json<KnowledgeResearchTraceListViewModel>({
        athleteId,
        traces,
        expansionTraces,
        error: null,
      });
    }

    const traces = await listKnowledgeExpansionTraceSummaries(athleteId, { limit });
    return NextResponse.json<KnowledgeResearchTraceListViewModel>({
      athleteId,
      traces,
      error: null,
    });
  } catch (error) {
    if (isMissingKnowledgeFoundationError(error)) {
      const athleteId = req.nextUrl.searchParams.get("athleteId")?.trim() ?? "";
      return NextResponse.json<KnowledgeResearchTraceListViewModel>({
        athleteId,
        traces: [],
        error: null,
      });
    }
    const status = error instanceof AthleteReadContextError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Knowledge research traces failed";
    return NextResponse.json<KnowledgeResearchTraceListViewModel>(
      { athleteId: req.nextUrl.searchParams.get("athleteId")?.trim() ?? "", traces: [], error: message },
      { status },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuthenticatedTrainingUser(req);
    const body = (await req.json().catch(() => null)) as KnowledgeResearchTraceSaveInput | null;
    const batchPlans =
      body && "plans" in body && Array.isArray(body.plans) && body.plans.length
        ? (body.plans as ResearchPlan[])
        : null;
    const singlePlan = body && "plan" in body && body.plan ? body.plan : null;
    const plans: ResearchPlan[] | null = batchPlans ?? (singlePlan ? [singlePlan] : null);
    if (!plans?.length) {
      return NextResponse.json<KnowledgeResearchTraceViewModel>(
        { trace: null, error: "Invalid JSON body: expect plan or plans[]" },
        { status: 400 },
      );
    }

    const athleteIds = new Set(plans.map((p) => p.trigger.athleteId).filter(Boolean) as string[]);
    if (athleteIds.size > 1) {
      return NextResponse.json<KnowledgeResearchTraceViewModel>(
        { trace: null, error: "All plans must share the same athleteId" },
        { status: 400 },
      );
    }
    const athleteIdGate = [...athleteIds][0];
    if (!athleteIdGate) {
      return NextResponse.json<KnowledgeResearchTraceViewModel>(
        { trace: null, error: "Each plan must include trigger.athleteId" },
        { status: 400 },
      );
    }
    await requireAthleteReadContext(req, athleteIdGate);

    const summaries = await syncResearchTracePlans(plans);

    if (batchPlans) {
      return NextResponse.json<KnowledgeResearchTraceViewModel>({
        trace: null,
        summary: null,
        summaries,
        error: null,
      });
    }

    const first = summaries[0];
    const trace = first ? await getKnowledgeExpansionTraceById(first.traceId) : null;
    return NextResponse.json<KnowledgeResearchTraceViewModel>({
      trace,
      summary: first ?? null,
      error: null,
    });
  } catch (error) {
    if (isMissingKnowledgeFoundationError(error)) {
      return NextResponse.json<KnowledgeResearchTraceViewModel>({
        trace: null,
        error: "Knowledge foundation migration missing",
      });
    }
    const status = error instanceof AthleteReadContextError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Knowledge research trace save failed";
    return NextResponse.json<KnowledgeResearchTraceViewModel>(
      { trace: null, error: message },
      { status },
    );
  }
}
