import type { Metadata } from "next";
import { AuthSetPasswordForm } from "@/components/access/AuthSetPasswordForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nuova password",
  description: "Imposta una nuova password dopo il link ricevuto via email.",
};

export default function AuthSetPasswordPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-950 px-6 py-16 text-white">
      <div className="text-center">
        <p className="font-mono text-[0.6rem] uppercase tracking-[0.35em] text-gray-500">Access</p>
        <h1 className="mt-3 text-xl font-bold tracking-tight">Imposta nuova password</h1>
        <p className="mt-2 max-w-sm text-sm text-gray-400">
          Scegli una password sicura (minimo 8 caratteri). Dopo il salvataggio entrerai in app.
        </p>
      </div>
      <AuthSetPasswordForm />
    </main>
  );
}
