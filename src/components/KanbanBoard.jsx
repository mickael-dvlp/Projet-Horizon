import { useState } from "react";
import { DndContext, closestCorners, DragOverlay } from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import Column from "@/components/Column";
import PageCard from "@/components/PageCard";
import TaskList from "@/components/TaskList";
import PlanView from "@/components/views/PlanView";
import { Plus, ListTodo, LayoutGrid, ListTree } from "lucide-react";

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
  projectSuperName,
  onRename: onRenamePage,
  onDeleteColumn,
  onSetPageStatus,
  onSetPagePriority,
  onSetPageDeadline,
  subProjectTasks = [],
  onAddSubProjectTask,
  onToggleSubProjectTask,
  onDeleteSubProjectTask,
  hasMainBg = false,
  onOpenDashboard,
}) {
  const [isTasksOpen, setIsTasksOpen] = useState(false);
  const [view, setView] = useState("board");
  const totalPages = columns.reduce((acc, col) => acc + col.pages.length, 0);
  const undoneTasksCount = subProjectTasks.filter((t) => !t.done).length;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex-1 flex flex-col overflow-hidden">
        <header
          className={`relative px-4 md:px-8 pl-16 md:pl-8 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center gap-3 justify-between shrink-0 ${
            hasMainBg ? "" : "bg-white dark:bg-slate-900"
          }`}
        >
          <div className="min-w-0">
            {projectSuperName && (
              onOpenDashboard ? (
                <button
                  onClick={onOpenDashboard}
                  className="text-[10px] font-bold text-indigo-400 dark:text-indigo-500 uppercase tracking-widest mb-0.5 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors truncate max-w-full"
                  title="Retour au tableau de bord de l'univers"
                >
                  {projectSuperName}
                </button>
              ) : (
                <p className="text-[10px] font-bold text-indigo-400 dark:text-indigo-500 uppercase tracking-widest mb-0.5">
                  {projectSuperName}
                </p>
              )
            )}
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate">
              {projectName}
            </h1>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-medium">
              {columns.length} arc{columns.length !== 1 ? "s" : ""} ·{" "}
              {totalPages} chapitre{totalPages !== 1 ? "s" : ""}
            </p>
          </div>

          {/* En dessous du point de repère mobile, l'en-tête est empilé (flex-col
              ci-dessus) ; à partir de md, titre et actions partagent la même ligne
              (justify-between) — jamais de positionnement en absolute qui pourrait
              chevaucher le titre à une largeur intermédiaire (ex. 768-1024px). */}
          <div className="flex items-center gap-2 shrink-0 overflow-x-auto custom-scrollbar -mx-1 px-1 md:mx-0 md:px-0">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 shrink-0">
              <button
                onClick={() => setView("plan")}
                title="Vue Plan"
                className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-md transition-colors ${
                  view === "plan"
                    ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
              >
                <ListTree size={14} />
                Plan
              </button>
              <button
                onClick={() => setView("board")}
                title="Vue Arcs"
                className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-md transition-colors ${
                  view === "board"
                    ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
              >
                <LayoutGrid size={14} />
                Arcs
              </button>
            </div>
            {onAddSubProjectTask && (
              <button
                onClick={() => setIsTasksOpen((v) => !v)}
                aria-label={`Tâches — ${undoneTasksCount} élément${undoneTasksCount !== 1 ? "s" : ""} non terminé${undoneTasksCount !== 1 ? "s" : ""}`}
                className={`relative flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg transition-colors border shrink-0 ${
                  isTasksOpen
                    ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/50"
                    : "text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-500/50"
                }`}
              >
                <ListTodo size={15} />
                Tâches
                {undoneTasksCount > 0 && (
                  <span aria-hidden="true" className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center">
                    {undoneTasksCount}
                  </span>
                )}
              </button>
            )}
            {view === "board" && (
              <button
                onClick={addColumn}
                className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 px-3 py-2 rounded-lg transition-colors border border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-500/50 shrink-0"
              >
                <Plus size={15} />
                Nouvel arc
              </button>
            )}
          </div>
        </header>

        {isTasksOpen && onAddSubProjectTask && (
          <div className="px-8 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 shrink-0">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Tâches du livre
            </p>
            <TaskList
              tasks={subProjectTasks}
              onAdd={onAddSubProjectTask}
              onToggle={onToggleSubProjectTask}
              onDelete={onDeleteSubProjectTask}
            />
          </div>
        )}

        {view === "plan" ? (
          <PlanView columns={columns} onPageClick={setActivePage} />
        ) : (
          <div className="flex-1 flex flex-wrap gap-5 items-start overflow-y-auto p-6 pb-4 custom-scrollbar content-start">
            <SortableContext
              items={columns.map((c) => c.id)}
              strategy={horizontalListSortingStrategy}
            >
              {columns.map((col) => (
                <Column
                  key={col.id}
                  {...col}
                  onPageClick={setActivePage}
                  onAddPage={(title) => addPage(col.id, title)}
                  onRenamePage={onRenamePage}
                  onDeleteColumn={() => onDeleteColumn(col.id)}
                  onSetPageStatus={onSetPageStatus}
                  onSetPagePriority={onSetPagePriority}
                  onSetPageDeadline={onSetPageDeadline}
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
        )}
      </div>

      <DragOverlay>
        {draggedItem &&
          (draggedItem.type === "Column" ? (
            <div className="w-72 p-4 rounded-xl border border-indigo-200 dark:border-indigo-500/50 bg-white dark:bg-slate-900 shadow-xl font-semibold text-slate-700 dark:text-slate-200 opacity-90">
              {draggedItem.title}
            </div>
          ) : (
            <PageCard title={draggedItem.title} id={draggedItem.id} />
          ))}
      </DragOverlay>
    </DndContext>
  );
}
