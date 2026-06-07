"use client";
// Composant de la page d'accueil avec une image de fond, un slogan et un bouton pour ouvrir la modale d'authentification
import { useState, useRef, useEffect } from "react";
import {
  useSortable,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";

import { CSS } from "@dnd-kit/utilities";
// Icônes venant de la dépendance React-lucide
import {
  MoreHorizontal,
  Pencil,
  PlusCircle,
  Palette,
  Trash2,
} from "lucide-react";
import PageCard from "./PageCard";

export default function Column({
  id,
  title,
  pages,
  color = "indigo",
  onAddPage,
  onRename,
  onDeletePage,
  onPageClick,
  onChangeColor,
  onRenamePage,
  onDeleteColumn,
}) {
  // États pour la gestion du menu de la colonne et de l'édition du titre
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const inputRef = useRef(null);

  // 1. Hook pour permettre de TRIER cette colonne
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: id,
    data: { type: "Column" },
  });

  // Hook pour permettre de DÉPOSER des pages dans cette colonne
  const { setNodeRef: setDroppableRef } = useDroppable({
    id: id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Mapping des couleurs pour les différentes options de personnalisation de la colonne
  const colorMaps = {
    indigo: "border-t-indigo-500 bg-indigo-50/30",
    amber: "border-t-amber-500 bg-amber-50/30",
    emerald: "border-t-emerald-500 bg-emerald-50/30",
    rose: "border-t-rose-500 bg-rose-50/30",
    slate: "border-t-slate-500 bg-slate-50/30",
  };

  // Effet pour gérer le focus sur le champ de saisie lors de l'édition du titre de la colonne
  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  // Fonction pour gérer la sauvegarde du nouveau titre de la colonne, en vérifiant que le champ n'est pas vide
  const handleSave = () => {
    if (editValue.trim() !== "") onRename(editValue);
    else setEditValue(title);
    setIsEditing(false);
  };

  return (
    <div
      ref={setSortableRef}
      style={style}
      className={`w-72 shrink-0 flex flex-col gap-4 p-4 rounded-2xl border border-slate-200 border-t-4 ${
        colorMaps[color] || colorMaps.slate
      } shadow-sm transition-all bg-white/50`}
    >
      {/* En-tête de la colonne */}
      <div
        {...attributes}
        {...listeners}
        className="flex items-center justify-between relative px-1 cursor-grab active:cursor-grabbing"
      >
        {isEditing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            onClick={(e) => e.stopPropagation()}
            className="font-bold text-slate-700 bg-white border border-indigo-300 rounded px-1 outline-none w-full"
          />
        ) : (
          <h3 className="font-bold text-slate-700 flex items-center gap-2 truncate">
            {title}
            <span className="text-[10px] bg-white border border-slate-200 text-slate-500 px-2 py-0.5 rounded-full">
              {pages.length}
            </span>
          </h3>
        )}
        {/* Bouton du menu de la colonne */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsMenuOpen(!isMenuOpen);
          }}
          className="p-1 hover:bg-white rounded-md text-slate-400 transition-colors"
        >
          <MoreHorizontal size={18} />
        </button>

        {isMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsMenuOpen(false)}
            />
            <div className="absolute right-0 top-8 w-52 bg-white border border-slate-200 rounded-xl shadow-2xl z-20 py-2 animate-in fade-in zoom-in-95 duration-150">
              {/* Option : Modifier le nom */}
              <button
                onClick={() => {
                  setIsEditing(true);
                  setIsMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Pencil size={14} /> Modifier le nom
              </button>
              {/* Option : Supprimer le groupe */}
              <button
                onClick={() => {
                  onDeleteColumn();
                  setIsMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={14} /> Supprimer le groupe
              </button>

              <div className="h-px bg-slate-100 my-1" />

              {/* Option : Changer couleur */}
              <div className="px-4 py-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Palette size={12} /> Couleurs
                </p>
                <div className="flex gap-2 flex-wrap">
                  {Object.keys(colorMaps).map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        onChangeColor(c);
                        setIsMenuOpen(false);
                      }}
                      className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 active:scale-95 ${
                        color === c
                          ? "border-slate-400 ring-2 ring-slate-100"
                          : "border-transparent"
                      }`}
                      style={{
                        // Correspondance des couleurs pour les boutons de sélection dans le menu, en fonction des options disponibles
                        backgroundColor:
                          c === "slate"
                            ? "#64748b"
                            : c === "indigo"
                              ? "#6366f1"
                              : c === "amber"
                                ? "#f59e0b"
                                : c === "emerald"
                                  ? "#10b981"
                                  : c === "rose"
                                    ? "#f43f5e"
                                    : "#cbd5e1",
                      }}
                      title={c}
                    />
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ZONE DE LISTE DES PAGES */}
      <div ref={setDroppableRef} className="flex flex-col gap-2 min-h-37.5">
        <SortableContext
          items={pages.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          {pages.map((page) => (
            <PageCard
              key={page.id}
              id={page.id}
              title={page.title}
              onClick={() => onPageClick(page)}
              onRename={onRenamePage}
              onDelete={() => onDeletePage(page.id)}
            />
          ))}
        </SortableContext>

        {pages.length === 0 && (
          <div className="flex-1 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center p-4 bg-slate-50/50">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
              Vide
            </p>
          </div>
        )}
      </div>

      {/* Bouton pour ajouter une page */}
      <button
        onClick={onAddPage}
        className={`flex items-center gap-2 w-full p-2 text-xs font-semibold transition-colors mt-auto rounded-lg
    ${
      color === "indigo"
        ? "text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50"
        : color === "amber"
          ? "text-amber-400 hover:text-amber-600 hover:bg-amber-50"
          : color === "emerald"
            ? "text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50"
            : color === "rose"
              ? "text-rose-400 hover:text-rose-600 hover:bg-rose-50"
              : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
    }
  `}
      >
        <PlusCircle size={16} />
        <span>Ajouter une page</span>
      </button>
    </div>
  );
}

// Composant représentant une colonne du tableau Kanban, avec des fonctionnalités de tri, de dépôt de pages, d'édition du titre, de changement de couleur et de suppression
