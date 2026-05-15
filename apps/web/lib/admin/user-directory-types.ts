import type { UserAccessEntitlement } from "@/lib/billing/access-entitlement";
import type { AdminAthleteActivityRollup } from "@/lib/admin/load-activity-rollups";

export type AdminDirectoryStripeRow = {
  status: string;
  currentPeriodEnd: string | null;
  basePlanId: string | null;
};

export type AdminDirectoryUserRow = {
  userId: string;
  email: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  role: "private" | "coach" | null;
  platformCoachStatus: string | null;
  isPlatformAdmin: boolean;
  athleteId: string | null;
  stripeSubscriptions: AdminDirectoryStripeRow[];
  entitlement: UserAccessEntitlement;
  activity: AdminAthleteActivityRollup | null;
};
