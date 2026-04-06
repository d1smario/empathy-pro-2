/**
 * Stili di esecuzione coach (allineati a V1 `EXECUTION_STYLES` + varianti richieste Pro 2).
 * Valori stringa stabili per `notes` / contratto.
 */
export const PRO2_GYM_EXECUTION_STYLES: readonly string[] = [
  "Lento controllato",
  "Veloce",
  "Massima velocità / intento velocità",
  "Spinta massima / discesa lenta",
  "Estensione incompleta (ROM parziale)",
  "Sfinimento",
  "Superserie",
  "Serie composte / triset",
  "Isometrico",
  "Pliometrico",
] as const;

export type Pro2GymExecutionStyle = (typeof PRO2_GYM_EXECUTION_STYLES)[number] | string;
