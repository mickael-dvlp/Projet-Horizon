"use client";
import { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronRight, Trash2, Plus, Check, FileText, Upload, Target, Search } from "lucide-react";
import Popover from "@/components/Popover";
import { MenuLabel, MenuSeparator } from "@/components/MetaMenu";
import { useConfirm } from "@/components/ConfirmDialog";
import { isKbFileVisibleForBook } from "@/lib/knowledgeBase";
import { searchKbFiles } from "@/lib/kbSearch";

// Une fiche est stockée dans le même document Firestore que tout le reste
// (limite 1 Mio) : au-delà, une seule importation pourrait bloquer toutes
// les sauvegardes suivantes.
const MAX_KB_FILE_BYTES = 500 * 1024;

const MENU_ITEM =
  "w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors";
const EMPTY_TEXT = "px-3 py-1 text-[11px] text-slate-500 dark:text-slate-400 italic";

// Base de connaissances de l'univers actif : liste des fiches visibles pour
// le livre ouvert, recherche, import, portée (univers entier ou livres
// choisis) et suppression. `onNavigate` referme le tiroir mobile.
export default function KnowledgeBaseSection({
  knowledgeBase,
  books,
  activeProjectId,
  activeSubProjectId,
  activeKbFileId,
  onSelectKbFile,
  onAddKbFile,
  onDeleteKbFile,
  onSetKbFileScope,
  onToast,
  onNavigate,
}) {
  const confirm = useConfirm();
  const [isExpanded, setIsExpanded] = useState(true);
  const [scopeMenuFor, setScopeMenuFor] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const fileInputRef = useRef(null);

  // Une recherche vide en changeant d'univers évite d'afficher "Aucun
  // résultat" sur un mot qui n'a jamais concerné le nouvel univers.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearchQuery("");
  }, [activeProjectId]);

  const handleFileImport = (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_KB_FILE_BYTES) {
      onToast?.("error", `Fichier trop volumineux (${Math.round(file.size / 1024)} Ko, maximum 500 Ko).`);
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => onAddKbFile(file.name, ev.target.result);
    reader.onerror = () => onToast?.("error", `Impossible de lire le fichier "${file.name}".`);
    reader.readAsText(file, "UTF-8");
  };

  const openFile = (file) => {
    onSelectKbFile(file);
    onNavigate?.();
  };

  const visibleKb = knowledgeBase.filter((f) => isKbFileVisibleForBook(f, activeSubProjectId));
  const trimmedQuery = searchQuery.trim();
  const searchResults = trimmedQuery ? searchKbFiles(visibleKb, trimmedQuery) : null;

  const renderSearchResults = () => (
    <>
      {searchResults.length === 0 && (
        <p className={EMPTY_TEXT}>Aucun résultat pour &quot;{trimmedQuery}&quot;</p>
      )}
      {searchResults.map(({ file, snippet }) => (
        <button
          key={file.id}
          onClick={() => openFile(file)}
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

  const renderFileList = () => (
    <>
      {visibleKb.length === 0 && (
        <p className={EMPTY_TEXT}>
          Aucun fichier {activeSubProjectId ? "visible pour ce livre" : "importé"}
        </p>
      )}
      {visibleKb.map((file) => {
        const isActive = activeKbFileId === file.id;
        const scope = file.subProjectIds || [];
        return (
          <div key={file.id} className="group relative">
            <button
              onClick={() => openFile(file)}
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
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setScopeMenuFor(scopeMenuFor === file.id ? null : file.id);
                }}
                className="p-0.5 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                title={scope.length === 0 ? "Portée : tout l'univers" : "Portée : livres spécifiques"}
                aria-label={`Modifier la portée de la fiche ${file.name}`}
              >
                <Target size={11} />
              </button>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  const ok = await confirm({
                    title: `Supprimer la fiche « ${file.name} » ?`,
                    message: "La fiche sera placée dans la corbeille.",
                    confirmLabel: "Supprimer",
                    danger: true,
                  });
                  if (ok) onDeleteKbFile(file.id);
                }}
                className="p-0.5 hover:bg-red-50 dark:hover:bg-red-500/10 rounded text-slate-400 dark:text-slate-500 hover:text-red-500 transition-colors"
                title="Supprimer"
                aria-label={`Supprimer la fiche ${file.name}`}
              >
                <Trash2 size={11} />
              </button>
            </div>
            {scopeMenuFor === file.id && (
              <Popover
                onClose={() => setScopeMenuFor(null)}
                className="right-1.5 top-full mt-0.5 w-48 rounded-lg z-20 py-1"
              >
                <MenuLabel>Portée</MenuLabel>
                <button onClick={() => onSetKbFileScope(file.id, [])} className={MENU_ITEM}>
                  <span className="flex-1 text-left">Tout l&apos;univers</span>
                  {scope.length === 0 && <Check size={12} className="text-indigo-500 dark:text-indigo-400" />}
                </button>
                {books.length > 0 && (
                  <>
                    <MenuSeparator />
                    {books.map((book) => {
                      const checked = scope.includes(book.id);
                      return (
                        <button
                          key={book.id}
                          onClick={() =>
                            onSetKbFileScope(
                              file.id,
                              checked ? scope.filter((id) => id !== book.id) : [...scope, book.id]
                            )
                          }
                          className={MENU_ITEM}
                        >
                          <span className="flex-1 text-left truncate">{book.name}</span>
                          {checked && <Check size={12} className="text-indigo-500 dark:text-indigo-400" />}
                        </button>
                      );
                    })}
                  </>
                )}
              </Popover>
            )}
          </div>
        );
      })}
    </>
  );

  return (
    <>
      <div className="flex items-center justify-between px-3 mb-1.5">
        <button
          onClick={() => setIsExpanded((v) => !v)}
          aria-expanded={isExpanded}
          className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          Base de connaissances
        </button>
        {activeProjectId && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-md transition-colors"
            title="Importer un fichier .md"
            aria-label="Importer un fichier .md"
          >
            <Plus size={13} />
          </button>
        )}
      </div>

      {isExpanded && !activeProjectId && (
        <p className={EMPTY_TEXT}>Sélectionnez un univers pour voir sa base de connaissances</p>
      )}

      {isExpanded && activeProjectId && (
        <div className="space-y-0.5">
          {searchResults ? renderSearchResults() : renderFileList()}

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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un élément..."
              aria-label="Rechercher un élément dans la base de connaissances"
              className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-8 pr-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-300/40 dark:focus:ring-indigo-500/30 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept=".md,.txt" className="hidden" onChange={handleFileImport} />
    </>
  );
}
