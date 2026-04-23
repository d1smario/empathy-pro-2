import { EMPATHY_PLATFORM_VERSION, type ProductModuleId } from "@empathy/contracts";
import { BookOpen, LayoutDashboard, Settings2 } from "lucide-react";
import { getEmpathyAccountCatalog } from "@/lib/account/plan-catalog";
import { checkoutPayReady, hostedCheckoutAvailability } from "@/lib/billing/stripe-checkout-availability";
import { readCheckoutTrialDays } from "@/lib/billing/stripe-checkout-trial";
import { DashboardAthleteHubCard } from "@/components/dashboard/DashboardAthleteHubCard";
import { DashboardIntroAndPricing } from "@/components/dashboard/DashboardIntroAndPricing";
import { DashboardLoadAnalysisSummary } from "@/components/dashboard/DashboardLoadAnalysisSummary";
import { CoachAthletesModulePanel } from "@/components/coach/CoachAthletesModulePanel";
import { SettingsCoachAccountCard } from "@/components/settings/SettingsCoachAccountCard";
import { SettingsAthleteContextDiagnostics } from "@/components/settings/SettingsAthleteContextDiagnostics";
import { SettingsAuthSessionDiagnostics } from "@/components/settings/SettingsAuthSessionDiagnostics";
import { SettingsBillingDiagnostics } from "@/components/settings/SettingsBillingDiagnostics";
import { SettingsBuildPhasesCard } from "@/components/settings/SettingsBuildPhasesCard";
import { SettingsIntegrationsDiagnostics } from "@/components/settings/SettingsIntegrationsDiagnostics";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { ActionBar, Pro2Link } from "@/components/ui/empathy";
import { DashboardModuleSubnav } from "@/components/navigation/DashboardModuleSubnav";
import { StandardModuleSubnav } from "@/components/navigation/StandardModuleSubnav";
import { getModuleDomainPanel } from "@/core/navigation/module-domain-bridge";
import { moduleEyebrowClass } from "@/core/navigation/module-ui-accent";
import { getProductNavItemByModule } from "@/core/navigation/module-registry";

