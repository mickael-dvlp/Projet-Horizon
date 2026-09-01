"use client";
import { useState, useEffect, useRef } from "react";
import DOMPurify from "dompurify";
import { htmlToMarkdown } from "@/lib/htmlToMarkdown";
import { triggerDownload, sanitizeFilename } from "@/lib/download";
import { countWordsFromHtml } from "@/lib/wordCount";
import { useRestoreFocus } from "@/hooks/useRestoreFocus";
import TaskList from "@/components/TaskList";
import SceneListPanel from "@/components/SceneListPanel";
import {
  X, Save, FileText, Bold, Italic, Underline,
  Highlighter, List, Type, Maximize2, Minimize2, FileDown,
  ListTodo, Layers, ArrowLeft,
} from "lucide-react";

const TEXT_COLORS = [
  "#111827", "#374151", "#6b7280", "#9ca3af", "#d1d5db",
  "#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e",
  "#14b8a6", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6",
  "#a855f7", "#ec4899", "#f43f5e", "#92400e", "#78716c",
];

const HIGHLIGHT_COLORS = [
  "#fef08a", "#fde68a", "#fed7aa", "#fecaca", "#fbcfe8",
  "#f5d0fe", "#ddd6fe", "#bfdbfe", "#a5f3fc", "#99f6e4",
  "#bbf7d0", "#d9f99d", "#fef3c7", "#ffedd5", "#ffe4e6",
  "#e0e7ff", "#f3e8ff", "#fce7f3", "#ecfdf5", "#ffffff",
];

