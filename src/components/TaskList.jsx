"use client";
import { Check, Plus, X } from "lucide-react";
import { useCreateForm } from "@/hooks/useCreateForm";

export default function TaskList({ tasks = [], onAdd, onToggle, onDelete }) {
  const {
    value: newLabel,
    setValue: setNewLabel,
    submit: handleAdd,
    handleKeyDown: handleLabelKeyDown,
  } = useCreateForm(onAdd);

  const done = tasks.filter((t) => t.done).length;

  return (
    <div className="flex flex-col gap-1.5">
      {tasks.length > 0 && (
        <div className="flex items-center gap-2 mb-0.5">
          <div className="flex-1 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${(done / tasks.length) * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium tabular-nums shrink-0">
            {done}/{tasks.length}
          </span>
        </div>
      )}

      {tasks.map((task) => (
        <div key={task.id} className="group flex items-center gap-2 px-1">
          <button
            onClick={() => onToggle(task.id)}
            aria-label={task.done ? `Marquer "${task.label}" non terminée` : `Marquer "${task.label}" terminée`}
            aria-pressed={task.done}
            className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
              task.done
                ? "bg-emerald-500 border-emerald-500 text-white"
                : "border-slate-300 dark:border-slate-600 hover:border-indigo-400"
            }`}
          >
            {task.done && <Check size={11} />}
          </button>
          <span
            className={`flex-1 text-sm min-w-0 truncate ${
              task.done
                ? "text-slate-400 dark:text-slate-600 line-through"
                : "text-slate-700 dark:text-slate-200"
            }`}
          >
            {task.label}
          </span>
          <button
            onClick={() => onDelete(task.id)}
            className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-300 dark:text-slate-600 hover:text-red-500 transition-all shrink-0"
            title="Supprimer"
          >
            <X size={13} />
          </button>
        </div>
      ))}

      <form onSubmit={handleAdd} className="flex items-center gap-1.5 px-1 mt-0.5">
        <Plus size={13} className="text-slate-300 dark:text-slate-600 shrink-0" />
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onBlur={handleAdd}
          onKeyDown={handleLabelKeyDown}
          placeholder="Ajouter une tâche..."
          className="flex-1 min-w-0 text-sm bg-transparent outline-none text-slate-700 dark:text-slate-200 placeholder:text-slate-300 dark:placeholder:text-slate-600 py-0.5"
        />
      </form>
    </div>
  );
}
