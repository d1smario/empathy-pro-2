"use client";

import { useState } from "react";
import { AccessMagicLinkForm } from "@/components/access/AccessMagicLinkForm";
import { AccessPasswordForm } from "@/components/access/AccessPasswordForm";

type Mode = "password" | "otp";

type Props = {
  redirectAfterLogin: string;
};

/**
 * Accesso: email+password (default) oppure magic link, stesso `redirectAfterLogin`.
 */
export function AccessAuthPanel({ redirectAfterLogin }: Props) {
  const [mode, setMode] = useState<Mode>("password");

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex rounded-xl border border-white/10 bg-black/40 p-1">
        <button
          type="button"
          onClick={() => setMode("password")}
          className={`flex-1 rounded-lg px-3 py-2 text-center text-xs font-bold uppercase tracking-wider transition-colors ${
            mode === "password" ? "bg-purple-600/40 text-white" : "text-gray-500 hover:text-gray-300"
          }`}
        >
          Email e password
        </button>
        <button
          type="button"
          onClick={() => setMode("otp")}
          className={`flex-1 rounded-lg px-3 py-2 text-center text-xs font-bold uppercase tracking-wider transition-colors ${
            mode === "otp" ? "bg-purple-600/40 text-white" : "text-gray-500 hover:text-gray-300"
          }`}
        >
          Link email
        </button>
      </div>
      {mode === "password" ? (
        <AccessPasswordForm redirectAfterLogin={redirectAfterLogin} />
      ) : (
        <AccessMagicLinkForm redirectAfterLogin={redirectAfterLogin} />
      )}
    </div>
  );
}
