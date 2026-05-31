"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Camera, CheckCircle2, Clock3, UploadCloud } from "lucide-react";
import type {
  BiomechanicsCameraPlane,
  BiomechanicsCaptureJobV1,
  BiomechanicsCaptureSource,
  BiomechanicsDiscipline,
  BiomechanicsSessionImportV1,
} from "@empathy/contracts";
import { GenerativeModuleSubnav } from "@/components/navigation/GenerativeModuleSubnav";
import { Pro2AthleteRequiredGate } from "@/components/shell/Pro2AthleteRequiredGate";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { Pro2Button, Pro2Link } from "@/components/ui/empathy";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import {
  fetchBiomechanicsSessions,
  importBiomechanicsOpenCapSession,
  processBiomechanicsCaptureJob,
  uploadBiomechanicsCapture,
} from "@/modules/biomechanics/services/biomechanics-module-api";

const DISCIPLINE_OPTIONS: Array<{ value: BiomechanicsDiscipline; label: string }> = [
  { value: "cycling", label: "Cycling" },
  { value: "running", label: "Running" },
  { value: "walking", label: "Walking" },
  { value: "gym", label: "Gym" },
  { value: "movement_screening", label: "Movement screening" },
];

const CAMERA_OPTIONS: Array<{ value: BiomechanicsCameraPlane; label: string }> = [
  { value: "side", label: "Laterale" },
  { value: "front", label: "Frontale" },
  { value: "rear", label: "Posteriore" },
  { value: "oblique", label: "Obliqua" },
  { value: "multi_view", label: "Multi-view" },
];

function statusLabel(job: BiomechanicsCaptureJobV1): string {
  switch (job.status) {
    case "pending":
      return "In coda";
    case "processing":
      return "In elaborazione";
    case "completed":
      return "Completato";
    case "failed":
      return "Fallito";
    case "cancelled":
      return "Annullato";
  }
}

function formatDateTime(value: string | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" });
}

function LatestJobCard({ job }: { job: BiomechanicsCaptureJobV1 | null }) {
  if (!job) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-gray-500">Ultimo job</p>
        <p className="mt-2 text-sm text-gray-300">Nessuna cattura Biomechanics ancora caricata.</p>
      </div>
    );
  }
  const Icon = job.status === "failed" ? AlertTriangle : job.status === "completed" ? CheckCircle2 : Clock3;
  return (
    <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-emerald-200" />
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-emerald-200">Ultimo job</p>
      </div>
      <p className="mt-2 text-lg font-semibold text-white">{statusLabel(job)}</p>
      <p className="mt-1 text-xs text-gray-400">
        {job.discipline} · {job.cameraPlane} · {formatDateTime(job.createdAt)}
      </p>
      {job.errorMessage ? <p className="mt-2 text-xs text-rose-200">{job.errorMessage}</p> : null}
    </div>
  );
}

