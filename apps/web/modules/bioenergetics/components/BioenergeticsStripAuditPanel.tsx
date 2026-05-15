"use client";

import type { BioenergeticMonitoringStripAuditV1 } from "@/api/bioenergetics/contracts";

type Props = {
  audit: BioenergeticMonitoringStripAuditV1;
};

/**
 * Pannello tecnico da `GET /api/bioenergetics/day?stripAudit=1` — controlli input → curve striscia.
 */
export function BioenergeticsStripAuditPanel({ audit }: Props) {
  return (
    <div className="space-y-4 rounded-2xl border border-violet-500/30 bg-violet-950/20 p-4">
      <div>
        <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-wider text-violet-200">
          Controlli striscia (audit v{audit.auditContractVersion})
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Layer renderizzato: <span className="text-gray-200">{audit.stripLayerRendered}</span> · verifica coerenza motori
          senza ricalcolo curve.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <AuditStat label="CHO giorno (g)" value={String(Math.round(audit.diaryAndTraining.choIntakeGramsDay))} />
        <AuditStat label="Pasti con macro" value={String(audit.diaryAndTraining.mealsWithMacroSignals)} />
        <AuditStat label="Sedute eseguite" value={String(audit.diaryAndTraining.executedWorkoutCount)} />
        <AuditStat label="TSS eseguito" value={String(Math.round(audit.diaryAndTraining.executedTssSum))} />
        <AuditStat label="Campioni glicemia (055)" value={String(audit.channelsSource.glucoseSamples055)} />
        <AuditStat label="Campioni lattato (055)" value={String(audit.channelsSource.lactateSamples055)} />
        <AuditStat
          label="Provenienza glu / lac"
          value={`${audit.channelsSource.glucoseProvenance} / ${audit.channelsSource.lactateProvenance}`}
        />
        <AuditStat
          label="Carico post-prandiale (01)"
          value={String(Math.round(audit.cortisolActhModulation.postprandialMealLoad01 * 100) / 100)}
        />
        <AuditStat
          label="Ora picco glicemico pasti"
          value={`${String(audit.timelineDigest.mealGlycemicMaxHour).padStart(2, "0")}:00`}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/30">
        <table className="min-w-full text-left text-xs text-gray-300">
          <thead className="border-b border-white/10 text-[0.65rem] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">Canale</th>
              <th className="px-3 py-2">Piano</th>
              <th className="px-3 py-2">Ore valorizzate</th>
              <th className="px-3 py-2">Min–max</th>
              <th className="px-3 py-2">Stream</th>
              <th className="px-3 py-2">Fusione</th>
            </tr>
          </thead>
          <tbody>
            {audit.stripChannels.map((ch) => (
              <tr key={ch.id} className="border-b border-white/5 align-top last:border-0">
                <td className="px-3 py-2 text-gray-100">
                  {ch.labelIt}
                  <span className="block text-[0.65rem] text-gray-500">{ch.unit}</span>
                </td>
                <td className="px-3 py-2 text-gray-400">{ch.dataPlane}</td>
                <td className="px-3 py-2">{ch.hourlyNonNullCount}/24</td>
                <td className="px-3 py-2">
                  {ch.hourlyMin != null && ch.hourlyMax != null ? `${ch.hourlyMin} – ${ch.hourlyMax}` : "—"}
                </td>
                <td className="px-3 py-2">{ch.streamPointCount}</td>
                <td className="max-w-xs px-3 py-2 text-[0.65rem] leading-snug text-gray-500">
                  {ch.curveResolutionNote ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-1 text-[0.7rem] leading-relaxed text-gray-500">
        {audit.engineRefsIt.map((line) => (
          <li key={line.slice(0, 48)}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

function AuditStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
      <p className="text-[0.6rem] uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-white">{value}</p>
    </div>
  );
}
