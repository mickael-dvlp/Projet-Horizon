"use client";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import {
  ChevronDown,
  ChevronRight,
  Settings,
  Trash2,
  Plus,
  Check,
  X,
  LogOut,
  LayoutGrid,
  PanelLeftClose,
  PanelLeftOpen,
  BookOpen,
  FileText,
  Upload,
  Flag,
  Target,
  Search,
} from "lucide-react";
import { StatusDot, StatusMenu } from "./StatusPicker";
import { PriorityMenu } from "./PriorityPicker";
import DeadlineField from "./DeadlineField";
import { isKbFileVisibleForBook } from "@/lib/knowledgeBase";
import { searchKbFiles } from "@/lib/kbSearch";
import { useCreateForm } from "@/hooks/useCreateForm";

export default function Sidebar({
  user,
  onLogout,
  projects,
  subProjects,
  activeProjectId,
  activeSubProjectId,
  onSelectProject,
  onSelectSubProject,
  onCreate,
  onCreateSubProject,
  isDashboardOpen,
  onOpenDashboard,
  onUpdateProject,
  onUpdateSubProject,
  onSetSubProjectStatus,
  onSetSubProjectPriority,
  onSetSubProjectDeadline,
  onDeleteProject,
  onDeleteSubProject,
  onOpenTrash,
  onOpenSettings,
  backgroundImage,
  knowledgeBase,
  activeKbFileId,
  onSelectKbFile,
  onAddKbFile,
  onDeleteKbFile,
  onSetKbFileScope,
}) {
  const [isOpen, setIsOpen] = useState(true);
  // Tiroir superposé sous le point de repère mobile (md) : indépendant de
  // isOpen, qui ne pilote que le repli en rail sur desktop — sur mobile, la
  // barre latérale est soit hors-écran, soit affichée en entier.
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState(new Set());
  const [isKbExpanded, setIsKbExpanded] = useState(true);
  const [kbScopeMenuFor, setKbScopeMenuFor] = useState(null);
  const [kbSearchQuery, setKbSearchQuery] = useState("");

  const fileInputRef = useRef(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [creatingSubIn, setCreatingSubIn] = useState(null);
  const [editingProject, setEditingProject] = useState(null);
  const [editingSubProject, setEditingSubProject] = useState(null);
  const [statusMenuFor, setStatusMenuFor] = useState(null);
  const newProjectTriggerRef = useRef(null);

  const handleFileImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onAddKbFile(file.name, ev.target.result);
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  const createProjectRef = useRef(null);
  const createSubRef = useRef(null);
  const editProjectRef = useRef(null);
  const editSubRef = useRef(null);

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

  // Une recherche vide en changeant d'univers évite d'afficher "Aucun
  // résultat" sur un mot qui n'a jamais concerné le nouvel univers.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKbSearchQuery("");
  }, [activeProjectId]);

  // Échap ferme le tiroir mobile — même mécanisme que le clic sur le fond
  // assombri déjà en place, pour une fermeture complètement accessible au
  // clavier.
  useEffect(() => {
    if (!isMobileOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setIsMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMobileOpen]);

  useEffect(() => { if (isCreatingProject) createProjectRef.current?.focus(); }, [isCreatingProject]);
  useEffect(() => { if (creatingSubIn) createSubRef.current?.focus(); }, [creatingSubIn]);
  useEffect(() => { if (editingProject) editProjectRef.current?.focus(); }, [editingProject]);
  useEffect(() => { if (editingSubProject) editSubRef.current?.focus(); }, [editingSubProject]);

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
    setExpandedProjects((prev) => new Set([...prev, projectId]));
    onSelectProject?.(projectId);
    setIsMobileOpen(false);
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

  const handleRenameProject = (e) => {
    e?.preventDefault();
    if (editingProject?.name.trim()) {
      onUpdateProject(editingProject.id, editingProject.name.trim());
    }
    setEditingProject(null);
  };

  const handleRenameSub = (e) => {
    e?.preventDefault();
    if (editingSubProject?.name.trim()) {
      onUpdateSubProject(
        editingSubProject.projectId,
        editingSubProject.id,
        editingSubProject.name.trim()
      );
    }
    setEditingSubProject(null);
  };

  const initials = user?.displayName
    ? user.displayName.charAt(0).toUpperCase()
    : user?.email?.charAt(0).toUpperCase() || "?";

  // Contenu complet de la barre latérale (profil, univers/livres, base de
  // connaissances, footer) : identique que la barre soit affichée en flux
  // normal (desktop) ou en tiroir superposé (mobile) — factorisé pour
  // éviter de dupliquer ce corps volumineux entre les deux rendus. Seul le
  // bouton de repli/fermeture en tête diffère entre les deux contextes,
  // reçu en paramètre.
  const renderBody = (collapseButton) => (
    <div className="relative z-10 flex flex-col h-full">
      {/* Toggle */}
      <div className="px-3 pt-2 flex items-center justify-end">
        {collapseButton}
      </div>

      {/* Profil utilisateur */}
      <div className="px-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group cursor-default">
          {user?.photoURL ? (
            <Image
              src={user.photoURL}
              width={32}
              height={32}
              unoptimized
              className="w-8 h-8 rounded-lg object-cover shrink-0"
              alt="Avatar"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate leading-tight">
              {user?.displayName || user?.email?.split("@")[0] || "Invité"}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Espace personnel</p>
          </div>
          <button
            onClick={onLogout}
            className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all rounded-md"
            title="Déconnexion"
            aria-label="Déconnexion"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 overflow-y-auto custom-scrollbar">
        <button
          onClick={() => {
            onOpenDashboard();
            setIsMobileOpen(false);
          }}
          className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg transition-colors text-sm font-medium mb-1 ${
            isDashboardOpen
              ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-semibold"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          }`}
        >
          <LayoutGrid size={15} />
          Tableau de bord
        </button>

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
                {editingProject?.id === project.id ? (
                  <form onSubmit={handleRenameProject} className="flex items-center gap-1 px-2 py-1">
                    <input
                      ref={editProjectRef}
                      value={editingProject.name}
                      onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
                      onBlur={handleRenameProject}
                      onKeyDown={(e) => e.key === "Escape" && setEditingProject(null)}
                      className="flex-1 text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-500/50 rounded-md px-2 py-1 outline-none min-w-0 shadow-sm"
                    />
                    <button type="submit" className="p-1 text-indigo-500 dark:text-indigo-400 shrink-0">
                      <Check size={13} />
                    </button>
                  </form>
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
                      {isExpanded
                        ? <ChevronDown size={13} />
                        : <ChevronRight size={13} />}
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
                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCreatingSubIn(project.id);
                          setExpandedProjects((prev) => new Set([...prev, project.id]));
                        }}
                        className="p-1 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        title="Ajouter un livre"
                        aria-label={`Ajouter un livre dans ${project.name}`}
                      >
                        <Plus size={11} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingProject({ id: project.id, name: project.name });
                        }}
                        className="p-1 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        title="Renommer"
                        aria-label={`Renommer l’univers ${project.name}`}
                      >
                        <Settings size={11} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Supprimer l'univers "${project.name}" et tous ses livres ?`)) {
                            onDeleteProject(project.id);
                          }
                        }}
                        className="p-1 hover:bg-red-50 dark:hover:bg-red-500/10 rounded text-slate-400 dark:text-slate-500 hover:text-red-500 transition-colors"
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
                      return (
                        <div key={sub.id} className="group relative">
                          {editingSubProject?.id === sub.id ? (
                            <form onSubmit={handleRenameSub} className="flex items-center gap-1 px-1 py-0.5">
                              <input
                                ref={editSubRef}
                                value={editingSubProject.name}
                                onChange={(e) =>
                                  setEditingSubProject({ ...editingSubProject, name: e.target.value })
                                }
                                onBlur={handleRenameSub}
                                onKeyDown={(e) => e.key === "Escape" && setEditingSubProject(null)}
                                className="flex-1 text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-500/50 rounded-md px-2 py-0.5 outline-none min-w-0 shadow-sm"
                              />
                              <button type="submit" className="p-0.5 text-indigo-500 dark:text-indigo-400 shrink-0">
                                <Check size={12} />
                              </button>
                            </form>
                          ) : (
                            <button
                              onClick={() => {
                                onSelectSubProject(project.id, sub.id);
                                setIsMobileOpen(false);
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
                          {editingSubProject?.id !== sub.id && (
                            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setStatusMenuFor(statusMenuFor === sub.id ? null : sub.id);
                                }}
                                className="p-0.5 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                title="Statut"
                                aria-label={`Modifier le statut du livre ${sub.name}`}
                              >
                                <Flag size={11} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingSubProject({
                                    projectId: project.id,
                                    id: sub.id,
                                    name: sub.name,
                                  });
                                }}
                                className="p-0.5 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                title="Renommer"
                                aria-label={`Renommer le livre ${sub.name}`}
                              >
                                <Settings size={11} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm(`Supprimer "${sub.name}" ?`)) {
                                    onDeleteSubProject(project.id, sub.id);
                                  }
                                }}
                                className="p-0.5 hover:bg-red-50 dark:hover:bg-red-500/10 rounded text-slate-400 dark:text-slate-500 hover:text-red-500 transition-colors"
                                title="Supprimer"
                                aria-label={`Supprimer le livre ${sub.name}`}
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          )}
                          {statusMenuFor === sub.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setStatusMenuFor(null)} />
                              <div className="absolute right-1 top-full mt-0.5 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-20 py-1 animate-in fade-in zoom-in-95 duration-100">
                                <p className="px-3 pt-1 pb-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                  Statut
                                </p>
                                <StatusMenu
                                  value={sub.status}
                                  onChange={(status) => onSetSubProjectStatus(project.id, sub.id, status)}
                                />
                                <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-3" />
                                <p className="px-3 pt-0.5 pb-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                  Priorité
                                </p>
                                <PriorityMenu
                                  value={sub.priority}
                                  onChange={(priority) => onSetSubProjectPriority(project.id, sub.id, priority)}
                                />
                                <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-3" />
                                <div className="px-3 pt-0.5 pb-1.5">
                                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                                    Échéance
                                  </p>
                                  <DeadlineField
                                    value={sub.deadline}
                                    onChange={(deadline) => {
                                      onSetSubProjectDeadline(project.id, sub.id, deadline);
                                      setStatusMenuFor(null);
                                    }}
                                  />
                                </div>
                              </div>
                            </>
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
                          className="flex-1 text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-500/50 rounded-md px-2 py-0.5 outline-none min-w-0 shadow-sm"
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
                className="flex-1 text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-500/50 rounded-md px-2 py-1 outline-none min-w-0 shadow-sm"
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

        {/* Séparateur */}
        <div className="h-px bg-slate-100 dark:bg-slate-800 my-3 mx-2" />

        {/* Base de connaissances */}
        <div className="flex items-center justify-between px-3 mb-1.5">
          <button
            onClick={() => setIsKbExpanded((v) => !v)}
            className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            {isKbExpanded
              ? <ChevronDown size={11} />
              : <ChevronRight size={11} />}
            Base de connaissances
          </button>
          {activeProjectId && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-md transition-colors"
              title="Importer un fichier .md"
            >
              <Plus size={13} />
            </button>
          )}
        </div>

        {isKbExpanded && !activeProjectId && (
          <p className="px-3 py-1 text-[11px] text-slate-500 dark:text-slate-400 italic">
            Sélectionnez un univers pour voir sa base de connaissances
          </p>
        )}

        {isKbExpanded && activeProjectId && (
          <div className="space-y-0.5">
            {(() => {
              const visibleKb = knowledgeBase.filter((f) =>
                isKbFileVisibleForBook(f, activeSubProjectId)
              );
              const books = subProjects[activeProjectId] || [];
              const trimmedQuery = kbSearchQuery.trim();
              const searchResults = trimmedQuery ? searchKbFiles(visibleKb, trimmedQuery) : null;

              if (searchResults) {
                return (
                  <>
                    {searchResults.length === 0 && (
                      <p className="px-3 py-1 text-[11px] text-slate-500 dark:text-slate-400 italic">
                        Aucun résultat pour &quot;{trimmedQuery}&quot;
                      </p>
                    )}
                    {searchResults.map(({ file, snippet }) => (
                      <button
                        key={file.id}
                        onClick={() => {
                          onSelectKbFile(file);
                          setIsMobileOpen(false);
                        }}
                        className="w-full flex flex-col items-start gap-0.5 px-3 py-1.5 rounded-lg text-left text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                      >
                        <span className="flex items-center gap-2 w-full min-w-0 text-sm font-medium">
                          <FileText size={12} className="shrink-0 text-slate-400 dark:text-slate-500" />
                          <span className="truncate" title={file.name}>{file.name}</span>
                        </span>
                        {snippet && (
                          <span className="pl-5 text-[11px] text-slate-400 dark:text-slate-500 truncate w-full">
                            {snippet}
                          </span>
                        )}
                      </button>
                    ))}
                  </>
                );
              }

              return (
                <>
                  {visibleKb.length === 0 && (
                    <p className="px-3 py-1 text-[11px] text-slate-500 dark:text-slate-400 italic">
                      Aucun fichier {activeSubProjectId ? "visible pour ce livre" : "importé"}
                    </p>
                  )}
                  {visibleKb.map((file) => {
                    const isActive = activeKbFileId === file.id;
                    const scope = file.subProjectIds || [];
                    return (
                      <div key={file.id} className="group relative">
                        <button
                          onClick={() => {
                            onSelectKbFile(file);
                            setIsMobileOpen(false);
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-sm ${
                            isActive
                              ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-semibold"
                              : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
                          }`}
                        >
                          <FileText
                            size={12}
                            className={`shrink-0 ${isActive ? "text-indigo-500 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"}`}
                          />
                          <span className="truncate pr-14" title={file.name}>{file.name}</span>
                        </button>
                        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setKbScopeMenuFor(kbScopeMenuFor === file.id ? null : file.id);
                            }}
                            className="p-0.5 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                            title={scope.length === 0 ? "Portée : tout l'univers" : "Portée : livres spécifiques"}
                            aria-label={`Modifier la portée de la fiche ${file.name}`}
                          >
                            <Target size={11} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Supprimer "${file.name}" ?`)) onDeleteKbFile(file.id);
                            }}
                            className="p-0.5 hover:bg-red-50 dark:hover:bg-red-500/10 rounded text-slate-400 dark:text-slate-500 hover:text-red-500 transition-colors"
                            title="Supprimer"
                            aria-label={`Supprimer la fiche ${file.name}`}
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                        {kbScopeMenuFor === file.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setKbScopeMenuFor(null)} />
                            <div className="absolute right-1.5 top-full mt-0.5 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-20 py-1 animate-in fade-in zoom-in-95 duration-100">
                              <p className="px-3 pt-1 pb-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                Portée
                              </p>
                              <button
                                onClick={() => onSetKbFileScope(file.id, [])}
                                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                              >
                                <span className="flex-1 text-left">Tout l&apos;univers</span>
                                {scope.length === 0 && <Check size={12} className="text-indigo-500 dark:text-indigo-400" />}
                              </button>
                              {books.length > 0 && (
                                <>
                                  <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-3" />
                                  {books.map((book) => {
                                    const checked = scope.includes(book.id);
                                    return (
                                      <button
                                        key={book.id}
                                        onClick={() => {
                                          const next = checked
                                            ? scope.filter((id) => id !== book.id)
                                            : [...scope, book.id];
                                          onSetKbFileScope(file.id, next);
                                        }}
                                        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                      >
                                        <span className="flex-1 text-left truncate">{book.name}</span>
                                        {checked && <Check size={12} className="text-indigo-500 dark:text-indigo-400" />}
                                      </button>
                                    );
                                  })}
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </>
              );
            })()}

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 w-full px-3 py-1 text-xs text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-colors font-medium"
            >
              <Upload size={11} />
              Importer un .md
            </button>

            {/* Rechercher un élément — filtre la liste ci-dessus par mot,
                dans le nom et le contenu des fiches de l'univers actif. */}
            <div className="relative px-1 pt-1">
              <Search size={12} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 pointer-events-none" />
              <input
                value={kbSearchQuery}
                onChange={(e) => setKbSearchQuery(e.target.value)}
                placeholder="Rechercher un élément..."
                aria-label="Rechercher un élément dans la base de connaissances"
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-8 pr-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-300/40 dark:focus:ring-indigo-500/30 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.txt"
          className="hidden"
          onChange={handleFileImport}
        />
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-slate-100 dark:border-slate-800 space-y-0.5">
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors text-sm font-medium"
        >
          <Settings size={15} />
          Paramètres
        </button>
        <button
          onClick={onOpenTrash}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-500 dark:text-slate-400 hover:text-red-500 transition-colors text-sm font-medium"
        >
          <Trash2 size={15} />
          Corbeille
        </button>
      </div>
    </div>
  );

  // Un seul bouton, qui replie sur desktop (rail) ET ferme le tiroir sur
  // mobile — les deux appels sont sans effet visible sur l'autre contexte
  // (isMobileOpen ne pilote rien à partir de md, isOpen ne pilote rien en
  // dessous), donc les appeler tous les deux est toujours correct sans avoir
  // à détecter le viewport en JS.
  const collapseOrCloseButton = (
    <button
      onClick={() => {
        setIsOpen(false);
        setIsMobileOpen(false);
      }}
      className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
      title="Réduire / fermer la barre latérale"
      aria-label="Réduire ou fermer la barre latérale"
    >
      <PanelLeftClose size={14} />
    </button>
  );

  return (
    <>
      {/* Déclencheur du tiroir mobile — la barre latérale complète est
          hors-écran en dessous de md tant qu'on ne l'ouvre pas ici. */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-30 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm text-slate-500 dark:text-slate-400"
        title="Ouvrir la barre latérale"
        aria-label="Ouvrir la barre latérale"
      >
        <PanelLeftOpen size={16} />
      </button>

      {/* Fond assombri du tiroir mobile */}
      {isMobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-slate-900/40 z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Rail replié — desktop uniquement (isOpen=false), jamais affiché sur
          mobile où le repli en rail n'a pas de sens (le tiroir est soit
          fermé, soit affiché en entier). Élément séparé et sans état propre :
          aucun risque de duplication de refs/état contrairement au contenu
          complet ci-dessous. */}
      {!isOpen && (
        <aside className="hidden md:flex w-10 h-full bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 flex-col items-center py-2 shrink-0">
          <button
            onClick={() => setIsOpen(true)}
            className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="Ouvrir la barre latérale"
            aria-label="Ouvrir la barre latérale"
          >
            <PanelLeftOpen size={15} />
          </button>
        </aside>
      )}

      {/* Contenu complet — UN SEUL arbre, jamais dupliqué : sa visibilité
          mobile (glissement via transform, piloté par isMobileOpen) et sa
          visibilité desktop (flex/hidden, pilotée par isOpen) sont deux
          mécanismes indépendants superposés sur le même élément, pour éviter
          tout risque de refs ou d'état de formulaire partagés entre deux
          instances simultanément montées. */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 md:z-auto w-72 md:w-60 h-full bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 flex-col shrink-0 overflow-hidden transform md:translate-x-0 transition-transform duration-200 pl-[env(safe-area-inset-left)] ${
          isMobileOpen ? "flex translate-x-0" : "flex -translate-x-full"
        } ${isOpen ? "md:flex" : "md:hidden"}`}
      >
        {backgroundImage && (
          <div className="absolute inset-0 z-0 pointer-events-none">
            <Image
              src={`/images/fond-menu/${backgroundImage}.png`}
              alt=""
              fill
              sizes="(min-width: 768px) 240px, 288px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-white/60 dark:bg-slate-950/75" />
          </div>
        )}
        {renderBody(collapseOrCloseButton)}
      </aside>
    </>
  );
}
