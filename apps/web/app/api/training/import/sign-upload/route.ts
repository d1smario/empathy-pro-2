import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { AthleteReadContextError, requireAthleteWriteContext } from "@/lib/auth/athlete-read-context";
import {
  createSupabaseServiceRoleClient,
  isAllowedTrainingManualImportContentType,
  sanitizeTrainingManualStagingObjectName,
  trainingManualImportsBucketId,
  TRAINING_MANUAL_IMPORT_MAX_BYTES,
} from "@/lib/training/training-manual-import-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

/**
 * Risposta per upload diretto al Storage (bypass limite body Vercel).
 * Il client deve usare `supabase.storage.from(bucket).uploadToSignedUrl(path, token, file)`.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      athleteId?: string;
      fileName?: string;
      contentType?: string;
      fileSizeBytes?: number;
    };

    const athleteId = String(body.athleteId ?? "").trim();
    const fileName = String(body.fileName ?? "").trim();
    const contentType = String(body.contentType ?? "").trim() || "application/octet-stream";
    const fileSizeBytes =
      typeof body.fileSizeBytes === "number" && Number.isFinite(body.fileSizeBytes)
        ? Math.floor(body.fileSizeBytes)
        : 0;

    if (!athleteId) {
      return NextResponse.json({ error: "Missing athleteId" }, { status: 400, headers: NO_STORE });
    }
    if (!fileName) {
      return NextResponse.json({ error: "Missing fileName" }, { status: 400, headers: NO_STORE });
    }
    if (fileSizeBytes <= 0) {
      return NextResponse.json({ error: "Invalid fileSizeBytes" }, { status: 400, headers: NO_STORE });
    }
    if (fileSizeBytes > TRAINING_MANUAL_IMPORT_MAX_BYTES) {
      return NextResponse.json(
        {
          error: `File troppo grande per lo staging (max ${TRAINING_MANUAL_IMPORT_MAX_BYTES} byte).`,
        },
        { status: 413, headers: NO_STORE },
      );
    }
    if (!isAllowedTrainingManualImportContentType(contentType)) {
      return NextResponse.json({ error: "contentType_not_allowed" }, { status: 400, headers: NO_STORE });
    }

    await requireAthleteWriteContext(req, athleteId);

    const admin = createSupabaseServiceRoleClient();
    if (!admin) {
      return NextResponse.json(
        {
          error:
            "Upload diretto non configurato: serve SUPABASE_SERVICE_ROLE_KEY sul server e bucket migrazione 049.",
        },
        { status: 503, headers: NO_STORE },
      );
    }

    const bucket = trainingManualImportsBucketId();
    const safe = sanitizeTrainingManualStagingObjectName(fileName);
    const objectPath = `${athleteId}/${randomUUID()}_${safe}`;

    const signed = await admin.storage.from(bucket).createSignedUploadUrl(objectPath);
    if (signed.error || !signed.data) {
      return NextResponse.json(
        { error: signed.error?.message ?? "createSignedUploadUrl_failed" },
        { status: 500, headers: NO_STORE },
      );
    }

    const { path, token } = signed.data;
    return NextResponse.json(
      {
        bucket,
        path,
        token,
        /** Per comodità client: stesso valore di `path` restituito dall’SDK. */
        objectPath: path,
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "sign_upload_failed";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
