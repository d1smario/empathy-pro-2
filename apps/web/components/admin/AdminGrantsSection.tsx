"use client";

/**
 * Sezione "Concedi accesso gratuito" della console admin.
 * Convoglia sul resolver `loadUserAccessEntitlement` (lib/billing/access-entitlement.ts).
 * Testi UI via next-intl (`AdminGrants.*`) — Tier A EN in messages/en.json.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Pro2Button } from "@/components/ui/empathy";

const PRESET_DEFS = [
  { translationKey: "presetPromo1" as const, months: 1, kind: "promo" as const },
  { translationKey: "presetAmbassador12" as const, months: 12, kind: "comp" as const, defaultNote: "Ambassador — accesso gratuito" },
  { translationKey: "presetTestimonial3" as const, months: 3, kind: "testimonial" as const },
  { translationKey: "presetTestimonial6" as const, months: 6, kind: "testimonial" as const },
  { translationKey: "presetTestimonial9" as const, months: 9, kind: "testimonial" as const },
  { translationKey: "presetComp12" as const, months: 12, kind: "comp" as const },
] as const;

type LookupUser = {
  userId: string;
  email: string;
  role: "private" | "coach" | null;
  platformCoachStatus: string | null;
  isPlatformAdmin: boolean;
  entitlement: {
    hasOperatorAccess: boolean;
    hasAthleteAccess: boolean;
    source: string;
    validUntil: string | null;
    label: string;
  };
};

type Grant = {
  id: string;
  user_id: string;
  kind: string;
  starts_at: string;
  ends_at: string;
  note: string | null;
  granted_by_email: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
  created_at: string;
};

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(locale === "en" ? "en-GB" : "it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function entitlementDescription(t: (key: string) => string, source: string): string {
  switch (source) {
    case "admin":
      return t("entitlementLabel.admin");
    case "stripe_paid":
      return t("entitlementLabel.stripe_paid");
    case "grant_active":
      return t("entitlementLabel.grant_active");
    case "coach_operator":
      return t("entitlementLabel.coach_operator");
    default:
      return t("entitlementLabel.none");
  }
}

function entitlementBadgeClass(source: string): string {
  switch (source) {
    case "admin":
      return "bg-violet-500/15 text-violet-200";
    case "stripe_paid":
      return "bg-emerald-500/15 text-emerald-200";
    case "grant_active":
      return "bg-cyan-500/15 text-cyan-200";
    case "coach_operator":
      return "bg-amber-500/15 text-amber-200";
    default:
      return "bg-rose-500/15 text-rose-200";
  }
}

type AdminGrantsSectionProps = {
  /** Imposta ricerca grant da directory admin (una tantum). */
  grantEmailPrefill?: string | null;
  onGrantEmailPrefillConsumed?: () => void;
};

