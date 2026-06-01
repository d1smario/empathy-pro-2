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
    metadata?: Record<string, unknown>;
  },
): Promise<{ ok: boolean; error?: string }> {
  const noticeKind = input.kind ?? "grant_created";
  const { error } = await admin.from("user_account_notices").insert({
    user_id: input.userId,
    kind: noticeKind,
    title: input.title.slice(0, 200),
    body: input.body.slice(0, 2000),
    metadata: {
      grant_id: input.grantId ?? null,
      grant_kind: input.kind ?? null,
      duration_months: input.durationMonths ?? null,
      ...(input.metadata ?? {}),
    },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

const SUBSCRIPTION_WELCOME_KIND = "subscription_welcome";

export async function ensureSubscriptionWelcomeNotice(
  admin: SupabaseClient,
  userId: string,
): Promise<void> {
  const { data: existing } = await admin
    .from("user_account_notices")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", SUBSCRIPTION_WELCOME_KIND)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return;

  await insertUserAccountNotice(admin, {
    userId,
    kind: SUBSCRIPTION_WELCOME_KIND,
    title: "Benvenuto in Empathy",
    body:
      "La tua registrazione è completata e la prova gratuita è attiva. Puoi usare Training, Nutrizione, Fisiologia e tutti i moduli Empathy Pro 2.0.",
  });
}
