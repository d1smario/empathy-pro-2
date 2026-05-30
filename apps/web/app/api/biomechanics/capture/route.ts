import { NextRequest, NextResponse } from "next/server";

import type { BiomechanicsCameraPlane, BiomechanicsCaptureSource, BiomechanicsDiscipline } from "@empathy/contracts";
import { AthleteReadContextError, requireAthleteWriteContext } from "@/lib/auth/athlete-read-context";
import {
  BIOMECH_CAPTURE_BUCKET,
  assertBiomechCapturePathForAthlete,
  isAllowedBiomechCaptureContentType,
} from "@/lib/biomechanics/biomech-capture-storage";
import { createBiomechanicsCaptureJob } from "@/lib/biomechanics/biomech-capture-pipeline";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

const DISCIPLINES = new Set<BiomechanicsDiscipline>(["cycling", "running", "walking", "gym", "movement_screening"]);
const SOURCES = new Set<BiomechanicsCaptureSource>(["smartphone_video", "gopro_video", "image", "manual_import", "external_pose_import"]);
const CAMERA_PLANES = new Set<BiomechanicsCameraPlane>(["front", "side", "rear", "oblique", "multi_view"]);

function parseEnum<T extends string>(value: unknown, allowed: Set<T>, fallback: T): T {
  const s = String(value ?? "").trim();
  return allowed.has(s as T) ? (s as T) : fallback;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      athleteId?: string;
      discipline?: string;
      source?: string;
      cameraPlane?: string;
      storage?: { bucket?: string; objectPath?: string };
      mediaContentType?: string;
      statedExerciseId?: string | null;
    };

    const athleteId = String(body.athleteId ?? "").trim();
    const bucket = String(body.storage?.bucket ?? "").trim();
    const objectPath = String(body.storage?.objectPath ?? "").trim();
    const mediaContentType = String(body.mediaContentType ?? "").trim();

    if (!athleteId) {
      return NextResponse.json({ error: "Missing athleteId" }, { status: 400, headers: NO_STORE });
    }
    if (bucket !== BIOMECH_CAPTURE_BUCKET) {
      return NextResponse.json({ error: "storage_bucket_forbidden" }, { status: 400, headers: NO_STORE });
    }
    if (!objectPath) {
      return NextResponse.json({ error: "Missing storage.objectPath" }, { status: 400, headers: NO_STORE });
    }
    if (!isAllowedBiomechCaptureContentType(mediaContentType)) {
      return NextResponse.json({ error: "contentType_not_allowed" }, { status: 400, headers: NO_STORE });
    }

    const { db } = await requireAthleteWriteContext(req, athleteId);
    assertBiomechCapturePathForAthlete({ athleteId, objectPath });

    const job = await createBiomechanicsCaptureJob(db, {
      athleteId,
      discipline: parseEnum(body.discipline, DISCIPLINES, "movement_screening"),
      source: parseEnum(body.source, SOURCES, "smartphone_video"),
      cameraPlane: parseEnum(body.cameraPlane, CAMERA_PLANES, "side"),
      mediaStoragePath: objectPath,
      mediaContentType,
      statedExerciseId: body.statedExerciseId ?? null,
    });

    return NextResponse.json({ ok: true, job }, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "biomech_capture_failed";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
