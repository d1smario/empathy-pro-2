"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type {
  PlatformLinkedCoach,
  PlatformModuleId,
  PlatformReport,
  PlatformRosterOperatorRow,
} from "@/lib/admin/platform-report-types";
import { PLATFORM_REPORT_MODULE_COUNT } from "@/lib/admin/platform-report-types";
import { Pro2Button } from "@/components/ui/empathy";

type ReportJson = { ok: boolean; report?: PlatformReport; error?: string };

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

function moduleLabel(t: (key: string) => string, id: PlatformModuleId): string {
  return t(`module.${id}`);
}

function modulesCell(t: (key: string) => string, ids: PlatformModuleId[]): string {
  if (!ids.length) return t("modulesNone");
  return ids.map((id) => moduleLabel(t, id)).join(" · ");
}

function coachStatusLabel(t: (key: string) => string, st: string | null): string {
  if (st === "approved") return t("coachStatus.approved");
  if (st === "suspended") return t("coachStatus.suspended");
  return t("coachStatus.pending");
}

function rosterOperatorIssueLabel(t: (key: string) => string, issue: PlatformRosterOperatorRow["issue"]): string {
  if (issue === "missing_coach_role") return t("rosterIssue.missingRole");
  if (issue === "coach_suspended") return t("rosterIssue.suspended");
  return t("rosterIssue.pending");
}

function linkedCoachesCell(t: (key: string) => string, coaches: PlatformLinkedCoach[]): string {
  if (!coaches.length) return t("linkedCoachesNone");
  return coaches
    .map((c) => {
      const email = c.email ?? c.userId.slice(0, 8);
      if (c.coachConsoleOperational) return email;
      if (c.role !== "coach") return `${email} (${t("linkedCoachAthleteAccount")})`;
      return `${email} (${t("linkedCoachNotActive")})`;
    })
    .join(" · ");
}

