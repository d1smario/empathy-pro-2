# EMPATHY Digital Athlete Lab — Biomechanics & Aerodynamics Blueprint v1

This document converts the Biomechanics Engine and Aerodynamics Engine vision into a Pro 2 implementation blueprint.
It is a technical boundary document, not a marketing page.

## Position In The EMPATHY Graph

Biomechanics and Aerodynamics extend the Digital Athlete Twin without replacing existing engines.

```text
Reality media
  -> ingest adapter
  -> CV/AI staging
  -> user/coach validation
  -> deterministic domain engine
  -> athlete memory / twin snapshot
  -> product report and cross-module modulation
```

Hard invariants:

- `athlete_id` is the canonical subject key.
- CV/AI extracts pose, mesh, geometry, equipment context, and structured proposals.
- Domain engines compute canonical metrics, scores, deltas, and flags.
- Reports may interpret and explain, but cannot invent canonical numbers.
- Training remains Builder/VIRYA centered. These modules modulate constraints and context; they do not generate parallel sessions.

## Biomechanics Engine

### Goal

Reconstruct human movement from smartphone, GoPro, image, and structured import sources, then derive a validated biomechanical profile.

Supported scopes:

- cycling
- running
- walking
- gym movement screening

### Canonical Flow

1. Capture upload: frontal, lateral, posterior video or still images.
2. Media storage: private `biomech-capture` bucket.
3. Capture job: `biomech_capture_jobs`.
4. CV/pose staging: MediaPipe, MoveNet, YOLO, OpenCV, or external pose service output is staged, not treated as final truth.
5. Calibration: known scale reference such as saddle height, wheel diameter, athlete height, or frame component.
6. Confirmed import: `biomech_session_imports`.
7. Deterministic engine: joint angles, asymmetry, movement quality, risk flags, and scores.
8. Twin projection: latest confirmed snapshot made available to AthleteMemory.

### Domain Outputs

Core measurements:

- anthropometric segments: femur, tibia, torso, humerus, forearm
- joint angles: hip, knee, ankle, shoulder, elbow, back
- movement metrics: pelvic stability, knee tracking, ankle dynamics, stride symmetry, ROM
- risk scores: knee, hip, lumbar, achilles, cervical
- efficiency scores: biomechanical efficiency, movement quality, symmetry, injury risk

### Database Boundary

Existing migrations are the current Pro 2 base:

- `supabase/migrations/020_biomech_session_imports_and_capture_jobs_v1.sql`
- `supabase/migrations/021_biomech_capture_storage_bucket_v1.sql`

Do not add a second biomechanical memory table unless the API/UI flow requires a versioned profile snapshot migration. Existing imports and capture jobs are the canonical starting line.

## Aerodynamics Engine

### Goal

Estimate cyclist aerodynamic posture and equipment impact from video/images and validated athlete/bike context, without presenting real-time CFD as product truth.

Supported scopes:

- side/front/360-degree media
- cyclist + bike geometry
- position optimization
- equipment deltas

### Canonical Flow

1. Capture upload: side, front, 360-degree video or still images.
2. 3D/geometry staging: SMPL-X, Open3D, Gaussian Splatting, NeRF, or surrogate reconstruction output is staged.
3. Bike/equipment recognition: frame, wheels, cockpit, helmet, bottles, clothing.
4. Geometry engine: frontal area, projected area, wetted-area proxy, body volume proxy.
5. Deterministic/surrogate aero engine: CdA, drag, watt savings, time savings, confidence.
6. Optimization engine: virtual position/equipment candidates with bounded deltas.
7. Twin projection: latest confirmed aerodynamic baseline and history.

### Domain Outputs

Core measurements:

- current CdA and confidence
- optimized CdA prediction and bounded delta
- drag at reference speed
- watt savings and time savings
- position score, equipment score, aero efficiency score
- equipment recommendation deltas

### Database Boundary

Aerodynamics does not yet have a Pro 2 migration. The first migration should land only with contracts and API usage in the same patch series:

- aero test sessions
- aero capture jobs
- private capture bucket
- RLS scoped to athlete/coach
- payloads linked to domain contract version

## Human Efficiency Engine

Human Efficiency is a downstream composition layer, not a third ingest line.

Inputs:

- metabolic/bioenergetic state
- biomechanical profile snapshot
- aerodynamic profile snapshot

Output:

- physiological efficiency
- mechanical efficiency
- aerodynamic efficiency
- global Human Efficiency Score

This layer must consume confirmed snapshots and deterministic domain outputs only.

## Implementation Order

1. Contracts for biomechanical and aerodynamic capture/report shapes.
2. `@empathy/domain-biomechanics` with deterministic fixture-tested metrics.
3. Biomechanics pipeline and API on existing schema/bucket.
4. Aerodynamics contracts, migration, and deterministic domain package.
5. Module pages and premium gating.
6. Twin/memory resolver integration and cross-module read projections.

## Non-Negotiable Guardrails

- No duplicate generative routes or shadow memory stores.
- No page-local state as canonical source.
- No AI-generated scores written directly to the twin.
- No runtime imports from V1; port contracts and logic into this repo.
- Module failure must render local fallback states, not global redirects.
