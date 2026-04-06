import type { KnowledgeResearchTraceSummary } from "@/api/knowledge/contracts";

function pluralize(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function traceFocus(trace: KnowledgeResearchTraceSummary) {
  return (
    trace.trigger.stimulusLabel ??
    trace.trigger.entityLabel ??
    trace.trigger.adaptationTarget?.replaceAll("_", " ") ??
    "stimolo canonico"
  );
}

export function ResearchTraceStatusSummary({
  traces,
  label = "Research trace",
  className,
}: {
  traces: KnowledgeResearchTraceSummary[];
  label?: string;
  className?: string;
}) {
  if (!traces.length) return null;

  const totals = traces.reduce(
    (acc, trace) => {
      acc.totalHops += trace.hopCounts.total;
      acc.completeHops += trace.hopCounts.complete;
      acc.documents += trace.linkCounts.documents;
      acc.assertions += trace.linkCounts.assertions;
      return acc;
    },
    { totalHops: 0, completeHops: 0, documents: 0, assertions: 0 },
  );
  const latest = traces[0];

  return (
    <small className={`text-slate-500 ${className ?? ""}`.trim()}>
      {label}: {pluralize(traces.length, "traccia canonica", "tracce canoniche")} ·{" "}
      {totals.completeHops}/{Math.max(1, totals.totalHops)} hop completati ·{" "}
      {pluralize(totals.documents, "documento", "documenti")} ·{" "}
      {pluralize(totals.assertions, "assertion", "assertion")} · focus {traceFocus(latest)}.
    </small>
  );
}
