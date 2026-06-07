"use client";
import { useState, useRef, useEffect } from "react";
import {
  Home,
  Library,
  ChevronDown,
  ChevronRight,
  Settings,
  Trash2,
  FolderIcon,
  Plus,
  Check,
  X,
} from "lucide-react";

export default function Sidebar({
  user,
  onLogout,
  projects,
  activeId,
  onSelect,
  onCreate,
  onOpenTrash,
  onUpdateProject,
  onDeleteProject,
}) {
  const [isProjectsOpen, setIsProjectsOpen] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const createInputRef = useRef(null);
  const editInputRef = useRef(null);

  useEffect(() => {
    if (isCreating) createInputRef.current?.focus();
  }, [isCreating]);

  useEffect(() => {
    if (editingId) editInputRef.current?.focus();
  }, [editingId]);

  const handleCreateSubmit = (e) => {
    e?.preventDefault();
    if (newName.trim()) {
      onCreate(newName.trim());
    }
    setNewName("");
    setIsCreating(false);
  };

  const handleCreateKeyDown = (e) => {
    if (e.key === "Escape") {
      setNewName("");
      setIsCreating(false);
    }
  };

  const startEditing = (project) => {
    setEditingId(project.id);
    setEditingName(project.name);
  };

  const handleRenameSubmit = (e) => {
    e?.preventDefault();
    if (editingName.trim() && editingName.trim() !== "") {
      onUpdateProject(editingId, editingName.trim());
    }
    setEditingId(null);
  };

  const handleRenameKeyDown = (e) => {
    if (e.key === "Escape") setEditingId(null);
  };

  return (
    <aside className="w-64 h-full bg-white border-r border-slate-200 flex flex-col p-4">
      <div className="flex items-center justify-between mb-8 px-2">
        <div className="flex items-center gap-3">
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              className="w-8 h-8 rounded-full"
              alt="Avatar"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-xs">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex flex-col">
            <span className="font-semibold text-slate-700 truncate text-center max-w-25">
              {user?.displayName || "Utilisateur"}
            </span>
            <button
              onClick={onLogout}
              className="text-[10px] text-red-400 hover:underline text-left"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto custom-scrollbar">
        <button className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">
          <Home size={18} />
          <span className="text-sm font-medium">Accueil</span>
        </button>
        <button className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">
          <Library size={18} />
          <span className="text-sm font-medium">Bibliothèque</span>
        </button>

        <div className="pt-4">
          <button
            onClick={() => setIsProjectsOpen(!isProjectsOpen)}
            className="flex items-center justify-between w-full p-2 text-slate-500 hover:bg-slate-50 rounded-lg group transition-colors"
          >
            <div className="flex items-center gap-3">
              <FolderIcon size={18} />
              <span className="text-sm font-bold uppercase tracking-wider">
                Projets
              </span>
            </div>
            {isProjectsOpen ? (
              <ChevronDown size={16} />
            ) : (
              <ChevronRight size={16} />
            )}
          </button>

          {isProjectsOpen && (
            <div className="ml-4 mt-1 space-y-1 border-l-2 border-slate-100 animate-in fade-in slide-in-from-top-1 duration-200">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="group relative flex items-center"
                >
                  {editingId === project.id ? (
                    <form
                      onSubmit={handleRenameSubmit}
                      className="flex-1 flex items-center gap-1 pl-3 pr-1"
                    >
                      <input
                        ref={editInputRef}
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={handleRenameSubmit}
                        onKeyDown={handleRenameKeyDown}
                        className="flex-1 text-sm text-slate-700 bg-white border border-indigo-300 rounded px-2 py-1 outline-none min-w-0"
                      />
                      <button
                        type="submit"
                        className="p-1 text-indigo-500 hover:text-indigo-700 shrink-0"
                      >
                        <Check size={14} />
                      </button>
                    </form>
                  ) : (
                    <>
                      <button
                        onClick={() => onSelect(project.id)}
                        className={`flex-1 text-left text-sm py-2 px-4 rounded-r-md transition-all truncate pr-16 ${
                          activeId === project.id
                            ? "text-indigo-600 bg-indigo-50 font-semibold border-l-2 border-indigo-600 -ml-0.5"
                            : "text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/50"
                        }`}
                      >
                        {project.name}
                      </button>

                      <div className="absolute right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditing(project);
                          }}
                          className="p-1 hover:bg-indigo-100 rounded text-slate-400 hover:text-indigo-600"
                          title="Renommer"
                        >
                          <Settings size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (
                              confirm(
                                `Supprimer définitivement le projet "${project.name}" et tout son contenu ?`,
                              )
                            ) {
                              onDeleteProject(project.id);
                            }
                          }}
                          className="p-1 hover:bg-red-100 rounded text-slate-400 hover:text-red-500"
                          title="Supprimer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}

              {isCreating ? (
                <form
                  onSubmit={handleCreateSubmit}
                  className="flex items-center gap-1 pl-3 pr-1 py-1"
                >
                  <input
                    ref={createInputRef}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onBlur={handleCreateSubmit}
                    onKeyDown={handleCreateKeyDown}
                    placeholder="Nom du projet"
                    className="flex-1 text-sm text-slate-700 bg-white border border-indigo-300 rounded px-2 py-1 outline-none min-w-0"
                  />
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setNewName("");
                      setIsCreating(false);
                    }}
                    className="p-1 text-slate-400 hover:text-red-500 shrink-0"
                  >
                    <X size={14} />
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setIsCreating(true)}
                  className="w-full text-left text-sm text-slate-400 hover:text-slate-600 py-1.5 px-4 flex items-center gap-2 italic"
                >
                  <Plus size={14} />
                  Nouveau projet
                </button>
              )}
            </div>
          )}
        </div>
      </nav>

      <div className="pt-4 border-t border-slate-100 space-y-1">
        <button className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
          <Settings size={18} />
          <span className="text-sm font-medium cursor-pointer">Paramètre</span>
        </button>

        <button
          onClick={onOpenTrash}
          className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-red-150 text-red-500 transition-colors"
        >
          <Trash2 size={18} />
          <span className="text-sm font-medium cursor-pointer">Corbeille</span>
        </button>
      </div>
    </aside>
  );
}
