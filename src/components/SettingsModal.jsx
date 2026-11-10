"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import {
  X,
  Settings,
  Sun,
  Moon,
  Monitor,
  Download,
  FileArchive,
  Loader2,
  AlertTriangle,
  Trash2,
  Ban,
  Palette,
  Database,
  RefreshCw,
  RotateCw,
  Upload,
} from "lucide-react";
import { BACKGROUND_OPTIONS } from "@/lib/backgrounds";
import { MAX_BACKUP_BYTES } from "@/lib/backup";
import { useRestoreFocus } from "@/hooks/useRestoreFocus";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { useConfirm } from "@/components/ConfirmDialog";

const THEME_OPTIONS = [
  { value: "light", label: "Clair", icon: Sun },
  { value: "dark", label: "Sombre", icon: Moon },
  { value: "system", label: "Système", icon: Monitor },
];

const RETENTION_OPTIONS = [
  { value: "", label: "Jamais" },
  { value: "7", label: "7 jours" },
  { value: "30", label: "30 jours" },
  { value: "90", label: "90 jours" },
];

const DELETE_CONFIRM_WORD = "SUPPRIMER";

function updateStatusText(status) {
  switch (status.state) {
    case "checking":
      return "Recherche d’une mise à jour...";
    case "available":
      return `Mise à jour ${status.version} trouvée, téléchargement en cours...`;
    case "not-available":
      return "Vous avez déjà la dernière version.";
    case "downloading":
      return `Téléchargement en cours... ${status.percent ?? 0}%`;
    case "downloaded":
      return `Mise à jour ${status.version} téléchargée, prête à installer.`;
    case "error":
      return `Échec de la vérification : ${status.message || "réessayez plus tard."}`;
    case "unavailable":
      return "Vérification indisponible hors d’une build installée.";
    default:
      return null;
  }
}

const GAUGE_COLORS = {
  ok: "bg-indigo-500",
  warning: "bg-amber-400",
  critical: "bg-red-500",
};