function SessionList({ sessions }: { sessions: BiomechanicsSessionImportV1[] }) {
  if (!sessions.length) {
    return (
      <p className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
        Nessuna sessione confermata. Elabora un job pending, valida la proposta CV, poi conferma per alimentare il twin.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {sessions.slice(0, 5).map((session) => (
        <div key={session.id} className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
          <p className="text-sm font-semibold text-white">{session.discipline}</p>
          <p className="mt-1 text-xs text-gray-400">
            {formatDateTime(session.recordedAt)} · {session.source}
          </p>
          {session.efficiencyScores ? (
            <p className="nutrition-muted mt-2 mb-0 text-[0.72rem]">
              Efficienza {Math.round(session.efficiencyScores.biomechanicalEfficiency01 * 100)}% · simmetria{" "}
              {Math.round(session.efficiencyScores.symmetry01 * 100)}% · rischio{" "}
              {Math.round(session.efficiencyScores.injuryRisk01 * 100)}%
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export default function BiomechanicsPageView() {
  const { athleteId, loading: athleteLoading } = useActiveAthlete();
  const [discipline, setDiscipline] = useState<BiomechanicsDiscipline>("cycling");
  const [cameraPlane, setCameraPlane] = useState<BiomechanicsCameraPlane>("side");
  const [file, setFile] = useState<File | null>(null);
  const [sessions, setSessions] = useState<BiomechanicsSessionImportV1[]>([]);
  const [captureJobs, setCaptureJobs] = useState<BiomechanicsCaptureJobV1[]>([]);
  const [pendingStaging, setPendingStaging] = useState<Array<{ id: string; jobId: string | null }>>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [processingJobId, setProcessingJobId] = useState<string | null>(null);
  const [openCapSessionId, setOpenCapSessionId] = useState("");
  const [importingOpenCap, setImportingOpenCap] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const latestJob = captureJobs[0] ?? null;
  const source: BiomechanicsCaptureSource = file?.type.startsWith("image/") ? "image" : "smartphone_video";

  const refresh = useCallback(async () => {
    if (!athleteId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchBiomechanicsSessions(athleteId);
      setSessions(result.sessions);
      setCaptureJobs(result.captureJobs);
      setPendingStaging(result.pendingStaging.map((row) => ({ id: row.id, jobId: row.jobId })));
      if (result.error) setError(result.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Biomechanics non disponibile.");
    } finally {
      setLoading(false);
    }
  }, [athleteId]);

  useEffect(() => {
    if (athleteLoading || !athleteId) return;
    void refresh();
  }, [athleteId, athleteLoading, refresh]);

  const captureCountLabel = useMemo(() => {
    const pending = captureJobs.filter((job) => job.status === "pending" || job.status === "processing").length;
    return `${captureJobs.length} job · ${pending} attivi`;
  }, [captureJobs]);

  const latestEfficiency = sessions[0]?.efficiencyScores ?? null;

  async function onProcessJob(jobId: string) {
    if (!athleteId || processingJobId) return;
    setProcessingJobId(jobId);
    setError(null);
    setMessage(null);
    try {
      const out = await processBiomechanicsCaptureJob({ athleteId, jobId });
      if (!out.ok) {
        setError(out.message || out.error || "Elaborazione fallita.");
        return;
      }
      if (out.stagingRunId) {
        setMessage(`Proposta CV pronta — apri review per confermare.`);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Elaborazione fallita.");
    } finally {
      setProcessingJobId(null);
    }
  }

  async function onUpload() {
    if (!athleteId || !file || uploading) return;
    setUploading(true);
    setError(null);
    setMessage(null);
    try {
      const out = await uploadBiomechanicsCapture({
        athleteId,
        file,
        discipline,
        cameraPlane,
        source,
      });
      setMessage(`Capture job creato: ${out.job.id.slice(0, 8)}...`);
      setFile(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload Biomechanics fallito.");
    } finally {
      setUploading(false);
    }
  }

  async function onImportOpenCap() {
    if (!athleteId || !openCapSessionId.trim() || importingOpenCap) return;
    setImportingOpenCap(true);
    setError(null);
    setMessage(null);
    try {
      const out = await importBiomechanicsOpenCapSession({
        athleteId,
        externalSessionId: openCapSessionId.trim(),
        discipline,
      });
      if (!out.ok) {
        setError(out.message || out.error || "Import OpenCap fallito.");
        return;
      }
      setMessage("Sessione OpenCap in review — conferma per promuovere al twin.");
      setOpenCapSessionId("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import OpenCap fallito.");
    } finally {
      setImportingOpenCap(false);
    }
  }

  return (
    <Pro2AthleteRequiredGate enabled>
      <Pro2ModulePageShell
        eyebrow="Biomechanics Engine · Capture"
        eyebrowClassName="text-emerald-300"
        title="Biomechanics"
        description="Cattura media → CV esterno → review atleta/coach → motore deterministico → twin biomeccanico."
        headerActions={
          <>
            <Pro2Link href="/training" variant="secondary" className="justify-center border border-sky-500/35 bg-sky-500/10">
              Training
            </Pro2Link>
            <Pro2Link href="/physiology" variant="ghost" className="justify-center border border-emerald-500/35 bg-emerald-500/10">
              Physiology
            </Pro2Link>
          </>
        }
      >
        <div className="scroll-mt-28">
          <GenerativeModuleSubnav />
        </div>

        <section id="gen-domain" className="scroll-mt-28">
          <Pro2SectionCard
            accent="emerald"
            icon={Camera}
            title="Capture line"
            subtitle="Upload firmato su Storage privato, poi job canonico in biomech_capture_jobs."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <LatestJobCard job={latestJob} />
              <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.06] p-4">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-cyan-200">Archivio capture</p>
                <p className="mt-2 text-lg font-semibold text-white">{captureCountLabel}</p>
                <p className="mt-1 text-xs text-gray-400">Job più recenti, scoped su atleta attivo.</p>
              </div>
              <div className="rounded-2xl border border-fuchsia-500/25 bg-fuchsia-500/[0.06] p-4">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-fuchsia-200">Report confermato</p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {latestEfficiency ? `${Math.round(latestEfficiency.biomechanicalEfficiency01 * 100)}%` : "—"}
                </p>
                <p className="mt-1 text-xs text-gray-400">Efficienza biomeccanica (domain engine).</p>
              </div>
            </div>
            {pendingStaging.length ? (
              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                {pendingStaging.length} review CV in attesa —{" "}
                <Link href={`/biomechanics/staging/${pendingStaging[0]!.id}`} className="underline">
                  apri validazione
                </Link>
              </div>
            ) : null}
            {latestJob?.status === "pending" ? (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Pro2Button
                  variant="secondary"
                  onClick={() => onProcessJob(latestJob.id)}
                  disabled={processingJobId != null}
                  className="justify-center"
                >
                  {processingJobId === latestJob.id ? "Elaborazione CV..." : "Elabora ultimo job"}
                </Pro2Button>
              </div>
            ) : null}
          </Pro2SectionCard>
        </section>

        <section id="gen-body" className="scroll-mt-28">
          <Pro2SectionCard
            accent="cyan"
            icon={UploadCloud}
            title="Nuova cattura"
            subtitle="File supportati: MP4, MOV, JPEG, PNG, WEBP. La pagina non analizza il video: crea solo il job canonico."
          >
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
              <label className="space-y-2 text-sm text-gray-300">
                <span className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Disciplina</span>
                <select
                  value={discipline}
                  onChange={(e) => setDiscipline(e.currentTarget.value as BiomechanicsDiscipline)}
                  className="w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-white"
                >
                  {DISCIPLINE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-gray-300">
                <span className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Camera</span>
                <select
                  value={cameraPlane}
                  onChange={(e) => setCameraPlane(e.currentTarget.value as BiomechanicsCameraPlane)}
                  className="w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-white"
                >
                  {CAMERA_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-gray-300 lg:min-w-72">
                <span className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Media</span>
                <input
                  type="file"
                  accept="video/mp4,video/quicktime,image/jpeg,image/png,image/webp"
                  onChange={(e) => setFile(e.currentTarget.files?.[0] ?? null)}
                  className="block w-full text-xs text-gray-300 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-500/20 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-emerald-100"
                />
              </label>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Pro2Button onClick={onUpload} disabled={!file || uploading || !athleteId} className="justify-center">
                {uploading ? "Caricamento..." : "Crea capture job"}
              </Pro2Button>
              {file ? <p className="text-xs text-gray-400">{file.name} · {(file.size / 1_000_000).toFixed(1)} MB</p> : null}
            </div>
            {message ? <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{message}</p> : null}
            {error ? <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}
          </Pro2SectionCard>
        </section>

        <section className="scroll-mt-28">
          <Pro2SectionCard
            accent="fuchsia"
            icon={Camera}
            title="Import OpenCap"
            subtitle="Session UUID da app.opencap.ai → sidecar OPENCAP_API_BASE_URL → stesso staging/review."
          >
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-[16rem] flex-1 space-y-2 text-sm text-gray-300">
                <span className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Session ID</span>
                <input
                  value={openCapSessionId}
                  onChange={(e) => setOpenCapSessionId(e.currentTarget.value)}
                  placeholder="7272a71a-e70a-4794-a253-39e11cb7542c"
                  className="w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-white"
                />
              </label>
              <Pro2Button
                variant="secondary"
                onClick={onImportOpenCap}
                disabled={!openCapSessionId.trim() || importingOpenCap || !athleteId}
                className="justify-center"
              >
                {importingOpenCap ? "Import..." : "Importa OpenCap"}
              </Pro2Button>
            </div>
          </Pro2SectionCard>
        </section>

        <section id="gen-cross" className="scroll-mt-28">
          <Pro2SectionCard
            accent="violet"
            icon={Activity}
            title="Sessioni e twin readiness"
            subtitle="Qui compaiono le sessioni confermate dopo review CV e motore deterministico."
          >
            {loading ? <p className="text-sm text-gray-400">Caricamento archivio Biomechanics...</p> : <SessionList sessions={sessions} />}
          </Pro2SectionCard>
        </section>

        <section id="gen-focus" className="scroll-mt-28">
          <Pro2SectionCard
            accent="amber"
            icon={AlertTriangle}
            title="Guardrail generativo"
            subtitle="La pagina non calcola angoli, rischi o score: quelli arrivano solo dal domain engine dopo validazione."
          >
            <p className="text-sm leading-relaxed text-gray-300">
              I numeri canonici (efficienza, simmetria, rischio) provengono solo da{" "}
              <code className="text-gray-100">@empathy/domain-biomechanics</code> dopo conferma staging. Il CV esterno
              propone landmark/angoli; atleta e coach validano prima della promozione a twin.
            </p>
          </Pro2SectionCard>
        </section>
      </Pro2ModulePageShell>
    </Pro2AthleteRequiredGate>
  );
}
