import { NextRequest, NextResponse } from "next/server";

import { getOrImportFdcFood } from "@/lib/nutrition/fdc-food-cache";

export const runtime = "nodejs";

function authorizeImport(req: NextRequest): boolean {
  const secret = process.env.NUTRITION_FDC_IMPORT_SECRET?.trim();
  const auth = req.headers.get("authorization")?.trim();
  return Boolean(secret && auth === `Bearer ${secret}`);
}

export async function GET(req: NextRequest, context: { params: { fdcId: string } }) {
  if (!authorizeImport(req)) {
    return NextResponse.json(
      {
        error:
          "Non autorizzato. Imposta NUTRITION_FDC_IMPORT_SECRET e usa Authorization: Bearer <secret> per warmup cache.",
      },
      { status: 401 },
    );
  }

  const fdcId = Number(context.params.fdcId);
  if (!Number.isFinite(fdcId) || fdcId < 1) {
    return NextResponse.json({ error: "fdcId non valido" }, { status: 400 });
  }

  const food = await getOrImportFdcFood(Math.round(fdcId));
  if ("error" in food) {
    const status = food.error.includes("service_role_unconfigured") ? 503 : 502;
    return NextResponse.json({ error: food.error }, { status });
  }

  return NextResponse.json({
    food,
    source: "usda_fdc_cache",
  });
}
