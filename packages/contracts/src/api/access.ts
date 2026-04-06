export type AccessBootstrapAthleteOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

export type AccessBootstrapAthleteCatalogViewModel = {
  athletes: AccessBootstrapAthleteOption[];
  error: string | null;
};

export type EnsureAccessBootstrapInput = {
  userId: string;
  role: "private" | "coach";
  athleteId?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  accessToken?: string | null;
};

export type EnsureAccessBootstrapResult = {
  status: "existing" | "created";
  role: "private" | "coach";
  athleteId: string | null;
};

/** Compatibility aliases for existing access-page imports. */
export type AccessAthleteOption = AccessBootstrapAthleteOption;
