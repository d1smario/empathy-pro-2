export type GrantNoticeKind = "testimonial" | "promo" | "comp" | "beta";

const KIND_LABEL_IT: Record<GrantNoticeKind, string> = {
  testimonial: "Accesso testimonial",
  promo: "Promozione",
  comp: "Accesso omaggio",
  beta: "Programma beta / tester",
};

function formatItDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function buildGrantNoticeCopy(input: {
  kind: string;
  durationMonths: number;
  endsAt: string;
  note?: string | null;
}): { title: string; body: string } {
  const kind = (input.kind as GrantNoticeKind) in KIND_LABEL_IT ? (input.kind as GrantNoticeKind) : "comp";
  const label = KIND_LABEL_IT[kind];
  const months = Math.max(1, Math.round(input.durationMonths));
  const until = formatItDate(input.endsAt);
  const custom = (input.note ?? "").trim();
  const title =
    custom && /ambassador/i.test(custom)
      ? "Empathy — accesso Ambassador"
      : `Empathy — ${label}`;
  const lines = [
    `Ti abbiamo attivato ${months} ${months === 1 ? "mese" : "mesi"} di accesso gratuito alla piattaforma.`,
    `Valido fino al ${until}.`,
  ];
  if (custom) lines.push(custom);
  lines.push("Apri la dashboard: il tuo account è già pronto.");
  return { title, body: lines.join(" ") };
}
