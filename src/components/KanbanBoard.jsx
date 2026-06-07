// Composant principal du tableau Kanban, gérant le contexte de glisser-déposer et affichant les colonnes et les cartes de page
import { DndContext, closestCorners, DragOverlay } from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import Column from "@/components/Column";
import PageCard from "@/components/PageCard";
import { Plus } from "lucide-react";

export default function KanbanBoard({
  columns,
  sensors,
  handleDragStart,
  handleDragOver,
  handleDragEnd,
  setActivePage,
  addPage,
  setColumns,
  deletePage,
  draggedItem,
  addColumn,
  projectName,
  onRename: onRenamePage,
  onDeleteColumn,
}) {
  return (
    // Contexte de glisser-déposer pour gérer les interactions de déplacement des colonnes et des cartes de page
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex-1 p-8 flex flex-col overflow-hidden">
        <header className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">
              {projectName}
            </h1>
            <p className="text-slate-400 text-sm italic mt-1 font-medium">
              Glissez les pages ou les blocs pour organiser.
            </p>
          </div>
          <button
            onClick={addColumn}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl shadow-lg transition-all flex items-center gap-2"
          >
            <Plus size={20} /> Créer un groupe
          </button>
        </header>

        <div className="flex gap-8 items-start overflow-x-auto pb-6 h-full custom-scrollbar">
          {/* Colonnes du tableau Kanban */}
          <SortableContext
            items={columns.map((c) => c.id)}
            strategy={horizontalListSortingStrategy}
          >
            {columns.map((col) => (
              // Composant de chaque colonne, avec des props pour gérer les interactions et les données de la colonne
              <Column
                key={col.id}
                {...col}
                onPageClick={setActivePage}
                onAddPage={() => addPage(col.id)}
                onRenamePage={onRenamePage}
                onDeleteColumn={() => onDeleteColumn(col.id)}
                onRename={(newName) =>
                  setColumns((prev) =>
                    prev.map((c) =>
                      c.id === col.id ? { ...c, title: newName } : c,
                    ),
                  )
                }
                onDeletePage={deletePage}
                onChangeColor={(color) =>
                  setColumns((prev) =>
                    prev.map((c) => (c.id === col.id ? { ...c, color } : c)),
                  )
                }
              />
            ))}
          </SortableContext>
        </div>
      </div>
      {/* Overlay pour l'élément glissé */}
      <DragOverlay>
        {draggedItem &&
          (draggedItem.type === "Column" ? (
            <div className="w-72 p-4 rounded-2xl border-2 border-indigo-400 bg-white shadow-2xl opacity-80 font-bold">
              {draggedItem.title}
            </div>
          ) : (
            <PageCard title={draggedItem.title} id={draggedItem.id} />
          ))}
      </DragOverlay>
    </DndContext>
  );
}
