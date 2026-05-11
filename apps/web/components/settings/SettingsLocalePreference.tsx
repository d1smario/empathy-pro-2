"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Pro2Button } from "@/components/ui/empathy";

type LocaleOption = { code: string; displayName: string };

export function SettingsLocalePreference() {
  const t = useTranslations("SettingsLocale");
  const router = useRouter();
  const [options, setOptions] = useState<LocaleOption[]>([]);
  const [locale, setLocale] = useState<string>("it");
  const [units, setUnits] = useState<"metric" | "imperial">("metric");
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings/locale-preference", { cache: "no-store" });
        const j = (await res.json()) as {
          ok?: boolean;
          preferredLocale?: string;
          preferredUnits?: string;
          enabledLocaleOptions?: LocaleOption[];
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !j.ok) {
          setLoadErr(j.error ?? t("loadError"));
          return;
        }
        setLoadErr(null);
        setLocale(j.preferredLocale ?? "it");
        setUnits(j.preferredUnits === "imperial" ? "imperial" : "metric");
        setOptions(j.enabledLocaleOptions ?? []);
      } catch {
        if (!cancelled) setLoadErr(t("loadError"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const persist = useCallback(
    async (nextLocale: string, nextUnits: "metric" | "imperial") => {
      setSaving(true);
      setLoadErr(null);
      setSavedFlash(false);
      try {
        const res = await fetch("/api/settings/locale-preference", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preferredLocale: nextLocale, preferredUnits: nextUnits }),
        });
        const j = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !j.ok) {
          setLoadErr(j.error ?? t("saveError"));
          return;
        }
        setLocale(nextLocale);
        setUnits(nextUnits);
        setSavedFlash(true);
        window.setTimeout(() => setSavedFlash(false), 2500);
        router.refresh();
      } catch {
        setLoadErr(t("saveError"));
      } finally {
        setSaving(false);
      }
    },
    [t, router],
  );

  const onLocaleChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const next = e.target.value;
      if (next === locale) return;
      await persist(next, units);
    },
    [locale, units, persist],
  );

  const onUnitsChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const next = e.target.value === "imperial" ? "imperial" : "metric";
      if (next === units) return;
      await persist(locale, next);
    },
    [locale, units, persist],
  );

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div>
        <h3 className="text-sm font-semibold text-white">{t("title")}</h3>
        <p className="mt-1 text-xs text-gray-500">{t("subtitle")}</p>
      </div>

      {loadErr ? (
        <p className="text-xs text-amber-300" role="alert">
          {loadErr}
        </p>
      ) : null}
      {savedFlash ? (
        <p className="text-xs text-emerald-300" role="status">
          {t("saved")}
        </p>
      ) : null}

      <div className="flex flex-wrap items-end gap-4">
        <label className="text-xs uppercase tracking-wider text-gray-400">
          {t("label")}
          <select
            value={locale}
            disabled={saving || options.length === 0}
            onChange={(e) => void onLocaleChange(e)}
            className="mt-1 block min-w-[12rem] rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/60"
          >
            {options.map((o) => (
              <option key={o.code} value={o.code}>
                {o.displayName}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs uppercase tracking-wider text-gray-400">
          {t("unitsLabel")}
          <select
            value={units}
            disabled={saving}
            onChange={(e) => void onUnitsChange(e)}
            className="mt-1 block min-w-[12rem] rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/60"
          >
            <option value="metric">{t("metric")}</option>
            <option value="imperial">{t("imperial")}</option>
          </select>
        </label>

        {saving ? (
          <Pro2Button type="button" variant="secondary" disabled className="text-xs">
            {t("saving")}
          </Pro2Button>
        ) : null}
      </div>
    </div>
  );
}
