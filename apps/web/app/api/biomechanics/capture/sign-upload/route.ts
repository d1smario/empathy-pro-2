import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { AthleteReadContextError, requireAthleteWriteContext } from "@/lib/auth/athlete-read-context";
import {
  BIOMECH_CAPTURE_BUCKET,
  BIOMECH_CAPTURE_MAX_BYTES,
  createBiomechServiceRoleClient,
  isAllowedBiomechCaptureContentType,
  sanitizeBiomechCaptureObjectName,
} from "@/lib/biomechanics/biomech-capture-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

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
    const contentType = String(body.contentType ?? "").trim();
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
    if (fileSizeBytes > BIOMECH_CAPTURE_MAX_BYTES) {
      return NextResponse.json({ error: "file_too_large" }, { status: 413, headers: NO_STORE });
    }
    if (!isAllowedBiomechCaptureContentType(contentType)) {
      return NextResponse.json({ error: "contentType_not_allowed" }, { status: 400, headers: NO_STORE });
    }

    await requireAthleteWriteContext(req, athleteId);

    const admin = createBiomechServiceRoleClient();
    if (!admin) {
      return NextResponse.json(
        { error: "biomech_capture_requires_SUPABASE_SERVICE_ROLE_KEY" },
        { status: 503, headers: NO_STORE },
      );
    }

    const safe = sanitizeBiomechCaptureObjectName(fileName);
    const objectPath = `${athleteId}/${randomUUID()}_${safe}`;
    const signed = await admin.storage.from(BIOMECH_CAPTURE_BUCKET).createSignedUploadUrl(objectPath);
    if (signed.error || !signed.data) {
      return NextResponse.json(
        { error: signed.error?.message ?? "createSignedUploadUrl_failed" },
        { status: 500, headers: NO_STORE },
      );
    }

    const { path, token } = signed.data;
    return NextResponse.json(
      {
        ok: true,
        bucket: BIOMECH_CAPTURE_BUCKET,
        path,
        token,
        objectPath: path,
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "biomech_sign_upload_failed";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
