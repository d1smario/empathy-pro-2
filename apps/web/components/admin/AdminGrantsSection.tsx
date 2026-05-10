"use client";

/**
 * Sezione "Concedi accesso gratuito" della console admin.
 * Convoglia sul resolver `loadUserAccessEntitlement` (lib/billing/access-entitlement.ts).
 *
 * Permette: cercare utente per email, vedere stato entitlement, creare grant
 * (testimonial 3-6-9 mesi, promo 1 mese, comp ad-hoc, beta), revocare grant attivi.
 */

import { useCallback, useState } from "react";
import { Pro2Button } from "@/components/ui/empathy";

const PRESET_BUTTONS: Array<{
  label: string;
  months: number;
  kind: "testimonial" | "promo" | "comp" | "beta";
}> = [
  { label: "Promo 1 mese", months: 1, kind: "promo" },
  { label: "Testimonial 3 mesi", months: 3, kind: "testimonial" },
  { label: "Testimonial 6 mesi", months: 6, kind: "testimonial" },
  { label: "Testimonial 9 mesi", months: 9, kind: "testimonial" },
  { label: "Comp 12 mesi", months: 12, kind: "comp" },
];

type LookupUser = {
  userId: string;
  email: string;
  role: "private" | "coach" | null;
  platformCoachStatus: string | null;
  isPlatformAdmin: boolean;
  entitlement: {
    hasOperatorAccess: boolean;
    hasAthleteAccess: boolean;
    source: string;
    validUntil: string | null;
    label: string;
  };
};

type Grant = {
  id: string;
  user_id: string;
  kind: string;
  starts_at: string;
  ends_at: string;
  note: string | null;
  granted_by_email: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
  created_at: string;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}

function entitlementBadge(source: string): { className: string; label: string } {
  switch (source) {
    case "admin":
      return { className: "bg-violet-500/15 text-violet-200", label: "Admin" };
    case "stripe_paid":
      return { className: "bg-emerald-500/15 text-emerald-200", label: "Stripe attivo" };
    case "grant_active":
      return { className: "bg-cyan-500/15 text-cyan-200", label: "Grant attivo" };
    case "coach_operator":
      return { className: "bg-amber-500/15 text-amber-200", label: "Solo coach" };
    default:
      return { className: "bg-rose-500/15 text-rose-200", label: "Nessun piano" };
  }
}

