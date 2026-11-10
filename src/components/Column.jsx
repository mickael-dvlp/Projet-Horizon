"use client";
import { useState, useRef, useEffect } from "react";
import {
  useSortable,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MoreHorizontal, Pencil, Plus, Palette, Trash2 } from "lucide-react";
import PageCard from "./PageCard";
import Popover from "./Popover";
import { MenuSeparator } from "./MetaMenu";
import { colorConfig, swatchColors } from "@/lib/arcColors";
import { useCreateForm } from "@/hooks/useCreateForm";
import { useInlineRename } from "@/hooks/useInlineRename";
import { useConfirm } from "@/components/ConfirmDialog";

// Un arc du tableau. `onUpdate(champs)` modifie l'arc ({ title } ou
// { color }) ; `onUpdatePage(id, champs)` modifie l'un de ses chapitres.
export default function Column({
  id,
  title,
  pages,
  color = "slate",
  onAddPage,
  onUpdate,
  onDeleteColumn,
  onPageClick,
  onUpdatePage,
  onDeletePage,
  autoEdit = false,
  onAutoEditHandled,
}) {
  const confirm = useConfirm();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAddingPage, setIsAddingPage] = useState(false);
  const newPageRef = useRef(null);
  const addPageButtonRef = useRef(null);
  const rename = useInlineRename((newTitle) => onUpdate({ title: newTitle }));

  const {
    value: newPageTitle,
    setValue: setNewPageTitle,
    submit: handleConfirmAddPage,
    handleKeyDown: handleAddPageKeyDown,
  } = useCreateForm(onAddPage, {
    onClose: () => setIsAddingPage(false),
    triggerRef: addPageButtonRef,
  });

  // L'en-tête est le déclencheur du déplacement : le déclarer comme tel évite
  // qu'un Espace tapé dans le champ de renommage ou sur le bouton d'options
  // (tous deux dans l'en-tête) ne lance un déplacement au clavier.
  // Pas de useDroppable séparé : useSortable enregistre déjà la colonne
  // entière comme zone de dépôt sous cet id (y compris quand elle est vide).
  // Un second droppable au même id entrait en conflit avec le premier.
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, data: { type: "Column" } });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const colors = colorConfig[color] || colorConfig.slate;

  useEffect(() => {
    if (autoEdit) {
      rename.start(undefined, title);
      onAutoEditHandled?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoEdit]);

  useEffect(() => {
    if (isAddingPage) newPageRef.current?.focus();
  }, [isAddingPage]);

  return (
    <div
      ref={setSortableRef}
      style={style}
      className={`w-72 shrink-0 flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 border-t-4 shadow-sm dark:shadow-none ${colors.border}`}
    >
      <div className="flex flex-col gap-3 p-3 flex-1">
        <div
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="flex items-center justify-between cursor-grab active:cursor-grabbing px-1 relative"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {rename.isEditing() ? (
              <input
                {...rename.inputProps}
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
            <Popover onClose={() => setIsMenuOpen(false)} className="right-0 top-8 w-52 rounded-xl z-20 py-1.5">
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  rename.start(undefined, title);
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <Pencil size={14} /> Modifier le nom
              </button>
              <button
                onClick={async () => {
                  setIsMenuOpen(false);
                  const ok = await confirm({
                    title: `Supprimer l’arc « ${title} » ?`,
                    message: "L’arc et ses chapitres seront placés dans la corbeille.",
                    confirmLabel: "Supprimer",
                    danger: true,
                  });
                  if (ok) onDeleteColumn();
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={14} /> Supprimer l&apos;arc
              </button>
              <MenuSeparator />
              <div className="px-4 py-1.5">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Palette size={10} /> Couleur
                </p>
                <div className="flex gap-2">
                  {Object.entries(swatchColors).map(([name, hex]) => (
                    <button
                      key={name}
                      onClick={() => {
                        onUpdate({ color: name });
                        setIsMenuOpen(false);
                      }}
                      className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${
                        color === name
                          ? "ring-2 ring-offset-1 dark:ring-offset-slate-800 ring-slate-400"
                          : ""
                      }`}
                      style={{ backgroundColor: hex }}
                      title={name}
                      aria-label={`Couleur ${name}`}
                    />
                  ))}
                </div>
              </div>
            </Popover>
          )}
        </div>

        <div className="flex flex-col gap-2 min-h-30 max-h-80 overflow-y-auto custom-scrollbar pr-1">
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
                onDelete={() => onDeletePage(page.id)}
                onUpdate={onUpdatePage}
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
