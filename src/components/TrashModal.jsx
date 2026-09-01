import { useEffect } from "react";
import {
  Trash2,
  RotateCcw,
  X,
  AlertCircle,
  FileText,
  FolderOpen,
  Library,
} from "lucide-react";
import { useRestoreFocus } from "@/hooks/useRestoreFocus";

export default function TrashModal({
  items,
  projects = [],
  subProjects = {},
  onRestore,
  onDelete,
  onClose,
}) {
  useRestoreFocus();
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const resolveOrigin = (item) => {
    const project = projects.find((p) => p.id === item.projectId);
    const sub = (subProjects[item.projectId] || []).find(
      (s) => s.id === item.subProjectId
    );
    if (!project && !sub) return null;
    return [project?.name, sub?.name].filter(Boolean).join(" · ");
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-100 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden border border-slate-200 dark:border-slate-700">
        {/* Header */}
        <div className="relative p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between md:justify-center items-center bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3 md:flex-col md:text-center">
            <div className="p-2 bg-red-100 dark:bg-red-500/10 rounded-lg text-red-600 dark:text-red-400">
              <Trash2 size={20} />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 dark:text-slate-100">Corbeille</h2>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold tracking-wider">
                Éléments supprimés
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400 dark:text-slate-500 md:absolute md:right-5 md:top-1/2 md:-translate-y-1/2"
          >
            <X size={20} />
          </button>
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-300 dark:text-slate-700">
              <AlertCircle size={48} strokeWidth={1} />
              <p className="mt-4 italic text-sm">Votre corbeille est vide</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.trashId}
                className="group flex items-center justify-between p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl hover:border-indigo-200 dark:hover:border-indigo-500/50 hover:shadow-md dark:hover:shadow-none transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Icône dynamique selon le type */}
                  <div
                    className={`p-2 rounded-lg ${
                      item.originalType === "column"
                        ? "bg-amber-50 dark:bg-amber-500/10 text-amber-500 dark:text-amber-400"
                        : item.originalType === "kbFile"
                        ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 dark:text-emerald-400"
                        : "bg-blue-50 dark:bg-blue-500/10 text-blue-500 dark:text-blue-400"
                    }`}
                  >
                    {item.originalType === "column" ? (
                      <FolderOpen size={18} />
                    ) : item.originalType === "kbFile" ? (
                      <Library size={18} />
                    ) : (
                      <FileText size={18} />
                    )}
                  </div>

                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                      {item.title || item.name}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                      {item.originalType === "column" ? "Arc" : item.originalType === "kbFile" ? "Fiche" : "Page"} • Supprimé le{" "}
                      {new Date(item.deletedAt).toLocaleDateString()}
                      {resolveOrigin(item) && ` • ${resolveOrigin(item)}`}
                    </span>
                  </div>
                </div>

                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onRestore(item)}
                    className="p-2 text-indigo-500 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-colors"
                    title="Restaurer"
                  >
                    <RotateCcw size={18} />
                  </button>
                  <button
                    onClick={() => onDelete(item.trashId)}
                    className="p-2 text-red-400 dark:text-red-400/80 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Supprimer définitivement"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 text-center">
          <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">
            Les éléments restaurés retourneront dans leur projet d’origine.
          </p>
        </div>
      </div>
    </div>
  );
}