export function AdminGrantsSection() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<LookupUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<LookupUser | null>(null);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loadingGrants, setLoadingGrants] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const search = useCallback(async () => {
    const q = query.trim();
    if (q.length < 2) {
      setUsers([]);
      return;
    }
    setSearching(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/users/lookup?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      const j = (await res.json()) as { ok: boolean; users?: LookupUser[]; error?: string };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Ricerca utente fallita.");
        setUsers([]);
      } else {
        setUsers(j.users ?? []);
      }
    } catch {
      setErr("Errore di rete.");
    } finally {
      setSearching(false);
    }
  }, [query]);

  const loadGrants = useCallback(async (userId: string) => {
    setLoadingGrants(true);
    try {
      const res = await fetch(`/api/admin/grants?userId=${encodeURIComponent(userId)}`, { cache: "no-store" });
      const j = (await res.json()) as { ok: boolean; grants?: Grant[]; error?: string };
      if (res.ok && j.ok) {
        setGrants(j.grants ?? []);
      } else {
        setErr(j.error ?? "Lettura grants fallita.");
        setGrants([]);
      }
    } finally {
      setLoadingGrants(false);
    }
  }, []);

  const selectUser = useCallback(
    async (u: LookupUser) => {
      setSelected(u);
      setInfo(null);
      setErr(null);
      await loadGrants(u.userId);
    },
    [loadGrants],
  );

  const createGrant = useCallback(
    async (preset: (typeof PRESET_BUTTONS)[number]) => {
      if (!selected) return;
      setBusy(true);
      setErr(null);
      setInfo(null);
      try {
        const res = await fetch("/api/admin/grants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: selected.userId,
            kind: preset.kind,
            durationMonths: preset.months,
            note: note.trim() || undefined,
          }),
        });
        const j = (await res.json()) as { ok: boolean; error?: string };
        if (!res.ok || !j.ok) {
          setErr(j.error ?? "Creazione grant fallita.");
        } else {
          setInfo(`Grant ${preset.kind} di ${preset.months} mesi concesso.`);
          setNote("");
          await loadGrants(selected.userId);
          // Refresh entitlement nella lista users.
          await search();
        }
      } catch {
        setErr("Errore di rete.");
      } finally {
        setBusy(false);
      }
    },
    [selected, note, loadGrants, search],
  );

  const revokeGrant = useCallback(
    async (grantId: string) => {
      if (!selected) return;
      const reason = window.prompt("Motivo revoca (opzionale):") ?? "";
      setBusy(true);
      setErr(null);
      try {
        const res = await fetch(`/api/admin/grants/${encodeURIComponent(grantId)}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        });
        const j = (await res.json()) as { ok: boolean; error?: string };
        if (!res.ok || !j.ok) {
          setErr(j.error ?? "Revoca fallita.");
        } else {
          setInfo("Grant revocato.");
          await loadGrants(selected.userId);
          await search();
        }
      } catch {
        setErr("Errore di rete.");
      } finally {
        setBusy(false);
      }
    },
    [selected, loadGrants, search],
  );

  return (
    <section aria-labelledby="admin-grants-heading" className="space-y-4">
      <div>
        <h2 id="admin-grants-heading" className="text-lg font-semibold text-white">
          Accessi gratuiti (testimonial / promo / comp)
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Cerca un utente per email e concedi un accesso gratuito a tempo. I coach approvati hanno già
          accesso alla console coach (gestione roster), ma per usare la piattaforma <em>come atleta</em> sul
          proprio profilo serve un piano attivo o un grant qui sotto.
        </p>
      </div>

      {err ? (
        <p className="rounded-xl border border-amber-500/35 bg-amber-950/20 px-4 py-3 text-sm text-amber-200" role="alert">
          {err}
        </p>
      ) : null}
      {info ? (
        <p className="rounded-xl border border-emerald-500/35 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200">
          {info}
        </p>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <label className="flex-1 text-xs uppercase tracking-wider text-gray-400">
          Email utente
          <input
            type="search"
            inputMode="email"
            autoComplete="off"
            placeholder="cerca per email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void search();
            }}
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/60"
          />
        </label>
        <Pro2Button type="button" disabled={searching || query.trim().length < 2} onClick={() => void search()}>
          {searching ? "Cerco…" : "Cerca"}
        </Pro2Button>
      </div>

      {users.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/25">
          <table className="min-w-full text-left text-sm text-gray-300">
            <thead className="border-b border-white/10 bg-white/5 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Ruolo</th>
                <th className="px-4 py-3">Stato accesso</th>
                <th className="px-4 py-3">Scade</th>
                <th className="px-4 py-3">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const badge = entitlementBadge(u.entitlement.source);
                return (
                  <tr
                    key={u.userId}
                    className={`border-b border-white/5 last:border-0 ${selected?.userId === u.userId ? "bg-cyan-500/5" : ""}`}
                  >
                    <td className="px-4 py-3 text-sm text-gray-200">{u.email}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {u.role ?? "—"}
                      {u.role === "coach" ? (
                        <span className="ml-1 text-[0.65rem] uppercase text-gray-500">{u.platformCoachStatus ?? "pending"}</span>
                      ) : null}
                      {u.isPlatformAdmin ? <span className="ml-1 text-violet-300">· admin</span> : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{formatDate(u.entitlement.validUntil)}</td>
                    <td className="px-4 py-3">
                      <Pro2Button
                        type="button"
                        className="px-3 py-1.5 text-xs"
                        variant={selected?.userId === u.userId ? "primary" : "secondary"}
                        onClick={() => void selectUser(u)}
                      >
                        {selected?.userId === u.userId ? "Selezionato" : "Gestisci"}
                      </Pro2Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {selected ? (
        <div className="space-y-4 rounded-2xl border border-cyan-400/30 bg-cyan-500/[0.04] p-5">
          <div>
            <p className="text-xs uppercase tracking-wider text-cyan-300">Utente selezionato</p>
            <p className="mt-1 text-sm font-semibold text-white">{selected.email}</p>
            <p className="text-xs text-gray-400">
              {selected.entitlement.label}
              {selected.entitlement.validUntil ? ` · scade ${formatDate(selected.entitlement.validUntil)}` : ""}
            </p>
          </div>

          <label className="block text-xs uppercase tracking-wider text-gray-400">
            Nota (opzionale, visibile in audit)
            <input
              type="text"
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="es. Testimonial campagna autunno"
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/60"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            {PRESET_BUTTONS.map((p) => (
              <Pro2Button
                key={p.label}
                type="button"
                disabled={busy}
                onClick={() => void createGrant(p)}
                className="text-xs"
              >
                {p.label}
              </Pro2Button>
            ))}
          </div>

          <div>
            <p className="mb-2 text-xs uppercase tracking-wider text-gray-400">Storico grants</p>
            {loadingGrants ? (
              <p className="text-sm text-gray-400">Carico…</p>
            ) : grants.length === 0 ? (
              <p className="text-sm text-gray-500">Nessun grant per questo utente.</p>
            ) : (
              <ul className="space-y-1.5">
                {grants.map((g) => {
                  const active = !g.revoked_at && new Date(g.ends_at).getTime() > Date.now();
                  return (
                    <li
                      key={g.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-black/30 px-3 py-2 text-xs"
                    >
                      <div>
                        <span
                          className={`mr-2 rounded-full px-2 py-0.5 text-[0.65rem] uppercase ${
                            active ? "bg-emerald-500/15 text-emerald-200" : "bg-gray-700/40 text-gray-400"
                          }`}
                        >
                          {active ? g.kind : g.revoked_at ? "revocato" : "scaduto"}
                        </span>
                        <span className="text-gray-300">
                          {formatDate(g.starts_at)} → {formatDate(g.ends_at)}
                        </span>
                        {g.note ? <span className="ml-2 text-gray-500">— {g.note}</span> : null}
                        {g.granted_by_email ? (
                          <span className="ml-2 text-[0.65rem] text-gray-600">by {g.granted_by_email}</span>
                        ) : null}
                      </div>
                      {active ? (
                        <Pro2Button
                          type="button"
                          variant="secondary"
                          className="border-rose-500/30 px-3 py-1 text-[0.65rem] text-rose-200 hover:border-rose-400/50"
                          disabled={busy}
                          onClick={() => void revokeGrant(g.id)}
                        >
                          Revoca
                        </Pro2Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
