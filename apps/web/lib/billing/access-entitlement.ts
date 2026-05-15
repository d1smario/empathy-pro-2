/**
 * Resolver canonico "questo utente ha accesso alla piattaforma?".
 *
 * Convoglia (NON parallelizza) le sorgenti già esistenti:
 *   - `billing_subscriptions` (Stripe paid)
 *   - `subscription_grants`   (admin grants: testimonial / promo / comp / beta — migration 054)
 *   - `app_user_profiles.is_platform_admin`         (override admin)
 *   - `app_user_profiles.role + platform_coach_status` (un coach approved ha accesso "operativo")
 *
 * **Modello esplicito** chiesto dall'utente:
 *   - Cliente atleta `private`: serve `paid` o `grant_active` per usare l'app.
 *   - Coach `approved`: NON paga per essere coach (gestire roster) → ha entitlement
 *     `coach_operator` automatico. Ma per usare la piattaforma **come atleta** sul
 *     proprio `athlete_id`, vale la stessa regola della categoria private (paid/grant).
 *     Questo evita il bypass "mi iscrivo coach e mi monitoro gratis".
 *   - Coach `pending` o `suspended`: nessun accesso operativo coach. Per accesso
 *     atleta vale comunque paid/grant.
 *   - Admin: sempre accesso (override).
 *
 * Funzione **pura** (input dati già caricati) + funzione **loader** che fa le query.
 * La funzione pura è coperta da test deterministici.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type UserAccessEntitlementSource =
  | "admin"
  | "stripe_paid"
  | "grant_active"
  | "coach_operator"
  | "none";

export type UserAccessEntitlement = {
  hasOperatorAccess: boolean; // può fare il coach (gestire roster)
  hasAthleteAccess: boolean;  // può usare la piattaforma come atleta sul proprio athlete_id
  source: UserAccessEntitlementSource;
  /** Quando scade l'accesso "non admin", se applicabile. */
  validUntil: string | null;
  label: string;
};

export type UserAccessInputs = {
  isPlatformAdmin: boolean;
  role: "private" | "coach" | null;
  platformCoachStatus: "pending" | "approved" | "suspended" | null;
  /** Sottoscrizioni Stripe attive (status in active/trialing, current_period_end > now o null). */
  paidSubscriptions: Array<{
    status: string;
    currentPeriodEnd: string | null;
    basePlanId: string | null;
  }>;
  /** Grants admin con starts_at <= now < ends_at e revoked_at null. */
  activeGrants: Array<{
    kind: "testimonial" | "promo" | "comp" | "beta";
    endsAt: string;
  }>;
};

const PAID_STATUSES = new Set(["active", "trialing"]);

function pickLatestEnd(values: Array<string | null>): string | null {
  let best: string | null = null;
  for (const v of values) {
    if (!v) continue;
    if (!best || v > best) best = v;
  }
  return best;
}

/**
 * Risolutore puro deterministico. Nessuna I/O. Test su questa.
 */
export function resolveUserAccessEntitlement(input: UserAccessInputs): UserAccessEntitlement {
  if (input.isPlatformAdmin) {
    return {
      hasOperatorAccess: true,
      hasAthleteAccess: true,
      source: "admin",
      validUntil: null,
      label: "Platform admin",
    };
  }

  const paidActive = input.paidSubscriptions.find((s) => PAID_STATUSES.has(s.status));
  if (paidActive) {
    return {
      hasOperatorAccess: input.role === "coach" && input.platformCoachStatus === "approved",
      hasAthleteAccess: true,
      source: "stripe_paid",
      validUntil: paidActive.currentPeriodEnd ?? null,
      label:
        paidActive.status === "trialing"
          ? "Stripe trial attivo"
          : `Abbonamento ${paidActive.basePlanId ?? "attivo"}`,
    };
  }

  const grantActive = input.activeGrants[0] ?? null;
  if (grantActive) {
    return {
      hasOperatorAccess: input.role === "coach" && input.platformCoachStatus === "approved",
      hasAthleteAccess: true,
      source: "grant_active",
      validUntil: grantActive.endsAt,
      label:
        grantActive.kind === "testimonial"
          ? "Profilo testimonial"
          : grantActive.kind === "promo"
          ? "Promo gratuita"
          : grantActive.kind === "beta"
          ? "Accesso beta"
          : "Accesso comp",
    };
  }

  // Nessun pagamento, nessun grant → coach approved può ancora fare il coach,
  // ma NON può usare la piattaforma come atleta senza un proprio entitlement.
  if (input.role === "coach" && input.platformCoachStatus === "approved") {
    return {
      hasOperatorAccess: true,
      hasAthleteAccess: false,
      source: "coach_operator",
      validUntil: null,
      label: "Coach approvato (senza piano atleta)",
    };
  }

  return {
    hasOperatorAccess: false,
    hasAthleteAccess: false,
    source: "none",
    validUntil: null,
    label: "Nessun piano attivo",
  };
}