export function AdminPlatformReportSection() {
  const t = useTranslations("AdminReport");
  const locale = useLocale();
  const [report, setReport] = useState<PlatformReport | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [athleteFilter, setAthleteFilter] = useState<"all" | "low">("low");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/platform-report", { cache: "no-store" });
      const j = (await res.json()) as ReportJson;
      if (!res.ok || !j.ok || !j.report) {
        setReport(null);
        setErr(j.error ?? t("errors.load"));
        return;
      }
      setReport(j.report);
    } catch {
      setReport(null);
      setErr(t("errors.network"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredAthletes = useMemo(() => {
    if (!report) return [];
    if (athleteFilter === "low") {
      return report.athletes.filter((a) => a.engagementScore === 0);
    }
    return report.athletes;
  }, [report, athleteFilter]);

  const kpiTiles = useMemo(() => {
    if (!report) return [];
    const k = report.kpis;
    return [
      { label: t("kpi.authUsers"), value: String(k.totalAuthUsers) },
      { label: t("kpi.signIn30"), value: String(k.signInLast30Days) },
      { label: t("kpi.coaches"), value: `${k.coachesTotal} (${k.coachesPending} ${t("kpi.pending")})` },
      { label: t("kpi.coachesApproved"), value: String(k.coachesApproved) },
      { label: t("kpi.athletes"), value: String(k.athletesWithProfile) },
      { label: t("kpi.rosterLinks"), value: String(k.rosterLinks) },
      { label: t("kpi.stripePaid"), value: String(k.stripePaidUsers) },
      { label: t("kpi.grantActive"), value: String(k.grantActiveUsers) },
      { label: t("kpi.lowEngagement"), value: String(k.lowEngagementAthletes) },
    ];
  }, [report, t]);

  return (
    <section id="admin-platform-report" aria-labelledby="admin-report-heading" className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <h2 id="admin-report-heading" className="text-lg font-semibold text-white">
            {t("title")}
          </h2>
          <p className="mt-1 text-sm text-gray-500">{t("subtitle")}</p>
          {report?.generatedAt ? (
            <p className="mt-1 text-xs text-gray-600">
              {formatShortDate(report.generatedAt, locale)} · {new Date(report.generatedAt).toLocaleTimeString()}
            </p>
          ) : null}
          {report && !report.rollupsAvailable ? (
            <p className="mt-2 text-xs text-amber-300/90">{t("rollupsMissing")}</p>
          ) : null}
        </div>
        <Pro2Button type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
          {t("reload")}
        </Pro2Button>
      </div>

      {err ? (
        <p className="rounded-xl border border-amber-500/35 bg-amber-950/20 px-4 py-3 text-sm text-amber-200" role="alert">
          {err}
        </p>
      ) : null}

      {loading && !report ? <p className="text-sm text-gray-500">{t("loading")}</p> : null}

      {report ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {kpiTiles.map((tile) => (
              <div key={tile.label} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3">
                <p className="text-[0.65rem] font-medium uppercase tracking-wide text-gray-500">{tile.label}</p>
                <p className="mt-1 text-lg font-semibold text-white">{tile.value}</p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/25">
            <h3 className="border-b border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white">
              {t("modulesHeading")}
            </h3>
            <table className="min-w-full text-left text-sm text-gray-300">
              <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2">{t("thModule")}</th>
                  <th className="px-4 py-2">{t("thActive")}</th>
                  <th className="px-4 py-2">{t("thPct")}</th>
                </tr>
              </thead>
              <tbody>
                {report.moduleAdoption.map((m) => (
                  <tr key={m.moduleId} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-2">{moduleLabel(t, m.moduleId)}</td>
                    <td className="px-4 py-2">
                      {m.athletesActive} / {m.athletesTotal}
                    </td>
                    <td className="px-4 py-2">{m.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-4 py-2 text-xs text-gray-500">{t("modulesFootnote")}</p>
          </div>

          {report.rosterOperatorsNeedingFix.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-amber-500/30 bg-amber-950/15">
              <h3 className="border-b border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-100">
                {t("rosterMismatchHeading")}
              </h3>
              <p className="px-4 py-2 text-xs text-amber-200/80">{t("rosterMismatchHint")}</p>
              <table className="min-w-full text-left text-sm text-gray-300">
                <thead className="border-b border-amber-500/20 text-xs uppercase tracking-wide text-amber-200/70">
                  <tr>
                    <th className="px-4 py-2">{t("thCoach")}</th>
                    <th className="px-4 py-2">{t("thRosterIssue")}</th>
                    <th className="px-4 py-2">{t("thAthleteCount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rosterOperatorsNeedingFix.map((op) => (
                    <tr key={op.coachUserId} className="border-b border-amber-500/10 last:border-0">
                      <td className="px-4 py-2 text-gray-200">{op.email ?? op.coachUserId.slice(0, 8)}</td>
                      <td className="px-4 py-2 text-amber-100">{rosterOperatorIssueLabel(t, op.issue)}</td>
                      <td className="px-4 py-2 font-medium text-white">{op.athleteCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/25">
            <h3 className="border-b border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white">
              {t("coachesHeading")}
            </h3>
            <table className="min-w-full text-left text-sm text-gray-300">
              <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">{t("thCoach")}</th>
                  <th className="px-4 py-3">{t("thStatus")}</th>
                  <th className="px-4 py-3">{t("thAthleteCount")}</th>
                  <th className="px-4 py-3">{t("thRoster")}</th>
                </tr>
              </thead>
              <tbody>
                {report.coaches.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                      {t("emptyCoaches")}
                    </td>
                  </tr>
                ) : (
                  report.coaches.map((c) => (
                    <tr key={c.coachUserId} className="border-b border-white/5 align-top last:border-0">
                      <td className="px-4 py-3 text-gray-200">{c.email ?? c.coachUserId.slice(0, 8)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            c.platformCoachStatus === "approved"
                              ? "bg-emerald-500/15 text-emerald-200"
                              : c.platformCoachStatus === "suspended"
                                ? "bg-rose-500/15 text-rose-200"
                                : "bg-amber-500/15 text-amber-200"
                          }`}
                        >
                          {coachStatusLabel(t, c.platformCoachStatus)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-white">{c.athleteCount}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {c.athletes.length === 0 ? (
                          "—"
                        ) : (
                          <ul className="space-y-1">
                            {c.athletes.map((a) => (
                              <li key={a.athleteId}>
                                <span className="text-gray-300">{a.displayName ?? a.email ?? a.athleteId.slice(0, 8)}</span>
                                <span className="text-gray-600"> · </span>
                                <span>{modulesCell(t, a.modulesUsed)}</span>
                                <span className="text-gray-600"> · </span>
                                <span>
                                  {a.engagementScore}/{PLATFORM_REPORT_MODULE_COUNT}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-white">{t("athletesHeading", { count: filteredAthletes.length })}</h3>
              <div className="flex gap-2">
                <Pro2Button
                  type="button"
                  variant={athleteFilter === "low" ? "primary" : "secondary"}
                  className="px-3 py-1.5 text-xs"
                  onClick={() => setAthleteFilter("low")}
                >
                  {t("filterLow")}
                </Pro2Button>
                <Pro2Button
                  type="button"
                  variant={athleteFilter === "all" ? "primary" : "secondary"}
                  className="px-3 py-1.5 text-xs"
                  onClick={() => setAthleteFilter("all")}
                >
                  {t("filterAll")}
                </Pro2Button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/25">
              <table className="min-w-full text-left text-sm text-gray-300">
                <thead className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3">{t("thAthlete")}</th>
                    <th className="px-4 py-3">{t("thAccount")}</th>
                    <th className="px-4 py-3">{t("thCoaches")}</th>
                    <th className="px-4 py-3">{t("thModules")}</th>
                    <th className="px-4 py-3">{t("thScore")}</th>
                    <th className="px-4 py-3">{t("thLastSignIn")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAthletes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        {t("emptyAthletes")}
                      </td>
                    </tr>
                  ) : (
                    filteredAthletes.slice(0, 150).map((a) => (
                      <tr key={a.athleteId} className="border-b border-white/5 last:border-0">
                        <td className="px-4 py-2 text-gray-200">
                          {a.displayName ?? a.email ?? a.athleteId.slice(0, 8)}
                        </td>
                        <td className="px-4 py-2 text-gray-400">{a.accountEmail ?? "—"}</td>
                        <td className="max-w-xs px-4 py-2 text-xs text-gray-400">
                          {linkedCoachesCell(t, a.linkedCoaches)}
                        </td>
                        <td className="max-w-xs px-4 py-2 text-xs text-gray-400">{modulesCell(t, a.modulesUsed)}</td>
                        <td className="px-4 py-2">
                          <span
                            className={
                              a.engagementScore === 0
                                ? "rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-200"
                                : "rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-200"
                            }
                          >
                            {a.engagementScore}/{PLATFORM_REPORT_MODULE_COUNT}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-gray-500">{formatShortDate(a.lastSignInAt, locale)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {filteredAthletes.length > 150 ? (
                <p className="px-4 py-2 text-xs text-gray-500">{t("athletesTruncated", { count: 150 })}</p>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
