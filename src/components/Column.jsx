"use client";
import { useState, useRef, useEffect } from "react";
import {
  useSortable,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { MoreHorizontal, Pencil, Plus, Palette, Trash2 } from "lucide-react";
import PageCard from "./PageCard";
import { colorConfig, swatchColors } from "@/lib/arcColors";
import { useCreateForm } from "@/hooks/useCreateForm";

export default function Column({
  id,
  title,
  pages,
  color = "slate",
  onAddPage,
  onRename,
  onDeletePage,
  onPageClick,
  onChangeColor,
  onRenamePage,
  onDeleteColumn,
  onSetPageStatus,
  onSetPagePriority,
  onSetPageDeadline,
  autoEdit = false,
  onAutoEditHandled,
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const [isAddingPage, setIsAddingPage] = useState(false);
  const inputRef = useRef(null);
  const newPageRef = useRef(null);
  const addPageButtonRef = useRef(null);

  const {
    value: newPageTitle,
    setValue: setNewPageTitle,
    submit: handleConfirmAddPage,
    cancel: handleCancelAddPage,
    handleKeyDown: handleAddPageKeyDown,
  } = useCreateForm(onAddPage, {
    onClose: () => setIsAddingPage(false),
    triggerRef: addPageButtonRef,
  });

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, data: { type: "Column" } });

  const { setNodeRef: setDroppableRef } = useDroppable({ id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const colors = colorConfig[color] || colorConfig.slate;

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (autoEdit) {
      setIsEditing(true);
      onAutoEditHandled?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoEdit]);

  useEffect(() => {
    if (isAddingPage) newPageRef.current?.focus();
  }, [isAddingPage]);

  const handleSave = () => {
    if (editValue.trim()) onRename(editValue);
    else setEditValue(title);
    setIsEditing(false);
  };

  return (
    <div
      ref={setSortableRef}
      style={style}
      className={`w-72 shrink-0 flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 border-t-4 shadow-sm dark:shadow-none ${colors.border}`}
    >
      <div className="flex flex-col gap-3 p-3 flex-1">
        <div
          {...attributes}
          {...listeners}
          className="flex items-center justify-between cursor-grab active:cursor-grabbing px-1 relative"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {isEditing ? (
              <input
                ref={inputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    setEditValue(title);
                    setIsEditing(false);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Nouveau nom de l’arc ${title}`}
                className="font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-500/50 rounded-md px-2 py-0.5 outline-none w-full text-sm shadow-sm"
              />
            ) : (
              <>
                <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm truncate">
                  {title}
                </h3>
                <span
                  className={`text-[11px] px-1.5 py-0.5 rounded-md font-semibold shrink-0 ${colors.badge}`}
                >
                  {pages.length}
                </span>
              </>
            )}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen(!isMenuOpen);
            }}
            aria-label={`Options de l’arc ${title}`}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors ml-1 shrink-0"
          >
            <MoreHorizontal size={16} />
          </button>

          {isMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setIsMenuOpen(false)}
              />
              <div className="absolute right-0 top-8 w-52 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-20 py-1.5 animate-in fade-in zoom-in-95 duration-100">
                <button
                  onClick={() => {
                    setIsEditing(true);
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <Pencil size={14} /> Modifier le nom
                </button>
                <button
                  onClick={() => {
                    onDeleteColumn();
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 size={14} /> Supprimer l&apos;arc
                </button>
                <div className="h-px bg-slate-100 dark:bg-slate-700 my-1.5 mx-3" />
                <div className="px-4 py-1.5">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Palette size={10} /> Couleur
                  </p>
                  <div className="flex gap-2">
                    {Object.entries(swatchColors).map(([name, hex]) => (
                      <button
                        key={name}
                        onClick={() => {
                          onChangeColor(name);
                          setIsMenuOpen(false);
                        }}
                        className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${
                          color === name
                            ? "ring-2 ring-offset-1 dark:ring-offset-slate-800 ring-slate-400"
                            : ""
                        }`}
                        style={{ backgroundColor: hex }}
                        title={name}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div
          ref={setDroppableRef}
          className="flex flex-col gap-2 min-h-30 max-h-80 overflow-y-auto custom-scrollbar pr-1"
        >
          <SortableContext
            items={pages.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            {pages.map((page) => (
              <PageCard
                key={page.id}
                id={page.id}
                title={page.title}
                status={page.status}
                priority={page.priority}
                deadline={page.deadline}
                onClick={() => onPageClick(page)}
                onRename={onRenamePage}
                onDelete={() => onDeletePage(page.id)}
                onSetStatus={onSetPageStatus}
                onSetPriority={onSetPagePriority}
                onSetDeadline={onSetPageDeadline}
              />
            ))}
          </SortableContext>

          {isAddingPage && (
            <form
              onSubmit={handleConfirmAddPage}
              className="bg-white dark:bg-slate-800 rounded-lg border border-indigo-300 dark:border-indigo-500/50 ring-2 ring-indigo-100 dark:ring-indigo-500/20 px-3 py-2.5 shadow-sm"
            >
              <input
                ref={newPageRef}
                value={newPageTitle}
                onChange={(e) => setNewPageTitle(e.target.value)}
                onBlur={handleConfirmAddPage}
                onKeyDown={handleAddPageKeyDown}
                placeholder="Nom du chapitre..."
                aria-label="Nom du nouveau chapitre"
                className="w-full bg-transparent font-medium text-slate-800 dark:text-slate-100 outline-none text-sm placeholder:text-slate-300 dark:placeholder:text-slate-600"
              />
            </form>
          )}

          {pages.length === 0 && !isAddingPage && (
            <div className="flex-1 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-center p-6">
              <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                Glissez un chapitre ici
              </p>
            </div>
          )}
        </div>

        <button
          ref={addPageButtonRef}
          onClick={() => setIsAddingPage(true)}
          className={`flex items-center gap-2 w-full px-2 py-1.5 text-xs font-semibold transition-colors rounded-lg ${colors.addBtn}`}
        >
          <Plus size={14} />
          Ajouter un chapitre
        </button>
      </div>
    </div>
  );
}
