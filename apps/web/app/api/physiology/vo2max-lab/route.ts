import { NextRequest, NextResponse } from "next/server";
import { RequestAuthError, requireRequestAthleteAccess } from "@/lib/auth/request-auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

function asFiniteNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * POST: salva VO2max da test di laboratorio (manuale o già parsato lato client) su physiological_profiles
 * + riga di audit metabolic_lab_runs (section vo2max_lab).
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      athleteId?: string;
      vo2max_ml_min_kg?: unknown;
      source?: string;
      note?: string | null;
      parsePreview?: Record<string, unknown> | null;
    };
    const athleteId = (body.athleteId ?? "").trim();
    const vo2 = asFiniteNumber(body.vo2max_ml_min_kg);
    if (!athleteId || vo2 == null) {
      return NextResponse.json({ error: "Missing athleteId or vo2max_ml_min_kg" }, { status: 400 });
    }
    const clamped = Math.round(Math.max(15, Math.min(95, vo2)) * 100) / 100;
    await requireRequestAthleteAccess(req, athleteId);

    const supabase = createServerSupabaseClient();
    const { data: existing, error: selErr } = await supabase
      .from("physiological_profiles")
      .select("athlete_id")
      .eq("athlete_id", athleteId)
      .maybeSingle();
    if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 });

    if (existing) {
      const { error: upErr } = await supabase
        .from("physiological_profiles")
        .update({ vo2max_ml_min_kg: clamped, updated_at: new Date().toISOString() })
        .eq("athlete_id", athleteId);
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    } else {
      const { error: insErr } = await supabase.from("physiological_profiles").insert({
        athlete_id: athleteId,
        vo2max_ml_min_kg: clamped,
      });
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    const inputPayload = {
      source: typeof body.source === "string" ? body.source : "manual",
      note: body.note ?? null,
      parse_preview: body.parsePreview ?? null,
    };
    const outputPayload = {
      vo2max_ml_min_kg: clamped,
      saved_at: new Date().toISOString(),
    };

    const { error: runErr } = await supabase.from("metabolic_lab_runs").insert({
      athlete_id: athleteId,
      section: "vo2max_lab",
      model_version: "vo2max-lab-v1",
      input_payload: inputPayload,
      output_payload: outputPayload,
      created_by: null,
    });
    if (runErr) {
      return NextResponse.json({ error: runErr.message }, { status: 500 });
    }

    return NextResponse.json({ status: "ok", vo2max_ml_min_kg: clamped });
  } catch (err) {
    if (err instanceof RequestAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "VO2max lab save failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Rimuove VO2max da laboratorio dal profilo fisiologico. */
export async function DELETE(req: NextRequest) {
  try {
    const body = (await req.json()) as { athleteId?: string };
    const athleteId = (body.athleteId ?? "").trim();
    if (!athleteId) return NextResponse.json({ error: "Missing athleteId" }, { status: 400 });
    await requireRequestAthleteAccess(req, athleteId);

    const supabase = createServerSupabaseClient();
    const { error: upErr } = await supabase
      .from("physiological_profiles")
      .update({ vo2max_ml_min_kg: null, updated_at: new Date().toISOString() })
      .eq("athlete_id", athleteId);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    if (err instanceof RequestAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "VO2max lab clear failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
