import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteWriteContext } from "@/lib/auth/athlete-read-context";
import { runPlannedProgramFileImport } from "@/lib/training/training-planned-import-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

/** POST programmazione tabellare (CSV/JSON) — delega al servizio condiviso con `/api/training/import`. */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const athleteId = String(form.get("athleteId") ?? "").trim();
    const file = form.get("file");
    const notes = String(form.get("notes") ?? "").trim();

    if (!athleteId) {
      return NextResponse.json({ error: "Missing athleteId" }, { status: 400, headers: NO_STORE });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400, headers: NO_STORE });
    }

    const { db } = await requireAthleteWriteContext(req, athleteId);

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileChecksum = createHash("sha1").update(fileBuffer).digest("hex");

    const body = await runPlannedProgramFileImport(db, {
      athleteId,
      file,
      fileChecksum,
      fileBuffer,
      notes,
    });

    return NextResponse.json(body, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "Planned import failed";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
