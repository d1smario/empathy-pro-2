import { EMPATHY_PLATFORM_VERSION, type ProductModuleId } from "@empathy/contracts";
import { BookOpen, LayoutDashboard, Settings2, Users, Zap } from "lucide-react";
import { getGenerativeFocusConfig } from "@/components/generative/generative-focus-options";
import { DashboardAthleteHubCard } from "@/components/dashboard/DashboardAthleteHubCard";
import { CoachInviteLinksCard } from "@/components/coach/CoachInviteLinksCard";
import { CoachRosterCard } from "@/components/coach/CoachRosterCard";
import { SettingsAthleteContextDiagnostics } from "@/components/settings/SettingsAthleteContextDiagnostics";
import { SettingsAuthSessionDiagnostics } from "@/components/settings/SettingsAuthSessionDiagnostics";
import { SettingsBillingDiagnostics } from "@/components/settings/SettingsBillingDiagnostics";
import { SettingsBuildPhasesCard } from "@/components/settings/SettingsBuildPhasesCard";
import { SettingsIntegrationsDiagnostics } from "@/components/settings/SettingsIntegrationsDiagnostics";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { ActionBar, Pro2Link } from "@/components/ui/empathy";
import { StandardModuleSubnav } from "@/components/navigation/StandardModuleSubnav";
import { getModuleDomainPanel } from "@/core/navigation/module-domain-bridge";
import { moduleEyebrowClass } from "@/core/navigation/module-ui-accent";
import { getProductNavItemByModule } from "@/core/navigation/module-registry";
import type { GenerativeHubIntent } from "@/core/routing/generative-intent-search-params";

/** Hub / coach / settings: shell e sezioni canone Pro 2 (`docs/PRO2_UI_PAGE_CANON.md`). */
export function StandardModuleSurface({
  module,
  generativeHubIntent,
}: {
  module: ProductModuleId;
  generativeHubIntent?: GenerativeHubIntent;
}) {
  const nav = getProductNavItemByModule(module);
  const title = nav?.label ?? module;
  const panel = getModuleDomainPanel(module);

  const intentLine =
    module === "dashboard" && generativeHubIntent
      ? (() => {
          const sourceNav = getProductNavItemByModule(generativeHubIntent.module);
          const sourceTitle = sourceNav?.label ?? generativeHubIntent.module;
          const cfg = getGenerativeFocusConfig(generativeHubIntent.module);
          const focusLabel =
            cfg.options.find((o) => o.value === generativeHubIntent.focus)?.label ??
            generativeHubIntent.focus;
          return { sourceTitle, focusLabel, href: `/${generativeHubIntent.module}` as const };
        })()
      : null;

  return (
    <Pro2ModulePageShell
      eyebrow={`${title} · Modulo`}
      eyebrowClassName={moduleEyebrowClass(module)}
      title={title}
      description={
        panel ? (
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
        <StandardModuleSubnav />
      </div>

      <section id="std-domain" className="scroll-mt-28 space-y-10">
        {intentLine ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-gray-300">
            <span className="font-mono text-[0.6rem] uppercase tracking-[0.25em] text-amber-400/90">Focus </span>
            <span className="text-gray-200">
              {intentLine.sourceTitle} · {intentLine.focusLabel}
            </span>
            {" · "}
            <Pro2Link href={intentLine.href} variant="ghost" className="inline-flex align-middle">
              Modulo
            </Pro2Link>
          </div>
        ) : null}

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
        {module === "dashboard" ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Pro2Link
              href="/training/builder"
              variant="secondary"
              className="justify-center border border-fuchsia-500/35 bg-fuchsia-500/10 hover:bg-fuchsia-500/15"
            >
              Builder
            </Pro2Link>
            <Pro2Link
              href="/training/calendar"
              variant="secondary"
              className="justify-center border border-sky-500/35 bg-sky-500/10 hover:bg-sky-500/15"
            >
              Calendar
            </Pro2Link>
            <Pro2Link
              href="/training"
              variant="secondary"
              className="justify-center border border-orange-500/35 bg-orange-500/10 hover:bg-orange-500/15"
            >
              Training
            </Pro2Link>
            <Pro2Link
              href="/nutrition"
              variant="secondary"
              className="justify-center border border-amber-500/35 bg-amber-500/10 hover:bg-amber-500/15"
            >
              Nutrition
            </Pro2Link>
            <Pro2Link
              href="/physiology"
              variant="secondary"
              className="justify-center border border-emerald-500/35 bg-emerald-500/10 hover:bg-emerald-500/15"
            >
              Physiology
            </Pro2Link>
            <Pro2Link
              href="/health"
              variant="secondary"
              className="justify-center border border-violet-500/35 bg-violet-500/10 hover:bg-violet-500/15"
            >
              Health
            </Pro2Link>
            <Pro2Link
              href="/profile"
              variant="secondary"
              className="justify-center border border-fuchsia-500/30 bg-fuchsia-500/10 hover:bg-fuchsia-500/15"
            >
              Profile
            </Pro2Link>
            <Pro2Link
              href="/athletes"
              variant="secondary"
              className="justify-center border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/15"
            >
              Athletes
            </Pro2Link>
          </div>
        ) : null}
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
      {module === "dashboard" ? (
        <Pro2SectionCard accent="orange" title="Operatività" subtitle="Accesso rapido agli hub generativi" icon={Zap}>
          <p className="mb-4 text-sm leading-relaxed text-gray-400">
            Dati e piani restano sui contratti condivisi; da qui salti ai moduli dove leggi o agisci sullo stesso contesto atleta.
          </p>
          <div className="flex flex-wrap gap-2">
            <Pro2Link
              href="/training/builder"
              variant="secondary"
              className="justify-center border border-fuchsia-500/40 bg-fuchsia-500/10 hover:bg-fuchsia-500/15"
            >
              Session builder
            </Pro2Link>
            <Pro2Link
              href="/nutrition"
              variant="secondary"
              className="justify-center border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/15"
            >
              Nutrition focus
            </Pro2Link>
            <Pro2Link
              href="/physiology"
              variant="secondary"
              className="justify-center border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/15"
            >
              Physiology focus
            </Pro2Link>
          </div>
        </Pro2SectionCard>
      ) : null}

      {module === "dashboard" ? (
        <div className="flex justify-center">
          <DashboardAthleteHubCard />
        </div>
      ) : null}

      {module === "athletes" ? (
        <Pro2SectionCard accent="violet" title="Area coach" subtitle="Roster e inviti" icon={Users}>
          <div className="flex flex-col gap-10">
            <CoachRosterCard />
            <CoachInviteLinksCard />
          </div>
        </Pro2SectionCard>
      ) : null}

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
    </Pro2ModulePageShell>
  );
}
