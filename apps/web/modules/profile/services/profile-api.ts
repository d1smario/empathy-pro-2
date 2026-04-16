import type { ProfileViewModel } from "@/api/profile/contracts";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-auth";
import { coerceProfileViewModel } from "@/lib/profile/coerce-profile-view-model";

export async function fetchProfileViewModel(athleteId: string): Promise<ProfileViewModel & { error?: string | null }> {
  const response = await fetch(`/api/profile?athleteId=${encodeURIComponent(athleteId)}`, {
    method: "GET",
    cache: "no-store",
    credentials: "same-origin",
    headers: await buildSupabaseAuthHeaders({ "Content-Type": "application/json" }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    return {
      athleteId,
      profile: null,
      physiology: null,
      physiologyState: null,
      athleteMemory: null,
      activity: { daysActive: 0, dayStreak: 0 },
      error: payload.error ?? "Profile fetch failed",
    };
  }
  const json: unknown = await response.json().catch(() => null);
  return coerceProfileViewModel(json, athleteId);
}

export async function updateProfilePayload(athleteId: string, payload: Record<string, unknown>) {
  const response = await fetch("/api/profile", {
    method: "PUT",
    cache: "no-store",
    credentials: "same-origin",
    headers: await buildSupabaseAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ athleteId, payload }),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Profile update failed");
  }
  return response.json();
}

export async function createProfilePayload(payload: Record<string, unknown>) {
  const response = await fetch("/api/profile", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: await buildSupabaseAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ payload }),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Profile create failed");
  }
  return response.json() as Promise<{ id: string | null; status: string }>;
}