/**
 * Loader: legge da DB e chiama il resolver puro.
 * Usa il client passato (in route admin/server è il service-role; nelle route atleta è
 * il client RLS post-auth — entrambi possono leggere i propri dati).
 */
export async function loadUserAccessEntitlement(
  db: SupabaseClient,
  userId: string,
): Promise<UserAccessEntitlement> {
  if (!userId) return { hasOperatorAccess: false, hasAthleteAccess: false, source: "none", validUntil: null, label: "Sessione mancante" };

  const nowIso = new Date().toISOString();

  const [{ data: profile }, { data: subs }, { data: grants }] = await Promise.all([
    db
      .from("app_user_profiles")
      .select("is_platform_admin, role, platform_coach_status")
      .eq("user_id", userId)
      .maybeSingle(),
    db
      .from("billing_subscriptions")
      .select("status, current_period_end, base_plan_id")
      .eq("user_id", userId),
    db
      .from("subscription_grants")
      .select("kind, ends_at")
      .eq("user_id", userId)
      .is("revoked_at", null)
      .lte("starts_at", nowIso)
      .gt("ends_at", nowIso)
      .order("ends_at", { ascending: false }),
  ]);

  const profileRow =
    (profile as {
      is_platform_admin?: boolean | null;
      role?: "private" | "coach" | null;
      platform_coach_status?: "pending" | "approved" | "suspended" | null;
    } | null) ?? null;

  return resolveUserAccessEntitlement({
    isPlatformAdmin: profileRow?.is_platform_admin === true,
    role: profileRow?.role ?? null,
    platformCoachStatus: profileRow?.platform_coach_status ?? null,
    paidSubscriptions: ((subs ?? []) as Array<Record<string, unknown>>).map((row) => ({
      status: typeof row.status === "string" ? row.status : "",
      currentPeriodEnd: typeof row.current_period_end === "string" ? row.current_period_end : null,
      basePlanId: typeof row.base_plan_id === "string" ? row.base_plan_id : null,
    })),
    activeGrants: ((grants ?? []) as Array<Record<string, unknown>>).map((row) => ({
      kind: row.kind as "testimonial" | "promo" | "comp" | "beta",
      endsAt: typeof row.ends_at === "string" ? row.ends_at : "",
    })),
  });
}

export type AccessEntitlementBatchEntry = {
  entitlement: UserAccessEntitlement;
  role: "private" | "coach" | null;
  platformCoachStatus: "pending" | "approved" | "suspended" | null;
  isPlatformAdmin: boolean;
  athleteId: string | null;
  stripeSubscriptions: Array<{
    status: string;
    currentPeriodEnd: string | null;
    basePlanId: string | null;
  }>;
};

/**
 * Carica entitlement + profilo + righe Stripe per molti `user_id` (3 query batch, console admin).
 */
