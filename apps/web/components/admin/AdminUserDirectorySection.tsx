"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AdminAthleteActivityRollup } from "@/lib/admin/load-activity-rollups";
import type { AdminDirectoryUserRow } from "@/lib/admin/user-directory-types";
import { Pro2Button } from "@/components/ui/empathy";

type DirectoryJson = {
  ok: boolean;
  users?: AdminDirectoryUserRow[];
  page?: number;
  perPage?: number;
  totalUsers?: number;
  hasMore?: boolean;
  error?: string;
};

type DetailJson = {
  ok: boolean;
  user?: {
    id: string;
    email: string | null;
    createdAt: string | null;
    lastSignInAt: string | null;
  };
  profile?: {
    role: "private" | "coach" | null;
    platformCoachStatus: string | null;
    isPlatformAdmin: boolean;
    athleteId: string | null;
  };
  entitlement?: AdminDirectoryUserRow["entitlement"];
  stripeSubscriptions?: Array<{
    status: string;
    currentPeriodEnd: string | null;
    basePlanId: string | null;
    updatedAt: string | null;
  }>;
  grants?: Array<{
    id: string;
    kind: string;
    starts_at: string;
    ends_at: string;
    note: string | null;
    revoked_at: string | null;
    created_at: string;
  }>;
  activity?: AdminAthleteActivityRollup | null;
  error?: string;
};

