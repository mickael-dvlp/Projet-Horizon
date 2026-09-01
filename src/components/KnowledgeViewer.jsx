"use client";
import { useEffect, useState } from "react";
import { X, FileText, Pencil, Check } from "lucide-react";
import { useRestoreFocus } from "@/hooks/useRestoreFocus";

// Échappe les caractères HTML avant le rendu markdown
const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Rendu inline : gras, italique, code inline
const inline = (s) =>
  esc(s)
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/___(.+?)___/g, "<strong><em>$1</em></strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");

const renderMarkdown = (md) => {
  if (!md) return "";
  const lines = md.split("\n");
  const out = [];
  let listStack = [];

  const closeLists = () => {
    while (listStack.length) out.push(`</${listStack.pop()}>`);
  };

  for (const line of lines) {
    if (line.startsWith("### ")) {
      closeLists();
      out.push(`<h3>${inline(line.slice(4))}</h3>`);
    } else if (line.startsWith("## ")) {
      closeLists();
      out.push(`<h2>${inline(line.slice(3))}</h2>`);
    } else if (line.startsWith("# ")) {
      closeLists();
      out.push(`<h1>${inline(line.slice(2))}</h1>`);
    } else if (line.startsWith("> ")) {
      closeLists();
      out.push(`<blockquote>${inline(line.slice(2))}</blockquote>`);
    } else if (/^[-*] /.test(line)) {
      if (listStack[listStack.length - 1] !== "ul") {
        if (listStack.length) closeLists();
        out.push("<ul>");
        listStack.push("ul");
      }
      out.push(`<li>${inline(line.slice(2))}</li>`);
    } else if (/^\d+\. /.test(line)) {
      if (listStack[listStack.length - 1] !== "ol") {
        if (listStack.length) closeLists();
        out.push("<ol>");
        listStack.push("ol");
      }
      out.push(`<li>${inline(line.replace(/^\d+\. /, ""))}</li>`);
    } else if (/^[-*_]{3,}$/.test(line.trim())) {
      closeLists();
      out.push("<hr />");
    } else if (line.trim() === "") {
      closeLists();
      out.push('<div class="kb-spacer"></div>');
    } else {
      closeLists();
      out.push(`<p>${inline(line)}</p>`);
    }
  }

  closeLists();
  return out.join("");
};

const formatDate = (ts) =>
  new Date(ts).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export default function KnowledgeViewer({ file, onClose, onUpdateContent, onToast }) {
  useRestoreFocus();
  const [isEditing, setIsEditing] = useState(false);
  const [draftContent, setDraftContent] = useState(file.content || "");
  const html = renderMarkdown(file.content);

  const handleStartEdit = () => {
    setDraftContent(file.content || "");
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    onUpdateContent?.(file.id, draftContent);
    setIsEditing(false);
    onToast?.("success", "Fiche mise à jour.");
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      if (isEditing) handleCancelEdit();
      else onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, isEditing]);

  return (
    <>
      {/* Backdrop au-dessus du MemoEditor */}
      <div
        className="fixed inset-0 bg-slate-900/30 z-[55] animate-in fade-in duration-200"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 w-full sm:w-[560px] max-w-full sm:max-w-[90vw] bg-white dark:bg-slate-900 h-full flex flex-col shadow-2xl z-[60] animate-in slide-in-from-right duration-300 border-l border-slate-200 dark:border-slate-700 pr-[env(safe-area-inset-right)]">
        {/* Header */}
        <div className="relative px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between md:justify-center gap-4 shrink-0">
          <div className="flex items-start gap-3 min-w-0 flex-1 md:flex-none md:flex-col md:items-center md:text-center">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5 md:mt-0">
              <FileText size={16} />
            </div>
            <div className="min-w-0 flex-1 md:flex-none">
              <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-0.5">
                Base de connaissances
              </p>
              <h2 className="font-bold text-slate-900 dark:text-slate-100 text-base leading-snug truncate">
                {file.name}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 md:absolute md:right-6 md:top-4">
            {isEditing ? (
              <>
                <button
                  onClick={handleCancelEdit}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                >
                  <Check size={13} />
                  Enregistrer
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleStartEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors"
                >
                  <Pencil size={13} />
                  Modifier
                </button>
                <button
                  onClick={onClose}
                  aria-label="Fermer"
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  <X size={18} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Contenu markdown rendu, ou champ texte brut en mode édition */}
        {isEditing ? (
          <textarea
            value={draftContent}
            onChange={(e) => setDraftContent(e.target.value)}
            aria-label="Contenu de la fiche (Markdown)"
            className="flex-1 outline-none px-8 py-6 text-sm font-mono text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 resize-none custom-scrollbar"
            style={{ minHeight: 0 }}
            autoFocus
          />
        ) : (
          <div
            className="flex-1 overflow-y-auto custom-scrollbar kb-content px-8 py-6"
            style={{ minHeight: 0 }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <p className="text-xs text-slate-300 dark:text-slate-600 font-medium">
            Importé le {formatDate(file.importedAt)}
          </p>
        </div>
      </div>
    </>
  );
}
