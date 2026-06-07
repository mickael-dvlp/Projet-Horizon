"use client";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FileText, MoreVertical, Trash2, Edit2, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export default function PageCard({ id, title, onClick, onDelete, onRename }) {
  const [showOptions, setShowOptions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const inputRef = useRef(null);

  // Hook pour rendre la carte de page "sortable" (déplaçable)
  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  // Hook pour gérer le tri de la carte de page, avec des styles dynamiques pendant le drag
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: isEditing }); // On désactive le drag pendant l'édition

  // Styles dynamiques pour la carte pendant le drag
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    cursor: isEditing ? "text" : "grab",
  };

  // Fonction pour gérer la sauvegarde du nouveau titre de la page
  const handleSave = () => {
    if (editValue.trim() !== "" && editValue !== title) {
      onRename(id, editValue); // On passe l'ID et le nouveau titre
    } else {
      setEditValue(title);
    }
    setIsEditing(false);
  };

  return (
    <div
      // Référence pour le tri, styles dynamiques, et gestion des événements de clic et de drag
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group relative bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all flex items-center gap-3 ${
        isEditing ? "ring-2 ring-indigo-400 border-transparent" : ""
      }`}
      onClick={(e) => {
        if (showOptions || isEditing) return;
        onClick();
      }}
    >
      <div className="p-2 bg-slate-50 rounded-lg text-slate-400 group-hover:text-indigo-500 group-hover:bg-indigo-50 transition-colors">
        <FileText size={18} />
      </div>

      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") {
                setEditValue(title);
                setIsEditing(false);
              }
            }}
            className="w-full bg-transparent font-medium text-slate-700 outline-none text-sm"
          />
        ) : (
          <span className="block font-medium text-slate-700 truncate text-sm">
            {title || "Sans titre"}
          </span>
        )}
      </div>

      {/* Menu d'options ou bouton de validation */}
      <div className="relative flex items-center">
        {isEditing ? (
          <button
            onClick={handleSave}
            className="text-emerald-500 hover:text-emerald-600"
          >
            <Check size={18} />
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowOptions(!showOptions);
            }}
            className="p-1 hover:bg-slate-100 rounded text-slate-400"
          >
            <MoreVertical size={16} />
          </button>
        )}

        {/* Menu d'options */}
        {showOptions && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowOptions(false)}
            />
            <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-slate-200 rounded-lg shadow-xl z-20 py-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                  setShowOptions(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"
              >
                <Edit2 size={12} /> Renommer
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                  setShowOptions(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50"
              >
                <Trash2 size={12} /> Supprimer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
