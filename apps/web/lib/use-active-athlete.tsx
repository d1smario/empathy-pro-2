"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { dedupeAthletesByEmail, pickCanonicalAthlete, type CanonicalAthleteRow } from "@/lib/athletes/canonical-profile";
import {
  AppRole,
  clearActiveAthleteId,
  clearPro2ClientSessionKeys,
  readActiveAthleteId,
  writeActiveAthleteId,
  writeAuditUserId,
} from "@/lib/app-session";
import { coachOrgIdForClient } from "@/lib/coach-org-id";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";

type AthleteOption = Pick<
  CanonicalAthleteRow,
  | "id"
  | "email"
  | "first_name"
  | "last_name"
  | "height_cm"
  | "weight_kg"
  | "body_fat_pct"
  | "muscle_mass_kg"
  | "resting_hr_bpm"
  | "max_hr_bpm"
  | "threshold_hr_bpm"
  | "diet_type"
  | "training_days_per_week"
  | "training_max_session_minutes"
  | "routine_config"
  | "nutrition_config"
  | "supplement_config"
  | "goals"
  | "intolerances"
  | "allergies"
  | "food_preferences"
  | "food_exclusions"
  | "supplements"
  | "created_at"
>;

type UserProfileRow = {
  role: AppRole;
  athlete_id: string | null;
};

const ATHLETE_SELECT =
  "id, email, first_name, last_name, height_cm, weight_kg, body_fat_pct, muscle_mass_kg, resting_hr_bpm, max_hr_bpm, threshold_hr_bpm, diet_type, training_days_per_week, training_max_session_minutes, routine_config, nutrition_config, supplement_config, goals, intolerances, allergies, food_preferences, food_exclusions, supplements, created_at";

export type ActiveAthleteContextValue = {
  athleteId: string | null;
  activeAthleteId: string | null;
  role: AppRole;
  athletes: AthleteOption[];
  loading: boolean;
  signedIn: boolean;
  userId: string | null;
  setActiveAthleteId: (id: string | null) => void;
  refresh: () => void;
};

const ActiveAthleteContext = createContext<ActiveAthleteContextValue | null>(null);

/**
 * Un solo store atleta per albero React: evita N fetch `ensure-profile` / Supabase e stati divergenti tra shell e moduli.
 * Montare nel layout root (`ClientRootProviders`).
 */
export function ActiveAthleteProvider({ children }: { children: ReactNode }) {
  const providerValue = useActiveAthleteState();
  return <ActiveAthleteContext.Provider value={providerValue}>{children}</ActiveAthleteContext.Provider>;
}

export function useActiveAthlete(): ActiveAthleteContextValue {
  const ctx = useContext(ActiveAthleteContext);
  if (!ctx) {
    throw new Error(
      "useActiveAthlete richiede ActiveAthleteProvider nel layout root (vedi app/client-root-providers.tsx).",
    );
  }
  return ctx;
}

/**
 * Allineato a V1: Supabase browser + `POST /api/access/ensure-profile` (cookie, no Bearer).
 * Merge duplicati email server-side (`/api/athletes/repair`) non incluso: richiede service role V1.
 */
