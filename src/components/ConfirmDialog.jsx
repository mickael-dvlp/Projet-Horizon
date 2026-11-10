"use client";
import { createContext, useCallback, useContext, useId, useState } from "react";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { useRestoreFocus } from "@/hooks/useRestoreFocus";

const BUTTON_BASE = "w-full px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors";
const VARIANTS = {
  primary: "bg-indigo-600 hover:bg-indigo-700 text-white",
  danger: "bg-red-600 hover:bg-red-700 text-white",
  // Choix destructif secondaire (ex. "Fermer sans enregistrer").
  neutral:
    "bg-slate-100 dark:bg-slate-700 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 text-slate-500 dark:text-slate-300",
  ghost: "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-medium",
};

// Boîte de confirmation de l'app (remplace les window.confirm natifs et les
// modales dupliquées). `actions` : [{ label, onClick, variant }], la
// première reçoit le focus. Échap ou un clic sur le fond appellent
// `onCancel`. `inline` : superposée à son conteneur (position absolute)
// plutôt qu'à toute la fenêtre.
export default function ConfirmDialog({ title, message, actions, onCancel, inline = false }) {
  useRestoreFocus();
  useEscapeKey(onCancel);
  const titleId = useId();
  const messageId = useId();

  return (
    <div
      className={`${
        inline
          ? "absolute inset-0 z-20 bg-white/80 dark:bg-slate-900/80"
          : "fixed inset-0 z-200 bg-slate-900/60 p-4"
      } backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message ? messageId : undefined}
        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl shadow-slate-200/60 dark:shadow-none p-6 mx-8 w-full max-w-sm text-center"
      >
        <div className="w-12 h-12 bg-amber-50 dark:bg-amber-500/10 text-amber-500 dark:text-amber-400 rounded-xl flex items-center justify-center text-xl mx-auto mb-4">
          ⚠️
        </div>
        <p id={titleId} className="font-bold text-slate-800 dark:text-slate-100 mb-1">
          {title}
        </p>
        {message && (
          <p id={messageId} className="text-sm text-slate-400 dark:text-slate-500 mb-6 leading-relaxed">
            {message}
          </p>
        )}
        <div className={`flex flex-col gap-2 ${message ? "" : "mt-5"}`}>
          {actions.map(({ label, onClick, variant = "primary" }, index) => (
            <button
              key={label}
              onClick={onClick}
              autoFocus={index === 0}
              className={`${BUTTON_BASE} ${VARIANTS[variant] || VARIANTS.primary}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const ConfirmContext = createContext(null);

// Fournit `confirm(options)` à toute l'app : renvoie une promesse résolue à
// true (confirmé) ou false (annulé). Options : title, message, confirmLabel,
// cancelLabel, danger (bouton de confirmation rouge).
export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);

  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        setRequest((previous) => {
          previous?.resolve(false);
          return { ...options, resolve };
        });
      }),
    []
  );

  const settle = (value) => {
    request.resolve(value);
    setRequest(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request && (
        <ConfirmDialog
          title={request.title}
          message={request.message}
          onCancel={() => settle(false)}
          actions={[
            {
              label: request.confirmLabel || "Confirmer",
              variant: request.danger ? "danger" : "primary",
              onClick: () => settle(true),
            },
            { label: request.cancelLabel || "Annuler", variant: "ghost", onClick: () => settle(false) },
          ]}
        />
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm doit être utilisé sous <ConfirmProvider>.");
  return confirm;
}
