import type { Metadata } from "next";
import { BrutalistAppBackdrop } from "@/components/shell/BrutalistAppBackdrop";
import { Pro2Link } from "@/components/ui/empathy";
import { empathyPrivacySections, empathyPrivacyUserRights } from "@/lib/legal/empathy-privacy-sections";

export const metadata: Metadata = {
  title: "Privacy — Empathy Pro 2.0",
  description:
    "Informativa sulla privacy e trattamento dei dati personali, sanitari e fisiologici nella piattaforma EMPATHY (Day One Sagl).",
  robots: { index: true, follow: true },
};

/**
 * Pagina pubblica HTTPS per partner (es. Garmin Developer: URL privacy policy).
 * Contenuto allineato a V1 Settings → Privacy e dati.
 */
export default function PrivacyPage() {
  return (
    <BrutalistAppBackdrop matrix>
      <main
        id="main-content"
        className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-10 md:px-8"
      >
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Pro2Link href="/" className="text-sm text-white/70 hover:text-white">
            ← Torna alla home
          </Pro2Link>
        </header>

        <section
          className="rounded-2xl border border-white/12 p-6 md:p-8"
          style={{
            background:
              "radial-gradient(circle at top left, rgba(39,211,255,0.12), transparent 30%), radial-gradient(circle at top right, rgba(255,93,122,0.12), transparent 24%), linear-gradient(180deg, rgba(12,12,16,0.96), rgba(7,8,11,0.98))",
          }}
        >
          <p className="text-xs uppercase tracking-[0.16em] text-white/60">Privacy e trattamenti dei dati</p>
          <h1 className="mt-2 text-balance text-3xl font-semibold leading-tight text-white md:text-4xl">
            Come EMPATHY utilizza, protegge e governa i dati personali e fisiologici.
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/85 md:text-base">
            Questa pagina integra il contenuto del documento privacy di EMPATHY e descrive il trattamento dei dati personali,
            sanitari, biometrici, comportamentali e derivati utilizzati dalla piattaforma per il Digital Twin, la modellazione
            metabolica, l&apos;analisi della performance, il recupero e l&apos;adattamento fisiologico.
          </p>
        </section>

        <section
          className="rounded-2xl border border-cyan-400/20 p-5 md:p-6"
          style={{ background: "linear-gradient(180deg, rgba(14,17,22,0.94), rgba(8,10,14,0.98))" }}
        >
          <h2 className="text-xl font-semibold text-white">Riferimenti principali</h2>
          <ul className="mt-4 grid gap-2 text-sm text-white/90">
            <li className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <strong className="text-white">Titolare:</strong> Day One Sagl, Via Nassa 15, 6900 Lugano, Svizzera
            </li>
            <li className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <strong className="text-white">Normativa di riferimento:</strong> GDPR, nFADP, linee guida EDPB, ISO/IEC 27001,
              ISO/IEC 27701, principi HIPAA ove applicabili
            </li>
            <li className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <strong className="text-white">Documento base:</strong> testo integrato dal PDF{" "}
              <code className="text-cyan-200/90">EMPATHY_FULL_TEXT_privacy</code>
            </li>
          </ul>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {empathyPrivacySections.map((section) => (
            <article
              key={section.title}
              className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-[rgba(8,9,13,0.98)] p-5 md:p-6"
            >
              <h3 className="text-lg font-semibold leading-snug text-white">{section.title}</h3>
              <div className="mt-3 grid gap-2.5">
                {section.body.map((paragraph, i) => (
                  <p key={`${section.title}-${i}`} className="text-sm leading-relaxed text-white/90">
                    {paragraph}
                  </p>
                ))}
              </div>
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 md:p-6">
          <h2 className="text-xl font-semibold text-white">Diritti dell&apos;utente</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {empathyPrivacyUserRights.map((item) => (
              <div
                key={item}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/90"
              >
                {item}
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm leading-relaxed text-white/80">
            I diritti possono essere esercitati in qualsiasi momento contattando il Titolare del trattamento. I dati sono
            conservati per un periodo limitato e proporzionato alle finalita&apos; del trattamento e possono essere cancellati o
            anonimizzati su richiesta o al termine del rapporto.
          </p>
        </section>

        <section className="rounded-xl border border-dashed border-white/20 bg-white/[0.02] p-5">
          <p className="text-xs leading-relaxed text-white/75 md:text-sm">
            Nota: EMPATHY PRO non e&apos; un dispositivo medico e non fornisce diagnosi cliniche. Le informazioni fornite hanno
            finalita&apos; informative e di supporto alla performance. Il presente testo puo&apos; essere aggiornato per riflettere
            evoluzioni normative, tecnologiche o scientifiche.
          </p>
        </section>
      </main>
    </BrutalistAppBackdrop>
  );
}
