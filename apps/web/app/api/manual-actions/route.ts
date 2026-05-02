import { NextRequest, NextResponse } from "next/server";
import type { ManualActionCommand } from "@/api/manual-actions/contracts";
import { AthleteReadContextError, requireAthleteReadContext, requireAthleteWriteContext } from "@/lib/auth/athlete-read-context";
import { validateManualActionCommand } from "@/lib/coach-actions/manual-action-policy";
import { isMissingRelationError } from "@/lib/supabase/missing-relation-error";

export const runtime = "nodejs";

type ManualActionRow = {
  id: string;
  athlete_id: string;
  created_by_user_id: string;
  scope: "coach" | "private";
  action_type: string;
  payload: Record<string, unknown>;
  status: "pending" | "applied" | "rejected" | "superseded";
  reason: string | null;
  created_at: string;
  applied_at: string | null;
};

export async function GET(req: NextRequest) {
  try {
    const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
    if (!athleteId) {
      return NextResponse.json({ items: [], error: "Missing athleteId" }, { status: 400 });
    }
    const { db } = await requireAthleteReadContext(req, athleteId);
    const { data, error } = await db
      .from("manual_actions")
      .select("id, athlete_id, created_by_user_id, scope, action_type, payload, status, reason, created_at, applied_at")
      .eq("athlete_id", athleteId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      if (isMissingRelationError(error)) {
        return NextResponse.json(
          { items: [], error: "Tabella manual_actions non presente: applica migrazione Pro 2 017 o equivalente V1 014." },
          { status: 503 },
        );
      }
      return NextResponse.json({ items: [], error: error.message }, { status: 500 });
    }
    return NextResponse.json({ items: (data as ManualActionRow[]) ?? [] });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ items: [], error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Manual actions list failed";
    return NextResponse.json({ items: [], error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as ManualActionCommand;
    const missing = validateManualActionCommand(payload);
    if (missing.length > 0) {
      return NextResponse.json({ error: `Missing required fields: ${missing.join(", ")}` }, { status: 400 });
    }

    const athleteId = String(payload.payload.athleteId ?? "").trim();
    const { userId, db } = await requireAthleteWriteContext(req, athleteId);
    if (payload.createdByUserId !== userId) {
      return NextResponse.json({ error: "createdByUserId must match authenticated user" }, { status: 403 });
    }

    const { error } = await db.from("manual_actions").insert({
      id: payload.id,
      athlete_id: payload.payload.athleteId,
      created_by_user_id: payload.createdByUserId,
      scope: payload.coachScope,
      action_type: payload.type,
      payload: payload.payload,
      status: "pending",
      reason: (payload.payload.reason as string | undefined) ?? null,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      actionId: payload.id,
      status: "pending" as const,
      message: "Manual action accepted and queued.",
    });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Manual action submit failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
