import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stato connessione Replicate (solo server). Non espone mai il token.
 * GET https://api.replicate.com/v1/account per validare la chiave.
 */
export async function GET() {
  const token = (process.env.REPLICATE_API_TOKEN ?? "").trim();
  if (!token) {
    return NextResponse.json({
      configured: false,
      reachable: null as boolean | null,
      message: "Nessuna REPLICATE_API_TOKEN sul server (locale: .env.local · Vercel: Environment Variables).",
    });
  }

  try {
    const res = await fetch("https://api.replicate.com/v1/account", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (res.ok) {
      return NextResponse.json({
        configured: true,
        reachable: true,
        message: "API Replicate raggiungibile e token accettato.",
      });
    }

    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({
        configured: true,
        reachable: false,
        message: "Token presente ma rifiutato da Replicate (controlla che sia valido).",
      });
    }

    return NextResponse.json({
      configured: true,
      reachable: false,
      message: `Replicate ha risposto HTTP ${res.status}.`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Errore di rete";
    return NextResponse.json({
      configured: true,
      reachable: false,
      message: msg,
    });
  }
}
