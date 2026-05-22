import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildGrantNoticeCopy } from "@/lib/billing/grant-user-notice-copy";

export { buildGrantNoticeCopy } from "@/lib/billing/grant-user-notice-copy";

export async function insertUserAccountNotice(
  admin: SupabaseClient,
  input: {
    userId: string;
    title: string;
    body: string;
    grantId?: string;
    kind?: string;
    durationMonths?: number;
  },
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await admin.from("user_account_notices").insert({
    user_id: input.userId,
    kind: "grant_created",
    title: input.title.slice(0, 200),
    body: input.body.slice(0, 2000),
    metadata: {
      grant_id: input.grantId ?? null,
      grant_kind: input.kind ?? null,
      duration_months: input.durationMonths ?? null,
    },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
