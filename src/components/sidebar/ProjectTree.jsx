"use client";
import { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronRight, Settings, Trash2, Plus, Check, X, BookOpen, Flag } from "lucide-react";
import { StatusDot } from "@/components/StatusPicker";
import Popover from "@/components/Popover";
import MetaMenu from "@/components/MetaMenu";
import { useConfirm } from "@/components/ConfirmDialog";
import { useCreateForm } from "@/hooks/useCreateForm";
import { useInlineRename } from "@/hooks/useInlineRename";

const ACTION_BUTTON =
  "hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors";
const DELETE_BUTTON =
  "hover:bg-red-50 dark:hover:bg-red-500/10 rounded text-slate-400 dark:text-slate-500 hover:text-red-500 transition-colors";
const ROW_ACTIONS =
  "absolute top-1/2 -translate-y-1/2 flex gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity";
const RENAME_INPUT =
  "flex-1 text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-500/50 rounded-md px-2 outline-none min-w-0 shadow-sm";

// Champ de renommage en place (univers ou livre), validé par Entrée, perte
// de focus ou le bouton ✓.
function RenameForm({ rename, label, className, iconSize }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        rename.commit();
      }}
      className={`flex items-center gap-1 ${className}`}
    >
      <input {...rename.inputProps} aria-label={label} className={`${RENAME_INPUT} py-0.5`} />
      <button
        type="submit"
        onMouseDown={(e) => e.preventDefault()}
        aria-label="Valider le nouveau nom"
        className="p-0.5 text-indigo-500 dark:text-indigo-400 shrink-0"
      >
        <Check size={iconSize} />
      </button>
    </form>
  );
}

