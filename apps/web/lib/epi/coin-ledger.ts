import "server-only";

/**
 * Empathy Coin ledger helpers. Balance + tier are DERIVED sums over the append-only ledger.
 * Award is idempotent per (athlete_id, earned_for_date, reason) at the DB level.
 */

import {
  COIN_LEDGER_VERSION,
  coinTierForBalance,
  coinsToNextTier,
  type EmpathyCoinBalance,
} from "@/lib/empathy/schemas";
import type { EpiResult } from "@/lib/empathy/schemas";

type LedgerRow = { coins?: unknown; reason?: unknown; earned_for_date?: unknown };

/**
 * Minimal Supabase-like surface (authed client passed by the route). `from` is typed `any` to
 * avoid the deep generic instantiation of SupabaseClient at this boundary (consistent with other
 * pragmatic casts in lib/).
 */
type DbLike = { from: (table: string) => any };

export function computeCoinBalanceFromRows(athleteId: string, rows: LedgerRow[]): EmpathyCoinBalance {
  let total = 0;
  let efficientDays = 0;
  for (const r of rows) {
    const coins = typeof r.coins === "number" ? r.coins : Number(r.coins);
    if (Number.isFinite(coins)) total += coins;
    if (r.reason === "efficient_day") efficientDays += 1;
  }
  return {
    athleteId,
    totalCoins: total,
    tier: coinTierForBalance(total),
    nextTier: coinsToNextTier(total),
    efficientDays,
  };
}

export async function loadCoinBalance(db: DbLike, athleteId: string): Promise<EmpathyCoinBalance> {
  const { data, error } = await db
    .from("empathy_coin_ledger")
    .select("coins, reason, earned_for_date")
    .eq("athlete_id", athleteId);
  if (error?.message) throw new Error(error.message);
  return computeCoinBalanceFromRows(athleteId, (data ?? []) as LedgerRow[]);
}

/**
 * Award the efficient-day coins for a resolved EPI. Idempotent: the DB unique constraint on
 * (athlete_id, earned_for_date, reason) + ignoreDuplicates prevents double-credit. No-op when the
 * day is not efficient (illness day / below threshold / no check-in).
 */
export async function awardEfficientDay(
  db: DbLike,
  athleteId: string,
  epi: EpiResult,
  earnedForDate: string,
  userId?: string | null,
): Promise<{ awarded: boolean; coins: number }> {
  if (!epi.efficientDay || epi.coinAwardForDay <= 0) {
    return { awarded: false, coins: 0 };
  }
  const { error } = await db.from("empathy_coin_ledger").upsert(
    {
      athlete_id: athleteId,
      user_id: userId ?? null,
      earned_for_date: earnedForDate,
      coins: epi.coinAwardForDay,
      reason: "efficient_day",
      epi_score: epi.score,
      ledger_version: COIN_LEDGER_VERSION,
    },
    { onConflict: "athlete_id,earned_for_date,reason", ignoreDuplicates: true },
  );
  if (error?.message) throw new Error(error.message);
  return { awarded: true, coins: epi.coinAwardForDay };
}