export function AdminGrantsSection({
  grantEmailPrefill,
  onGrantEmailPrefillConsumed,
}: AdminGrantsSectionProps = {}) {
  const t = useTranslations("AdminGrants");
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<LookupUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<LookupUser | null>(null);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loadingGrants, setLoadingGrants] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const runSearch = useCallback(
    async (qRaw?: string) => {
      const q = (qRaw ?? query).trim();
      if (q.length < 2) {
        setUsers([]);
        return;
      }
      setSearching(true);
      setErr(null);
      try {
        const res = await fetch(`/api/admin/users/lookup?q=${encodeURIComponent(q)}`, { cache: "no-store" });
        const j = (await res.json()) as { ok: boolean; users?: LookupUser[]; error?: string };
        if (!res.ok || !j.ok) {
          setErr(j.error ?? t("errors.searchFailed"));
          setUsers([]);
        } else {
          setUsers(j.users ?? []);
        }
      } catch {
        setErr(t("errors.network"));
      } finally {
        setSearching(false);
      }
    },
    [query, t],
  );

  useEffect(() => {
    if (!grantEmailPrefill?.trim()) return;
    const q = grantEmailPrefill.trim();
    setQuery(q);
    void (async () => {
      await runSearch(q);
      onGrantEmailPrefillConsumed?.();
    })();
  }, [grantEmailPrefill, onGrantEmailPrefillConsumed, runSearch]);

  const loadGrants = useCallback(
    async (userId: string) => {
      setLoadingGrants(true);
      try {
        const res = await fetch(`/api/admin/grants?userId=${encodeURIComponent(userId)}`, { cache: "no-store" });
        const j = (await res.json()) as { ok: boolean; grants?: Grant[]; error?: string };
        if (res.ok && j.ok) {
          setGrants(j.grants ?? []);
        } else {
          setErr(j.error ?? t("errors.grantsLoad"));
          setGrants([]);
        }
      } finally {
        setLoadingGrants(false);
      }
    },
    [t],
  );

  const selectUser = useCallback(
    async (u: LookupUser) => {
      setSelected(u);
      setInfo(null);
      setErr(null);
      await loadGrants(u.userId);
    },
    [loadGrants],
  );

  const createGrant = useCallback(
    async (preset: (typeof PRESET_DEFS)[number]) => {
      if (!selected) return;
      setBusy(true);
      setErr(null);
      setInfo(null);
      try {
        const res = await fetch("/api/admin/grants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: selected.userId,
            kind: preset.kind,
            durationMonths: preset.months,
            note:
              note.trim() ||
              ("defaultNote" in preset && typeof preset.defaultNote === "string" ? preset.defaultNote : undefined),
          }),
        });
        const j = (await res.json()) as {
          ok?: boolean;
          error?: string;
          noticeSent?: boolean;
          noticeError?: string | null;
        };
        if (!res.ok || !j.ok) {
          setErr(j.error ?? t("errors.createFailed"));
        } else {
          setInfo(
            j.noticeSent
              ? t("info.grantCreatedWithNotice")
              : j.noticeError
                ? `${t("info.grantCreated")} (${t("info.noticeFailed")})`
                : t("info.grantCreated"),
          );
          setNote("");
          await loadGrants(selected.userId);
          await runSearch();
        }
      } catch {
        setErr(t("errors.network"));
      } finally {
        setBusy(false);
      }
    },
    [selected, note, loadGrants, runSearch, t],
  );

  const revokeGrant = useCallback(
    async (grantId: string) => {
      if (!selected) return;
      const reason = window.prompt(t("revokePrompt")) ?? "";
      setBusy(true);
      setErr(null);
      try {
        const res = await fetch(`/api/admin/grants/${encodeURIComponent(grantId)}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        });
        const j = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !j.ok) {
          setErr(j.error ?? t("errors.revokeFailed"));
        } else {
          setInfo(t("info.revoked"));
          await loadGrants(selected.userId);
          await runSearch();
        }
      } catch {
        setErr(t("errors.network"));
      } finally {
        setBusy(false);
      }
    },
    [selected, loadGrants, runSearch, t],
  );

  const presets = useMemo(
    () =>
      PRESET_DEFS.map((p) => ({
        ...p,
        label: t(p.translationKey),
      })),
    [t],
  );

  return (
    <section id="admin-grants" aria-labelledby="admin-grants-heading" className="space-y-4">
      <div>
        <h2 id="admin-grants-heading" className="text-lg font-semibold text-white">
          {t("title")}
        </h2>
        <p className="mt-1 text-sm text-gray-500">{t("intro")}</p>
      </div>

      {err ? (
        <p className="rounded-xl border border-amber-500/35 bg-amber-950/20 px-4 py-3 text-sm text-amber-200" role="alert">
          {err}
        </p>
      ) : null}
      {info ? (
        <p className="rounded-xl border border-emerald-500/35 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200">
          {info}
        </p>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <label className="flex-1 text-xs uppercase tracking-wider text-gray-400">
          {t("emailLabel")}
          <input
            type="search"
            inputMode="email"
            autoComplete="off"
            placeholder={t("emailPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void runSearch();
            }}
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/60"
          />
        </label>
        <Pro2Button type="button" disabled={searching || query.trim().length < 2} onClick={() => void runSearch()}>
          {searching ? t("searching") : t("search")}
        </Pro2Button>
      </div>

      {users.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/25">
          <table className="min-w-full text-left text-sm text-gray-300">
            <thead className="border-b border-white/10 bg-white/5 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">{t("thEmail")}</th>
                <th className="px-4 py-3">{t("thRole")}</th>
                <th className="px-4 py-3">{t("thAccess")}</th>
                <th className="px-4 py-3">{t("thExpires")}</th>
                <th className="px-4 py-3">{t("thManage")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const src = u.entitlement.source;
                const badgeClass = entitlementBadgeClass(src);
                const shortBadge =
                  src === "admin"
                    ? t("badgeAdmin")
                    : src === "stripe_paid"
                      ? t("badgeStripe")
                      : src === "grant_active"
                        ? t("badgeGrant")
                        : src === "coach_operator"
                          ? t("badgeCoachOnly")
                          : t("badgeNone");
                return (
                  <tr
                    key={u.userId}
                    className={`border-b border-white/5 last:border-0 ${selected?.userId === u.userId ? "bg-cyan-500/5" : ""}`}
                  >
                    <td className="px-4 py-3 text-sm text-gray-200">{u.email}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {u.role ?? "—"}
                      {u.role === "coach" ? (
                        <span className="ml-1 text-[0.65rem] uppercase text-gray-500">{u.platformCoachStatus ?? "pending"}</span>
                      ) : null}
                      {u.isPlatformAdmin ? <span className="ml-1 text-violet-300">· admin</span> : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}>{shortBadge}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{formatDate(u.entitlement.validUntil, locale)}</td>
                    <td className="px-4 py-3">
                      <Pro2Button
                        type="button"
                        className="px-3 py-1.5 text-xs"
                        variant={selected?.userId === u.userId ? "primary" : "secondary"}
                        onClick={() => void selectUser(u)}
                      >
                        {selected?.userId === u.userId ? t("selected") : t("manage")}
                      </Pro2Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {selected ? (
        <div className="space-y-4 rounded-2xl border border-cyan-400/30 bg-cyan-500/[0.04] p-5">
          <div>
            <p className="text-xs uppercase tracking-wider text-cyan-300">{t("selectedUser")}</p>
            <p className="mt-1 text-sm font-semibold text-white">{selected.email}</p>
            <p className="text-xs text-gray-400">
              {entitlementDescription(t, selected.entitlement.source)}
              {selected.entitlement.validUntil
                ? t("expiresWithDate", { date: formatDate(selected.entitlement.validUntil, locale) })
                : ""}
            </p>
          </div>

          <label className="block text-xs uppercase tracking-wider text-gray-400">
            {t("noteLabel")}
            <input
              type="text"
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("notePlaceholder")}
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/60"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <Pro2Button key={p.translationKey} type="button" disabled={busy} onClick={() => void createGrant(p)} className="text-xs">
                {p.label}
              </Pro2Button>
            ))}
          </div>

          <div>
            <p className="mb-2 text-xs uppercase tracking-wider text-gray-400">{t("history")}</p>
            {loadingGrants ? (
              <p className="text-sm text-gray-400">{t("loadingGrants")}</p>
            ) : grants.length === 0 ? (
              <p className="text-sm text-gray-500">{t("noGrants")}</p>
            ) : (
              <ul className="space-y-1.5">
                {grants.map((g) => {
                  const active = !g.revoked_at && new Date(g.ends_at).getTime() > Date.now();
                  return (
                    <li
                      key={g.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-black/30 px-3 py-2 text-xs"
                    >
                      <div>
                        <span
                          className={`mr-2 rounded-full px-2 py-0.5 text-[0.65rem] uppercase ${
                            active ? "bg-emerald-500/15 text-emerald-200" : "bg-gray-700/40 text-gray-400"
                          }`}
                        >
                          {active ? g.kind : g.revoked_at ? t("grantKindRevoked") : t("grantKindExpired")}
                        </span>
                        <span className="text-gray-300">
                          {formatDate(g.starts_at, locale)} → {formatDate(g.ends_at, locale)}
                        </span>
                        {g.note ? <span className="ml-2 text-gray-500">— {g.note}</span> : null}
                        {g.granted_by_email ? (
                          <span className="ml-2 text-[0.65rem] text-gray-600">by {g.granted_by_email}</span>
                        ) : null}
                      </div>
                      {active ? (
                        <Pro2Button
                          type="button"
                          variant="secondary"
                          className="border-rose-500/30 px-3 py-1 text-[0.65rem] text-rose-200 hover:border-rose-400/50"
                          disabled={busy}
                          onClick={() => void revokeGrant(g.id)}
                        >
                          {t("revoke")}
                        </Pro2Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
