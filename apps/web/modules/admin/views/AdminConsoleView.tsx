"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AdminGrantsSection } from "@/components/admin/AdminGrantsSection";
import { AdminPlatformReportSection } from "@/components/admin/AdminPlatformReportSection";
import { AdminUserDirectorySection } from "@/components/admin/AdminUserDirectorySection";
import { AdminUserRolePanel } from "@/components/admin/AdminUserRolePanel";
import type { AdminCoachRow } from "@/lib/admin/coach-list-types";
import { Pro2Button, Pro2Link } from "@/components/ui/empathy";

type MeJson = { ok: boolean; isAdmin?: boolean; email?: string };

export default function AdminConsoleView() {
  const t = useTranslations("Admin");
  const [me, setMe] = useState<MeJson | null>(null);
  const [coaches, setCoaches] = useState<AdminCoachRow[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [grantEmailPrefill, setGrantEmailPrefill] = useState<string | null>(null);
  const clearGrantPrefill = useCallback(() => setGrantEmailPrefill(null), []);

  const reloadCoaches = useCallback(async () => {
    const res = await fetch("/api/admin/coaches", { cache: "no-store" });
    const j = (await res.json()) as { ok?: boolean; coaches?: AdminCoachRow[]; error?: string };
    if (!res.ok || !j.ok) {
      setLoadErr(j.error ?? t("errors.coachList"));
      setCoaches([]);
      return;
    }
    setLoadErr(null);
    setCoaches(j.coaches ?? []);
  }, [t]);

  useEffect(() => {
    let c = false;
    (async () => {
      const res = await fetch("/api/admin/me", { cache: "no-store" });
      const j = (await res.json()) as MeJson;
      if (c) return;
      setMe(j);
      if (j.isAdmin) {
        await reloadCoaches();
      }
    })();
    return () => {
      c = true;
    };
  }, [reloadCoaches]);

  const setCoachStatus = useCallback(
    async (userId: string, action: "approve" | "suspend" | "pending") => {
      setBusyId(userId);
      setLoadErr(null);
      try {
        const res = await fetch(`/api/admin/coaches/${encodeURIComponent(userId)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const j = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !j.ok) {
          setLoadErr(j.error ?? t("errors.updateFailed"));
          return;
        }
        await reloadCoaches();
      } catch {
        setLoadErr(t("errors.network"));
      } finally {
        setBusyId(null);
      }
    },
    [reloadCoaches, t],
  );

  const sortedCoaches = useMemo(() => {
    const rank = (s: string | null | undefined) => {
      const v = s ?? "pending";
      if (v === "pending") return 0;
      if (v === "suspended") return 1;
      return 2;
    };
    return [...coaches].sort((a, b) => {
      const d = rank(a.platformCoachStatus) - rank(b.platformCoachStatus);
      if (d !== 0) return d;
      return (a.email ?? a.userId).localeCompare(b.email ?? b.userId);
    });
  }, [coaches]);

  const pendingCount = useMemo(
    () => coaches.filter((c) => (c.platformCoachStatus ?? "pending") === "pending").length,
    [coaches],
  );

  if (me && me.isAdmin === false) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-xl font-bold text-white">{t("deniedTitle")}</h1>
        <p className="mt-4 text-sm text-gray-400">{t("deniedBody")}</p>
        <Pro2Link href="/dashboard" variant="primary" className="mt-8 inline-flex justify-center">
          {t("backDashboard")}
        </Pro2Link>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-sm text-gray-400">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" aria-hidden />
        <p>{t("checking")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-10">
      <header className="space-y-2 border-b border-white/10 pb-8">
        <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-orange-300">{t("eyebrow")}</p>
        <h1 className="text-2xl font-bold text-white">{t("title")}</h1>
        <p className="text-sm text-gray-400">
          {t("intro")}{" "}
          <span className="text-gray-300">{me.email ?? "—"}</span>
        </p>
        <p className="text-xs text-gray-500">
          {t("directoryHint")}{" "}
          <a href="#admin-user-role" className="text-fuchsia-300 underline-offset-2 hover:underline">
            {t("rolePanelAnchor")}
          </a>
          {" · "}
          <a href="#admin-coaches-heading" className="text-cyan-400 underline-offset-2 hover:underline">
            {t("coachesAnchor")}
          </a>
          {" · "}
          <a href="#admin-platform-report" className="text-cyan-400 underline-offset-2 hover:underline">
            {t("reportAnchor")}
          </a>
          {" · "}
          <a href="#admin-grants" className="text-cyan-400 underline-offset-2 hover:underline">
            {t("directoryGrantAnchor")}
          </a>
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          <Pro2Link href="/dashboard" variant="secondary" className="justify-center border border-white/15">
            {t("dashboard")}
          </Pro2Link>
        </div>
      </header>

      <AdminUserRolePanel onRolesChanged={() => void reloadCoaches()} />

      <section aria-labelledby="admin-coaches-heading" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="admin-coaches-heading" className="text-lg font-semibold text-white">
              {t("coachesHeading")}
            </h2>
            <p className="mt-1 text-sm text-gray-500">{t("coachesSub", { count: pendingCount })}</p>
          </div>
          <Pro2Button type="button" variant="secondary" disabled={!!busyId} onClick={() => void reloadCoaches()}>
            {t("reloadList")}
          </Pro2Button>
        </div>

        {loadErr ? (
          <p className="rounded-xl border border-amber-500/35 bg-amber-950/20 px-4 py-3 text-sm text-amber-200" role="alert">
            {loadErr}
          </p>
        ) : null}

        <p className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-gray-400">
          <strong className="text-gray-300">{t("coachNoteLead")}</strong> {t("coachNoteBody")}
        </p>

        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/25">
          <table className="min-w-full text-left text-sm text-gray-300">
            <thead className="border-b border-white/10 bg-white/5 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-semibold">{t("thEmail")}</th>
                <th className="px-4 py-3 font-semibold">{t("thStatus")}</th>
                <th className="px-4 py-3 font-semibold">{t("thActions")}</th>
              </tr>
            </thead>
            <tbody>
              {coaches.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm leading-relaxed text-gray-500">
                    {t("emptyCoaches")}
                  </td>
                </tr>
              ) : (
                sortedCoaches.map((c) => {
                  const busy = busyId === c.userId;
                  const st = c.platformCoachStatus ?? "pending";
                  const stLabel =
                    st === "approved" ? t("statusActive") : st === "suspended" ? t("statusSuspended") : t("statusPending");
                  return (
                    <tr key={c.userId} className="border-b border-white/5 last:border-0">
                      <td className="px-4 py-3 text-sm text-gray-200">{c.email ?? c.userId}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            st === "approved"
                              ? "bg-emerald-500/15 text-emerald-200"
                              : st === "suspended"
                                ? "bg-rose-500/15 text-rose-200"
                                : "bg-amber-500/15 text-amber-200"
                          }`}
                        >
                          {stLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Pro2Button
                            type="button"
                            className="px-3 py-1.5 text-xs"
                            disabled={busy || st === "approved"}
                            onClick={() => void setCoachStatus(c.userId, "approve")}
                          >
                            {t("approve")}
                          </Pro2Button>
                          <Pro2Button
                            type="button"
                            className="px-3 py-1.5 text-xs"
                            variant="secondary"
                            disabled={busy || st === "pending"}
                            onClick={() => void setCoachStatus(c.userId, "pending")}
                          >
                            {t("pending")}
                          </Pro2Button>
                          <Pro2Button
                            type="button"
                            className="border-rose-500/30 px-3 py-1.5 text-xs text-rose-200 hover:border-rose-400/50"
                            variant="secondary"
                            disabled={busy || st === "suspended"}
                            onClick={() => void setCoachStatus(c.userId, "suspend")}
                          >
                            {t("suspend")}
                          </Pro2Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <details
        id="admin-platform-report"
        className="group rounded-2xl border border-white/10 bg-white/[0.03] open:border-white/15"
      >
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-gray-300 [&::-webkit-details-marker]:hidden">
          <span className="text-white">{t("reportAnchor")}</span>
          <span className="ml-2 text-xs font-normal text-gray-500">({t("sectionCollapsedHint")})</span>
        </summary>
        <div className="border-t border-white/10 px-1 pb-4 pt-2">
          <AdminPlatformReportSection />
        </div>
      </details>

      <details className="group rounded-2xl border border-white/10 bg-white/[0.03] open:border-white/15">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-gray-300 [&::-webkit-details-marker]:hidden">
          <span className="text-white">{t("directorySectionTitle")}</span>
          <span className="ml-2 text-xs font-normal text-gray-500">({t("sectionCollapsedHint")})</span>
        </summary>
        <div className="border-t border-white/10 px-1 pb-4 pt-2">
          <AdminUserDirectorySection onPrefillGrantEmail={(email) => setGrantEmailPrefill(email)} />
        </div>
      </details>

      <AdminGrantsSection grantEmailPrefill={grantEmailPrefill} onGrantEmailPrefillConsumed={clearGrantPrefill} />

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-gray-400">
        <h2 className="text-base font-semibold text-white">{t("comingHeading")}</h2>
        <p className="mt-2 leading-relaxed">{t("comingBody")}</p>
      </section>
    </div>
  );
}
