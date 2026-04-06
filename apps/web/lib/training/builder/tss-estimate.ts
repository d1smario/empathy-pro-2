import { intensityToRelativeLoad } from "@/lib/training/builder/pro2-intensity";

/**
 * Stima TSS per segmenti a intensità costante (somma di blocchi).
 *
 * Modello: approssimazione **IF²** allineata al vincolo prodotto **60 min in Z4 ⇒ 100 TSS**
 * (coerente con la scala Coggan dove ~1 h a soglia/FTP ≈ 100 TSS; qui la Z4 del builder
 * è il riferimento di normalizzazione).
 *
 * Per ogni segmento: `TSS_i = (durata_ore) × (IF_i / IF_Z4)² × 100`
 * con `IF` = rapporto carico relativo da `intensityToRelativeLoad` (proxy %FTP / stress).
 */
export function estimateTssFromSegments(
  segments: ReadonlyArray<{ durationSeconds: number; intensityLabel: string }>,
): number {
  const refIf = Math.max(0.05, intensityToRelativeLoad("Z4"));
  let sum = 0;
  for (const s of segments) {
    const raw = intensityToRelativeLoad(s.intensityLabel);
    const ifN = raw / refIf;
    const hours = Math.max(0, s.durationSeconds) / 3600;
    sum += hours * ifN * ifN * 100;
  }
  return Math.round(Math.min(999, Math.max(0, sum)));
}
