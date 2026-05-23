import { NextRequest, NextResponse } from "next/server";
import { requireCoachLibraryWriteContext } from "@/lib/auth/coach-library-context";
import { TrainingRouteAuthError } from "@/lib/auth/training-route-auth";
import {
  importViryaWeekToCoachLibrary,
  type ViryaWeekLibrarySessionInput,
} from "@/lib/training/library/import-virya-week-to-library";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

function authError(err: unknown) {
  if (err instanceof TrainingRouteAuthError) {
    return NextResponse.json({ ok: false as const, error: err.message }, { status: err.status, headers: NO_STORE });
  }
  const message = err instanceof Error ? err.message : "virya_week_import_failed";
  return NextResponse.json({ ok: false as const, error: message }, { status: 500, headers: NO_STORE });
}

/** Export VIRYA: salva N sedute materializzate (contratto Builder) in libreria coach. */
export async function POST(req: NextRequest) {
  try {
    const { userId, orgId, db } = await requireCoachLibraryWriteContext(req);
    const body = (await req.json()) as {
      weekStart?: string;
      folderId?: string | null;
      viryaPlanName?: string;
      viryaPlanTag?: string;
      viryaPhase?: string;
      viryaWeekNumber?: number;
      weekObjectives?: string[];
      sessions?: ViryaWeekLibrarySessionInput[];
    };

    const weekStart = String(body.weekStart ?? "").trim();
    if (!weekStart) {
      return NextResponse.json({ ok: false as const, error: "missing_week_start" }, { status: 400, headers: NO_STORE });
    }

    const sessions = Array.isArray(body.sessions) ? body.sessions : [];
    if (!sessions.length) {
      return NextResponse.json({ ok: false as const, error: "no_sessions" }, { status: 400, headers: NO_STORE });
    }

    const result = await importViryaWeekToCoachLibrary({
      db,
      coachUserId: userId,
      orgId,
      folderId: body.folderId?.trim() || null,
      weekStart,
      viryaPlanName: body.viryaPlanName,
      viryaPlanTag: body.viryaPlanTag,
      viryaPhase: body.viryaPhase,
      viryaWeekNumber: body.viryaWeekNumber,
      weekObjectives: Array.isArray(body.weekObjectives)
        ? body.weekObjectives.filter((o): o is string => typeof o === "string")
        : undefined,
      sessions,
    });

    return NextResponse.json({ ok: true as const, ...result }, { headers: NO_STORE });
  } catch (err) {
    return authError(err);
  }
}