function useActiveAthleteState(): ActiveAthleteContextValue {
  const lastAuthenticatedUserIdRef = useRef<string | null>(null);
  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [role, setRole] = useState<AppRole>("private");
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const setActiveAthleteId = useCallback((id: string | null) => {
    if (id) writeActiveAthleteId(id);
    else clearActiveAthleteId();
    setAthleteId(id);
  }, []);

  const [reloadToken, setReloadToken] = useState(0);
  const refresh = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    const supabase = createEmpathyBrowserSupabase();

    async function readStableUser() {
      if (!supabase) return null;
      const attempts = 4;
      for (let index = 0; index < attempts; index += 1) {
        const { data } = await supabase.auth.getUser();
        if (data.user) return data.user;
        await new Promise((resolve) => setTimeout(resolve, 120 + index * 80));
      }
      return null;
    }

    async function loadNoSupabaseClient() {
      setLoading(true);
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        const j = (await res.json()) as {
          ok?: boolean;
          configured?: boolean;
          signedIn?: boolean;
          userId?: string | null;
        };
        const ok = j?.ok === true && j.configured && j.signedIn && j.userId;
        if (!active) return;
        setSignedIn(Boolean(ok));
        setUserId(ok ? (j.userId as string) : null);
        setRole("private");
        setAthletes([]);
        setAthleteId(ok ? readActiveAthleteId() : null);
        if (!ok) clearPro2ClientSessionKeys();
      } finally {
        if (active) setLoading(false);
      }
    }

    async function load() {
      if (!supabase) {
        await loadNoSupabaseClient();
        return;
      }
      try {
        if (!active) return;
        setLoading(true);

        const user = await readStableUser();
        if (!active) return;

        if (!user) {
          setAthleteId(null);
          setAthletes([]);
          setRole("private");
          setSignedIn(false);
          setUserId(null);
          lastAuthenticatedUserIdRef.current = null;
          clearPro2ClientSessionKeys();
          setLoading(false);
          return;
        }

        const prevUserId = lastAuthenticatedUserIdRef.current;
        if (prevUserId && prevUserId !== user.id) {
          clearPro2ClientSessionKeys();
          setAthleteId(null);
          setAthletes([]);
        }
        lastAuthenticatedUserIdRef.current = user.id;

        setSignedIn(true);
        setUserId(user.id);

        const { data: profileData } = await supabase
          .from("app_user_profiles")
          .select("role, athlete_id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!active) return;

        const profile = (profileData as UserProfileRow | null) ?? null;
        const profileRole = profile?.role ?? "private";
        setRole(profileRole);

        if (profileRole === "coach") {
          const activeId = readActiveAthleteId();
          const { data: linked } = await supabase
            .from("coach_athletes")
            .select("athlete_id")
            .eq("coach_user_id", user.id)
            .eq("org_id", coachOrgIdForClient());
          if (!active) return;
          const linkedAthleteIds = Array.from(
            new Set((linked ?? []).map((row) => String((row as { athlete_id?: string }).athlete_id ?? "").trim()).filter(Boolean)),
          );
          if (!linkedAthleteIds.length) {
            setAthletes([]);
            clearActiveAthleteId();
            setAthleteId(null);
            writeAuditUserId(user.id);
            setLoading(false);
            return;
          }
          const { data: coachProfiles } = await supabase
            .from("athlete_profiles")
            .select(ATHLETE_SELECT)
            .in("id", linkedAthleteIds)
            .order("created_at", { ascending: false });
          if (!active) return;
          const coachList = dedupeAthletesByEmail((coachProfiles as AthleteOption[]) ?? []);
          setAthletes(coachList);
          const resolvedCoachAthleteId =
            (activeId && linkedAthleteIds.includes(activeId) ? activeId : null) ?? linkedAthleteIds[0] ?? null;
          if (resolvedCoachAthleteId) {
            writeActiveAthleteId(resolvedCoachAthleteId);
          } else {
            clearActiveAthleteId();
          }
          setAthleteId(resolvedCoachAthleteId);
          writeAuditUserId(user.id);
          setLoading(false);
          return;
        }

        /**
         * Private: **non** elencare tutti gli `athlete_profiles` visibili da RLS (su DB condivisi/demo può
         * esporre altri atleti → contesto UI sbagliato). Solo email dell’account o riga già collegata.
         */
        let rawList: AthleteOption[] = [];
        if (user.email) {
          const { data: listData } = await supabase
            .from("athlete_profiles")
            .select(ATHLETE_SELECT)
            .eq("email", user.email)
            .order("created_at", { ascending: false })
            .limit(50);
          rawList = (listData as AthleteOption[]) ?? [];
        } else if (profile?.athlete_id) {
          const { data: oneRow } = await supabase
            .from("athlete_profiles")
            .select(ATHLETE_SELECT)
            .eq("id", profile.athlete_id)
            .maybeSingle();
          rawList = oneRow ? ([oneRow] as AthleteOption[]) : [];
        }
        const list = dedupeAthletesByEmail(rawList);
        if (!active) return;
        setAthletes(list);

        let resolvedAthleteId = profile?.athlete_id ?? null;
        const guessedFirstName =
          typeof user.user_metadata?.first_name === "string" ? user.user_metadata.first_name : null;
        const guessedLastName =
          typeof user.user_metadata?.last_name === "string" ? user.user_metadata.last_name : null;

        const bootstrap = await fetch("/api/access/ensure-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            userId: user.id,
            role: "private",
            athleteId: resolvedAthleteId,
            email: user.email ?? null,
            firstName: guessedFirstName,
            lastName: guessedLastName,
          }),
        })
          .then(async (response) => {
            if (!response.ok) return null;
            return (await response.json()) as { athleteId?: string | null; role?: AppRole };
          })
          .catch(() => null);
        if (!active) return;
        resolvedAthleteId = bootstrap?.athleteId ?? resolvedAthleteId;

        if (user.email) {
          const { data: matchedAthletes } = await supabase
            .from("athlete_profiles")
            .select(ATHLETE_SELECT)
            .eq("email", user.email)
            .order("created_at", { ascending: false })
            .limit(20);
          if (!active) return;
          const emailMatches = (matchedAthletes as AthleteOption[]) ?? [];
          const emailCanonical = pickCanonicalAthlete(emailMatches, resolvedAthleteId);
          if (emailMatches.length > 1 && emailCanonical) {
            resolvedAthleteId = emailCanonical.id;
          }
        }

        if (resolvedAthleteId) {
          await supabase.from("app_user_profiles").upsert(
            {
              user_id: user.id,
              role: "private",
              athlete_id: resolvedAthleteId,
            },
            { onConflict: "user_id" },
          );
          writeActiveAthleteId(resolvedAthleteId);
        } else {
          clearPro2ClientSessionKeys();
        }

        if (!active) return;
        setAthleteId(resolvedAthleteId);
        writeAuditUserId(user.id);
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    if (!supabase) {
      return () => {
        active = false;
      };
    }

    const { data: authSub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "SIGNED_OUT") {
        setAthleteId(null);
        setAthletes([]);
        setRole("private");
        setSignedIn(false);
        setUserId(null);
        lastAuthenticatedUserIdRef.current = null;
        clearPro2ClientSessionKeys();
        setLoading(false);
        return;
      }
      if (session?.user) {
        void load();
      }
    });

    const handleStorage = (event: StorageEvent) => {
      if (!active) return;
      if (event.key !== "empathy_active_athlete_id") return;
      setAthleteId(event.newValue);
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      active = false;
      authSub.subscription.unsubscribe();
      window.removeEventListener("storage", handleStorage);
    };
  }, [reloadToken]);

  return {
    athleteId,
    activeAthleteId: athleteId,
    role,
    athletes,
    loading,
    signedIn,
    userId,
    setActiveAthleteId,
    refresh,
  };
}
