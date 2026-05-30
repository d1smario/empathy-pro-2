import { NextRequest, NextResponse } from "next/server";

import type { AerodynamicsCameraMode, AerodynamicsCaptureSource } from "@empathy/contracts";
import { AthleteReadContextError, requireAthleteWriteContext } from "@/lib/auth/athlete-read-context";
import {
  AERO_CAPTURE_BUCKET,
  assertAeroCapturePathForAthlete,
  isAllowedAeroCaptureContentType,
} from "@/lib/aerodynamics/aero-capture-storage";
import { createAerodynamicsCaptureJob } from "@/lib/aerodynamics/aero-capture-pipeline";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

const SOURCES = new Set<AerodynamicsCaptureSource>(["smartphone_video", "gopro_video", "image", "manual_test", "external_aero_import"]);
const CAMERA_MODES = new Set<AerodynamicsCameraMode>(["side", "front", "rear", "multi_view", "three_sixty"]);

function parseEnum<T extends string>(value: unknown, allowed: Set<T>, fallback: T): T {
  const s = String(value ?? "").trim();
  return allowed.has(s as T) ? (s as T) : fallback;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      athleteId?: string;
      source?: string;
      cameraMode?: string;
      storage?: { bucket?: string; objectPath?: string };
      mediaContentType?: string;
    };

    const athleteId = String(body.athleteId ?? "").trim();
    const bucket = String(body.storage?.bucket ?? "").trim();
    const objectPath = String(body.storage?.objectPath ?? "").trim();
    const mediaContentType = String(body.mediaContentType ?? "").trim();

    if (!athleteId) {
      return NextResponse.json({ error: "Missing athleteId" }, { status: 400, headers: NO_STORE });
    }
    if (bucket !== AERO_CAPTURE_BUCKET) {
      return NextResponse.json({ error: "storage_bucket_forbidden" }, { status: 400, headers: NO_STORE });
    }
    if (!objectPath) {
      return NextResponse.json({ error: "Missing storage.objectPath" }, { status: 400, headers: NO_STORE });
    }
    if (!isAllowedAeroCaptureContentType(mediaContentType)) {
      return NextResponse.json({ error: "contentType_not_allowed" }, { status: 400, headers: NO_STORE });
    }

    const { db } = await requireAthleteWriteContext(req, athleteId);
    assertAeroCapturePathForAthlete({ athleteId, objectPath });

    const job = await createAerodynamicsCaptureJob(db, {
      athleteId,
      source: parseEnum(body.source, SOURCES, "smartphone_video"),
      cameraMode: parseEnum(body.cameraMode, CAMERA_MODES, "side"),
      mediaStoragePath: objectPath,
      mediaContentType,
    });

    return NextResponse.json({ ok: true, job }, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "aero_capture_failed";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
