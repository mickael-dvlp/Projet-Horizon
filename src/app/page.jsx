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
import { useElectronCloseConfirm } from "@/hooks/useElectronCloseConfirm";
import ConfirmDialog, { useConfirm } from "@/components/ConfirmDialog";

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
  const confirm = useConfirm();
  const logic = useKanbanLogic({ confirm });
  const dnd = useKanbanDnD(logic);
  const { theme, setTheme } = useTheme();
  const { sidebarBg, setSidebarBg, mainBg, setMainBg } = logic;
  const updater = useElectronUpdater();
  const editorRef = useRef(null);
  const closeConfirm = useElectronCloseConfirm({
    onBeforeClose: () => editorRef.current?.flush(),
    onPersist: logic.flushSave,
  });
  const [activeKbFile, setActiveKbFile] = useState(null);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  // Tâche ciblée depuis le tableau de bord : ouvre le bon panneau Tâches et y
  // met la ligne en évidence. `nonce` force le re-déclenchement des effets
  // même en recliquant deux fois de suite sur la même tâche.
  const [taskFocus, setTaskFocus] = useState(null);

  // Confirmation de fermeture demandée par Electron : peut survenir sur
  // n'importe quel écran (chargement, connexion, espace de travail).
  const closeConfirmDialog = closeConfirm.isOpen && (
    <ConfirmDialog
      title="Fermer Horizon ?"
      message="Voulez-vous vraiment quitter l’application ? Les modifications en cours seront enregistrées avant la fermeture."
      onCancel={closeConfirm.cancelClose}
      actions={[
        { label: "Annuler", variant: "primary", onClick: closeConfirm.cancelClose },
        { label: "Fermer l’application", variant: "neutral", onClick: closeConfirm.confirmClose },
      ]}
    />
  );

  if (!logic.mounted || logic.loading) {
    return (
      <>
        {logic.awaitingServer ? (
          <div className="h-screen flex flex-col items-center justify-center gap-4 px-4 text-center bg-slate-50 dark:bg-slate-950">
            <p className="max-w-md text-slate-600 dark:text-slate-300" role="status">
              Hors-ligne : vos données n’ont pas encore été téléchargées sur cet appareil. Elles
              s’afficheront dès le retour de la connexion.
            </p>
            <button
              onClick={logic.handleLogout}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
            >
              Se déconnecter
            </button>
          </div>
        ) : (
          <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-400 dark:text-slate-500 italic">
            Chargement...
          </div>
        )}
        {closeConfirmDialog}
      </>
    );
  }

  if (!logic.user && !logic.isGuest) {
    return (
      <>
        <AuthScreen
          isAuthModalOpen={logic.isAuthModalOpen}
          setIsAuthModalOpen={logic.setIsAuthModalOpen}
          onGuestLogin={logic.handleGuestLogin}
        />
        {closeConfirmDialog}
      </>
    );
  }

  const openDashboard = () => {
    setActiveKbFile(null);
    setIsDashboardOpen(true);
  };

  const activeSubProjectObj = logic.subProjects[logic.activeProjectId]?.find(
    (sp) => sp.id === logic.activeSubProjectId
  );

  const activeSubName = activeSubProjectObj?.name || "Mon Livre";

  const activeProjectName =
    logic.projects.find((p) => p.id === logic.activeProjectId)?.name || "";

  const handleOpenDashboardItem = (item, isTask) => {
    setIsDashboardOpen(false);
    logic.handleSelectSubProject(logic.activeProjectId, item.subProjectId);
    setTaskFocus(
      isTask ? { taskId: item.id, kind: item.kind, sceneId: item.sceneId || null, nonce: Date.now() } : null
    );
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
        onOpenDashboard={openDashboard}
        onCreate={logic.handleCreateProject}
        onCreateSubProject={logic.handleCreateSubProject}
        onUpdateProject={logic.handleRenameProject}
        onUpdateSubProject={logic.updateSubProject}
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
        onToast={logic.showToast}
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
          {logic.storageUsage?.level === "critical" && (
            <div
              role="alert"
              className="shrink-0 px-4 pl-16 md:pl-4 py-2 text-xs font-semibold text-center text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/10 border-b border-red-100 dark:border-red-500/20"
            >
              Espace de stockage presque plein ({Math.round(logic.storageUsage.ratio * 100)} %) : au-delà
              de 100 %, plus rien ne pourra être enregistré. Videz la corbeille ou exportez puis supprimez
              d’anciens contenus.
            </div>
          )}

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
              deletePage={logic.deletePage}
              draggedItem={logic.draggedItem}
              addColumn={logic.addColumn}
              sensors={dnd.sensors}
              handleDragStart={dnd.handleDragStart}
              handleDragOver={dnd.handleDragOver}
              handleDragEnd={dnd.handleDragEnd}
              announcements={dnd.announcements}
              screenReaderInstructions={dnd.screenReaderInstructions}
              onUpdatePage={logic.handleSavePage}
              onUpdateColumn={logic.updateColumn}
              onDeleteColumn={logic.deleteColumn}
              hasMainBg={!!mainBg}
              onOpenDashboard={openDashboard}
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
              taskFocus={taskFocus}
            />
          ) : (
            <EmptyState onCreate={logic.handleCreateProject} />
          )}

          {logic.activePage && (
            <MemoEditor
              ref={editorRef}
              page={logic.activePage}
              onClose={() => logic.setActivePage(null)}
              onSave={logic.handleSavePage}
              onSaveScene={logic.handleSaveScene}
              onAddScene={logic.addScene}
              onDeleteScene={logic.deleteScene}
              onToast={logic.showToast}
              taskFocus={taskFocus}
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
          onImport={logic.importBackup}
          onDeleteAll={logic.deleteAllData}
          canDeleteAccount={!!logic.user}
          storageUsage={logic.storageUsage}
          updater={updater}
        />
      )}

      <Toast toast={logic.toast} onDismiss={logic.dismissToast} />

      {closeConfirmDialog}
    </div>
  );
}
