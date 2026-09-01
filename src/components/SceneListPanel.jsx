"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Layers, MoreHorizontal, Pencil } from "lucide-react";
import { StatusDot, StatusMenu } from "@/components/StatusPicker";
import { PriorityDot, PriorityMenu } from "@/components/PriorityPicker";
import DeadlineField from "@/components/DeadlineField";
import { formatShortDate } from "@/lib/date";
import { useCreateForm } from "@/hooks/useCreateForm";

export default function SceneListPanel({ id, scenes = [], onOpen, onAdd, onDelete, onUpdate }) {
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [editingSceneId, setEditingSceneId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef(null);
  const {
    value: newTitle,
    setValue: setNewTitle,
    submit: handleAdd,
    handleKeyDown: handleTitleKeyDown,
  } = useCreateForm(onAdd);

  useEffect(() => {
    if (editingSceneId) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [editingSceneId]);

  const startRename = (scene) => {
    setEditValue(scene.title || "");
    setEditingSceneId(scene.id);
    setMenuOpenId(null);
  };

  const saveRename = () => {
    const trimmed = editValue.trim();
    if (trimmed) onUpdate(editingSceneId, { title: trimmed });
    setEditingSceneId(null);
  };

  return (
    <div id={id} className="flex-1 overflow-y-auto custom-scrollbar px-8 py-6">
      {scenes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-slate-300 dark:text-slate-700">
          <Layers size={32} strokeWidth={1.5} />
          <p className="mt-3 text-sm italic">Aucune scène pour l’instant</p>
        </div>
      ) : (
        <div className="flex flex-col border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 mb-4">
          {scenes.map((scene) => {
            const done = (scene.tasks || []).filter((t) => t.done).length;
            const total = (scene.tasks || []).length;
            return (
              <div
                key={scene.id}
                className="group relative flex items-center gap-1 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                {editingSceneId === scene.id ? (
                  <input
                    ref={editInputRef}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={saveRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveRename();
                      if (e.key === "Escape") {
                        e.stopPropagation();
                        setEditingSceneId(null);
                      }
                    }}
                    aria-label={`Nouveau nom de la scène ${scene.title || "Sans titre"}`}
                    className="flex-1 min-w-0 mx-4 my-2 text-sm font-medium bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-500/50 rounded-md px-2 py-1 outline-none text-slate-700 dark:text-slate-200"
                  />
                ) : (
                  <button
                    onClick={() => onOpen(scene.id)}
                    className="flex-1 min-w-0 flex flex-col gap-0.5 px-4 py-2.5 text-left"
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <StatusDot status={scene.status} />
                      <span className="flex-1 min-w-0 truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                        {scene.title || "Sans titre"}
                      </span>
                      <PriorityDot priority={scene.priority} />
                      {total > 0 && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium tabular-nums shrink-0">
                          {done}/{total}
                        </span>
                      )}
                    </span>
                    {scene.deadline && (
                      <span className="pl-5 text-[10px] text-slate-400 dark:text-slate-500">
                        {formatShortDate(scene.deadline)}
                      </span>
                    )}
                  </button>
                )}
                <button
                  onClick={() => setMenuOpenId(menuOpenId === scene.id ? null : scene.id)}
                  aria-label={`Options de la scène ${scene.title || "Sans titre"}`}
                  className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1.5 mr-2 text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 transition-all shrink-0"
                  title="Options"
                >
                  <MoreHorizontal size={16} />
                </button>

                {menuOpenId === scene.id && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpenId(null)} />
                    <div className="absolute right-2 top-full mt-1 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-20 py-1 animate-in fade-in zoom-in-95 duration-100">
                      <button
                        onClick={() => startRename(scene)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium"
                      >
                        <Pencil size={12} /> Renommer
                      </button>
                      <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-3" />
                      <p className="px-3 pt-1 pb-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        Statut
                      </p>
                      <StatusMenu value={scene.status} onChange={(status) => onUpdate(scene.id, { status })} />
                      <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-3" />
                      <p className="px-3 pt-0.5 pb-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        Priorité
                      </p>
                      <PriorityMenu value={scene.priority} onChange={(priority) => onUpdate(scene.id, { priority })} />
                      <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-3" />
                      <div className="px-3 pt-0.5 pb-1.5">
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                          Échéance
                        </p>
                        <DeadlineField
                          value={scene.deadline}
                          onChange={(deadline) => {
                            onUpdate(scene.id, { deadline });
                            setMenuOpenId(null);
                          }}
                        />
                      </div>
                      <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-3" />
                      <button
                        onClick={() => {
                          setMenuOpenId(null);
                          if (confirm(`Supprimer la scène "${scene.title || "Sans titre"}" ?`)) onDelete(scene.id);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 font-medium"
                      >
                        <Trash2 size={12} /> Supprimer
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row sm:items-center gap-2">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onBlur={handleAdd}
          onKeyDown={handleTitleKeyDown}
          placeholder="Nom de la nouvelle scène..."
          className="flex-1 min-w-0 text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300/40 dark:focus:ring-indigo-500/30 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder:text-slate-300 dark:placeholder:text-slate-600"
        />
        <button
          type="submit"
          disabled={!newTitle.trim()}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors shrink-0"
        >
          <Plus size={14} />
          Ajouter
        </button>
      </form>
    </div>
  );
}