function formatShortDate(iso: string | null, locale: string): string {
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

function csvEscape(s: string): string {
  if (s.includes('"') || s.includes(",") || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function stripeSummary(row: AdminDirectoryUserRow, locale: string, untilWord: string): string {
  const parts = row.stripeSubscriptions.map((s) => {
    const end = s.currentPeriodEnd ? formatShortDate(s.currentPeriodEnd, locale) : "—";
    return `${s.status}${s.basePlanId ? ` · ${s.basePlanId}` : ""} · ${untilWord} ${end}`;
  });
  return parts.length ? parts.join(" | ") : "—";
}

function fmtCountLast(count: number, last: string | null, locale: string): string {
  if (count <= 0 && !last) return "0";
  if (count <= 0) return `0 · ${formatShortDate(last, locale)}`;
  return `${count} · ${formatShortDate(last, locale)}`;
}

function formatShortDateTime(iso: string | null, locale: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(locale === "en" ? "en-GB" : "it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Indice compatto per tabella: G pull · D sync export · B blob · S staging · I import. ● = link Garmin. */
function opsIngestShort(a: AdminAthleteActivityRollup): string {
  const sum =
    a.deviceSyncExportsCount +
    a.garminPullJobsTotal +
    a.garminActivityBlobsCount +
    a.interpretationStagingRunsCount +
    a.trainingImportJobsCount;
  if (!a.garminAthleteLinked && sum === 0) return "—";
  const pre = a.garminAthleteLinked ? "● " : "○ ";
  return `${pre}G${a.garminPullJobsTotal} D${a.deviceSyncExportsCount} B${a.garminActivityBlobsCount} S${a.interpretationStagingRunsCount} I${a.trainingImportJobsCount}`;
}

function opsIngestTitle(a: AdminAthleteActivityRollup, locale: string): string {
  return [
    a.garminAthleteLinked ? "Garmin OAuth: linked" : "Garmin OAuth: not linked",
    `pull jobs ${a.garminPullJobsTotal} (completed ${a.garminPullJobsCompleted}, failed ${a.garminPullJobsFailed})`,
    `last pull ${formatShortDateTime(a.garminPullJobsLastAt, locale)}`,
    `activity blobs ${a.garminActivityBlobsCount}`,
    `device_sync_exports ${a.deviceSyncExportsCount}`,
    `last device export ${formatShortDateTime(a.deviceSyncLastAt, locale)}`,
    `interpretation staging ${a.interpretationStagingRunsCount}`,
    `last staging ${formatShortDateTime(a.interpretationStagingLastAt, locale)}`,
    `training import jobs ${a.trainingImportJobsCount}`,
    `last import ${formatShortDateTime(a.trainingImportJobsLastAt, locale)}`,
    `last blob ${formatShortDateTime(a.garminActivityBlobsLastAt, locale)}`,
  ].join("\n");
}

type Props = {
  onPrefillGrantEmail?: (email: string) => void;
};

export function AdminUserDirectorySection({ onPrefillGrantEmail }: Props) {
  const t = useTranslations("AdminDirectory");
  const locale = useLocale();
  const [page, setPage] = useState(1);
  const perPage = 50;
  const [rows, setRows] = useState<AdminDirectoryUserRow[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailJson | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/users/directory?page=${page}&perPage=${perPage}`, { cache: "no-store" });
      const j = (await res.json()) as DirectoryJson;
      if (!res.ok || !j.ok) {
        setErr(j.error ?? t("errors.load"));
        setRows([]);
        setTotalUsers(0);
        setHasMore(false);
        return;
      }
      setRows(j.users ?? []);
      setTotalUsers(j.totalUsers ?? j.users?.length ?? 0);
      setHasMore(Boolean(j.hasMore));
    } catch {
      setErr(t("errors.network"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, perPage, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = useCallback(
    async (userId: string) => {
      setDetailUserId(userId);
      setDetail(null);
      setDetailLoading(true);
      try {
        const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/detail`, { cache: "no-store" });
        const j = (await res.json()) as DetailJson;
        if (!res.ok || !j.ok) {
          setDetail({ ok: false, error: j.error ?? t("errors.detail") });
        } else {
          setDetail(j);
        }
      } catch {
        setDetail({ ok: false, error: t("errors.network") });
      } finally {
        setDetailLoading(false);
      }
    },
    [t],
  );

  const closeDetail = useCallback(() => {
    setDetailUserId(null);
    setDetail(null);
  }, []);

  const exportCsv = useCallback(() => {
    const headers = [
      "user_id",
      "email",
      "created_at",
      "last_sign_in",
      "role",
      "platform_coach_status",
      "athlete_id",
      "access_label",
      "access_until",
      "stripe",
      "executed_count",
      "executed_last",
      "planned_count",
      "planned_last",
      "food_diary_count",
      "food_diary_last",
      "biomarker_count",
      "biomarker_last",
      "device_sync_exports_count",
      "device_sync_last_at",
      "garmin_linked",
      "garmin_pull_total",
      "garmin_pull_completed",
      "garmin_pull_failed",
      "garmin_pull_last_at",
      "garmin_blobs_count",
      "garmin_blobs_last_at",
      "interpretation_staging_count",
      "interpretation_staging_last_at",
      "training_import_jobs_count",
      "training_import_jobs_last_at",
    ];
    const lines = [headers.join(",")];
    for (const r of rows) {
      const a = r.activity;
      lines.push(
        [
          r.userId,
          r.email ?? "",
          r.createdAt ?? "",
          r.lastSignInAt ?? "",
          r.role ?? "",
          r.platformCoachStatus ?? "",
          r.athleteId ?? "",
          r.entitlement.label,
          r.entitlement.validUntil ?? "",
          stripeSummary(r, locale, t("untilShort")),
          a ? String(a.executedWorkoutsCount) : "",
          a?.executedLastDate ?? "",
          a ? String(a.plannedWorkoutsCount) : "",
          a?.plannedLastDate ?? "",
          a ? String(a.foodDiaryEntriesCount) : "",
          a?.foodDiaryLastEntryDate ?? "",
          a ? String(a.biomarkerPanelsCount) : "",
          a?.biomarkerLastSampleDate ?? "",
          a ? String(a.deviceSyncExportsCount) : "",
          a?.deviceSyncLastAt ?? "",
          a ? (a.garminAthleteLinked ? "yes" : "no") : "",
          a ? String(a.garminPullJobsTotal) : "",
          a ? String(a.garminPullJobsCompleted) : "",
          a ? String(a.garminPullJobsFailed) : "",
          a?.garminPullJobsLastAt ?? "",
          a ? String(a.garminActivityBlobsCount) : "",
          a?.garminActivityBlobsLastAt ?? "",
          a ? String(a.interpretationStagingRunsCount) : "",
          a?.interpretationStagingLastAt ?? "",
          a ? String(a.trainingImportJobsCount) : "",
          a?.trainingImportJobsLastAt ?? "",
        ]
          .map((c) => csvEscape(String(c)))
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `empathy-admin-users-page-${page}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [rows, page, locale, t]);

  const setRole = useCallback(
    async (userId: string, targetRole: "private" | "coach", platformCoachStatus?: "pending" | "approved" | "suspended") => {
      setBusyId(userId);
      setErr(null);
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
        await load();
        if (detailUserId === userId) void openDetail(userId);
      } catch {
        setErr(t("errors.network"));
      } finally {
        setBusyId(null);
      }
    },
    [load, t, detailUserId, openDetail],
  );

  const colCount = 13;
  const shownFrom = totalUsers === 0 ? 0 : (page - 1) * perPage + 1;
  const shownTo = totalUsers === 0 ? 0 : Math.min(page * perPage, totalUsers);

  return (
    <section aria-labelledby="admin-directory-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="admin-directory-heading" className="text-lg font-semibold text-white">
            {t("title")}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {totalUsers > 0
              ? t("subtitleRange", { from: shownFrom, to: shownTo, total: totalUsers, page, perPage })
              : t("subtitle", { page, perPage })}
          </p>
          <p className="mt-1 text-xs text-gray-600">{t("fullListNote")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Pro2Button type="button" variant="secondary" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            {t("prev")}
          </Pro2Button>
          <Pro2Button type="button" variant="secondary" disabled={!hasMore || loading} onClick={() => setPage((p) => p + 1)}>
            {t("next")}
          </Pro2Button>
          <Pro2Button type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
            {t("reload")}
          </Pro2Button>
          <Pro2Button type="button" variant="secondary" disabled={!rows.length || loading} onClick={exportCsv}>
            {t("exportCsv")}
          </Pro2Button>
        </div>
      </div>

      {err ? (
        <p className="rounded-xl border border-amber-500/35 bg-amber-950/20 px-4 py-3 text-sm text-amber-200" role="alert">
          {err}
        </p>
      ) : null}

      <div className="max-h-[min(70vh,720px)] overflow-auto rounded-2xl border border-white/10 bg-black/25">
        <table className="min-w-[1280px] text-left text-sm text-gray-300">
          <thead className="sticky top-0 z-10 border-b border-white/10 bg-zinc-950 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-2 py-3 font-semibold">{t("thEmail")}</th>
              <th className="px-2 py-3 font-semibold">{t("thJoined")}</th>
              <th className="px-2 py-3 font-semibold">{t("thLastSignIn")}</th>
              <th className="px-2 py-3 font-semibold">{t("thRole")}</th>
              <th className="px-2 py-3 font-semibold">{t("thCoach")}</th>
              <th className="px-2 py-3 font-semibold">{t("thAthlete")}</th>
              <th className="px-2 py-3 font-semibold">{t("thTraining")}</th>
              <th className="px-2 py-3 font-semibold">{t("thDiary")}</th>
              <th className="px-2 py-3 font-semibold">{t("thHealth")}</th>
              <th className="px-2 py-3 font-semibold" title={t("thIngestHint")}>
                {t("thIngest")}
              </th>
              <th className="px-2 py-3 font-semibold">{t("thAccess")}</th>
              <th className="px-2 py-3 font-semibold">{t("thStripe")}</th>
              <th className="px-2 py-3 font-semibold">{t("thActions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading && !rows.length ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-8 text-center text-sm text-gray-500">
                  {t("loading")}
                </td>
              </tr>
            ) : null}
            {!loading && !rows.length ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-8 text-center text-sm text-gray-500">
                  {t("empty")}
                </td>
              </tr>
            ) : null}
            {rows.map((r) => {
              const busy = busyId === r.userId;
              const coachSt = r.role === "coach" ? (r.platformCoachStatus ?? "pending") : "—";
              const a = r.activity;
              const athShort = r.athleteId ? `${r.athleteId.slice(0, 8)}…` : "—";
              return (
                <tr key={r.userId} className="border-b border-white/5 last:border-0">
                  <td className="max-w-[180px] truncate px-2 py-2 text-gray-200" title={r.email ?? r.userId}>
                    {r.email ?? r.userId}
                    {r.isPlatformAdmin ? (
                      <span className="ml-1 rounded bg-violet-500/20 px-1 py-0.5 text-[0.6rem] font-medium text-violet-200">admin</span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-xs text-gray-500">{formatShortDate(r.createdAt, locale)}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-xs text-gray-500">{formatShortDate(r.lastSignInAt, locale)}</td>
                  <td className="px-2 py-2 text-xs">{r.role ?? "—"}</td>
                  <td className="px-2 py-2 text-xs">{r.role === "coach" ? coachSt : "—"}</td>
                  <td className="max-w-[90px] truncate px-2 py-2 font-mono text-[0.65rem] text-gray-500" title={r.athleteId ?? ""}>
                    {athShort}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-xs text-gray-400" title={t("thTrainingHint")}>
                    {a ? `${fmtCountLast(a.executedWorkoutsCount, a.executedLastDate, locale)} / ${fmtCountLast(a.plannedWorkoutsCount, a.plannedLastDate, locale)}` : "—"}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-xs text-gray-400">
                    {a ? fmtCountLast(a.foodDiaryEntriesCount, a.foodDiaryLastEntryDate, locale) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-xs text-gray-400">
                    {a ? fmtCountLast(a.biomarkerPanelsCount, a.biomarkerLastSampleDate, locale) : "—"}
                  </td>
                  <td
                    className="max-w-[140px] truncate px-2 py-2 font-mono text-[0.65rem] text-cyan-200/90"
                    title={a ? opsIngestTitle(a, locale) : ""}
                  >
                    {a ? opsIngestShort(a) : "—"}
                  </td>
                  <td className="max-w-[160px] px-2 py-2 text-xs leading-snug text-gray-400">
                    <span className="text-gray-300">{r.entitlement.label}</span>
                    {r.entitlement.validUntil ? (
                      <span className="block text-gray-500">
                        {t("until")} {formatShortDate(r.entitlement.validUntil, locale)}
                      </span>
                    ) : null}
                  </td>
                  <td className="max-w-[200px] px-2 py-2 text-xs leading-snug text-gray-500">{stripeSummary(r, locale, t("untilShort"))}</td>
                  <td className="px-2 py-2 align-top">
                    <div className="flex min-w-[8rem] flex-col gap-1">
                      <Pro2Button type="button" variant="secondary" className="px-2 py-1 text-[0.65rem]" disabled={busy} onClick={() => void openDetail(r.userId)}>
                        {t("detail")}
                      </Pro2Button>
                      {r.email && onPrefillGrantEmail ? (
                        <Pro2Button
                          type="button"
                          variant="secondary"
                          className="px-2 py-1 text-[0.65rem]"
                          disabled={busy}
                          onClick={() => onPrefillGrantEmail(r.email!)}
                        >
                          {t("grant")}
                        </Pro2Button>
                      ) : null}
                      {r.role === "coach" && (r.platformCoachStatus ?? "pending") !== "approved" ? (
                        <Pro2Button
                          type="button"
                          className="px-2 py-1 text-[0.65rem]"
                          disabled={busy}
                          onClick={() => void setRole(r.userId, "coach", "approved")}
                        >
                          {t("approveCoach")}
                        </Pro2Button>
                      ) : null}
                      {r.role !== "coach" ? (
                        <Pro2Button type="button" className="px-2 py-1 text-[0.65rem]" disabled={busy} onClick={() => void setRole(r.userId, "coach", "pending")}>
                          {t("makeCoach")}
                        </Pro2Button>
                      ) : (
                        <Pro2Button
                          type="button"
                          variant="secondary"
                          className="border-rose-500/25 px-2 py-1 text-[0.65rem] text-rose-200"
                          disabled={busy}
                          onClick={() => {
                            if (typeof window !== "undefined" && !window.confirm(t("confirmPrivate"))) return;
                            void setRole(r.userId, "private");
                          }}
                        >
                          {t("makePrivate")}
                        </Pro2Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {detailUserId ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-user-detail-title"
          onClick={closeDetail}
          onKeyDown={(e) => {
            if (e.key === "Escape") closeDetail();
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/15 bg-zinc-950 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 id="admin-user-detail-title" className="text-lg font-semibold text-white">
                {t("detailTitle")}
              </h3>
              <button type="button" className="rounded-lg border border-white/15 px-2 py-1 text-xs text-gray-400 hover:bg-white/5" onClick={closeDetail}>
                {t("detailClose")}
              </button>
            </div>
            {detailLoading ? <p className="mt-6 text-sm text-gray-500">{t("detailLoading")}</p> : null}
            {!detailLoading && detail && !detail.ok ? (
              <p className="mt-4 text-sm text-amber-200">{detail.error ?? t("errors.detail")}</p>
            ) : null}
            {!detailLoading && detail?.ok && detail.user ? (
              <div className="mt-4 space-y-4 text-sm text-gray-300">
                <p>
                  <span className="text-gray-500">{t("detailEmail")} </span>
                  {detail.user.email ?? detail.user.id}
                </p>
                <p className="text-xs text-gray-500">
                  {t("detailIds")}: <span className="font-mono text-gray-400">{detail.user.id}</span>
                  {detail.profile?.athleteId ? (
                    <>
                      {" "}
                      · athlete: <span className="font-mono text-gray-400">{detail.profile.athleteId}</span>
                    </>
                  ) : null}
                </p>
                <p className="text-xs text-gray-500">
                  {t("detailJoined")}: {formatShortDate(detail.user.createdAt, locale)} · {t("detailLastSignIn")}:{" "}
                  {formatShortDate(detail.user.lastSignInAt, locale)}
                </p>
                <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs">
                  <p className="font-mono uppercase tracking-wider text-gray-500">{t("detailAccess")}</p>
                  <p className="mt-1 text-gray-200">{detail.entitlement?.label}</p>
                  {detail.entitlement?.validUntil ? (
                    <p className="text-gray-500">
                      {t("until")} {formatShortDate(detail.entitlement.validUntil, locale)}
                    </p>
                  ) : null}
                  <p className="mt-2 text-gray-500">
                    {t("detailRole")}: {detail.profile?.role ?? "—"} · coach: {detail.profile?.platformCoachStatus ?? "—"}
                  </p>
                </div>
                {detail.stripeSubscriptions?.length ? (
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs">
                    <p className="font-mono uppercase tracking-wider text-gray-500">{t("detailStripe")}</p>
                    <ul className="mt-2 list-inside list-disc space-y-1 text-gray-400">
                      {detail.stripeSubscriptions.map((s, i) => (
                        <li key={`${s.status}-${i}`}>
                          {s.status} {s.basePlanId ? `· ${s.basePlanId}` : ""} · {t("untilShort")}{" "}
                          {formatShortDate(s.currentPeriodEnd, locale)}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-xs text-gray-600">{t("detailNoStripe")}</p>
                )}
                {detail.activity ? (
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs">
                    <p className="font-mono uppercase tracking-wider text-gray-500">{t("detailActivity")}</p>
                    <ul className="mt-2 space-y-1 text-gray-400">
                      <li>
                        {t("detailExecuted")}: {detail.activity.executedWorkoutsCount} · {formatShortDate(detail.activity.executedLastDate, locale)}
                      </li>
                      <li>
                        {t("detailPlanned")}: {detail.activity.plannedWorkoutsCount} · {formatShortDate(detail.activity.plannedLastDate, locale)}
                      </li>
                      <li>
                        {t("detailDiary")}: {detail.activity.foodDiaryEntriesCount} · {formatShortDate(detail.activity.foodDiaryLastEntryDate, locale)}
                      </li>
                      <li>
                        {t("detailBiomarkers")}: {detail.activity.biomarkerPanelsCount} · {formatShortDate(detail.activity.biomarkerLastSampleDate, locale)}
                      </li>
                    </ul>
                    <p className="mt-3 font-mono uppercase tracking-wider text-gray-500">{t("detailIngest")}</p>
                    <ul className="mt-1 space-y-1 text-gray-400">
                      <li>
                        {t("detailGarminOAuth")}: {detail.activity.garminAthleteLinked ? t("detailYes") : t("detailNo")}
                      </li>
                      <li>
                        {t("detailGarminPull")}: {detail.activity.garminPullJobsTotal} ({t("detailOk")}{" "}
                        {detail.activity.garminPullJobsCompleted}, {t("detailFail")} {detail.activity.garminPullJobsFailed}) ·{" "}
                        {formatShortDateTime(detail.activity.garminPullJobsLastAt, locale)}
                      </li>
                      <li>
                        {t("detailGarminBlobs")}: {detail.activity.garminActivityBlobsCount} ·{" "}
                        {formatShortDateTime(detail.activity.garminActivityBlobsLastAt, locale)}
                      </li>
                      <li>
                        {t("detailDeviceSync")}: {detail.activity.deviceSyncExportsCount} · {formatShortDateTime(detail.activity.deviceSyncLastAt, locale)}
                      </li>
                      <li>
                        {t("detailStaging")}: {detail.activity.interpretationStagingRunsCount} ·{" "}
                        {formatShortDateTime(detail.activity.interpretationStagingLastAt, locale)}
                      </li>
                      <li>
                        {t("detailTrainingImports")}: {detail.activity.trainingImportJobsCount} ·{" "}
                        {formatShortDateTime(detail.activity.trainingImportJobsLastAt, locale)}
                      </li>
                    </ul>
                  </div>
                ) : (
                  <p className="text-xs text-gray-600">{t("detailNoAthlete")}</p>
                )}
                <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs">
                  <p className="font-mono uppercase tracking-wider text-gray-500">{t("detailGrants")}</p>
                  {detail.grants?.length ? (
                    <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-gray-400">
                      {detail.grants.map((g) => (
                        <li key={g.id} className="border-b border-white/5 pb-1">
                          {g.kind} · {formatShortDate(g.starts_at, locale)} → {formatShortDate(g.ends_at, locale)}
                          {g.revoked_at ? <span className="text-rose-300"> · {t("detailRevoked")}</span> : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-gray-600">{t("detailNoGrants")}</p>
                  )}
                </div>
                {detail.user.email && onPrefillGrantEmail ? (
                  <Pro2Button type="button" variant="secondary" className="w-full justify-center" onClick={() => onPrefillGrantEmail(detail.user!.email!)}>
                    {t("grantFromDetail")}
                  </Pro2Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
