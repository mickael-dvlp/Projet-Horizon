"use client";
import { useEffect } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

// Bandeau de notification flottant, réutilisé pour les succès/échecs de
// sauvegarde et d'export — même vocabulaire visuel que le bandeau d'erreur
// déjà utilisé dans l'assistant IA (MemoEditor.jsx).
export default function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, toast.type === "error" ? 6000 : 3500);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  const isError = toast.type === "error";

  return (
    <div
      role="status"
      className={`fixed bottom-5 right-5 z-[200] flex items-start gap-2.5 max-w-sm px-4 py-3 rounded-xl shadow-xl border animate-in fade-in slide-in-from-bottom-2 duration-200 ${
        isError
          ? "bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400"
          : "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
      }`}
    >
      {isError ? (
        <AlertCircle size={18} className="shrink-0 mt-0.5" />
      ) : (
        <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
      )}
      <p className="text-sm font-semibold leading-snug flex-1">{toast.message}</p>
      <button
        onClick={onDismiss}
        aria-label="Fermer la notification"
        className="shrink-0 p-0.5 hover:opacity-70 transition-opacity"
      >
        <X size={14} />
      </button>
    </div>
  );
}
