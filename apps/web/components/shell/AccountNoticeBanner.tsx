"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Pro2Button } from "@/components/ui/empathy";

type Notice = {
  id: string;
  title: string;
  body: string;
  created_at: string;
};

export function AccountNoticeBanner() {
  const t = useTranslations("AccountNotices");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [dismissing, setDismissing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/account/notices?unread=1", { cache: "no-store" });
      const j = (await res.json()) as { ok?: boolean; notices?: Notice[] };
      if (res.ok && j.ok && j.notices?.length) {
        setNotice(j.notices[0] ?? null);
      } else {
        setNotice(null);
      }
    } catch {
      setNotice(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function dismiss() {
    if (!notice) return;
    setDismissing(true);
    try {
      await fetch("/api/account/notices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noticeId: notice.id }),
      });
      setNotice(null);
    } finally {
      setDismissing(false);
    }
  }

  if (!notice) return null;

  return (
    <div
      className="border-b border-cyan-500/30 bg-gradient-to-r from-cyan-950/80 via-violet-950/50 to-black/80 px-4 py-3"
      role="status"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[0.65rem] font-bold uppercase tracking-wider text-cyan-300/90">{t("eyebrow")}</p>
          <p className="mt-0.5 text-sm font-semibold text-white">{notice.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">{notice.body}</p>
        </div>
        <Pro2Button
          type="button"
          variant="ghost"
          className="shrink-0 border border-white/15 text-xs"
          disabled={dismissing}
          onClick={() => void dismiss()}
        >
          {dismissing ? "…" : t("dismiss")}
        </Pro2Button>
      </div>
    </div>
  );
}
