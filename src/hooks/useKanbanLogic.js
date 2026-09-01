import { useState, useEffect, useRef } from "react";
import JSZip from "jszip";
import { auth, db } from "@/firebase/config";
import { useTrash } from "@/hooks/useTrash";
import { htmlToMarkdown } from "@/lib/htmlToMarkdown";
import { buildUniverseSummary } from "@/lib/universeSummary";
import { triggerDownload, sanitizeFilename } from "@/lib/download";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { BACKGROUND_OPTIONS } from "@/lib/backgrounds";

// Marqueur localStorage distinct des données elles-mêmes : indique qu'une
// session invité était active, pour la restaurer après un rechargement.
const GUEST_SESSION_KEY = "horizon-guest-session";

const DEFAULT_SETTINGS = { trashRetentionDays: null, sidebarBg: null, mainBg: null };

// Anciennes clés localStorage (fonds d'écran stockés uniquement sur l'appareil,
// jamais synchronisés) : à ne lire qu'une fois, pour reprendre un choix déjà
// fait plutôt que de le perdre en migrant vers `settings` (synchronisé).
const LEGACY_SIDEBAR_BG_KEY = "horizon-sidebar-bg";
const LEGACY_MAIN_BG_KEY = "horizon-main-bg";

// Sérialisation stable (clés triées) : Firestore ne garantit pas l'ordre des
// clés d'un champ map après un aller-retour serveur, contrairement à un objet
// JS local — sans ce tri, une comparaison JSON.stringify() classique verrait
// une "différence" là où le contenu est en fait identique.
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function useKanbanLogic() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState(null);
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { trashItems, moveToTrash, removeFromTrash, setTrashItems } = useTrash();
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const [projects, setProjects] = useState([]);
  const [subProjects, setSubProjects] = useState({});
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [activeSubProjectId, setActiveSubProjectId] = useState(null);
  const [allProjectsData, setAllProjectsData] = useState({});
  const [knowledgeBaseByProject, setKnowledgeBaseByProject] = useState({});
  // Ancien module "Arcs narratifs" (retiré : il doublonnait les colonnes,
  // renommées "Arc"). Cet état n'est plus ni lu ni modifié par aucune
  // fonctionnalité — il est uniquement rechargé puis réécrit tel quel à
  // chaque sauvegarde pour ne jamais perdre les données existantes des
  // utilisateurs qui avaient créé des arcs narratifs avant ce retrait.
  const [arcsByProject, setArcsByProject] = useState({});
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [activePage, setActivePage] = useState(null);
  const [draggedItem, setDraggedItem] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (type, message) => setToast({ type, message, id: Date.now() });
  const dismissToast = () => setToast(null);

  // Sérialise les écritures Firestore/localStorage : si une écriture est déjà
  // en vol quand l'état change à nouveau, on mémorise seulement les données
  // les plus récentes au lieu de lancer une seconde requête concurrente —
  // évite qu'une écriture plus ancienne, résolue plus tard sur le réseau
  // (ex. lors d'une reconnexion), n'écrase une écriture plus récente et ne
  // fasse "disparaître" un champ modifié entre-temps.
  const savingRef = useRef(false);
  const pendingDataRef = useRef(null);
  const saveTimerRef = useRef(null);
  // Écoute Firestore active (onSnapshot) pour l'utilisateur courant, à fermer
  // dès qu'elle change (changement de compte, déconnexion, démontage).
  const docUnsubRef = useRef(null);
  // Dernière version des données connue comme déjà synchronisée avec
  // Firestore (chargement initial ou mise à jour reçue via onSnapshot) —
  // sert de référence à l'effet de sauvegarde pour ne pas réécrire ce qui
  // vient tout juste d'être lu.
  const lastSyncedRef = useRef(null);

  const columns = allProjectsData[activeSubProjectId] || [];
  const knowledgeBase = knowledgeBaseByProject[activeProjectId] || [];

  const applyData = (rawData) => {
    let data = rawData;

    // Migration : ancien format (allData keyed by projectId, pas de subProjects)
    if (data.projects?.length > 0 && !data.subProjects) {
      const migratedSubProjects = {};
      const migratedAllData = {};
      data.projects.forEach((proj) => {
        const subId = `sp-${proj.id}`;
        migratedSubProjects[proj.id] = [{ id: subId, name: "Livre 1" }];
        migratedAllData[subId] = data.allData?.[proj.id] || [
          { id: `col-${Date.now()}`, title: "Arc 1", color: "indigo", pages: []},
        ];
      });
      data = { ...data, subProjects: migratedSubProjects, allData: migratedAllData };
    }

    const loadedProjects = data.projects || [];
    const loadedSubProjects = data.subProjects || {};
    const loadedData = data.allData || {};
    // Ancien champ "knowledgeBase" (base de connaissances globale) volontairement
    // ignoré : elle est désormais scopée par univers, sans migration automatique.
    const loadedKb = data.knowledgeBaseByProject || {};
    const loadedArcs = data.arcsByProject || {};
    const loadedTrash = data.trash || [];
    const loadedSettings = { ...DEFAULT_SETTINGS, ...data.settings };

    setProjects(loadedProjects);
    setSubProjects(loadedSubProjects);
    setAllProjectsData(loadedData);
    setKnowledgeBaseByProject(loadedKb);
    setArcsByProject(loadedArcs);
    setTrashItems(loadedTrash);
    setSettings(loadedSettings);

    let lastActive = null;
    if (data.lastActive?.subProjectId) {
      lastActive = { projectId: data.lastActive.projectId, subProjectId: data.lastActive.subProjectId };
      setActiveProjectId(lastActive.projectId);
      setActiveSubProjectId(lastActive.subProjectId);
    } else if (loadedProjects[0]) {
      const firstProj = loadedProjects[0];
      const firstSub = loadedSubProjects[firstProj.id]?.[0];
      lastActive = { projectId: firstProj.id, subProjectId: firstSub?.id || null };
      setActiveProjectId(lastActive.projectId);
      setActiveSubProjectId(lastActive.subProjectId);
    }

    // Sans projet, l'effet de sauvegarde ne peut de toute façon rien écrire
    // (garde `projects.length === 0`) : pas besoin d'une référence exacte.
    if (loadedProjects.length > 0) {
      lastSyncedRef.current = stableStringify({
        projects: loadedProjects,
        subProjects: loadedSubProjects,
        allData: loadedData,
        knowledgeBaseByProject: loadedKb,
        arcsByProject: loadedArcs,
        lastActive,
        trash: loadedTrash,
        settings: loadedSettings,
      });
    }
  };

  // --- AUTH & CHARGEMENT ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      // Un changement de compte (ou une déconnexion) ferme l'écoute
      // précédente : sinon un document Firestore d'un compte différent
      // pourrait encore arriver après coup et mélanger les données.
      if (docUnsubRef.current) {
        docUnsubRef.current();
        docUnsubRef.current = null;
      }

      if (currentUser) {
        let isFirstSnapshot = true;
        docUnsubRef.current = onSnapshot(
          doc(db, "users", currentUser.uid),
          (docSnap) => {
            // Ignore l'écho de nos propres écritures pas encore confirmées
            // par le serveur (setDoc local) : sans ce garde-fou, chaque
            // sauvegarde redéclenche aussitôt applyData -> effet de
            // sauvegarde -> setDoc -> nouvel écho, en boucle. La toute
            // première lecture (chargement/reconnexion) n'est jamais
            // filtrée, pour ne jamais rester bloqué sur "Chargement...".
            if (!isFirstSnapshot && docSnap.metadata.hasPendingWrites) return;

            if (isFirstSnapshot) {
              isFirstSnapshot = false;
              if (docSnap.exists()) {
                applyData(docSnap.data());
              } else {
                const saved = localStorage.getItem(`kanban-data-${currentUser.uid}`);
                try { applyData(saved ? JSON.parse(saved) : {}); } catch { applyData({}); }
              }
              setIsInitialLoad(false);
              setLoading(false);
              return;
            }

            // Mise à jour confirmée : soit l'accusé de réception de notre
            // propre écriture (données déjà identiques, sans effet visible
            // grâce à lastSyncedRef), soit un changement fait depuis un
            // autre appareil.
            if (docSnap.exists()) applyData(docSnap.data());
          },
          (error) => {
            console.error("Erreur d'écoute Firestore :", error);
            if (isFirstSnapshot) {
              isFirstSnapshot = false;
              const saved = localStorage.getItem(`kanban-data-${currentUser.uid}`);
              try { applyData(saved ? JSON.parse(saved) : {}); } catch { applyData({}); }
              setIsInitialLoad(false);
              setLoading(false);
            }
          }
        );
      } else if (localStorage.getItem(GUEST_SESSION_KEY) === "1") {
        // Restaure la session invité après un rechargement complet : sans ce
        // marqueur, seul le state React `isGuest` (jamais persisté) faisait
        // foi, donc tout `reload()` ramenait à l'écran de connexion malgré
        // des données invité toujours présentes dans localStorage.
        const saved = localStorage.getItem("kanban-data-guest");
        try { applyData(saved ? JSON.parse(saved) : {}); } catch { applyData({}); }
        setIsGuest(true);
        setIsInitialLoad(false);
        setLoading(false);
      } else {
        setIsInitialLoad(false);
        setLoading(false);
      }
    });

    setMounted(true);
    return () => {
      unsubscribeAuth();
      if (docUnsubRef.current) {
        docUnsubRef.current();
        docUnsubRef.current = null;
      }
    };
    // applyData volontairement exclu : ce listener ne doit s'enregistrer qu'une
    // seule fois au montage, pas se réabonner à chaque re-render du composant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- SAUVEGARDE ---
  // Écrit dataToSave, en mettant en attente (plutôt qu'en lançant en
  // parallèle) toute nouvelle demande arrivée pendant qu'une écriture est
  // déjà en vol — dès que celle-ci se termine, la plus récente demande en
  // attente (si elle existe) est relancée immédiatement.
  const persist = async (dataToSave, serialized) => {
    if (savingRef.current) {
      pendingDataRef.current = { dataToSave, serialized };
      return;
    }
    savingRef.current = true;
    let succeeded = false;
    try {
      if (user) {
        await setDoc(doc(db, "users", user.uid), dataToSave);
        localStorage.setItem(`kanban-data-${user.uid}`, JSON.stringify(dataToSave));
      } else if (isGuest) {
        localStorage.setItem("kanban-data-guest", JSON.stringify(dataToSave));
      }
      succeeded = true;
      lastSyncedRef.current = serialized;
    } catch (error) {
      console.error("Erreur lors de la sauvegarde :", error);
      showToast("error", "Échec de l'enregistrement — vérifiez votre connexion.");
    } finally {
      savingRef.current = false;
      if (pendingDataRef.current) {
        const next = pendingDataRef.current;
        pendingDataRef.current = null;
        persist(next.dataToSave, next.serialized);
      }
    }
    return succeeded;
  };

  useEffect(() => {
    if (!mounted || isInitialLoad || projects.length === 0) return;

    const dataToSave = {
      projects,
      subProjects,
      allData: allProjectsData,
      knowledgeBaseByProject,
      arcsByProject,
      lastActive: { projectId: activeProjectId, subProjectId: activeSubProjectId },
      trash: trashItems,
      settings,
    };

    const serialized = stableStringify(dataToSave);
    // Identique à la dernière version connue de Firestore (chargement initial
    // ou mise à jour reçue d'un autre appareil via onSnapshot) : rien à
    // réécrire — évite la boucle décrite dans l'effet d'auth ci-dessus.
    if (serialized === lastSyncedRef.current) return;

    // Debounce court : regroupe les changements rapprochés (ex. plusieurs
    // champs modifiés en quelques secondes) en une seule écriture au lieu
    // d'une requête Firestore par changement d'état.
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => persist(dataToSave, serialized), 500);
    return () => clearTimeout(saveTimerRef.current);
    // activeProjectId & activeSubProjectId exclus : la navigation seule ne déclenche pas de sauvegarde
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, subProjects, allProjectsData, knowledgeBaseByProject, arcsByProject, trashItems, settings, mounted, user, isGuest, isInitialLoad]);

  // --- PURGE AUTOMATIQUE DE LA CORBEILLE ---
  useEffect(() => {
    const days = settings.trashRetentionDays;
    if (!days) return;

    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    setTrashItems((prev) => {
      const kept = prev.filter((item) => new Date(item.deletedAt).getTime() >= cutoff);
      // Renvoyer la même référence quand rien n'a expiré évite de redéclencher
      // cet effet indéfiniment sur son propre changement d'état.
      return kept.length === prev.length ? prev : kept;
    });
  }, [settings.trashRetentionDays, trashItems, setTrashItems]);

  // --- FONDS D'ÉCRAN (font partie de `settings`, donc synchronisés comme le
  // reste : mêmes fonds sur tout appareil connecté au même compte) ---
  const setSidebarBg = (value) => setSettings((prev) => ({ ...prev, sidebarBg: value }));
  const setMainBg = (value) => setSettings((prev) => ({ ...prev, mainBg: value }));

  // Migration ponctuelle : le fond d'écran était auparavant stocké seulement
  // dans le localStorage de cet appareil (jamais synchronisé). On reprend ce
  // choix une seule fois dans `settings` si les données chargées n'en ont pas
  // — pour ne pas faire disparaître un fond déjà choisi avant cette mise à jour.
  const bgMigratedRef = useRef(false);
  useEffect(() => {
    if (bgMigratedRef.current || !mounted || isInitialLoad) return;
    bgMigratedRef.current = true;

    const legacySidebar = localStorage.getItem(LEGACY_SIDEBAR_BG_KEY);
    const legacyMain = localStorage.getItem(LEGACY_MAIN_BG_KEY);
    const validSidebar = BACKGROUND_OPTIONS.includes(legacySidebar) ? legacySidebar : null;
    const validMain = BACKGROUND_OPTIONS.includes(legacyMain) ? legacyMain : null;
    if (!validSidebar && !validMain) return;

    setSettings((prev) => ({
      ...prev,
      sidebarBg: prev.sidebarBg ?? validSidebar,
      mainBg: prev.mainBg ?? validMain,
    }));
  }, [mounted, isInitialLoad]);

  // --- AUTHENTIFICATION ---
  const handleGuestLogin = () => {
    const saved = localStorage.getItem("kanban-data-guest");
    if (saved) {
      try { applyData(JSON.parse(saved)); } catch { applyData({}); }
    } else {
      applyData({});
    }
    localStorage.setItem(GUEST_SESSION_KEY, "1");
    setIsInitialLoad(false);
    setIsGuest(true);
  };

  const handleLogout = async () => {
    if (!isGuest) await signOut(auth);
    localStorage.removeItem(GUEST_SESSION_KEY);
    setIsGuest(false);
    setProjects([]);
    setSubProjects({});
    setAllProjectsData({});
    setKnowledgeBaseByProject({});
    setArcsByProject({});
    setActiveProjectId(null);
    setActiveSubProjectId(null);
    setActivePage(null);
    setTrashItems([]);
    setUser(null);
  };

  // --- NAVIGATION ---
  const handleSelectSubProject = (projectId, subProjectId) => {
    // Filet de sécurité : un chapitre ouvert appartient au sous-projet quitté,
    // le laisser affiché exposerait à des sauvegardes silencieusement perdues
    // si son id ne correspond à aucune page du nouveau sous-projet actif.
    setActivePage(null);
    setActiveProjectId(projectId);
    setActiveSubProjectId(subProjectId);
  };

  // Sélectionner un univers (indépendamment de tout livre) : conserve le
  // livre actif s'il appartient déjà à cet univers, sinon retombe sur son
  // premier livre — même repli que celui utilisé au chargement initial
  // (cf. applyData) pour un univers sans dernière position connue.
  const handleSelectProject = (projectId) => {
    const staysOnSameBook =
      activeSubProjectId && (subProjects[projectId] || []).some((s) => s.id === activeSubProjectId);
    if (staysOnSameBook) {
      setActiveProjectId(projectId);
      return;
    }
    const firstSub = subProjects[projectId]?.[0];
    handleSelectSubProject(projectId, firstSub?.id || null);
  };

  // --- PROJETS ---
  const handleCreateProject = (name) => {
    const projId = `proj-${Date.now()}`;
    const subId = `sp-${Date.now()}`;
    const colId = `col-${Date.now()}`;

    setProjects((prev) => [...prev, { id: projId, name }]);
    setSubProjects((prev) => ({
      ...prev,
      [projId]: [{ id: subId, name: "Livre 1" }],
    }));
    setAllProjectsData((prev) => ({
      ...prev,
      [subId]: [{ id: colId, title: "Arc 1", color: "indigo", pages: []}],
    }));
    setKnowledgeBaseByProject((prev) => ({ ...prev, [projId]: [] }));
    setActiveProjectId(projId);
    setActiveSubProjectId(subId);
  };

  const handleRenameProject = (projectId, newName) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, name: newName } : p))
    );
  };

  const deleteProject = (projectId) => {
    const subs = subProjects[projectId] || [];
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    setSubProjects((prev) => {
      const next = { ...prev };
      delete next[projectId];
      return next;
    });
    setAllProjectsData((prev) => {
      const next = { ...prev };
      subs.forEach((sub) => delete next[sub.id]);
      return next;
    });
    setKnowledgeBaseByProject((prev) => {
      const next = { ...prev };
      delete next[projectId];
      return next;
    });
    if (activeProjectId === projectId) {
      setActiveProjectId(null);
      setActiveSubProjectId(null);
    }
  };

  // --- SOUS-PROJETS ---
  const handleCreateSubProject = (projectId, name) => {
    const subId = `sp-${Date.now()}`;
    const colId = `col-${Date.now()}`;

    setSubProjects((prev) => ({
      ...prev,
      [projectId]: [...(prev[projectId] || []), { id: subId, name }],
    }));
    setAllProjectsData((prev) => ({
      ...prev,
      [subId]: [{ id: colId, title: "Arc 1", color: "indigo", pages: []}],
    }));
    setActiveProjectId(projectId);
    setActiveSubProjectId(subId);
  };

  const handleRenameSubProject = (projectId, subProjectId, newName) => {
    setSubProjects((prev) => ({
      ...prev,
      [projectId]: (prev[projectId] || []).map((sp) =>
        sp.id === subProjectId ? { ...sp, name: newName } : sp
      ),
    }));
  };

  const handleSetSubProjectStatus = (projectId, subProjectId, status) => {
    setSubProjects((prev) => ({
      ...prev,
      [projectId]: (prev[projectId] || []).map((sp) =>
        sp.id === subProjectId ? { ...sp, status } : sp
      ),
    }));
  };

  const handleSetSubProjectPriority = (projectId, subProjectId, priority) => {
    setSubProjects((prev) => ({
      ...prev,
      [projectId]: (prev[projectId] || []).map((sp) =>
        sp.id === subProjectId ? { ...sp, priority } : sp
      ),
    }));
  };

  const handleSetSubProjectDeadline = (projectId, subProjectId, deadline) => {
    setSubProjects((prev) => ({
      ...prev,
      [projectId]: (prev[projectId] || []).map((sp) =>
        sp.id === subProjectId ? { ...sp, deadline } : sp
      ),
    }));
  };

  const deleteSubProject = (projectId, subProjectId) => {
    const remaining = (subProjects[projectId] || []).filter(
      (sp) => sp.id !== subProjectId
    );
    setSubProjects((prev) => ({ ...prev, [projectId]: remaining }));
    setAllProjectsData((prev) => {
      const next = { ...prev };
      delete next[subProjectId];
      return next;
    });
    if (activeSubProjectId === subProjectId) {
      setActiveSubProjectId(remaining[0]?.id || null);
    }
  };

  // --- COLONNES (scoped to activeSubProjectId) ---
  const setColumns = (newColsOrFn) => {
    setAllProjectsData((prev) => {
      const currentCols = prev[activeSubProjectId] || [];
      const updatedCols =
        typeof newColsOrFn === "function"
          ? newColsOrFn(currentCols)
          : newColsOrFn;
      return { ...prev, [activeSubProjectId]: updatedCols };
    });
  };

  const addColumn = () =>
    setColumns([
      ...columns,
      { id: `col-${Date.now()}`, title: "Nouvel arc", color: "slate", pages: [] },
    ]);

  const deleteColumn = (columnId) => {
    const col = columns.find((c) => c.id === columnId);
    if (col && window.confirm(`Supprimer l'arc "${col.title}" ?`)) {
      moveToTrash(col, "column", {
        projectId: activeProjectId,
        subProjectId: activeSubProjectId,
      });
      setColumns((prev) => prev.filter((c) => c.id !== columnId));
    }
  };

  // --- PAGES ---
  // title est garanti non vide par l'appelant (Column.jsx valide avant
  // d'appeler onAddPage) : aucun chapitre "Nouveau Chapitre" par défaut.
  const addPage = (columnId, title) => {
    const newPage = { id: `p-${Date.now()}`, title, content: "" };
    setColumns(
      columns.map((col) =>
        col.id === columnId ? { ...col, pages: [...col.pages, newPage] } : col
      )
    );
  };

  const handleSavePage = (pageId, updates) => {
    setColumns((prev) =>
      prev.map((col) => ({
        ...col,
        pages: col.pages.map((p) => (p.id === pageId ? { ...p, ...updates } : p)),
      }))
    );
    if (activePage?.id === pageId) {
      setActivePage((prev) => ({ ...prev, ...updates }));
    }
  };

  const deletePage = (pageId) => {
    const sourceColumn = columns.find((c) => c.pages.some((p) => p.id === pageId));
    const page = sourceColumn?.pages.find((p) => p.id === pageId);
    if (page) {
      moveToTrash({ ...page, columnId: sourceColumn.id }, "page", {
        projectId: activeProjectId,
        subProjectId: activeSubProjectId,
      });
      setColumns((prev) =>
        prev.map((col) => ({
          ...col,
          pages: col.pages.filter((p) => p.id !== pageId),
        }))
      );
    }
  };

  // --- SCÈNES (enfants optionnels d'un chapitre) ---
  // Passe par handleSavePage pour la même raison que les tâches de chapitre :
  // rester synchronisé avec activePage pendant l'édition.
  const getPage = (pageId) => columns.flatMap((c) => c.pages).find((p) => p.id === pageId);

  const addScene = (pageId, title) => {
    if (!title.trim()) return;
    const scenes = [
      ...(getPage(pageId)?.scenes || []),
      { id: `scene-${Date.now()}`, title: title.trim(), content: "", tasks: [] },
    ];
    handleSavePage(pageId, { scenes });
  };

  const deleteScene = (pageId, sceneId) => {
    const scenes = (getPage(pageId)?.scenes || []).filter((s) => s.id !== sceneId);
    handleSavePage(pageId, { scenes });
  };

  const handleSaveScene = (pageId, sceneId, updates) => {
    const scenes = (getPage(pageId)?.scenes || []).map((s) =>
      s.id === sceneId ? { ...s, ...updates } : s
    );
    handleSavePage(pageId, { scenes });
  };

  // --- TÂCHES DE CHAPITRE ---
  // Passe par handleSavePage pour réutiliser sa synchronisation avec activePage
  // (sinon l'éditeur ouvert afficherait une liste de tâches obsolète après ajout).
  const addPageTask = (pageId, label) => {
    if (!label.trim()) return;
    const tasks = [
      ...(getPage(pageId)?.tasks || []),
      { id: `task-${Date.now()}`, label: label.trim(), done: false },
    ];
    handleSavePage(pageId, { tasks });
  };

  const togglePageTask = (pageId, taskId) => {
    const tasks = (getPage(pageId)?.tasks || []).map((t) =>
      t.id === taskId ? { ...t, done: !t.done } : t
    );
    handleSavePage(pageId, { tasks });
  };

  const deletePageTask = (pageId, taskId) => {
    const tasks = (getPage(pageId)?.tasks || []).filter((t) => t.id !== taskId);
    handleSavePage(pageId, { tasks });
  };

  // --- TÂCHES DE LIVRE ---
  const updateSubProjectTasks = (projectId, subProjectId, updater) => {
    setSubProjects((prev) => ({
      ...prev,
      [projectId]: (prev[projectId] || []).map((sp) =>
        sp.id === subProjectId ? { ...sp, tasks: updater(sp.tasks || []) } : sp
      ),
    }));
  };

  const addSubProjectTask = (projectId, subProjectId, label) => {
    if (!label.trim()) return;
    updateSubProjectTasks(projectId, subProjectId, (tasks) => [
      ...tasks,
      { id: `task-${Date.now()}`, label: label.trim(), done: false },
    ]);
  };

  const toggleSubProjectTask = (projectId, subProjectId, taskId) => {
    updateSubProjectTasks(projectId, subProjectId, (tasks) =>
      tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t))
    );
  };

  const deleteSubProjectTask = (projectId, subProjectId, taskId) => {
    updateSubProjectTasks(projectId, subProjectId, (tasks) =>
      tasks.filter((t) => t.id !== taskId)
    );
  };

  // --- BASE DE CONNAISSANCES (scoped to activeProjectId) ---
  // subProjectIds vide/absent = portée "univers entier" ; sinon la fiche
  // n'est visible que pour les livres listés (cf. lib/knowledgeBase.js).
  const addKbFile = (name, content, subProjectIds = []) => {
    if (!activeProjectId) return;
    const id = `kb-${Date.now()}`;
    setKnowledgeBaseByProject((prev) => ({
      ...prev,
      [activeProjectId]: [
        ...(prev[activeProjectId] || []),
        { id, name, content, importedAt: Date.now(), subProjectIds },
      ],
    }));
  };

  const setKbFileScope = (id, subProjectIds) => {
    if (!activeProjectId) return;
    setKnowledgeBaseByProject((prev) => ({
      ...prev,
      [activeProjectId]: (prev[activeProjectId] || []).map((f) =>
        f.id === id ? { ...f, subProjectIds } : f
      ),
    }));
  };

  const updateKbFileContent = (id, content) => {
    if (!activeProjectId) return;
    setKnowledgeBaseByProject((prev) => ({
      ...prev,
      [activeProjectId]: (prev[activeProjectId] || []).map((f) =>
        f.id === id ? { ...f, content } : f
      ),
    }));
  };

  // Passe par la corbeille (comme les arcs/chapitres) au lieu d'une
  // suppression directe, pour rester récupérable.
  const deleteKbFile = (id) => {
    if (!activeProjectId) return;
    const file = (knowledgeBaseByProject[activeProjectId] || []).find((f) => f.id === id);
    if (!file) return;
    moveToTrash(file, "kbFile", { projectId: activeProjectId });
    setKnowledgeBaseByProject((prev) => ({
      ...prev,
      [activeProjectId]: (prev[activeProjectId] || []).filter((f) => f.id !== id),
    }));
  };

  // Résumé transversal d'un univers pour le tableau de bord : progression par
  // livre, tâches non cochées, éléments en cours/à relire, échéances à venir.
  const getUniverseSummary = (projectId) =>
    buildUniverseSummary(subProjects, allProjectsData, projectId);

  // --- CORBEILLE ---
  // Restaure dans le sous-projet (livre) d'où l'élément a été supprimé, pas
  // dans celui actuellement ouvert — sinon un arc/chapitre supprimé dans un
  // univers réapparaît dans un autre livre juste parce que c'est celui qu'on
  // regardait au moment de cliquer sur "Restaurer".
  const handleRestore = (item) => {
    const { trashId, originalType, deletedAt, projectId, subProjectId, ...clean } = item;

    if (originalType === "kbFile") {
      const targetProjectId =
        projectId && projects.some((p) => p.id === projectId) ? projectId : activeProjectId;
      if (targetProjectId) {
        setKnowledgeBaseByProject((prev) => ({
          ...prev,
          [targetProjectId]: [...(prev[targetProjectId] || []), clean],
        }));
      }
      removeFromTrash(trashId);
      return;
    }

    const targetSubId =
      subProjectId && allProjectsData[subProjectId] !== undefined
        ? subProjectId
        : activeSubProjectId;

    if (targetSubId) {
      setAllProjectsData((prev) => {
        const cols = prev[targetSubId] || [];
        let updatedCols;

        if (originalType === "column") {
          updatedCols = [...cols, { ...clean, pages: clean.pages || [] }];
        } else {
          const targetColId = cols.some((c) => c.id === clean.columnId)
            ? clean.columnId
            : cols[0]?.id;
          if (!targetColId) return prev;
          const { columnId, ...pageOnly } = clean;
          updatedCols = cols.map((col) =>
            col.id === targetColId
              ? { ...col, pages: [pageOnly, ...col.pages] }
              : col
          );
        }

        return { ...prev, [targetSubId]: updatedCols };
      });
    }
    removeFromTrash(trashId);
  };

  // --- PARAMÈTRES ---
  // Sauvegarde complète : tout ce qu'il faut pour une restauration à
  // l'identique (données éditoriales + réglages utilisateur).
  const buildFullBackup = () => ({
    projects,
    subProjects,
    allData: allProjectsData,
    knowledgeBaseByProject,
    arcsByProject,
    trash: trashItems,
    settings,
    exportedAt: new Date().toISOString(),
  });

  const exportAllData = () => {
    try {
      const blob = new Blob([JSON.stringify(buildFullBackup(), null, 2)], {
        type: "application/json;charset=utf-8",
      });
      triggerDownload(blob, `horizon-export-${Date.now()}.json`);
      showToast("success", "Export JSON téléchargé.");
    } catch (error) {
      console.error("Erreur lors de l'export JSON :", error);
      showToast("error", "Échec de l'export JSON.");
    }
  };

  const exportAllDataZip = async () => {
    try {
      const zip = new JSZip();

      projects.forEach((project) => {
        const projectFolder = sanitizeFilename(project.name);
        const books = subProjects[project.id] || [];

        books.forEach((sub) => {
          const bookFolder = sanitizeFilename(sub.name);
          const columns = allProjectsData[sub.id] || [];

          columns.forEach((col) => {
            const arcFolder = sanitizeFilename(col.title);
            col.pages.forEach((page) => {
              const title = sanitizeFilename(page.title || "chapitre");
              const md = `# ${page.title || "Sans titre"}\n\n${htmlToMarkdown(page.content || "")}`;
              zip.file(`${projectFolder}/${bookFolder}/${arcFolder}/${title}.md`, md);
              (page.scenes || []).forEach((scene) => {
                const sceneTitle = sanitizeFilename(scene.title || "scène");
                const sceneMd = `# ${scene.title || "Sans titre"}\n\n${htmlToMarkdown(scene.content || "")}`;
                zip.file(
                  `${projectFolder}/${bookFolder}/${arcFolder}/${title}/Scènes/${sceneTitle}.md`,
                  sceneMd
                );
              });
            });
          });
        });

        // Une fiche univers-entier va sous Base de connaissances/ à la racine de
        // l'univers ; une fiche scopée va dans le dossier de chacun des livres
        // auxquels elle est rattachée (dupliquée si plusieurs), pour que chaque
        // export de livre reste autonome.
        (knowledgeBaseByProject[project.id] || []).forEach((file) => {
          const scope = file.subProjectIds || [];
          const fileName = sanitizeFilename(file.name);
          if (scope.length === 0) {
            zip.file(`${projectFolder}/Base de connaissances/${fileName}`, file.content || "");
          } else {
            scope.forEach((subId) => {
              const book = books.find((b) => b.id === subId);
              if (!book) return;
              zip.file(
                `${projectFolder}/${sanitizeFilename(book.name)}/Base de connaissances/${fileName}`,
                file.content || ""
              );
            });
          }
        });
      });

      zip.file("export.json", JSON.stringify(buildFullBackup(), null, 2));

      const blob = await zip.generateAsync({ type: "blob" });
      triggerDownload(blob, `horizon-export-${Date.now()}.zip`);
      showToast("success", "Archive ZIP téléchargée.");
    } catch (error) {
      console.error("Erreur lors de l'export ZIP :", error);
      showToast("error", "Échec de l'export ZIP.");
    }
  };

  const deleteAllData = async () => {
    setProjects([]);
    setSubProjects({});
    setAllProjectsData({});
    setKnowledgeBaseByProject({});
    setArcsByProject({});
    setTrashItems([]);
    setActiveProjectId(null);
    setActiveSubProjectId(null);
    setActivePage(null);
    setSettings(DEFAULT_SETTINGS);

    // Écriture directe via persist() : l'effet de sauvegarde automatique
    // n'écrit rien quand projects est vide (garde anti-écrasement pendant le
    // chargement initial), donc on déclenche l'écriture explicitement ici —
    // en passant par persist() plutôt qu'un setDoc/localStorage.removeItem
    // ad hoc, pour bénéficier de la même sérialisation et du même retour
    // d'erreur que le reste des sauvegardes. Le cache local n'est purgé
    // qu'une fois la suppression distante confirmée, pour ne jamais perdre
    // le seul exemplaire des données si l'écriture Firestore échoue.
    if (user) {
      const succeeded = await persist({}, stableStringify({}));
      if (succeeded) localStorage.removeItem(`kanban-data-${user.uid}`);
    } else if (isGuest) {
      localStorage.removeItem("kanban-data-guest");
    }
  };

  return {
    mounted,
    user,
    isGuest,
    loading,
    isAuthModalOpen,
    setIsAuthModalOpen,
    handleGuestLogin,
    projects,
    subProjects,
    activeProjectId,
    setActiveProjectId,
    activeSubProjectId,
    setActiveSubProjectId,
    handleSelectSubProject,
    handleSelectProject,
    columns,
    allProjectsData,
    activePage,
    setActivePage,
    draggedItem,
    setDraggedItem,
    isTrashOpen,
    setIsTrashOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    settings,
    setSettings,
    sidebarBg: settings.sidebarBg,
    setSidebarBg,
    mainBg: settings.mainBg,
    setMainBg,
    toast,
    showToast,
    dismissToast,
    exportAllData,
    exportAllDataZip,
    deleteAllData,
    trashItems,
    handleLogout,
    handleCreateProject,
    handleRenameProject,
    deleteProject,
    handleCreateSubProject,
    handleRenameSubProject,
    handleSetSubProjectStatus,
    handleSetSubProjectPriority,
    handleSetSubProjectDeadline,
    deleteSubProject,
    deletePage,
    handleRestore,
    addColumn,
    addPage,
    handleSavePage,
    setColumns,
    removeFromTrash,
    deleteColumn,
    knowledgeBase,
    addKbFile,
    deleteKbFile,
    setKbFileScope,
    updateKbFileContent,
    addScene,
    deleteScene,
    handleSaveScene,
    addPageTask,
    togglePageTask,
    deletePageTask,
    addSubProjectTask,
    toggleSubProjectTask,
    deleteSubProjectTask,
    getUniverseSummary,
  };
}
