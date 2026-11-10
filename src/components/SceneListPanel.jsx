"use client";
import { useState } from "react";
import { Plus, Trash2, Layers, MoreHorizontal, Pencil } from "lucide-react";
import { StatusDot } from "@/components/StatusPicker";
import { PriorityDot } from "@/components/PriorityPicker";
import Popover from "@/components/Popover";
import MetaMenu, { MenuSeparator } from "@/components/MetaMenu";
import { formatShortDate } from "@/lib/date";
import { useCreateForm } from "@/hooks/useCreateForm";
import { useInlineRename } from "@/hooks/useInlineRename";
import { useConfirm } from "@/components/ConfirmDialog";

export default function SceneListPanel({ id, scenes = [], onOpen, onAdd, onDelete, onUpdate }) {
  const confirm = useConfirm();
  const [menuOpenId, setMenuOpenId] = useState(null);
  const rename = useInlineRename((title, sceneId) => onUpdate(sceneId, { title }));
  const {
    value: newTitle,
    setValue: setNewTitle,
    submit: handleAdd,
    handleKeyDown: handleTitleKeyDown,
  } = useCreateForm(onAdd);

  // Échéance : referme le menu (choix ponctuel) ; statut/priorité le
  // laissent ouvert pour pouvoir enchaîner les réglages.
  const updateFromMenu = (sceneId, fields) => {
    onUpdate(sceneId, fields);
    if ("deadline" in fields) setMenuOpenId(null);
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
            const sceneTitle = scene.title || "Sans titre";
            return (
              <div
                key={scene.id}
                className="group relative flex items-center gap-1 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                {rename.isEditing(scene.id) ? (
                  <input
                    {...rename.inputProps}
                    aria-label={`Nouveau nom de la scène ${sceneTitle}`}
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
                        {sceneTitle}
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
                  aria-label={`Options de la scène ${sceneTitle}`}
                  className="opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 p-1.5 mr-2 text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 transition-all shrink-0"
                  title="Options"
                >
                  <MoreHorizontal size={16} />
                </button>

                {menuOpenId === scene.id && (
                  <Popover onClose={() => setMenuOpenId(null)} className="right-2 top-full mt-1 w-44 rounded-lg z-20 py-1">
                    <button
                      onClick={() => {
                        setMenuOpenId(null);
                        rename.start(scene.id, scene.title);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium"
                    >
                      <Pencil size={12} /> Renommer
                    </button>
                    <MenuSeparator />
                    <MetaMenu
                      status={scene.status}
                      priority={scene.priority}
                      deadline={scene.deadline}
                      onChange={(fields) => updateFromMenu(scene.id, fields)}
                    />
                    <MenuSeparator />
                    <button
                      onClick={async () => {
                        setMenuOpenId(null);
                        const ok = await confirm({
                          title: `Supprimer la scène « ${sceneTitle} » ?`,
                          message: "Une scène supprimée ne passe pas par la corbeille : son texte sera perdu.",
                          confirmLabel: "Supprimer",
                          danger: true,
                        });
                        if (ok) onDelete(scene.id);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 font-medium"
                    >
                      <Trash2 size={12} /> Supprimer
                    </button>
                  </Popover>
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