function ColorPicker({ colors, onSelect, onClose, label }) {
  return (
    <>
      <div className="fixed inset-0 z-30" onMouseDown={onClose} />
      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-40 animate-in fade-in zoom-in-95 duration-100">
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">{label}</p>
        <div className="grid grid-cols-5 gap-1.5">
          {colors.map((color) => (
            <button
              key={color}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(color);
              }}
              className="w-6 h-6 rounded-full hover:scale-110 transition-transform ring-1 ring-black/10 hover:ring-2 hover:ring-indigo-400"
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
      </div>
    </>
  );
}

export default function MemoEditor({
  page,
  onClose,
  onSave,
  onSaveScene,
  onAddScene,
  onDeleteScene,
  onToast,
}) {
  useRestoreFocus();
  const [isDirty, setIsDirty] = useState(false);
  const [isTasksOpen, setIsTasksOpen] = useState(false);
  const [activeSceneId, setActiveSceneId] = useState(null);
  const [showScenes, setShowScenes] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [panelWidth, setPanelWidth] = useState(512);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [activeTextColor, setActiveTextColor] = useState("#111827");
  const [activeHighlight, setActiveHighlight] = useState("#fef08a");
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const editorRef = useRef(null);
  const titleInputRef = useRef(null);
  const resizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  // Bloque toute sauvegarde déclenchée pendant le (re)chargement d'un
  // document (voir l'effet de chargement ci-dessous) — une ref, pas un
  // state, pour être lue de façon synchrone par les handlers sans attendre
  // un re-render.
  const isLoadingRef = useRef(true);

  // Une scène a exactement la même forme qu'un chapitre ({id, title, content,
  // status, tasks}) : "unit" désigne l'élément réellement en cours d'édition,
  // qu'il s'agisse du chapitre lui-même ou d'une de ses scènes.
  const activeScene = activeSceneId
    ? (page.scenes || []).find((s) => s.id === activeSceneId) || null
    : null;
  const isScene = !!activeScene;
  const unit = activeScene || page;

  // Identité explicite du document actuellement édité, et clé stable qui en
  // dérive : sert à la fois de dépendance d'effet unique (voir plus bas) et
  // de `key` React sur la zone éditable, pour garantir qu'un changement de
  // document (chapitre ↔ scène, ou scène ↔ scène) ne peut jamais laisser
  // survivre un état ou une ref de l'ancien document.
  const activeDocument = page ? { type: isScene ? "scene" : "chapter", id: unit.id } : null;
  const docKey = activeDocument ? `${activeDocument.type}-${activeDocument.id}` : null;

  const saveUnit = (updates) => {
    if (isLoadingRef.current) return;
    if (isScene) onSaveScene(page.id, activeSceneId, updates);
    else onSave(page.id, updates);
  };

  const updateCounts = () => {
    const text = (editorRef.current?.innerText || "").trim();
    setCharCount(text.length);
    setWordCount(text ? text.split(/\s+/).length : 0);
  };

  // Changer de chapitre réinitialise la navigation scène (on ne veut pas
  // rester "dans" une scène d'un autre chapitre) et pré-sélectionne la vue
  // scènes si ce chapitre en contient déjà — cf. décision produit : un
  // chapitre avec des scènes s'édite scène par scène, un chapitre sans
  // scène reste éditable directement comme avant.
  useEffect(() => {
    setActiveSceneId(null);
    setShowScenes((page?.scenes?.length || 0) > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page?.id]);

  // Rechargement du document actif. Dépend de `docKey` (changement de
  // chapitre/scène) ET de `showScenes` (la zone éditable est démontée puis
  // remontée quand on bascule vers/depuis la liste des scènes du même
  // chapitre, ce qui vide sa `innerHTML` : il faut la re-remplir). Le
  // compteur, lui, est désormais calculé depuis `unit.content` et non plus
  // depuis le DOM (`editorRef.current`) : il reste donc correct même quand
  // la zone éditable n'est pas montée (ex. liste des scènes affichée à la
  // place) — c'est précisément ce qui provoquait le compteur figé sur
  // l'ancien document après "Retour au chapitre".
  useEffect(() => {
    isLoadingRef.current = true;
    if (editorRef.current) {
      editorRef.current.innerHTML = DOMPurify.sanitize(unit?.content || "");
    }
    const { words, chars } = countWordsFromHtml(unit?.content);
    setWordCount(words);
    setCharCount(chars);
    setIsDirty(false);
    isLoadingRef.current = false;
    // unit.content volontairement exclu : ne recharger le contenu que lors du
    // changement de document ou de visibilité de la zone éditable. Sinon,
    // chaque clic sur "Enregistrer" (qui met à jour unit.content)
    // redéclencherait cet effet et réinitialiserait le curseur/la sélection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docKey, showScenes]);

  // Referme le panneau Tâches à chaque changement réel de document
  // (chapitre ↔ scène) — sans ça, il restait ouvert et basculait
  // silencieusement sur les tâches du nouveau document sans action
  // explicite de l'utilisateur (bouton "actif" mais contexte obsolète).
  // Uniquement docKey (pas showScenes) : basculer la vue Scènes pour le
  // même chapitre n'est pas un changement de document.
  useEffect(() => {
    setIsTasksOpen(false);
  }, [docKey]);

  useEffect(() => {
    if (isEditingTitle) titleInputRef.current?.focus();
  }, [isEditingTitle]);

  // Échap ferme d'abord ce qui est ouvert par-dessus l'éditeur (sélecteur de
  // couleur, édition du titre) avant de fermer l'éditeur lui-même — et passe
  // par la confirmation habituelle si des modifications ne sont pas enregistrées.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      if (showTextColorPicker) return setShowTextColorPicker(false);
      if (showHighlightPicker) return setShowHighlightPicker(false);
      if (showCloseConfirm) return setShowCloseConfirm(false);
      if (isEditingTitle) return setIsEditingTitle(false);
      if (isDirty) setShowCloseConfirm(true);
      else onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showTextColorPicker, showHighlightPicker, showCloseConfirm, isEditingTitle, isDirty, onClose]);

  // Lit le contenu du DOM quand la zone éditable est montée (contenu live,
  // potentiellement non encore enregistré) ; sinon (ex. liste des scènes
  // affichée à la place de l'éditeur pour ce chapitre) retombe sur le
  // contenu enregistré (unit.content) plutôt que sur une chaîne vide —
  // sans ce repli, exporter en .md depuis cette vue produisait un fichier
  // ne contenant que le titre, le corps étant silencieusement perdu.
  const getContent = () =>
    DOMPurify.sanitize(editorRef.current ? editorRef.current.innerHTML : unit?.content || "");

  const handleSaveAndClose = () => {
    if (isDirty) saveUnit({ content: getContent() });
    onClose();
  };

  const handleSave = () => {
    saveUnit({ content: getContent() });
    setIsDirty(false);
  };

  const handleCloseClick = () => {
    if (isDirty) setShowCloseConfirm(true);
    else onClose();
  };

  const handleTitleSave = () => {
    const trimmed = titleValue.trim();
    if (trimmed && trimmed !== unit.title) {
      saveUnit({ title: trimmed });
    }
    setIsEditingTitle(false);
  };

  const handleFormat = (command, value) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value ?? undefined);
  };

  const handleExportMd = () => {
    try {
      const md = htmlToMarkdown(getContent());
      const title = unit.title || "chapitre";
      const blob = new Blob([`# ${title}\n\n${md}`], { type: "text/markdown;charset=utf-8" });
      triggerDownload(blob, `${sanitizeFilename(title)}.md`);
      onToast?.("success", "Export Markdown téléchargé.");
    } catch (error) {
      console.error("Erreur lors de l'export Markdown :", error);
      onToast?.("error", "Échec de l'export Markdown.");
    }
  };

  const handleResizeMouseDown = (e) => {
    if (isFullscreen) return;
    e.preventDefault();
    resizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = panelWidth;

    const onMouseMove = (ev) => {
      if (!resizingRef.current) return;
      const delta = startXRef.current - ev.clientX;
      const clamped = Math.max(320, Math.min(window.innerWidth * 0.9, startWidthRef.current + delta));
      setPanelWidth(clamped);
    };
    const onMouseUp = () => {
      resizingRef.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const baseTools = [
    { icon: Bold,      command: "bold",      title: "Gras" },
    { icon: Italic,    command: "italic",    title: "Italique" },
    { icon: Underline, command: "underline", title: "Souligné" },
  ];

  const headingTools = [
    { label: "H1", value: "h1", title: "Titre 1" },
    { label: "H2", value: "h2", title: "Titre 2" },
    { label: "H3", value: "h3", title: "Titre 3" },
  ];

  return (
    <>
      {!isFullscreen && (
        <div
          className="fixed inset-0 bg-slate-900/20 z-40 animate-in fade-in duration-200"
          onClick={handleSaveAndClose}
        />
      )}

      <div
        className={`fixed bg-white dark:bg-slate-900 h-full flex flex-col shadow-2xl z-50 border-l border-slate-200 dark:border-slate-700 max-w-full pr-[env(safe-area-inset-right)] ${
          isFullscreen
            ? "inset-0"
            : "inset-y-0 right-0 animate-in slide-in-from-right duration-300"
        }`}
        style={isFullscreen ? {} : { width: panelWidth }}
      >
        {/* Resize handle */}
        {!isFullscreen && (
          <div
            onMouseDown={handleResizeMouseDown}
            className="absolute top-0 bottom-0 w-2 cursor-col-resize z-10 group"
            style={{ left: -4 }}
          >
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-16 bg-indigo-400 rounded-full opacity-0 group-hover:opacity-60 transition-opacity" />
          </div>
        )}

        {/* Header */}
        <div className="relative px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between md:justify-center gap-4 shrink-0">
          <div className="flex items-start gap-3 min-w-0 flex-1 md:flex-none">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg text-indigo-500 dark:text-indigo-400 shrink-0 mt-0.5">
              <FileText size={16} />
            </div>
            <div className="min-w-0 flex-1 md:flex-none md:text-center">
              <p className="text-[10px] font-semibold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest mb-0.5 flex items-center gap-1.5 md:justify-center">
                {isScene && (
                  <button
                    onClick={() => setActiveSceneId(null)}
                    className="hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-0.5 -ml-0.5"
                    title="Retour au chapitre"
                  >
                    <ArrowLeft size={11} />
                  </button>
                )}
                {isScene ? "Scène" : "Chapitre"}
              </p>
              {isEditingTitle ? (
                <input
                  ref={titleInputRef}
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleTitleSave();
                    if (e.key === "Escape") setIsEditingTitle(false);
                  }}
                  className="font-bold text-slate-900 dark:text-slate-100 text-base w-full border-b-2 border-indigo-300 dark:border-indigo-500/50 outline-none bg-transparent pb-0.5"
                />
              ) : (
                <h2
                  onClick={() => {
                    setTitleValue(unit.title || "");
                    setIsEditingTitle(true);
                  }}
                  className="font-bold text-slate-900 dark:text-slate-100 text-base leading-snug truncate cursor-text hover:text-indigo-700 dark:hover:text-indigo-400 transition-colors"
                  title="Cliquer pour renommer"
                >
                  {unit.title || "Sans titre"}
                </h2>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0 md:absolute md:right-6 md:top-4">
            <button
              onClick={() => setIsFullscreen((v) => !v)}
              title={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              onClick={handleCloseClick}
              aria-label="Fermer l'éditeur"
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 shrink-0 flex-wrap">
          {/* B / I / U */}
          {baseTools.map(({ icon: Icon, command, title }) => (
            <button
              key={command}
              onMouseDown={(e) => { e.preventDefault(); handleFormat(command); }}
              title={title}
              className="p-2 rounded-md text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Icon size={15} />
            </button>
          ))}

          <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

          {/* H1 / H2 / H3 */}
          {headingTools.map(({ label, value, title }) => (
            <button
              key={value}
              onMouseDown={(e) => { e.preventDefault(); handleFormat("formatBlock", value); }}
              title={title}
              className="px-1.5 py-1 rounded-md text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-xs font-bold font-mono leading-none"
            >
              {label}
            </button>
          ))}

          <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

          {/* Couleur texte */}
          <div className="relative">
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                setShowHighlightPicker(false);
                setShowTextColorPicker((v) => !v);
              }}
              title="Couleur du texte"
              className="p-2 rounded-md text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex flex-col items-center gap-0.5"
            >
              <Type size={15} />
              <div className="w-3.5 h-1 rounded-full" style={{ backgroundColor: activeTextColor }} />
            </button>
            {showTextColorPicker && (
              <ColorPicker
                colors={TEXT_COLORS}
                label="Couleur du texte"
                onSelect={(color) => {
                  handleFormat("foreColor", color);
                  setActiveTextColor(color);
                  setShowTextColorPicker(false);
                }}
                onClose={() => setShowTextColorPicker(false)}
              />
            )}
          </div>

          {/* Surlignage */}
          <div className="relative">
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                setShowTextColorPicker(false);
                setShowHighlightPicker((v) => !v);
              }}
              title="Couleur de surlignage"
              className="p-2 rounded-md text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex flex-col items-center gap-0.5"
            >
              <Highlighter size={15} />
              <div className="w-3.5 h-1 rounded-full ring-1 ring-black/10" style={{ backgroundColor: activeHighlight }} />
            </button>
            {showHighlightPicker && (
              <ColorPicker
                colors={HIGHLIGHT_COLORS}
                label="Surlignage"
                onSelect={(color) => {
                  handleFormat("backColor", color);
                  setActiveHighlight(color);
                  setShowHighlightPicker(false);
                }}
                onClose={() => setShowHighlightPicker(false)}
              />
            )}
          </div>

          <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

          {/* Liste */}
          <button
            onMouseDown={(e) => { e.preventDefault(); handleFormat("insertUnorderedList"); }}
            title="Liste à puces"
            className="p-2 rounded-md text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <List size={15} />
          </button>

          <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

          {/* Export .md */}
          <button
            onClick={handleExportMd}
            title="Exporter en .md"
            className="p-2 rounded-md text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
          >
            <FileDown size={15} />
          </button>

          <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />
          <button
            onClick={() => setIsTasksOpen((v) => !v)}
            title="Tâches"
            aria-label={`Tâches — ${unit.tasks?.length || 0} élément${(unit.tasks?.length || 0) !== 1 ? "s" : ""}`}
            aria-expanded={isTasksOpen}
            aria-controls="memo-tasks-panel"
            className={`p-2 rounded-md transition-colors relative ${
              isTasksOpen
                ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                : "text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
            }`}
          >
            <ListTodo size={15} />
            {(unit.tasks?.length || 0) > 0 && (
              <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center">
                {unit.tasks.filter((t) => !t.done).length}
              </span>
            )}
          </button>

          {!isScene && onAddScene && (
            <button
              onClick={() => setShowScenes((v) => !v)}
              title="Scènes"
              aria-label={`Scènes — ${page.scenes?.length || 0} élément${(page.scenes?.length || 0) !== 1 ? "s" : ""}`}
              aria-expanded={showScenes}
              aria-controls="memo-scenes-panel"
              className={`p-2 rounded-md transition-colors relative ${
                showScenes
                  ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                  : "text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
              }`}
            >
              <Layers size={15} />
              {(page.scenes?.length || 0) > 0 && (
                <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center">
                  {page.scenes.length}
                </span>
              )}
            </button>
          )}

        </div>

        {/* Panneau tâches */}
        {isTasksOpen && (
          <div id="memo-tasks-panel" className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 shrink-0">
            <TaskList
              tasks={unit.tasks || []}
              onAdd={(label) =>
                saveUnit({ tasks: [...(unit.tasks || []), { id: `task-${Date.now()}`, label, done: false }] })
              }
              onToggle={(taskId) =>
                saveUnit({ tasks: (unit.tasks || []).map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)) })
              }
              onDelete={(taskId) =>
                saveUnit({ tasks: (unit.tasks || []).filter((t) => t.id !== taskId) })
              }
            />
          </div>
        )}

        {/* Zone d'édition : liste des scènes (chapitre uniquement) ou contenu éditable */}
        {!isScene && showScenes ? (
          <SceneListPanel
            id="memo-scenes-panel"
            scenes={page.scenes || []}
            onOpen={(sceneId) => setActiveSceneId(sceneId)}
            onAdd={(title) => onAddScene(page.id, title)}
            onDelete={(sceneId) => onDeleteScene(page.id, sceneId)}
            onUpdate={(sceneId, updates) => onSaveScene(page.id, sceneId, updates)}
          />
        ) : (
          <div
            key={docKey}
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label={isScene ? "Contenu de la scène" : "Contenu du chapitre"}
            onInput={() => {
              setIsDirty(true);
              updateCounts();
            }}
            className="flex-1 px-8 py-6 outline-none text-slate-700 dark:text-slate-200 leading-relaxed text-sm font-medium overflow-y-auto custom-scrollbar memo-editor"
            style={{ minHeight: 0 }}
          />
        )}

        {/* Confirmation fermeture sans sauvegarde */}
        {showCloseConfirm && (
          <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-20 flex items-center justify-center">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl shadow-slate-200/60 dark:shadow-none p-6 mx-8 w-full max-w-sm text-center">
              <div className="w-12 h-12 bg-amber-50 dark:bg-amber-500/10 text-amber-500 dark:text-amber-400 rounded-xl flex items-center justify-center text-xl mx-auto mb-4">
                ⚠️
              </div>
              <p className="font-bold text-slate-800 dark:text-slate-100 mb-1">Modifications non enregistrées</p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mb-6 leading-relaxed">
                Voulez-vous enregistrer vos modifications avant de fermer ?
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    saveUnit({ content: getContent() });
                    onClose();
                  }}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors"
                >
                  Enregistrer et fermer
                </button>
                <button
                  onClick={onClose}
                  className="w-full bg-slate-100 dark:bg-slate-700 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 text-slate-500 dark:text-slate-300 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors"
                >
                  Fermer sans enregistrer
                </button>
                <button
                  onClick={() => setShowCloseConfirm(false)}
                  className="w-full text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 px-4 py-2 rounded-xl font-medium text-sm transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 sm:px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shrink-0">
          <span className="text-xs text-slate-400 dark:text-slate-500 font-medium tabular-nums">
            {wordCount} mot{wordCount !== 1 ? "s" : ""} · {charCount} caractère{charCount !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400 font-semibold hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={!isDirty}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                isDirty
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-200 dark:shadow-none active:scale-95"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed"
              }`}
            >
              <Save size={15} />
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