/** Hub / coach / settings: shell e sezioni canone Pro 2 (`docs/PRO2_UI_PAGE_CANON.md`). */
export function StandardModuleSurface({ module }: { module: ProductModuleId }) {
  const nav = getProductNavItemByModule(module);
  const title = nav?.label ?? module;
  const panel = getModuleDomainPanel(module);
  const dashboardCatalog = module === "dashboard" ? getEmpathyAccountCatalog() : null;
  const dashboardHosted = module === "dashboard" ? hostedCheckoutAvailability() : null;
  const dashboardPayReady = module === "dashboard" ? checkoutPayReady() : false;
  const dashboardTrialDays = module === "dashboard" ? readCheckoutTrialDays() : undefined;

  return (
    <Pro2ModulePageShell
      eyebrow={`${title} · Modulo`}
      eyebrowClassName={moduleEyebrowClass(module)}
      title={title}
      description={
        module === "dashboard" ? (
          <span className="leading-relaxed">
            Solo due aree: <strong className="text-gray-300">Empathy · piani</strong> e <strong className="text-gray-300">Core</strong>.
            Il resto dei moduli resta nella sidebar.
          </span>
        ) : panel ? (
          <span className="leading-relaxed">
            Punto di ingresso modulo: dati e azioni restano su contratti <code className="text-gray-500">@empathy/contracts</code> e domain
            packages.
          </span>
        ) : undefined
      }
      headerActions={
        <>
          <Pro2Link href="/" variant="ghost" className="justify-center border border-white/15 bg-white/5 hover:bg-white/10">
            Home
          </Pro2Link>
          <Pro2Link
            href="/dashboard"
            variant="secondary"
            className="justify-center border border-cyan-500/35 bg-cyan-500/10 hover:border-cyan-400/50 hover:bg-cyan-500/15"
          >
            Dashboard
          </Pro2Link>
        </>
      }
    >
      <div className="scroll-mt-28">
        {module === "dashboard" ? <DashboardModuleSubnav /> : <StandardModuleSubnav />}
      </div>

      {module === "settings" ? (
        <section
          id="settings-coach-account"
          className="scroll-mt-28 space-y-6"
          aria-label="Account coach e ruolo"
        >
          <p className="text-center text-xs text-gray-500 sm:text-left">
            <strong className="text-gray-300">Ruolo coach o atleta (privato):</strong> usa il pannello qui sotto. Le pill{" "}
            <strong className="text-gray-400">Ambito</strong> · <strong className="text-gray-400">Collegamenti</strong> ·{" "}
            <strong className="text-gray-400">Operatività</strong> servono solo a scorrere le altre sezioni.
          </p>
          <SettingsCoachAccountCard />
        </section>
      ) : null}

      {module === "dashboard" && dashboardCatalog && dashboardHosted ? (
        <div className="space-y-12">
          <DashboardIntroAndPricing
            hosted={dashboardHosted}
            payReady={dashboardPayReady}
            basePlans={dashboardCatalog.basePlans}
            coachAddOns={dashboardCatalog.coachAddOns}
            trialPolicy={dashboardCatalog.trialPolicy}
            trialDaysConfigured={dashboardTrialDays}
          />
          <DashboardLoadAnalysisSummary />
          <section id="dash-operational" className="scroll-mt-28 flex justify-center">
            <DashboardAthleteHubCard />
          </section>
        </div>
      ) : null}

      {module !== "dashboard" ? (
        <>
      <section id="std-domain" className="scroll-mt-28 space-y-10">
        {panel ? (
          <Pro2SectionCard accent="violet" title="Dominio contrattuale" subtitle={panel.title} icon={BookOpen}>
            <p className="text-sm leading-relaxed text-gray-300">{panel.summary}</p>
            <p className="mt-4 font-mono text-xs text-gray-500">
              <span className="text-purple-400">package</span> {panel.packageId}
            </p>
          </Pro2SectionCard>
        ) : (
          <Pro2SectionCard accent="slate" title="Dominio" subtitle="Non mappato" icon={BookOpen}>
            <p className="text-sm text-gray-400">Nessun pannello dominio mappato per questo id.</p>
          </Pro2SectionCard>
        )}
      </section>

      <section id="std-links" className="scroll-mt-28">
        <Pro2SectionCard accent="cyan" title="Collegamenti" subtitle="Navigazione rapida" icon={LayoutDashboard}>
        <ActionBar className="border-0 pt-0" aria-label="Navigazione rapida">
          <Pro2Link href="/" variant="ghost">
            Home
          </Pro2Link>
          <Pro2Link href="/dashboard" variant="secondary">
            Dashboard
          </Pro2Link>
        </ActionBar>
        {module === "athletes" ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Pro2Link
              href="/dashboard"
              variant="secondary"
              className="justify-center border border-cyan-500/35 bg-cyan-500/10 hover:bg-cyan-500/15"
            >
              Dashboard
            </Pro2Link>
            <Pro2Link
              href="/training/builder"
              variant="secondary"
              className="justify-center border border-fuchsia-500/35 bg-fuchsia-500/10 hover:bg-fuchsia-500/15"
            >
              Builder
            </Pro2Link>
            <Pro2Link
              href="/training"
              variant="secondary"
              className="justify-center border border-orange-500/35 bg-orange-500/10 hover:bg-orange-500/15"
            >
              Training
            </Pro2Link>
          </div>
        ) : null}
        {module === "settings" ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Pro2Link
              href="/dashboard"
              variant="secondary"
              className="justify-center border border-cyan-500/35 bg-cyan-500/10 hover:bg-cyan-500/15"
            >
              Dashboard
            </Pro2Link>
            <Pro2Link
              href="/training"
              variant="secondary"
              className="justify-center border border-orange-500/35 bg-orange-500/10 hover:bg-orange-500/15"
            >
              Training
            </Pro2Link>
            <Pro2Link
              href="/profile"
              variant="secondary"
              className="justify-center border border-fuchsia-500/30 bg-fuchsia-500/10 hover:bg-fuchsia-500/15"
            >
              Profile
            </Pro2Link>
          </div>
        ) : null}
        <p className="mt-6 font-mono text-xs text-gray-600">
          build <span className="text-purple-300">{EMPATHY_PLATFORM_VERSION}</span>
        </p>
        </Pro2SectionCard>
      </section>

      <section id="std-ops" className="scroll-mt-28 space-y-10">
      {module === "athletes" ? <CoachAthletesModulePanel /> : null}

      {module === "settings" ? (
        <Pro2SectionCard accent="slate" title="Impostazioni & diagnostica" subtitle="Sessione, atleta, integrazioni" icon={Settings2}>
          <div className="flex flex-col gap-10">
            <SettingsBuildPhasesCard />
            <SettingsAuthSessionDiagnostics />
            <SettingsAthleteContextDiagnostics />
            <SettingsIntegrationsDiagnostics />
            <SettingsBillingDiagnostics />
          </div>
        </Pro2SectionCard>
      ) : null}
      </section>
        </>
      ) : null}
    </Pro2ModulePageShell>
  );
}
