"use client";

import type { Pro2BuilderBlockContract, Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";

type StoredChartBlock = NonNullable<NonNullable<Pro2BuilderBlockContract["chart"]>> & {
  id: string;
  name: string;
  kind: string;
};

type Segment = {
  label: string;
  intensity: string;
  seconds: number;
  sourceBlockId: string;
  targetValue?: number;
};

function intensityScore(intensity: string): number {
  const map: Record<string, number> = {
    Z1: 1,
    Z2: 2,
    Z3: 3,
    Z4: 4,
    Z5: 5,
    Z6: 6,
    Z7: 7,
    LT1: 3,
    LT2: 4,
    FatMax: 2,
  };
  return map[intensity] ?? 3;
}

function colorForIntensity(intensity: string): string {
  const map: Record<string, string> = {
    Z1: "#00c2ff",
    Z2: "#00e08d",
    Z3: "#b6ff35",
    Z4: "#ffd60a",
    Z5: "#ff9e00",
    Z6: "#ff5d5d",
    Z7: "#ff00a8",
    LT1: "#61f4ff",
    LT2: "#ffd60a",
    FatMax: "#8affd1",
  };
  return map[intensity] ?? "#00e08d";
}

function intensityToRelativeLoad(intensity: string): number {
  const map: Record<string, number> = {
    Z1: 0.55,
    Z2: 0.68,
    Z3: 0.8,
    Z4: 0.92,
    Z5: 1.02,
    Z6: 1.1,
    Z7: 1.18,
    LT1: 0.78,
    LT2: 0.94,
    FatMax: 0.64,
  };
  return map[intensity] ?? 0.8;
}

function intensityTargetLabel(intensity: string, unit: "watt" | "hr", ftpW: number, hrMax: number): string {
  const rel = intensityToRelativeLoad(intensity);
  if (unit === "watt") return `${Math.max(1, Math.round(ftpW * rel))} W`;
  return `${Math.max(1, Math.round(hrMax * Math.min(rel, 1.02)))} bpm`;
}

function zoneForTargetValue(value: number, unit: "watt" | "hr", ftpW: number, hrMax: number): string {
  const rel = unit === "watt" ? value / Math.max(1, ftpW) : value / Math.max(1, hrMax);
  if (rel < 0.6) return "Z1";
  if (rel < 0.74) return "Z2";
  if (rel < 0.86) return "Z3";
  if (rel < 0.98) return "Z4";
  if (rel < 1.08) return "Z5";
  if (rel < 1.15) return "Z6";
  return "Z7";
}

function resolveBlockDurationSeconds(block: StoredChartBlock, lengthMode: "time" | "distance", speedRefKmh: number): number {
  if (lengthMode === "distance" && (block.kind === "steady" || block.kind === "ramp" || block.kind === "pyramid")) {
    const km = Math.max(0.1, block.distanceKm || 0);
    return Math.max(30, Math.round((km / Math.max(1, speedRefKmh)) * 3600));
  }
  return Math.max(30, block.minutes * 60 + block.seconds);
}

function expandBlockSegments(
  block: StoredChartBlock,
  opts: {
    unit: "watt" | "hr";
    ftpW: number;
    hrMax: number;
    lengthMode: "time" | "distance";
    speedRefKmh: number;
  },
): Segment[] {
  if (block.kind === "steady") {
    return [{ label: block.name, intensity: block.intensity, seconds: resolveBlockDurationSeconds(block, opts.lengthMode, opts.speedRefKmh), sourceBlockId: block.id }];
  }
  if (block.kind === "ramp") {
    return [{ label: `${block.name} ${block.startIntensity}->${block.endIntensity}`, intensity: block.endIntensity, seconds: resolveBlockDurationSeconds(block, opts.lengthMode, opts.speedRefKmh), sourceBlockId: block.id }];
  }
  if (block.kind === "pyramid") {
    const steps = Math.max(1, block.pyramidSteps || 1);
    const stepSeconds = Math.max(20, block.pyramidStepSeconds || 20);
    const start = block.pyramidStartTarget;
    const end = block.pyramidEndTarget;
    const stepDelta = (end - start) / steps;
    const out: Segment[] = [];
    for (let i = 0; i <= steps; i += 1) {
      const targetValue = Math.round((start + stepDelta * i) * 10) / 10;
      out.push({
        label: `${block.name} step ${i + 1}/${steps + 1}`,
        intensity: zoneForTargetValue(targetValue, opts.unit, opts.ftpW, opts.hrMax),
        seconds: stepSeconds,
        sourceBlockId: block.id,
        targetValue,
      });
    }
    return out;
  }
  if (block.kind === "interval2") {
    const reps = Math.max(1, block.repeats);
    const work = Math.max(10, block.workSeconds);
    const rec = Math.max(10, block.recoverSeconds);
    const out: Segment[] = [];
    for (let i = 0; i < reps; i += 1) {
      out.push({ label: `${block.name} work`, intensity: block.intensity, seconds: work, sourceBlockId: block.id });
      out.push({ label: `${block.name} rec`, intensity: block.intensity2, seconds: rec, sourceBlockId: block.id });
    }
    return out;
  }
  const reps = Math.max(1, block.repeats);
  const a = Math.max(10, block.step1Seconds);
  const b = Math.max(10, block.step2Seconds);
  const c = Math.max(10, block.step3Seconds);
  const out: Segment[] = [];
  for (let i = 0; i < reps; i += 1) {
    out.push({ label: `${block.name} A`, intensity: block.intensity, seconds: a, sourceBlockId: block.id });
    out.push({ label: `${block.name} B`, intensity: block.intensity2, seconds: b, sourceBlockId: block.id });
    out.push({ label: `${block.name} C`, intensity: block.intensity3, seconds: c, sourceBlockId: block.id });
  }
  return out;
}

export function BuilderPlannedSessionViz({
  contract,
  title = "Execution map",
  compact = false,
}: {
  contract: Pro2BuilderSessionContract | null | undefined;
  title?: string;
  compact?: boolean;
}) {
  const blocks = contract?.blocks ?? [];
  if (!blocks.length) return null;
  const renderProfile = contract?.renderProfile;
  const chartBlocks = blocks
    .map((block) => (block.chart ? { ...block.chart, id: block.id, name: block.label, kind: block.kind } : null))
    .filter((block): block is StoredChartBlock => block != null);
  if (!renderProfile || chartBlocks.length !== blocks.length) {
    return null;
  }

  const segments = chartBlocks.flatMap((block) =>
    expandBlockSegments(block, {
      unit: renderProfile.intensityUnit,
      ftpW: renderProfile.ftpW,
      hrMax: renderProfile.hrMax,
      lengthMode: renderProfile.lengthMode,
      speedRefKmh: renderProfile.speedRefKmh,
    }),
  );
  const total = Math.max(1, segments.reduce((s, x) => s + x.seconds, 0));
  let cursor = 0;
  let elapsed = 0;
  const axisLabel = renderProfile.intensityUnit === "watt" ? "Target (W)" : "Target FC (bpm)";

  return (
    <div className="builder-chart-shell" style={{ width: "100%" }}>
      <div className="builder-chart-title">
        {title} · Profilo blocchi ({renderProfile.intensityUnit === "watt" ? "Watt" : "Frequenza cardiaca"})
      </div>
      <svg
        viewBox="0 0 1000 250"
        className="builder-chart-svg"
        preserveAspectRatio="none"
        role="img"
        aria-label="Builder planned session timeline"
      >
        <rect x="0" y="0" width="1000" height="250" fill="rgba(255,255,255,0.02)" />
        <text x="8" y="16" fill="rgba(255,255,255,0.62)" fontSize="10">
          {axisLabel}
        </text>
        {[7, 6, 5, 4, 3, 2, 1].map((z) => {
          const y = 220 - (34 + z * 22);
          return (
            <g key={`tick-${z}`}>
              <line x1="0" x2="1000" y1={y} y2={y} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 4" />
              <text x="992" y={y - 2} textAnchor="end" fill="rgba(255,255,255,0.55)" fontSize="9">
                {renderProfile.intensityUnit === "watt"
                  ? `${Math.round(renderProfile.ftpW * intensityToRelativeLoad(`Z${z}`))}`
                  : `${Math.round(renderProfile.hrMax * Math.min(intensityToRelativeLoad(`Z${z}`), 1.02))}`}
              </text>
            </g>
          );
        })}
        {segments.map((segment, index) => {
          const width = Math.max(2, (segment.seconds / total) * 1000);
          const x = cursor;
          cursor += width;
          const continuousRel =
            segment.targetValue != null
              ? renderProfile.intensityUnit === "watt"
                ? segment.targetValue / Math.max(1, renderProfile.ftpW)
                : segment.targetValue / Math.max(1, renderProfile.hrMax)
              : null;
          const level = continuousRel != null ? 1 + Math.max(0, Math.min(7, continuousRel * 7)) : intensityScore(segment.intensity);
          const height = 34 + level * 22;
          const midX = x + Math.max(3, width / 2);
          elapsed += segment.seconds;
          const tMin = Math.round(elapsed / 60);
          return (
            <g key={`${segment.label}-${index}`}>
              <rect x={x} y={220 - height} width={Math.max(1, width - 1)} height={height} fill={colorForIntensity(segment.intensity)} opacity="0.94" />
              {width > 72 ? (
                <text x={midX} y={220 - height - 4} textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="10">
                  {segment.targetValue != null
                    ? `${Math.round(segment.targetValue)} ${renderProfile.intensityUnit === "watt" ? "W" : "bpm"}`
                    : intensityTargetLabel(segment.intensity, renderProfile.intensityUnit, renderProfile.ftpW, renderProfile.hrMax)}
                </text>
              ) : null}
              {width > 44 ? (
                <text x={midX} y={242} textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="9">
                  {tMin}m
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <div className="builder-zone-legend">
        {blocks.map((block, index) => (
          <span
            key={`legend-${block.id}`}
            className="builder-zone-chip"
            style={{
              borderColor: colorForIntensity(block.intensityCue?.split("/")[0]?.split("->").pop()?.trim() || "Z2"),
              color: colorForIntensity(block.intensityCue?.split("/")[0]?.split("->").pop()?.trim() || "Z2"),
              backgroundColor: `${colorForIntensity(block.intensityCue?.split("/")[0]?.split("->").pop()?.trim() || "Z2")}22`,
            }}
          >
            #{index + 1} {block.label} · {block.durationMinutes}m
          </span>
        ))}
      </div>
      {!compact ? (
        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          {blocks.map((block, index) => (
            <div
              key={`card-${block.id}`}
              style={{
                border: "1px solid rgba(255,255,255,0.12)",
                borderLeft: `3px solid ${colorForIntensity(block.intensityCue?.split("/")[0]?.split("->").pop()?.trim() || "Z2")}`,
                borderRadius: 8,
                padding: "10px 12px",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <div style={{ fontWeight: 700 }}>
                {index + 1}. {block.label}
              </div>
              <div className="session-sub-copy" style={{ marginBottom: 0 }}>
                {block.durationMinutes} min
                {block.kind ? ` · ${block.kind}` : ""}
                {block.target ? ` · target ${block.target}` : ""}
                {block.intensityCue ? ` · intensity ${block.intensityCue}` : ""}
              </div>
              {block.notes ? <div className="muted-copy" style={{ marginTop: 4 }}>{block.notes}</div> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
