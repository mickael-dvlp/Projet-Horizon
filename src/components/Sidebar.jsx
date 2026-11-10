"use client";
import { useState } from "react";
import Image from "next/image";
import { Settings, Trash2, LogOut, LayoutGrid, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import ProjectTree from "./sidebar/ProjectTree";
import KnowledgeBaseSection from "./sidebar/KnowledgeBaseSection";
import { useEscapeKey } from "@/hooks/useEscapeKey";

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
  onToast,
}) {
  const [isOpen, setIsOpen] = useState(true);
  // Tiroir superposé sous le point de repère mobile (md) : indépendant de
  // isOpen, qui ne pilote que le repli en rail sur desktop — sur mobile, la
  // barre latérale est soit hors-écran, soit affichée en entier.
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const closeMobile = () => setIsMobileOpen(false);

  // Échap ferme le tiroir mobile — même mécanisme que le clic sur le fond
  // assombri, pour une fermeture complètement accessible au clavier.
  useEscapeKey(closeMobile, isMobileOpen);

  const initials = user?.displayName
    ? user.displayName.charAt(0).toUpperCase()
    : user?.email?.charAt(0).toUpperCase() || "?";

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
        <div className="md:hidden fixed inset-0 bg-slate-900/40 z-40" onClick={closeMobile} />
      )}

      {/* Rail replié — desktop uniquement (isOpen=false), jamais affiché sur
          mobile où le repli en rail n'a pas de sens (le tiroir est soit
          fermé, soit affiché en entier). */}
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

        <div className="relative z-10 flex flex-col h-full">
          {/* Un seul bouton, qui replie sur desktop (rail) ET ferme le tiroir
              sur mobile — chaque appel est sans effet visible dans l'autre
              contexte, inutile de détecter le viewport en JS. */}
          <div className="px-3 pt-2 flex items-center justify-end">
            <button
              onClick={() => {
                setIsOpen(false);
                closeMobile();
              }}
              className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
              title="Réduire / fermer la barre latérale"
              aria-label="Réduire ou fermer la barre latérale"
            >
              <PanelLeftClose size={14} />
            </button>
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
                className="opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all rounded-md"
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
                closeMobile();
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

            <ProjectTree
              projects={projects}
              subProjects={subProjects}
              activeProjectId={activeProjectId}
              activeSubProjectId={activeSubProjectId}
              onSelectProject={onSelectProject}
              onSelectSubProject={onSelectSubProject}
              onCreate={onCreate}
              onCreateSubProject={onCreateSubProject}
              onUpdateProject={onUpdateProject}
              onUpdateSubProject={onUpdateSubProject}
              onDeleteProject={onDeleteProject}
              onDeleteSubProject={onDeleteSubProject}
              onNavigate={closeMobile}
            />

            {/* Séparateur */}
            <div className="h-px bg-slate-100 dark:bg-slate-800 my-3 mx-2" />

            <KnowledgeBaseSection
              knowledgeBase={knowledgeBase}
              books={subProjects[activeProjectId] || []}
              activeProjectId={activeProjectId}
              activeSubProjectId={activeSubProjectId}
              activeKbFileId={activeKbFileId}
              onSelectKbFile={onSelectKbFile}
              onAddKbFile={onAddKbFile}
              onDeleteKbFile={onDeleteKbFile}
              onSetKbFileScope={onSetKbFileScope}
              onToast={onToast}
              onNavigate={closeMobile}
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
      </aside>
    </>
  );
}