export async function loadAccessEntitlementsForUserIds(
  db: SupabaseClient,
  userIds: string[],
): Promise<Map<string, AccessEntitlementBatchEntry>> {
  const out = new Map<string, AccessEntitlementBatchEntry>();
  if (userIds.length === 0) return out;

  const nowIso = new Date().toISOString();

  const [{ data: profiles }, { data: subs }, { data: grants }] = await Promise.all([
    db
      .from("app_user_profiles")
      .select("user_id, is_platform_admin, role, platform_coach_status, athlete_id")
      .in("user_id", userIds),
    db.from("billing_subscriptions").select("user_id, status, current_period_end, base_plan_id").in("user_id", userIds),
    db
      .from("subscription_grants")
      .select("user_id, kind, ends_at")
      .in("user_id", userIds)
      .is("revoked_at", null)
      .lte("starts_at", nowIso)
      .gt("ends_at", nowIso),
  ]);

  const profileByUser = new Map(
    ((profiles ?? []) as Array<Record<string, unknown>>).map((r) => [String(r.user_id), r] as const),
  );
  const subsByUser = new Map<string, Array<Record<string, unknown>>>();
  for (const row of (subs ?? []) as Array<Record<string, unknown>>) {
    const uid = String(row.user_id ?? "");
    if (!uid) continue;
    const arr = subsByUser.get(uid) ?? [];
    arr.push(row);
    subsByUser.set(uid, arr);
  }
  const grantsByUser = new Map<string, Array<Record<string, unknown>>>();
  for (const row of (grants ?? []) as Array<Record<string, unknown>>) {
    const uid = String(row.user_id ?? "");
    if (!uid) continue;
    const arr = grantsByUser.get(uid) ?? [];
    arr.push(row);
    grantsByUser.set(uid, arr);
  }

  for (const uid of userIds) {
    const pr = profileByUser.get(uid) as
      | {
          is_platform_admin?: boolean | null;
          role?: "private" | "coach" | null;
          platform_coach_status?: "pending" | "approved" | "suspended" | null;
          athlete_id?: string | null;
        }
      | undefined;

    const athleteId = typeof pr?.athlete_id === "string" && pr.athlete_id.length > 0 ? pr.athlete_id : null;

    const grantRows = (grantsByUser.get(uid) ?? []).slice();
    grantRows.sort((a, b) => {
      const ea = typeof a.ends_at === "string" ? a.ends_at : "";
      const eb = typeof b.ends_at === "string" ? b.ends_at : "";
      return eb.localeCompare(ea);
    });

    const stripeSubscriptions = (subsByUser.get(uid) ?? []).map((row) => ({
      status: typeof row.status === "string" ? row.status : "",
      currentPeriodEnd: typeof row.current_period_end === "string" ? row.current_period_end : null,
      basePlanId: typeof row.base_plan_id === "string" ? row.base_plan_id : null,
    }));

    const ent = resolveUserAccessEntitlement({
      isPlatformAdmin: pr?.is_platform_admin === true,
      role: pr?.role ?? null,
      platformCoachStatus: pr?.platform_coach_status ?? null,
      paidSubscriptions: stripeSubscriptions,
      activeGrants: grantRows.map((row) => ({
        kind: row.kind as "testimonial" | "promo" | "comp" | "beta",
        endsAt: typeof row.ends_at === "string" ? row.ends_at : "",
      })),
    });
    out.set(uid, {
      entitlement: ent,
      role: pr?.role ?? null,
      platformCoachStatus: pr?.platform_coach_status ?? null,
      isPlatformAdmin: pr?.is_platform_admin === true,
      athleteId,
      stripeSubscriptions,
    });
  }

  return out;
}

/** Helper: durata in mesi → ends_at ISO. */
export function grantEndsAtFromMonths(months: number, startsAtIso?: string | null): string {
  const start = startsAtIso ? new Date(startsAtIso) : new Date();
  const end = new Date(start.getTime());
  end.setUTCMonth(end.getUTCMonth() + Math.max(1, Math.round(months)));
  return end.toISOString();
}

export const GRANT_PRESETS: Array<{ value: number; label: string; defaultKind: "testimonial" | "promo" | "comp" | "beta" }> = [
  { value: 1, label: "1 mese (promo)", defaultKind: "promo" },
  { value: 3, label: "3 mesi (testimonial)", defaultKind: "testimonial" },
  { value: 6, label: "6 mesi (testimonial)", defaultKind: "testimonial" },
  { value: 9, label: "9 mesi (testimonial)", defaultKind: "testimonial" },
  { value: 12, label: "12 mesi (comp)", defaultKind: "comp" },
];
// pickLatestEnd è exportato implicitamente attraverso eventuali futuri helper.
void pickLatestEnd;
