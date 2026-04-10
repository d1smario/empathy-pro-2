import "server-only";

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export type PdfExtractResult = { text: string; numpages: number };

type PdfParseFn = (b: Buffer) => Promise<{ text?: string; numpages?: number }>;

/**
 * Estrae testo grezzo da PDF (server-only). Richiede `pdf-parse` in `serverComponentsExternalPackages`.
 */
export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<PdfExtractResult | null> {
  try {
    const pdfParse = require("pdf-parse") as PdfParseFn;
    const data = await pdfParse(buffer);
    const text = String(data?.text ?? "").trim();
    if (!text.length) return null;
    return { text, numpages: Number(data?.numpages) || 0 };
  } catch {
    return null;
  }
}
