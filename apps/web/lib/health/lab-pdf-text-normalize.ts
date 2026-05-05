/**
 * Normalizza testo grezzo estratto da PDF referti (layout “compatto”):
 * unisce spazi, inserisce un separatore tra parole lunghe e cifre attaccate
 * (es. `Firmicutes40%` → `Firmicutes 40%`) così l’euristica `numberAfterLabels` trova il numero.
 */
export function normalizeLoosePdfText(raw: string): string {
  let t = raw.replace(/\u00a0/g, " ").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  t = t.replace(/[\t ]+/g, " ");
  t = t.replace(/\n+/g, " ");
  // ≥4 lettere consecutive + cifra subito dopo (evita casi tipo "B12" con solo 1–2 lettere prima del numero).
  t = t.replace(/([A-Za-zÀ-ÿ]{4,})(\d)/g, "$1 $2");
  return t.trim();
}
