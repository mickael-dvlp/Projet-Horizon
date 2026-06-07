"use client";

import { useState, useRef, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import TrashModal from "@/components/TrashModal";
import MemoEditor from "@/components/MemoEditor";
import KanbanBoard from "@/components/KanbanBoard";
import AuthScreen from "@/components/AuthScreen";
import { useKanbanLogic } from "@/hooks/useKanbanLogic";
import { useKanbanDnD } from "@/hooks/useKanbanDnD";

function EmptyState({ onCreate }) {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (isCreating) inputRef.current?.focus();
  }, [isCreating]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (name.trim()) {
      onCreate(name.trim());
    }
    setName("");
    setIsCreating(false);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
      <div className="max-w-md bg-white p-10 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100">
        <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center text-3xl mb-8 mx-auto shadow-inner">
          🚀
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-3 tracking-tight">
          Prêt pour un nouveau projet ?
        </h2>
        <p className="text-slate-500 mb-8 leading-relaxed">
          Horizon est plus efficace lorsque vous organisez vos idées par
          projet. Créez votre premier espace de travail pour commencer.
        </p>

        {isCreating ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setIsCreating(false)}
              placeholder="Nom de votre projet..."
              className="w-full border border-indigo-300 rounded-2xl px-5 py-4 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 text-center font-semibold"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="flex-1 border border-slate-200 text-slate-500 px-4 py-3 rounded-2xl font-semibold hover:bg-slate-50 transition-all"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white px-4 py-3 rounded-2xl font-semibold transition-all shadow-lg shadow-indigo-200"
              >
                Créer
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setIsCreating(true)}
            className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white px-8 py-4 rounded-2xl font-semibold transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
          >
            Créer mon premier projet
          </button>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const logic = useKanbanLogic();
  const dnd = useKanbanDnD(logic);

  if (!logic.mounted || logic.loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 text-slate-400 italic">
        Chargement...
      </div>
    );
  }

  if (!logic.user && !logic.isGuest) {
    return (
      <AuthScreen
        isAuthModalOpen={logic.isAuthModalOpen}
        setIsAuthModalOpen={logic.setIsAuthModalOpen}
        onGuestLogin={logic.handleGuestLogin}
      />
    );
  }

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden">
      <Sidebar
        user={logic.user}
        onLogout={logic.handleLogout}
        projects={logic.projects}
        activeId={logic.activeProjectId}
        onSelect={logic.setActiveProjectId}
        onCreate={logic.handleCreateProject}
        onUpdateProject={logic.handleRenameProject}
        onDeleteProject={logic.deleteProject}
        onOpenTrash={() => logic.setIsTrashOpen(true)}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {logic.projects.length > 0 && logic.activeProjectId ? (
          <KanbanBoard
            {...logic}
            sensors={dnd.sensors}
            handleDragStart={dnd.handleDragStart}
            handleDragOver={dnd.handleDragOver}
            handleDragEnd={dnd.handleDragEnd}
            onRename={(id, newName) =>
              logic.handleSavePage(id, { title: newName })
            }
            onDeleteColumn={logic.deleteColumn}
            projectName={
              logic.projects.find((p) => p.id === logic.activeProjectId)
                ?.name || "Mon Projet"
            }
          />
        ) : (
          <EmptyState onCreate={logic.handleCreateProject} />
        )}

        {logic.activePage && (
          <MemoEditor
            page={logic.activePage}
            onClose={() => logic.setActivePage(null)}
            onSave={logic.handleSavePage}
          />
        )}
      </main>

      {logic.isTrashOpen && (
        <TrashModal
          items={logic.trashItems}
          onRestore={logic.handleRestore}
          onDelete={logic.removeFromTrash}
          onClose={() => logic.setIsTrashOpen(false)}
        />
      )}
    </div>
  );
}
