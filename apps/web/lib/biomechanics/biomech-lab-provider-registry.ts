import type { BiomechanicsCaptureSource } from "@empathy/contracts";

export type BiomechLabProviderId = "generic_cv" | "opencap" | "lab_file";

export type BiomechLabProviderDescriptor = {
  id: BiomechLabProviderId;
  label: string;
  inputMode: "video_url" | "external_session_id" | "lab_file";
  captureSource: BiomechanicsCaptureSource;
  notes?: string;
};

export const BIOMECH_LAB_PROVIDER_REGISTRY: Record<BiomechLabProviderId, BiomechLabProviderDescriptor> = {
  generic_cv: {
    id: "generic_cv",
    label: "Generic pose CV",
    inputMode: "video_url",
    captureSource: "smartphone_video",
    notes: "BIOMECH_POSE_CV_API_URL HTTP adapter.",
  },
  opencap: {
    id: "opencap",
    label: "OpenCap",
    inputMode: "external_session_id",
    captureSource: "external_pose_import",
    notes: "OpenCap session UUID via OPENCAP sidecar.",
  },
  lab_file: {
    id: "lab_file",
    label: "Lab file import",
    inputMode: "lab_file",
    captureSource: "external_pose_import",
    notes: "MOT/TRC/C3D — phase 3.",
  },
};

export function resolveBiomechLabProvider(raw: string | null | undefined): BiomechLabProviderId {
  const value = raw?.trim();
  if (value && value in BIOMECH_LAB_PROVIDER_REGISTRY) {
    return value as BiomechLabProviderId;
  }
  return "generic_cv";
}

export function getBiomechLabProviderDescriptor(id: BiomechLabProviderId): BiomechLabProviderDescriptor {
  return BIOMECH_LAB_PROVIDER_REGISTRY[id];
}
