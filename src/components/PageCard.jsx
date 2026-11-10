"use client";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MoreHorizontal, Trash2, Edit2, Check, Flag, Calendar } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { StatusDot, StatusMenu } from "./StatusPicker";
import { PriorityDot, PriorityMenu } from "./PriorityPicker";
import DeadlineField from "./DeadlineField";
import { formatShortDate } from "@/lib/date";

function CardSummary({ title, status, priority, deadline }) {
  return (
    <span className="flex flex-col min-w-0 gap-0.5">
      <span className="flex items-center gap-1.5 min-w-0">
        <StatusDot status={status} />
        <span className="block font-medium text-slate-700 dark:text-slate-200 truncate text-sm leading-snug">
          {title || "Sans titre"}
        </span>
        <PriorityDot priority={priority} />
      </span>
      {deadline && (
        <span className="flex items-center gap-0.5 pl-4 text-[10px] text-slate-400 dark:text-slate-500">
          <Calendar size={9} />
          {formatShortDate(deadline)}
        </span>
      )}
    </span>
  );
}

// Aperçu affiché dans le DragOverlay pendant un déplacement : purement
// visuel. Réutiliser PageCard ici enregistrait un second élément triable
// portant le même id que la carte déplacée, ce que dnd-kit ne supporte pas.
export function PageCardPreview({ title, status, priority, deadline }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-indigo-200 dark:border-indigo-500/50 px-3 py-2.5 shadow-lg cursor-grabbing">
      <CardSummary title={title} status={status} priority={priority} deadline={deadline} />
    </div>
  );
}

export default function PageCard({
  id,
  title,
  status,
  priority,
  deadline,
  onClick,
  onDelete,
  onRename,
  onSetStatus,
  onSetPriority,
  onSetDeadline,
}) {
  const [showOptions, setShowOptions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: isEditing });

  // La carte entière est à la fois l'élément déplacé et son déclencheur :
  // le déclarer comme tel limite le déplacement au clavier (Espace) aux
  // touches pressées sur la carte elle-même, pas sur son bouton d'options.
  const setCardRef = (el) => {
    setNodeRef(el);
    setActivatorNodeRef(el);
  };

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    cursor: isEditing ? "text" : "grab",
  };

  // Repart toujours du titre actuel : il a pu changer depuis le montage
  // (renommage dans l'éditeur), et l'ancienne valeur était sinon réappliquée.
  const startEditing = () => {
    setEditValue(title);
    setIsEditing(true);
  };

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== title) onRename(id, trimmed);
    setIsEditing(false);
  };

  return (
    <div
      ref={setCardRef}
      style={style}
      {...attributes}
      {...listeners}
      // Entrée ouvre le chapitre (la carte est focalisable avec le rôle
      // "button" fourni par dnd-kit, mais rien ne répondait au clavier).
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e);
        if (e.defaultPrevented || e.key !== "Enter" || e.target !== e.currentTarget) return;
        if (showOptions || isEditing) return;
        e.preventDefault();
        onClick();
      }}
      className={`group relative bg-white dark:bg-slate-800 rounded-lg border px-3 py-2.5 transition-all ${
        isEditing
          ? "border-indigo-300 dark:border-indigo-500/50 ring-2 ring-indigo-100 dark:ring-indigo-500/20 shadow-sm"
          : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm dark:hover:shadow-none"
      }`}
      onClick={() => {
        if (showOptions || isEditing) return;
        onClick();
      }}
    >
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") setIsEditing(false);
              }}
              className="w-full bg-transparent font-medium text-slate-800 dark:text-slate-100 outline-none text-sm"
            />
          ) : (
            <CardSummary title={title} status={status} priority={priority} deadline={deadline} />
          )}
        </div>

        <div className="relative shrink-0">
          {isEditing ? (
            <button
              onClick={handleSave}
              aria-label="Confirmer le renommage"
              className="text-emerald-500 hover:text-emerald-600 p-0.5"
            >
              <Check size={15} />
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowOptions(!showOptions);
              }}
              aria-label={`Options du chapitre ${title}`}
              className="p-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400 dark:text-slate-500 transition-all"
            >
              <MoreHorizontal size={15} />
            </button>
          )}

          {showOptions && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowOptions(false)} />
              <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-20 py-1 animate-in fade-in zoom-in-95 duration-100">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startEditing();
                    setShowOptions(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium"
                >
                  <Edit2 size={12} /> Renommer
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                    setShowOptions(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 font-medium"
                >
                  <Trash2 size={12} /> Supprimer
                </button>
                {onSetStatus && (
                  <>
                    <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-3" />
                    <p className="px-3 pt-0.5 pb-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Flag size={10} /> Statut
                    </p>
                    <div onClick={(e) => e.stopPropagation()}>
                      <StatusMenu
                        value={status}
                        onChange={(next) => {
                          onSetStatus(id, next);
                          setShowOptions(false);
                        }}
                      />
                    </div>
                  </>
                )}
                {onSetPriority && (
                  <>
                    <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-3" />
                    <p className="px-3 pt-0.5 pb-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      Priorité
                    </p>
                    <div onClick={(e) => e.stopPropagation()}>
                      <PriorityMenu
                        value={priority}
                        onChange={(next) => {
                          onSetPriority(id, next);
                          setShowOptions(false);
                        }}
                      />
                    </div>
                  </>
                )}
                {onSetDeadline && (
                  <>
                    <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-3" />
                    <div className="px-3 pt-0.5 pb-1.5">
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                        Échéance
                      </p>
                      <DeadlineField
                        value={deadline}
                        onChange={(next) => {
                          onSetDeadline(id, next);
                          setShowOptions(false);
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
