"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Sidebar from "@/components/Sidebar";
import TrashModal from "@/components/TrashModal";
import SettingsModal from "@/components/SettingsModal";
import MemoEditor from "@/components/MemoEditor";
import KanbanBoard from "@/components/KanbanBoard";
import KnowledgeViewer from "@/components/KnowledgeViewer";
import Dashboard from "@/components/Dashboard";
import AuthScreen from "@/components/AuthScreen";
import Toast from "@/components/Toast";
import { useKanbanLogic } from "@/hooks/useKanbanLogic";
import { useKanbanDnD } from "@/hooks/useKanbanDnD";
import { useTheme } from "@/hooks/useTheme";
import { useElectronUpdater } from "@/hooks/useElectronUpdater";

function EmptyState({ onCreate }) {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (isCreating) inputRef.current?.focus();
  }, [isCreating]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (name.trim()) onCreate(name.trim());
    setName("");
    setIsCreating(false);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
      <div className="max-w-md bg-white dark:bg-slate-900 p-10 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800">
        <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-3xl flex items-center justify-center text-3xl mb-8 mx-auto shadow-inner">
          ✍️
        </div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-3 tracking-tight">
          Créez votre premier univers
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
          Un univers regroupe vos livres, leurs arcs, chapitres et scènes.
          Commencez par nommer votre série ou votre projet d’écriture.
        </p>

        {isCreating ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setIsCreating(false)}
              placeholder="Nom de l'univers..."
              className="w-full border border-indigo-300 dark:border-indigo-500/50 rounded-2xl px-5 py-4 text-slate-700 dark:text-slate-200 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 text-center font-semibold"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="flex-1 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 px-4 py-3 rounded-2xl font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
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
            Créer mon premier univers
          </button>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const logic = useKanbanLogic();
  const dnd = useKanbanDnD(logic);
  const { theme, setTheme } = useTheme();
  const { sidebarBg, setSidebarBg, mainBg, setMainBg } = logic;
  const updater = useElectronUpdater();
  const [activeKbFile, setActiveKbFile] = useState(null);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);

  if (!logic.mounted || logic.loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-400 dark:text-slate-500 italic">
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

  const activeSubProjectObj = logic.subProjects[logic.activeProjectId]?.find(
    (sp) => sp.id === logic.activeSubProjectId
  );

  const activeSubName = activeSubProjectObj?.name || "Mon Livre";

  const activeProjectName =
    logic.projects.find((p) => p.id === logic.activeProjectId)?.name || "";

  const handleOpenDashboardItem = (item) => {
    setIsDashboardOpen(false);
    logic.handleSelectSubProject(logic.activeProjectId, item.subProjectId);
    if (!item.pageId) return;
    const col = (logic.allProjectsData[item.subProjectId] || []).find((c) =>
      c.pages.some((p) => p.id === item.pageId)
    );
    const foundPage = col?.pages.find((p) => p.id === item.pageId);
    if (foundPage) logic.setActivePage(foundPage);
  };

  const universeSummary = logic.activeProjectId
    ? logic.getUniverseSummary(logic.activeProjectId)
    : null;

  return (
    <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <Sidebar
        user={logic.user}
        onLogout={() => {
          setActiveKbFile(null);
          logic.handleLogout();
        }}
        projects={logic.projects}
        subProjects={logic.subProjects}
        activeProjectId={logic.activeProjectId}
        activeSubProjectId={logic.activeSubProjectId}
        onSelectProject={(projectId) => {
          setActiveKbFile(null);
          setIsDashboardOpen(false);
          logic.handleSelectProject(projectId);
        }}
        onSelectSubProject={(projectId, subProjectId) => {
          // Le fichier de base de connaissances affiché appartient à l'univers
          // qu'on quitte : le fermer évite d'afficher un contenu qui n'a plus
          // de rapport avec l'univers désormais actif.
          setActiveKbFile(null);
          setIsDashboardOpen(false);
          logic.handleSelectSubProject(projectId, subProjectId);
        }}
        isDashboardOpen={isDashboardOpen}
        onOpenDashboard={() => {
          setActiveKbFile(null);
          setIsDashboardOpen(true);
        }}
        onCreate={logic.handleCreateProject}
        onCreateSubProject={logic.handleCreateSubProject}
        onUpdateProject={logic.handleRenameProject}
        onUpdateSubProject={logic.handleRenameSubProject}
        onSetSubProjectStatus={logic.handleSetSubProjectStatus}
        onSetSubProjectPriority={logic.handleSetSubProjectPriority}
        onSetSubProjectDeadline={logic.handleSetSubProjectDeadline}
        onDeleteProject={(projectId) => {
          if (projectId === logic.activeProjectId) setActiveKbFile(null);
          logic.deleteProject(projectId);
        }}
        onDeleteSubProject={logic.deleteSubProject}
        onOpenTrash={() => logic.setIsTrashOpen(true)}
        onOpenSettings={() => logic.setIsSettingsOpen(true)}
        backgroundImage={sidebarBg}
        knowledgeBase={logic.knowledgeBase}
        activeKbFileId={activeKbFile?.id || null}
        onSelectKbFile={setActiveKbFile}
        onAddKbFile={logic.addKbFile}
        onSetKbFileScope={logic.setKbFileScope}
        onDeleteKbFile={(id) => {
          if (activeKbFile?.id === id) setActiveKbFile(null);
          logic.deleteKbFile(id);
        }}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {mainBg && (
          <div className="hidden md:block absolute inset-0 z-0 pointer-events-none">
            <Image
              src={`/images/fond-champs/${mainBg}.png`}
              alt=""
              fill
              sizes="(min-width: 768px) 100vw, 0px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-white/70 dark:bg-slate-950/80" />
          </div>
        )}

        <div className="relative z-10 flex-1 flex flex-col min-w-0 overflow-hidden">
          {isDashboardOpen ? (
            <Dashboard
              project={logic.projects.find((p) => p.id === logic.activeProjectId) || null}
              activeSubProjectId={logic.activeSubProjectId}
              summary={universeSummary || { books: [], undoneTasks: [], inProgressItems: [], toReviewItems: [], upcomingDeadlines: [] }}
              onOpenItem={handleOpenDashboardItem}
            />
          ) : logic.activeSubProjectId ? (
            <KanbanBoard
              columns={logic.columns}
              setActivePage={logic.setActivePage}
              addPage={logic.addPage}
              setColumns={logic.setColumns}
              deletePage={logic.deletePage}
              draggedItem={logic.draggedItem}
              addColumn={logic.addColumn}
              sensors={dnd.sensors}
              handleDragStart={dnd.handleDragStart}
              handleDragOver={dnd.handleDragOver}
              handleDragEnd={dnd.handleDragEnd}
              onRename={(id, newName) => logic.handleSavePage(id, { title: newName })}
              onDeleteColumn={logic.deleteColumn}
              hasMainBg={!!mainBg}
              onOpenDashboard={() => {
                setActiveKbFile(null);
                setIsDashboardOpen(true);
              }}
              onSetPageStatus={(id, status) => logic.handleSavePage(id, { status })}
              onSetPagePriority={(id, priority) => logic.handleSavePage(id, { priority })}
              onSetPageDeadline={(id, deadline) => logic.handleSavePage(id, { deadline })}
              projectName={activeSubName}
              projectSuperName={activeProjectName}
              subProjectTasks={activeSubProjectObj?.tasks || []}
              onAddSubProjectTask={(label) =>
                logic.addSubProjectTask(logic.activeProjectId, logic.activeSubProjectId, label)
              }
              onToggleSubProjectTask={(taskId) =>
                logic.toggleSubProjectTask(logic.activeProjectId, logic.activeSubProjectId, taskId)
              }
              onDeleteSubProjectTask={(taskId) =>
                logic.deleteSubProjectTask(logic.activeProjectId, logic.activeSubProjectId, taskId)
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
              onSaveScene={logic.handleSaveScene}
              onAddScene={logic.addScene}
              onDeleteScene={logic.deleteScene}
              onToast={logic.showToast}
            />
          )}

          {activeKbFile && (
            <KnowledgeViewer
              key={activeKbFile.id}
              file={logic.knowledgeBase.find((f) => f.id === activeKbFile.id) || activeKbFile}
              onClose={() => setActiveKbFile(null)}
              onUpdateContent={logic.updateKbFileContent}
              onToast={logic.showToast}
            />
          )}
        </div>
      </main>

      {logic.isTrashOpen && (
        <TrashModal
          items={logic.trashItems}
          projects={logic.projects}
          subProjects={logic.subProjects}
          onRestore={logic.handleRestore}
          onDelete={logic.removeFromTrash}
          onClose={() => logic.setIsTrashOpen(false)}
        />
      )}

      {logic.isSettingsOpen && (
        <SettingsModal
          onClose={() => logic.setIsSettingsOpen(false)}
          theme={theme}
          setTheme={setTheme}
          sidebarBg={sidebarBg}
          setSidebarBg={setSidebarBg}
          mainBg={mainBg}
          setMainBg={setMainBg}
          settings={logic.settings}
          setSettings={logic.setSettings}
          onExport={logic.exportAllData}
          onExportZip={logic.exportAllDataZip}
          onDeleteAll={logic.deleteAllData}
          updater={updater}
        />
      )}

      <Toast toast={logic.toast} onDismiss={logic.dismissToast} />
    </div>
  );
}
