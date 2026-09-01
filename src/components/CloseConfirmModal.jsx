"use client";

// Modale affichée à la demande du processus principal Electron (voir
// useElectronCloseConfirm) quand l'utilisateur clique sur la croix de la
// fenêtre — remplace la boîte système par une confirmation cohérente avec
// le reste de l'app.
export default function CloseConfirmModal({ onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-200 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl shadow-slate-200/60 dark:shadow-none p-6 w-full max-w-sm text-center">
        <div className="w-12 h-12 bg-amber-50 dark:bg-amber-500/10 text-amber-500 dark:text-amber-400 rounded-xl flex items-center justify-center text-xl mx-auto mb-4">
          ⚠️
        </div>
        <p className="font-bold text-slate-800 dark:text-slate-100 mb-1">Fermer Horizon ?</p>
        <p className="text-sm text-slate-400 dark:text-slate-500 mb-6 leading-relaxed">
          Voulez-vous vraiment quitter l’application ?
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onCancel}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="w-full bg-slate-100 dark:bg-slate-700 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 text-slate-500 dark:text-slate-300 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors"
          >
            Fermer l’application
          </button>
        </div>
      </div>
    </div>
  );
}
