"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { AdminCoachRow } from "@/lib/admin/coach-list-types";
import { CompactValueField, Pro2Button } from "@/components/ui/empathy";

type LookupUser = {
  userId: string;
  email: string;
  role: "private" | "coach" | null;
  platformCoachStatus: string | null;
  isPlatformAdmin: boolean;
  rosterAsCoachCount?: number;
  rosterNeedsCoachActivation?: boolean;
};

type Props = {
  onRolesChanged?: () => void;
};

function coachStatusLabel(t: (k: string) => string, role: string | null, status: string | null): string {
  if (role !== "coach") return t("statusAthlete");
  const st = status ?? "pending";
  if (st === "approved") return t("statusCoachApproved");
  if (st === "suspended") return t("statusCoachSuspended");
  return t("statusCoachPending");
}

export function AdminUserRolePanel({ onRolesChanged }: Props) {
  const t = useTranslations("AdminRolePanel");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LookupUser[]>([]);
  const [selected, setSelected] = useState<LookupUser | null>(null);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pendingCoaches, setPendingCoaches] = useState<AdminCoachRow[]>([]);

  const loadPendingCoaches = useCallback(async () => {
    const res = await fetch("/api/admin/coaches", { cache: "no-store" });
    const j = (await res.json()) as { ok?: boolean; coaches?: AdminCoachRow[] };
    if (res.ok && j.ok) {
      setPendingCoaches((j.coaches ?? []).filter((c) => (c.platformCoachStatus ?? "pending") === "pending"));
    }
  }, []);

  useEffect(() => {
    void loadPendingCoaches();
  }, [loadPendingCoaches]);

  const runSearch = useCallback(
    async (qRaw?: string) => {
      const q = (qRaw ?? query).trim();
      if (q.length < 2) {
        setResults([]);
        setSelected(null);
        return;
      }
      setSearching(true);
      setErr(null);
      setInfo(null);
      try {
        const res = await fetch(`/api/admin/users/lookup?q=${encodeURIComponent(q)}`, { cache: "no-store" });
        const j = (await res.json()) as { ok: boolean; users?: LookupUser[]; error?: string };
        if (!res.ok || !j.ok) {
          setErr(j.error ?? t("errors.search"));
          setResults([]);
          setSelected(null);
          return;
        }
        const users = j.users ?? [];
        setResults(users);
        const exact = q.includes("@") ? users.find((u) => u.email.toLowerCase() === q.toLowerCase()) : null;
        const keepId = selected?.userId;
        const refreshed = keepId ? users.find((u) => u.userId === keepId) : null;
        setSelected(exact ?? refreshed ?? (users.length === 1 ? users[0]! : null));
      } catch {
        setErr(t("errors.network"));
        setResults([]);
        setSelected(null);
      } finally {
        setSearching(false);
      }
    },
    [query, t, selected?.userId],
  );

  const applyProfile = useCallback(
    async (userId: string, targetRole: "private" | "coach", platformCoachStatus?: "pending" | "approved" | "suspended") => {
      setBusy(true);
      setErr(null);
      setInfo(null);
      try {
        const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/app-profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetRole, platformCoachStatus }),
        });
        const j = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !j.ok) {
          setErr(j.error ?? t("errors.update"));
          return;
        }
        setInfo(t("info.updated"));
        await runSearch();
        await loadPendingCoaches();
        onRolesChanged?.();
      } catch {
        setErr(t("errors.network"));
      } finally {
        setBusy(false);
      }
    },
    [loadPendingCoaches, onRolesChanged, runSearch, t],
  );

  const approveCoach = useCallback(
    async (userId: string) => {
      setBusy(true);
      setErr(null);
      setInfo(null);
      try {
        const res = await fetch(`/api/admin/coaches/${encodeURIComponent(userId)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "approve" }),
        });
        const j = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !j.ok) {
          setErr(j.error ?? t("errors.update"));
          return;
        }
        setInfo(t("info.approved"));
        await runSearch();
        await loadPendingCoaches();
        onRolesChanged?.();
      } catch {
        setErr(t("errors.network"));
      } finally {
        setBusy(false);
      }
    },
    [loadPendingCoaches, onRolesChanged, runSearch, t],
  );

  const selectFromPending = useCallback(
    (row: AdminCoachRow) => {
      if (row.email) {
        setQuery(row.email);
        void runSearch(row.email);
      }
    },
    [runSearch],
  );

  const selectedStatus = useMemo(() => {
    if (!selected) return null;
    return coachStatusLabel(t, selected.role, selected.platformCoachStatus);
  }, [selected, t]);

  return (
    <section
      id="admin-user-role"
      aria-labelledby="admin-user-role-heading"
      className="space-y-4 rounded-2xl border border-fuchsia-500/25 bg-gradient-to-br from-fuchsia-950/20 via-black/40 to-violet-950/15 p-6"
    >
      <div className="space-y-1">
        <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-fuchsia-300">{t("eyebrow")}</p>
        <h2 id="admin-user-role-heading" className="text-lg font-semibold text-white">
          {t("title")}
        </h2>
        <p className="text-sm text-gray-400">{t("subtitle")}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[min(100%,20rem)] flex-1">
          <CompactValueField
            label={t("emailLabel")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("emailPlaceholder")}
            type="email"
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === "Enter") void runSearch();
            }}
          />
        </div>
        <Pro2Button type="button" disabled={searching || query.trim().length < 2} onClick={() => void runSearch()}>
          {searching ? t("searching") : t("search")}
        </Pro2Button>
      </div>

      {err ? (
        <p className="rounded-xl border border-amber-500/35 bg-amber-950/20 px-4 py-3 text-sm text-amber-200" role="alert">
          {err}
        </p>
      ) : null}
      {info ? (
        <p className="rounded-xl border border-emerald-500/35 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200" role="status">
          {info}
        </p>
      ) : null}

      {results.length > 1 && !selected ? (
        <ul className="space-y-2 rounded-xl border border-white/10 bg-black/30 p-3">
          <p className="text-xs text-gray-500">{t("pickUser")}</p>
          {results.map((u) => (
            <li key={u.userId}>
              <button
                type="button"
                className="w-full rounded-lg border border-white/10 px-3 py-2 text-left text-sm text-gray-200 hover:border-fuchsia-500/30 hover:bg-white/5"
                onClick={() => setSelected(u)}
              >
                {u.email}
                <span className="ml-2 text-xs text-gray-500">
                  · {coachStatusLabel(t, u.role, u.platformCoachStatus)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {selected ? (
        <div className="space-y-4 rounded-xl border border-white/10 bg-black/35 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white">{selected.email}</p>
              <p className="mt-1 font-mono text-[0.65rem] text-gray-500">{selected.userId}</p>
              <p className="mt-2 text-sm text-gray-300">
                {t("currentState")}: <span className="text-fuchsia-200">{selectedStatus}</span>
                {selected.isPlatformAdmin ? (
                  <span className="ml-2 rounded bg-violet-500/20 px-1.5 py-0.5 text-xs text-violet-200">platform admin</span>
                ) : null}
              </p>
              {(selected.rosterAsCoachCount ?? 0) > 0 ? (
                <p className="mt-2 text-sm text-amber-200/95">
                  {t("rosterLinked", { count: selected.rosterAsCoachCount ?? 0 })}
                </p>
              ) : null}
            </div>
          </div>

          {selected.rosterNeedsCoachActivation ? (
            <p className="rounded-xl border border-amber-500/35 bg-amber-950/25 px-4 py-3 text-sm text-amber-100" role="status">
              {t("rosterNeedsActivation")}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Pro2Button
              type="button"
              className="px-3 py-2 text-xs"
              disabled={busy || selected.role === "private"}
              onClick={() => void applyProfile(selected.userId, "private")}
            >
              {t("setAthlete")}
            </Pro2Button>
            <Pro2Button
              type="button"
              variant="secondary"
              className="px-3 py-2 text-xs"
              disabled={busy || (selected.role === "coach" && (selected.platformCoachStatus ?? "pending") === "pending")}
              onClick={() => void applyProfile(selected.userId, "coach", "pending")}
            >
              {t("setCoachPending")}
            </Pro2Button>
            <Pro2Button
              type="button"
              className="px-3 py-2 text-xs"
              disabled={busy || (selected.role === "coach" && selected.platformCoachStatus === "approved")}
              onClick={() => {
                if (selected.role === "coach") void approveCoach(selected.userId);
                else void applyProfile(selected.userId, "coach", "approved");
              }}
            >
              {t("setCoachApproved")}
            </Pro2Button>
            <Pro2Button
              type="button"
              variant="secondary"
              className="border-rose-500/30 px-3 py-2 text-xs text-rose-200"
              disabled={busy || selected.role !== "coach" || selected.platformCoachStatus === "suspended"}
              onClick={() => void applyProfile(selected.userId, "coach", "suspended")}
            >
              {t("suspendCoach")}
            </Pro2Button>
          </div>
        </div>
      ) : null}

      {pendingCoaches.length > 0 ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-950/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-200/90">
            {t("pendingQueue", { count: pendingCoaches.length })}
          </p>
          <ul className="mt-3 space-y-2">
            {pendingCoaches.slice(0, 8).map((c) => (
              <li key={c.userId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-gray-200">{c.email ?? c.userId}</span>
                <Pro2Button type="button" className="px-2 py-1 text-xs" disabled={busy} onClick={() => selectFromPending(c)}>
                  {t("openInPanel")}
                </Pro2Button>
              </li>
            ))}
          </ul>
          {pendingCoaches.length > 8 ? (
            <p className="mt-2 text-xs text-gray-500">{t("pendingMore", { count: pendingCoaches.length - 8 })}</p>
          ) : null}
          <p className="mt-3 text-xs text-gray-500">
            <a href="#admin-coaches-heading" className="text-cyan-400 underline-offset-2 hover:underline">
              {t("fullCoachList")}
            </a>
          </p>
        </div>
      ) : null}
    </section>
  );
}