// Arborescence univers → livres de la barre latérale : sélection, création,
// renommage, statut/priorité/échéance des livres et suppression.
// `onNavigate` est appelé après une sélection (ferme le tiroir mobile).
export default function ProjectTree({
  projects,
  subProjects,
  activeProjectId,
  activeSubProjectId,
  onSelectProject,
  onSelectSubProject,
  onCreate,
  onCreateSubProject,
  onUpdateProject,
  onUpdateSubProject,
  onDeleteProject,
  onDeleteSubProject,
  onNavigate,
}) {
  const confirm = useConfirm();
  const [expandedProjects, setExpandedProjects] = useState(new Set());
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [creatingSubIn, setCreatingSubIn] = useState(null);
  const [metaMenuFor, setMetaMenuFor] = useState(null);
  const newProjectTriggerRef = useRef(null);
  const createProjectRef = useRef(null);
  const createSubRef = useRef(null);

  const projectRename = useInlineRename((name, projectId) => onUpdateProject(projectId, name));
  // Un id de livre est unique dans toute l'app : on retrouve son univers.
  const bookRename = useInlineRename((name, subId) => {
    const projectId = Object.keys(subProjects).find((pid) =>
      subProjects[pid].some((s) => s.id === subId)
    );
    if (projectId) onUpdateSubProject(projectId, subId, { name });
  });

  // Auto-expand le projet qui contient le sous-projet actif. Volontairement fusionné
  // dans le même état que le dépli manuel (expandedProjects) : une fois auto-déplié,
  // le projet reste explicitement déplié tant que l'utilisateur ne le replie pas lui-même.
  useEffect(() => {
    if (!activeSubProjectId) return;
    for (const [projId, subs] of Object.entries(subProjects)) {
      if (subs.some((s) => s.id === activeSubProjectId)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setExpandedProjects((prev) => new Set([...prev, projId]));
        break;
      }
    }
  }, [activeSubProjectId, subProjects]);

  useEffect(() => { if (isCreatingProject) createProjectRef.current?.focus(); }, [isCreatingProject]);
  useEffect(() => { if (creatingSubIn) createSubRef.current?.focus(); }, [creatingSubIn]);

  const expand = (projectId) => setExpandedProjects((prev) => new Set([...prev, projectId]));

  const toggleProject = (projectId) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  // Sélectionner un univers (nom cliqué, distinct du chevron) : le déplie
  // s'il ne l'était pas déjà, et délègue à onSelectProject le choix du livre
  // à activer (dernier livre actif si connu, sinon le premier).
  const selectProject = (projectId) => {
    expand(projectId);
    onSelectProject?.(projectId);
    onNavigate?.();
  };

  const {
    value: newProjectName,
    setValue: setNewProjectName,
    submit: handleCreateProject,
    cancel: cancelCreateProject,
    handleKeyDown: handleCreateProjectKeyDown,
  } = useCreateForm(onCreate, {
    onClose: () => setIsCreatingProject(false),
    triggerRef: newProjectTriggerRef,
  });

  const {
    value: newSubName,
    setValue: setNewSubName,
    submit: handleCreateSub,
    cancel: cancelCreateSub,
    handleKeyDown: handleCreateSubKeyDown,
  } = useCreateForm(
    (title) => {
      if (creatingSubIn) onCreateSubProject(creatingSubIn, title);
    },
    { onClose: () => setCreatingSubIn(null) }
  );

  return (
    <>
      {/* En-tête section Projets */}
      <div className="flex items-center justify-between px-3 mb-1.5 mt-3">
        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
          Univers
        </span>
        <button
          ref={newProjectTriggerRef}
          onClick={() => setIsCreatingProject(true)}
          aria-label="Créer un nouvel univers"
          className="p-1 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-md transition-colors"
          title="Nouvel univers"
        >
          <Plus size={13} />
        </button>
      </div>

      <div className="space-y-0.5">
        {projects.map((project) => {
          const isExpanded = expandedProjects.has(project.id);
          const isActiveProject = activeProjectId === project.id;
          const subs = subProjects[project.id] || [];

          return (
            <div key={project.id}>
              {/* Ligne projet (univers) */}
              {projectRename.isEditing(project.id) ? (
                <RenameForm
                  rename={projectRename}
                  label={`Nouveau nom de l’univers ${project.name}`}
                  className="px-2 py-1"
                  iconSize={13}
                />
              ) : (
                <div
                  className={`group relative flex items-center rounded-lg transition-colors ${
                    isActiveProject
                      ? "bg-indigo-50 dark:bg-indigo-500/10"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  {/* Le chevron déplie/replie uniquement — n'active jamais l'univers. */}
                  <button
                    onClick={() => toggleProject(project.id)}
                    aria-label={isExpanded ? `Replier ${project.name}` : `Déplier ${project.name}`}
                    className="p-1.5 shrink-0 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 rounded-md"
                  >
                    {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  </button>
                  {/* Le nom sélectionne l'univers (dernier livre actif ou premier livre). */}
                  <button
                    onClick={() => selectProject(project.id)}
                    title={project.name}
                    className={`flex-1 min-w-0 text-left py-1.5 pr-20 text-sm font-semibold truncate ${
                      isActiveProject
                        ? "text-indigo-700 dark:text-indigo-400"
                        : "text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    {project.name}
                  </button>
                  <div className={`${ROW_ACTIONS} right-1.5`}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCreatingSubIn(project.id);
                        expand(project.id);
                      }}
                      className={`p-1 ${ACTION_BUTTON}`}
                      title="Ajouter un livre"
                      aria-label={`Ajouter un livre dans ${project.name}`}
                    >
                      <Plus size={11} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        projectRename.start(project.id, project.name);
                      }}
                      className={`p-1 ${ACTION_BUTTON}`}
                      title="Renommer"
                      aria-label={`Renommer l’univers ${project.name}`}
                    >
                      <Settings size={11} />
                    </button>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        const ok = await confirm({
                          title: `Supprimer l’univers « ${project.name} » ?`,
                          message: "L’univers et tous ses livres seront placés dans la corbeille.",
                          confirmLabel: "Supprimer",
                          danger: true,
                        });
                        if (ok) onDeleteProject(project.id);
                      }}
                      className={`p-1 ${DELETE_BUTTON}`}
                      title="Supprimer"
                      aria-label={`Supprimer l’univers ${project.name}`}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              )}

              {/* Sous-projets (livres) */}
              {isExpanded && (
                <div className="ml-4 border-l border-slate-100 dark:border-slate-800 pl-2 mt-0.5 mb-1 space-y-0.5">
                  {subs.map((sub) => {
                    const isActive = activeSubProjectId === sub.id;
                    const isRenaming = bookRename.isEditing(sub.id);
                    return (
                      <div key={sub.id} className="group relative">
                        {isRenaming ? (
                          <RenameForm
                            rename={bookRename}
                            label={`Nouveau nom du livre ${sub.name}`}
                            className="px-1 py-0.5"
                            iconSize={12}
                          />
                        ) : (
                          <button
                            onClick={() => {
                              onSelectSubProject(project.id, sub.id);
                              onNavigate?.();
                            }}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all text-sm ${
                              isActive
                                ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-semibold"
                                : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
                            }`}
                          >
                            <BookOpen
                              size={12}
                              className={`shrink-0 ${isActive ? "text-indigo-500 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"}`}
                            />
                            <StatusDot status={sub.status} />
                            <span className="truncate pr-16" title={sub.name}>{sub.name}</span>
                          </button>
                        )}
                        {!isRenaming && (
                          <div className={`${ROW_ACTIONS} right-1`}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMetaMenuFor(metaMenuFor === sub.id ? null : sub.id);
                              }}
                              className={`p-0.5 ${ACTION_BUTTON}`}
                              title="Statut"
                              aria-label={`Modifier le statut du livre ${sub.name}`}
                            >
                              <Flag size={11} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                bookRename.start(sub.id, sub.name);
                              }}
                              className={`p-0.5 ${ACTION_BUTTON}`}
                              title="Renommer"
                              aria-label={`Renommer le livre ${sub.name}`}
                            >
                              <Settings size={11} />
                            </button>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                const ok = await confirm({
                                  title: `Supprimer le livre « ${sub.name} » ?`,
                                  message: "Le livre et ses chapitres seront placés dans la corbeille.",
                                  confirmLabel: "Supprimer",
                                  danger: true,
                                });
                                if (ok) onDeleteSubProject(project.id, sub.id);
                              }}
                              className={`p-0.5 ${DELETE_BUTTON}`}
                              title="Supprimer"
                              aria-label={`Supprimer le livre ${sub.name}`}
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        )}
                        {metaMenuFor === sub.id && (
                          <Popover
                            onClose={() => setMetaMenuFor(null)}
                            className="right-1 top-full mt-0.5 w-44 rounded-lg z-20 py-1"
                          >
                            <MetaMenu
                              status={sub.status}
                              priority={sub.priority}
                              deadline={sub.deadline}
                              onChange={(fields) => {
                                onUpdateSubProject(project.id, sub.id, fields);
                                if ("deadline" in fields) setMetaMenuFor(null);
                              }}
                            />
                          </Popover>
                        )}
                      </div>
                    );
                  })}

                  {/* Formulaire création sous-projet */}
                  {creatingSubIn === project.id ? (
                    <form onSubmit={handleCreateSub} className="flex items-center gap-1 px-1 py-0.5">
                      <input
                        ref={createSubRef}
                        value={newSubName}
                        onChange={(e) => setNewSubName(e.target.value)}
                        onBlur={handleCreateSub}
                        onKeyDown={handleCreateSubKeyDown}
                        placeholder="Nom du livre..."
                        aria-label="Nom du nouveau livre"
                        className={`${RENAME_INPUT} py-0.5`}
                      />
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          cancelCreateSub();
                        }}
                        className="p-0.5 text-slate-400 dark:text-slate-500 hover:text-red-500 shrink-0"
                        aria-label="Annuler la création du livre"
                      >
                        <X size={12} />
                      </button>
                    </form>
                  ) : (
                    <button
                      onClick={() => setCreatingSubIn(project.id)}
                      className="flex items-center gap-1.5 w-full px-2 py-1 text-xs text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-colors font-medium"
                    >
                      <Plus size={11} />
                      Ajouter un livre
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Formulaire création projet */}
        {isCreatingProject && (
          <form onSubmit={handleCreateProject} className="flex items-center gap-1 px-2 py-1 mt-1">
            <input
              ref={createProjectRef}
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onBlur={handleCreateProject}
              onKeyDown={handleCreateProjectKeyDown}
              placeholder="Nom de l'univers..."
              aria-label="Nom du nouvel univers"
              className={`${RENAME_INPUT} py-1`}
            />
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                cancelCreateProject();
              }}
              className="p-1 text-slate-400 dark:text-slate-500 hover:text-red-500 shrink-0"
              aria-label="Annuler la création de l'univers"
            >
              <X size={13} />
            </button>
          </form>
        )}
      </div>
    </>
  );
}
