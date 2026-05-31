# Biomechanics & Aerodynamics — CV adapter HTTP contract

External pose/geometry services integrate via thin HTTP adapters in `apps/web/lib/biomechanics/biomech-pose-cv-adapter.ts` and `apps/web/lib/aerodynamics/aero-geometry-cv-adapter.ts`.

## Environment (append to `apps/web/.env.local` manually)

```env
BIOMECH_POSE_CV_API_URL=https://your-pose-service.example/v1/extract
BIOMECH_POSE_CV_API_KEY=
AERO_GEOMETRY_CV_API_URL=https://your-aero-service.example/v1/extract
AERO_GEOMETRY_CV_API_KEY=
```

Optional: `BIOMECH_POSE_CV_TIMEOUT_MS` (default 120000), `AERO_GEOMETRY_CV_TIMEOUT_MS` (default 120000).

## Biomechanics — POST request

```json
{
  "version": "pose_request_v1",
  "athleteId": "uuid",
  "discipline": "cycling",
  "cameraPlane": "side",
  "contentType": "video/mp4",
  "mediaDownloadUrl": "https://signed-url..."
}
```

## Biomechanics — response (`pose_proposal_v1`)

```json
{
  "version": "pose_proposal_v1",
  "confidence01": 0.82,
  "provider": "example-pose-v1",
  "model": "optional-model-id",
  "landmarks": [{ "name": "knee_left", "xMm": 0, "yMm": 0, "confidence01": 0.9 }],
  "jointAngles": [{ "joint": "knee", "side": "left", "angleDeg": 142, "confidence01": 0.85 }],
  "movementPatterns": { "pelvicStability01": 0.8, "kneeTracking01": 0.7 },
  "riskScores": { "kneeRisk01": 0.2 }
}
```

Errors: HTTP non-2xx or body `{ "error": "provider_unavailable" | "media_unreadable" | "low_confidence" }`.

## Aerodynamics — POST request

```json
{
  "version": "geometry_request_v1",
  "athleteId": "uuid",
  "cameraMode": "side",
  "contentType": "image/jpeg",
  "mediaDownloadUrl": "https://signed-url..."
}
```

## Aerodynamics — response (`geometry_proposal_v1`)

```json
{
  "version": "geometry_proposal_v1",
  "confidence01": 0.75,
  "provider": "example-aero-v1",
  "position": { "torsoAngleDeg": 12, "headDropMm": 45 },
  "geometry": { "frontalAreaM2": 0.38, "projectedAreaM2": 0.32 },
  "equipment": { "helmet": "aero", "wheels": "disc" },
  "cdaSurrogateM2": 0.31
}
```

Canonical CdA/drag/scores are computed only by `@empathy/domain-aerodynamics` on apply.

## Aerodynamics — scenario compare (`aero_scenario_compare_v1`)

After geometry CV, `@empathy/domain-aerodynamics` builds a bounded position scenario matrix (surrogate, AiRO-like UX). Staging patch key: `proposed_structured_patches.aeroScenarioCompare`. Apply accepts `selectedScenarioId`.

## OpenCap import (`opencap_import_v1`)

Sidecar HTTP at `OPENCAP_API_BASE_URL/v1/session/import`:

```json
{
  "version": "opencap_import_v1",
  "sessionId": "uuid-from-app.opencap.ai",
  "athleteId": "uuid",
  "discipline": "running"
}
```

Response: `{ "poseProposal": { ... pose_proposal_v1 } }` **or** `{ "motText": "..." }` (OpenSim `.mot` parsed by `opencap-mot-mapper.ts`).

Provider registry: `apps/web/lib/biomechanics/biomech-lab-provider-registry.ts` (`generic_cv`, `opencap`, `lab_file`).
