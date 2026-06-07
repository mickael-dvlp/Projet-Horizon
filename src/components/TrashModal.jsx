import {
  Trash2,
  RotateCcw,
  X,
  AlertCircle,
  FileText,
  FolderOpen,
} from "lucide-react";

export default function TrashModal({ items, onRestore, onDelete, onClose }) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-100 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg text-red-600">
              <Trash2 size={20} />
            </div>
            <div>
              <h2 className="font-bold text-slate-800">Corbeille</h2>
              <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">
                Éléments supprimés
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"
          >
            <X size={20} />
          </button>
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-300">
              <AlertCircle size={48} strokeWidth={1} />
              <p className="mt-4 italic text-sm">Votre corbeille est vide</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.trashId}
                className="group flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl hover:border-indigo-200 hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Icône dynamique selon le type */}
                  <div
                    className={`p-2 rounded-lg ${item.type === "column" ? "bg-amber-50 text-amber-500" : "bg-blue-50 text-blue-500"}`}
                  >
                    {item.type === "column" ? (
                      <FolderOpen size={18} />
                    ) : (
                      <FileText size={18} />
                    )}
                  </div>

                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-slate-700 truncate">
                      {item.title}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {item.type === "column" ? "Groupe" : "Page"} • Supprimé le{" "}
                      {new Date(item.deletedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onRestore(item)}
                    className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Restaurer"
                  >
                    <RotateCcw size={18} />
                  </button>
                  <button
                    onClick={() => onDelete(item.trashId)}
                    className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
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
        <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400 italic">
            Les éléments restaurés retourneront dans leur projet d'origine.
          </p>
        </div>
      </div>
    </div>
  );
}