// Part de l'espace disponible déjà utilisée (document Firestore de 1 Mio
// pour un compte, stockage local du navigateur pour un invité).
function StorageGauge({ usage }) {
  const percent = Math.round(usage.ratio * 100);
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
        <span>Espace de stockage utilisé</span>
        <span className="tabular-nums font-semibold">{percent} %</span>
      </div>
      <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${GAUGE_COLORS[usage.level] || GAUGE_COLORS.ok}`}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
    </div>
  );
}

function BackgroundGallery({ folder, value, onChange }) {
  return (
    <div className="grid grid-cols-6 gap-1.5">
      <button
        onClick={() => onChange(null)}
        title="Aucune"
        className={`aspect-square rounded-lg border flex items-center justify-center transition-colors ${
          value === null
            ? "border-indigo-400 dark:border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-500/30"
            : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
        }`}
      >
        <Ban size={14} className="text-slate-400 dark:text-slate-500" />
      </button>
      {BACKGROUND_OPTIONS.map((name) => (
        <button
          key={name}
          onClick={() => onChange(name)}
          title={name}
          className={`relative aspect-square rounded-lg overflow-hidden border transition-colors ${
            value === name
              ? "border-indigo-400 dark:border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-500/30"
              : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
          }`}
        >
          <Image src={`/images/${folder}/${name}.png`} alt={name} fill sizes="64px" className="object-cover" />
        </button>
      ))}
    </div>
  );
}

export default function SettingsModal({
  onClose,
  theme,
  setTheme,
  sidebarBg,
  setSidebarBg,
  mainBg,
  setMainBg,
  settings,
  setSettings,
  onExport,
  onExportZip,
  onImport,
  onDeleteAll,
  canDeleteAccount = false,
  storageUsage,
  updater,
}) {
  useRestoreFocus();
  const [confirmText, setConfirmText] = useState("");
  const [isDeleted, setIsDeleted] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteAccount, setDeleteAccount] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState(null);
  const [isZipping, setIsZipping] = useState(false);
  const [importMessage, setImportMessage] = useState(null);
  const importInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState("apparence");
  const confirm = useConfirm();
  useEscapeKey(onClose);

  const handleRetentionChange = (e) => {
    const raw = e.target.value;
    setSettings((prev) => ({
      ...prev,
      trashRetentionDays: raw ? Number(raw) : null,
    }));
  };

  const handleDeleteAll = async () => {
    setIsDeleting(true);
    setDeleteMessage(null);
    try {
      const result = await onDeleteAll({ deleteAccount });
      setDeleteMessage(result?.message || null);
      if (result?.ok) {
        setIsDeleted(true);
        setConfirmText("");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      setImportMessage("Fichier trop volumineux (10 Mo maximum).");
      return;
    }
    const ok = await confirm({
      title: "Remplacer toutes vos données ?",
      message:
        "Les données actuelles seront remplacées par cette sauvegarde. Exportez-les d’abord si vous souhaitez les conserver.",
      confirmLabel: "Remplacer",
      danger: true,
    });
    if (!ok) return;
    let text;
    try {
      text = await file.text();
    } catch {
      setImportMessage("Impossible de lire ce fichier.");
      return;
    }
    const result = onImport(text);
    setImportMessage(result.ok ? "Sauvegarde importée." : result.message);
  };

  const handleExportZip = async () => {
    setIsZipping(true);
    try {
      await onExportZip();
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-100 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-slate-200 dark:border-slate-700">
        {/* Header */}
        <div className="relative p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between md:justify-center items-center bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
          <div className="flex items-center gap-3 md:flex-col md:text-center">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-500/10 rounded-lg text-indigo-600 dark:text-indigo-400">
              <Settings size={20} />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 dark:text-slate-100">Paramètres</h2>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold tracking-wider">
                Préférences de l’application
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400 dark:text-slate-500 md:absolute md:right-5 md:top-1/2 md:-translate-y-1/2"
          >
            <X size={20} />
          </button>
        </div>

        {/* Onglets */}
        <div className="flex items-center gap-1.5 px-5 py-2.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <button
            onClick={() => setActiveTab("apparence")}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === "apparence"
                ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400"
                : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Palette size={13} />
            Apparence
          </button>
          <button
            onClick={() => setActiveTab("donnees")}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === "donnees"
                ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400"
                : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Database size={13} />
            Données
          </button>
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
          {/* Apparence */}
          {activeTab === "apparence" && (
          <section>
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              Apparence
            </h3>
            <div className="grid grid-cols-3 gap-2 mb-5">
              {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-semibold transition-colors ${
                    theme === value
                      ? "border-indigo-300 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400"
                      : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>

            <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1.5">
              Fond de la barre latérale
            </label>
            <BackgroundGallery folder="fond-menu" value={sidebarBg} onChange={setSidebarBg} />

            <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1.5 mt-4">
              Fond de la zone principale
            </label>
            <div className="opacity-40 pointer-events-none md:opacity-100 md:pointer-events-auto">
              <BackgroundGallery folder="fond-champs" value={mainBg} onChange={setMainBg} />
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 italic mt-1.5 md:hidden">
              Disponible à partir de la taille tablette.
            </p>
          </section>
          )}

          {/* Application (app de bureau uniquement) */}
          {activeTab === "donnees" && updater?.isElectron && (
          <section>
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              Application
            </h3>
            {updater.version && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                Version installée : <span className="font-mono font-semibold text-slate-600 dark:text-slate-300">{updater.version}</span>
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={updater.checkForUpdates}
                disabled={updater.status.state === "checking" || updater.status.state === "downloading"}
                className="flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 disabled:cursor-wait px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors"
              >
                {updater.status.state === "checking" || updater.status.state === "downloading" ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <RefreshCw size={15} />
                )}
                Vérifier les mises à jour
              </button>
              {updater.status.state === "downloaded" && (
                <button
                  onClick={updater.quitAndInstall}
                  className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors"
                >
                  <RotateCw size={15} />
                  Redémarrer et installer
                </button>
              )}
            </div>
            {updateStatusText(updater.status) && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                {updateStatusText(updater.status)}
              </p>
            )}
          </section>
          )}

          {/* Corbeille */}
          {activeTab === "donnees" && (
          <section>
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              Corbeille
            </h3>
            <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1.5">
              Purger automatiquement les éléments supprimés après :
            </label>
            <select
              value={settings.trashRetentionDays ?? ""}
              onChange={handleRetentionChange}
              className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-300/40 dark:focus:ring-indigo-500/30 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
            >
              {RETENTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </section>
          )}

          {/* Compte & données */}
          {activeTab === "donnees" && (
          <section>
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              Compte &amp; données
            </h3>

            {storageUsage && <StorageGauge usage={storageUsage} />}

            <div className="flex flex-col gap-2">
              <button
                onClick={onExport}
                className="w-full flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors"
              >
                <Download size={15} />
                Exporter mes données (.json)
              </button>

              <button
                onClick={handleExportZip}
                disabled={isZipping}
                className="w-full flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 disabled:cursor-wait px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors"
              >
                {isZipping ? <Loader2 size={15} className="animate-spin" /> : <FileArchive size={15} />}
                Exporter en .zip (chapitres en .md)
              </button>

              <button
                onClick={() => importInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors"
              >
                <Upload size={15} />
                Importer une sauvegarde (.json)
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                aria-label="Fichier de sauvegarde à importer"
                onChange={handleImportFile}
              />
              {importMessage && (
                <p role="status" className="text-xs text-slate-500 dark:text-slate-400">
                  {importMessage}
                </p>
              )}
            </div>

            <div className="mt-4 border border-red-100 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/5 rounded-xl p-4">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-semibold text-sm mb-2">
                <AlertTriangle size={15} />
                Zone de danger
              </div>

              {deleteMessage && (
                <p role="status" className="text-xs text-red-600 dark:text-red-400 mb-3 leading-relaxed">
                  {deleteMessage}
                </p>
              )}

              {isDeleted ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Toutes les données ont été supprimées.
                </p>
              ) : (
                <>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
                    Supprime définitivement tous vos univers, livres, chapitres, la
                    base de connaissances et la corbeille. Cette action est
                    irréversible. Tapez{" "}
                    <span className="font-mono font-bold text-red-500 dark:text-red-400">
                      {DELETE_CONFIRM_WORD}
                    </span>{" "}
                    pour confirmer.
                  </p>
                  <input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={DELETE_CONFIRM_WORD}
                    className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 mb-3 outline-none focus:ring-2 focus:ring-red-300/40 dark:focus:ring-red-500/30 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                  />
                  {canDeleteAccount && (
                    <label className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300 mb-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={deleteAccount}
                        onChange={(e) => setDeleteAccount(e.target.checked)}
                        className="mt-0.5 accent-red-600"
                      />
                      Supprimer aussi mon compte (connexion Google demandée si nécessaire)
                    </label>
                  )}
                  <button
                    onClick={handleDeleteAll}
                    disabled={confirmText !== DELETE_CONFIRM_WORD || isDeleting}
                    className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors"
                  >
                    {isDeleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    {deleteAccount ? "Supprimer mes données et mon compte" : "Supprimer toutes mes données"}
                  </button>
                </>
              )}
            </div>
          </section>
          )}
        </div>
      </div>
    </div>
  );
}
