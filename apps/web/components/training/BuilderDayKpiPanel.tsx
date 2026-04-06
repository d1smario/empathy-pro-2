"use client";

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds || 0));
  const totalMinutes = Math.round(safe / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export type BuilderDayKpiItem = {
  label: string;
  durationSec: number;
  tss: number;
  kcal: number;
  kj: number;
  avgPowerW: number;
};

export function BuilderDayKpiPanel({
  discipline,
  sessionName,
  items,
}: {
  discipline: string;
  sessionName: string;
  items: BuilderDayKpiItem[];
}) {
  const safeItems = items.slice(0, 2);
  const totalDuration = safeItems.reduce((sum, item) => sum + Math.max(0, item.durationSec || 0), 0);
  const totalTss = safeItems.reduce((sum, item) => sum + Math.max(0, item.tss || 0), 0);
  const totalKcal = safeItems.reduce((sum, item) => sum + Math.max(0, item.kcal || 0), 0);
  const totalKj = safeItems.reduce((sum, item) => sum + Math.max(0, item.kj || 0), 0);
  const weightedAvgPower =
    totalDuration > 0
      ? Math.round(
          safeItems.reduce((sum, item) => sum + Math.max(0, item.avgPowerW || 0) * Math.max(0, item.durationSec || 0), 0) /
            totalDuration,
        )
      : 0;
  const training1 = safeItems[0] ?? null;
  const training2 = safeItems[1] ?? null;

  return (
    <section className="viz-card builder-panel" style={{ marginTop: "12px" }}>
      <h3 className="viz-title">KPI sessione</h3>
      <div className="builder-kpi-grid">
        <div className="builder-kpi-card">
          <div className="kpi-card-label">Durata day</div>
          <div className="kpi-card-value">{formatDuration(totalDuration)}</div>
        </div>
        <div className="builder-kpi-card">
          <div className="kpi-card-label">TSS day</div>
          <div className="kpi-card-value">{totalTss}</div>
        </div>
        <div className="builder-kpi-card">
          <div className="kpi-card-label">kcal day</div>
          <div className="kpi-card-value">{totalKcal || "-"}</div>
        </div>
        <div className="builder-kpi-card">
          <div className="kpi-card-label">kJ day</div>
          <div className="kpi-card-value">{totalKj || "-"}</div>
        </div>
        <div className="builder-kpi-card">
          <div className="kpi-card-label">W medi day</div>
          <div className="kpi-card-value">{weightedAvgPower || "-"}</div>
        </div>
        <div className="builder-kpi-card">
          <div className="kpi-card-label">Disciplina</div>
          <div className="kpi-card-value">{discipline || "-"}</div>
        </div>
        <div className="builder-kpi-card">
          <div className="kpi-card-label">Sessione</div>
          <div className="kpi-card-value">{sessionName || "-"}</div>
        </div>
        <div className="builder-kpi-card">
          <div className="kpi-card-label">Training 1</div>
          <div className="kpi-card-value">
            {training1 ? `${formatDuration(training1.durationSec)} · TSS ${training1.tss} · ${training1.kj} kJ` : "-"}
          </div>
        </div>
        <div className="builder-kpi-card">
          <div className="kpi-card-label">Training 2</div>
          <div className="kpi-card-value">
            {training2 ? `${formatDuration(training2.durationSec)} · TSS ${training2.tss} · ${training2.kj} kJ` : "-"}
          </div>
        </div>
      </div>
    </section>
  );
}
