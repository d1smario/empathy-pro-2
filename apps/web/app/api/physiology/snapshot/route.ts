import { NextRequest, NextResponse } from "next/server";
import { RequestAuthError, requireRequestAthleteAccess } from "@/lib/auth/request-auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      athleteId?: string;
      runSection?: "metabolic_profile" | "lactate_analysis" | "max_oxidate";
      modelVersion?: string;
      inputPayload?: Record<string, unknown>;
      outputPayload?: Record<string, unknown>;
      createdBy?: string | null;
      profileUpdate?: {
        ftp_watts: number;
        lt1_watts: number;
        lt2_watts: number;
        v_lamax: number;
        vo2max_ml_min_kg: number;
        cp_watts?: number;
      } | null;
    };
    const athleteId = (body.athleteId ?? "").trim();
    if (!athleteId || !body.runSection || !body.outputPayload || !body.inputPayload) {
      return NextResponse.json({ error: "Missing snapshot payload" }, { status: 400 });
    }

    await requireRequestAthleteAccess(req, athleteId);

    const supabase = createServerSupabaseClient();
    const { error: insertErr } = await supabase.from("metabolic_lab_runs").insert({
      athlete_id: athleteId,
      section: body.runSection,
      model_version: body.modelVersion ?? "v0.2",
      input_payload: body.inputPayload,
      output_payload: body.outputPayload,
      created_by: body.createdBy ?? null,
    });
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

    if (body.runSection === "metabolic_profile" && body.profileUpdate) {
      const { error: upsertErr } = await supabase
        .from("physiological_profiles")
        .upsert(
          {
            athlete_id: athleteId,
            ftp_watts: body.profileUpdate.ftp_watts,
            lt1_watts: body.profileUpdate.lt1_watts,
            lt2_watts: body.profileUpdate.lt2_watts,
            v_lamax: body.profileUpdate.v_lamax,
            vo2max_ml_min_kg: body.profileUpdate.vo2max_ml_min_kg,
            cp_watts: body.profileUpdate.cp_watts ?? null,
            baseline_hrv_ms: null,
          },
          { onConflict: "athlete_id" },
        );
      if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    if (err instanceof RequestAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Physiology snapshot save failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

