import type {
  KnowledgeResearchTraceListViewModel,
  KnowledgeResearchTraceSaveInput,
  KnowledgeResearchTraceViewModel,
} from "@/api/knowledge/contracts";
import {
  RequestAuthError,
  requireRequestAthleteAccess,
  requireRequestUser,
} from "@/lib/auth/request-auth";
import { isMissingKnowledgeFoundationError } from "@/lib/knowledge/knowledge-foundation";
import {
  listKnowledgeExpansionTraceSummaries,
  listKnowledgeExpansionTraces,
  persistKnowledgeExpansionTrace,
  summarizeKnowledgeExpansionTrace,
} from "@/lib/knowledge/knowledge-research-trace-store";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireRequestUser(req);
    const athleteId = req.nextUrl.searchParams.get("athleteId")?.trim() ?? "";
    if (!athleteId) {
      return NextResponse.json<KnowledgeResearchTraceListViewModel>(
        { athleteId: "", traces: [], error: "Missing athleteId" },
        { status: 400 },
      );
    }
    await requireRequestAthleteAccess(req, athleteId);
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
    const status = error instanceof RequestAuthError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Knowledge research traces failed";
    return NextResponse.json<KnowledgeResearchTraceListViewModel>(
      { athleteId: req.nextUrl.searchParams.get("athleteId")?.trim() ?? "", traces: [], error: message },
      { status },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRequestUser(req);
    const body = (await req.json().catch(() => null)) as KnowledgeResearchTraceSaveInput | null;
    const plan = body?.plan ?? null;
    if (!plan) {
      return NextResponse.json<KnowledgeResearchTraceViewModel>(
        { trace: null, error: "Invalid JSON body" },
        { status: 400 },
      );
    }
    if (plan.trigger.athleteId) {
      await requireRequestAthleteAccess(req, plan.trigger.athleteId);
    }
    const trace = await persistKnowledgeExpansionTrace(plan);
    return NextResponse.json<KnowledgeResearchTraceViewModel>({
      trace,
      summary: summarizeKnowledgeExpansionTrace(trace),
      error: null,
    });
  } catch (error) {
    if (isMissingKnowledgeFoundationError(error)) {
      return NextResponse.json<KnowledgeResearchTraceViewModel>({
        trace: null,
        error: "Knowledge foundation migration missing",
      });
    }
    const status = error instanceof RequestAuthError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Knowledge research trace save failed";
    return NextResponse.json<KnowledgeResearchTraceViewModel>(
      { trace: null, error: message },
      { status },
    );
  }
}
