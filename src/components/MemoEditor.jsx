"use client";
import { useState, useEffect } from "react";
import { X, Save } from "lucide-react";

export default function MemoEditor({ page, onClose, onSave }) {
  const [content, setContent] = useState(page?.content || "");

  useEffect(() => {
    setContent(page?.content || "");
  }, [page]);

  const handleSave = () => {
    onSave(page.id, { content });
    onClose();
  };

  return (
    <>
      {/* L'OVERLAY : La fenêtre de fond */}
      <div
        className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* La fenêtre à droite */}
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white h-full flex flex-col shadow-2xl z-50 animate-in slide-in-from-right duration-300 border-l border-slate-200">
        {/* EN-TÊTE */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-1">
              Mémo
            </span>
            <h2 className="font-bold text-slate-800 truncate pr-4 text-lg italic">
              {page.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* ZONE DE TEXTE */}
        <textarea
          className="flex-1 p-8 outline-none resize-none text-slate-600 leading-relaxed text-base font-medium placeholder:text-slate-300 placeholder:italic bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] bg-size-[20px_20px]"
          placeholder="Écrivez votre mémo ici..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          autoFocus
        />

        {/* PIED DE PAGE */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-500 font-semibold hover:text-slate-700 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-semibold shadow-md transition-all active:scale-95 shadow-indigo-200"
          >
            <Save size={18} />
            Enregistrer
          </button>
        </div>
      </div>
    </>
  );
}

// Composant de l'éditeur de mémo, affiché en overlay pour permettre la création et la modification du contenu d'une page, avec des fonctionnalités d'enregistrement et d'annulation
