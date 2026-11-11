import { useState, useEffect, useRef } from "react";
import JSZip from "jszip";
import { useTrash } from "@/hooks/useTrash";
import { useCloudSync } from "@/hooks/useCloudSync";
import { htmlToMarkdown } from "@/lib/htmlToMarkdown";
import { buildUniverseSummary } from "@/lib/universeSummary";
import { triggerDownload } from "@/lib/download";
import { buildZipEntries } from "@/lib/exportData";
import { restoreTrashItem } from "@/lib/trashRestore";
import { validateBackup } from "@/lib/backup";
import { newId } from "@/lib/id";
import { addTask, toggleTask, removeTask } from "@/lib/tasks";
import { BACKGROUND_OPTIONS } from "@/lib/backgrounds";

// 30 jours par défaut pour les nouveaux comptes : une corbeille jamais purgée
// grossit indéfiniment (elle garde le texte intégral des chapitres
// supprimés) et rapproche le document Firestore de sa limite de taille.
// Un réglage déjà enregistré (y compris "Jamais" = null) reste prioritaire.
const DEFAULT_SETTINGS = { trashRetentionDays: 30, sidebarBg: null, mainBg: null };

// Anciennes clés localStorage (fonds d'écran stockés uniquement sur l'appareil,
// jamais synchronisés) : à ne lire qu'une fois, pour reprendre un choix déjà
// fait plutôt que de le perdre en migrant vers `settings` (synchronisé).
const LEGACY_SIDEBAR_BG_KEY = "horizon-sidebar-bg";
const LEGACY_MAIN_BG_KEY = "horizon-main-bg";

// Premier arc de tout nouveau livre.
const createDefaultColumn = () => ({ id: newId("col"), title: "Arc 1", color: "indigo", pages: [] });

// État et actions de l'app (univers, livres, arcs, chapitres, scènes, base de
// connaissances, corbeille, exports). La connexion et la sauvegarde sont
// déléguées à useCloudSync. `confirm` : boîte de confirmation de l'app
// (useConfirm), utilisée avant une déconnexion qui perdrait des
// modifications non synchronisées.
export function useKanbanLogic({ confirm }) {
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
  const [activePage, setActivePage] = useState(null);
  const [draggedItem, setDraggedItem] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (type, message) => setToast({ type, message, id: Date.now() });
  const dismissToast = () => setToast(null);

  // Navigation courante, lisible depuis l'écoute Firestore (enregistrée une
  // seule fois au montage, donc sans accès direct à l'état à jour).
  const activeRef = useRef({ activeProjectId: null, activeSubProjectId: null, activePage: null });

  const columns = allProjectsData[activeSubProjectId] || [];
  const knowledgeBase = knowledgeBaseByProject[activeProjectId] || [];

  // Données enregistrées (Firestore / localStorage) et exportées en JSON.
  const persistedData = () => ({
    projects,
    subProjects,
    allData: allProjectsData,
    knowledgeBaseByProject,
    arcsByProject,
    trash: trashItems,
    settings,
  });

  useEffect(() => {
    activeRef.current = { activeProjectId, activeSubProjectId, activePage };
  });

  // Charge des données (lues de Firestore, du stockage local ou d'une
  // sauvegarde importée) dans l'état, et renvoie leur version normalisée.
  // `isRemote` : mise à jour reçue d'un autre appareil (et non chargement
  // initial). La navigation locale est alors conservée — le "lastActive"
  // enregistré par l'autre appareil n'a pas à faire changer de livre celui-ci,
  // ce qui laissait l'éditeur ouvert sur un chapitre d'un autre livre et
  // perdait silencieusement ses sauvegardes.
  const applyData = (rawData, { isRemote = false } = {}) => {
    let data = rawData;

    // Migration : ancien format (allData keyed by projectId, pas de subProjects)
    if (data.projects?.length > 0 && !data.subProjects) {
      const migratedSubProjects = {};
      const migratedAllData = {};
      data.projects.forEach((proj) => {
        const subId = `sp-${proj.id}`;
        migratedSubProjects[proj.id] = [{ id: subId, name: "Livre 1" }];
        migratedAllData[subId] = data.allData?.[proj.id] || [createDefaultColumn()];
      });
      data = { ...data, subProjects: migratedSubProjects, allData: migratedAllData };
    }

    const loaded = {
      projects: data.projects || [],
      subProjects: data.subProjects || {},
      allData: data.allData || {},
      // Ancien champ "knowledgeBase" (base de connaissances globale)
      // volontairement ignoré : elle est désormais scopée par univers, sans
      // migration automatique.
      knowledgeBaseByProject: data.knowledgeBaseByProject || {},
      arcsByProject: data.arcsByProject || {},
      trash: data.trash || [],
      settings: { ...DEFAULT_SETTINGS, ...data.settings },
    };
    // Les fonds servent à construire un chemin d'image : seules les valeurs
    // connues sont acceptées.
    for (const key of ["sidebarBg", "mainBg"]) {
      if (!BACKGROUND_OPTIONS.includes(loaded.settings[key])) loaded.settings[key] = null;
    }

    setProjects(loaded.projects);
    setSubProjects(loaded.subProjects);
    setAllProjectsData(loaded.allData);
    setKnowledgeBaseByProject(loaded.knowledgeBaseByProject);
    setArcsByProject(loaded.arcsByProject);
    setTrashItems(loaded.trash);
    setSettings(loaded.settings);

    const firstBookOf = (projectId) => loaded.subProjects[projectId]?.[0]?.id || null;

    if (isRemote) {
      const { activeProjectId: curProj, activeSubProjectId: curSub, activePage: curPage } =
        activeRef.current;
      const projStillExists = !!curProj && loaded.projects.some((p) => p.id === curProj);
      const subStillExists =
        !!curSub && Object.values(loaded.subProjects).some((subs) => subs.some((s) => s.id === curSub));

      if ((curProj && !projStillExists) || (curSub && !subStillExists)) {
        const fallbackProj = projStillExists ? curProj : loaded.projects[0]?.id || null;
        setActiveProjectId(fallbackProj);
        setActiveSubProjectId(firstBookOf(fallbackProj));
        if (curPage) {
          setActivePage(null);
          showToast("error", "Le livre ouvert a été supprimé depuis un autre appareil.");
        }
      } else if (
        curPage &&
        !(loaded.allData[curSub] || []).some((c) => c.pages.some((p) => p.id === curPage.id))
      ) {
        setActivePage(null);
        showToast("error", "Le chapitre ouvert a été supprimé ou déplacé depuis un autre appareil.");
      }
    } else if (data.lastActive?.subProjectId) {
      setActiveProjectId(data.lastActive.projectId);
      setActiveSubProjectId(data.lastActive.subProjectId);
    } else if (loaded.projects[0]) {
      setActiveProjectId(loaded.projects[0].id);
      setActiveSubProjectId(firstBookOf(loaded.projects[0].id));
    }

    return loaded;
  };

  const resetData = () => {
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
  };

  const sync = useCloudSync({
    data: persistedData(),
    lastActive: { projectId: activeProjectId, subProjectId: activeSubProjectId },
    applyData,
    resetData,
    showToast,
    confirm,
  });

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
    if (bgMigratedRef.current || !sync.mounted || sync.isInitialLoad) return;
    bgMigratedRef.current = true;

    const legacySidebar = localStorage.getItem(LEGACY_SIDEBAR_BG_KEY);
    const legacyMain = localStorage.getItem(LEGACY_MAIN_BG_KEY);
    const validSidebar = BACKGROUND_OPTIONS.includes(legacySidebar) ? legacySidebar : null;
    const validMain = BACKGROUND_OPTIONS.includes(legacyMain) ? legacyMain : null;
    if (!validSidebar && !validMain) return;

    // Synchronisation ponctuelle depuis une source externe (localStorage).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings((prev) => ({
      ...prev,
      sidebarBg: prev.sidebarBg ?? validSidebar,
      mainBg: prev.mainBg ?? validMain,
    }));
  }, [sync.mounted, sync.isInitialLoad]);

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
    const projId = newId("proj");
    const subId = newId("sp");

    setProjects((prev) => [...prev, { id: projId, name }]);
    setSubProjects((prev) => ({
      ...prev,
      [projId]: [{ id: subId, name: "Livre 1" }],
    }));
    setAllProjectsData((prev) => ({ ...prev, [subId]: [createDefaultColumn()] }));
    setKnowledgeBaseByProject((prev) => ({ ...prev, [projId]: [] }));
    setActiveProjectId(projId);
    setActiveSubProjectId(subId);
  };

  const handleRenameProject = (projectId, newName) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, name: newName } : p))
    );
  };

  // Un univers n'embarque pas ses livres/arcs/chapitres "en ligne" (ils
  // vivent dans des maps séparées indexées par id) — contrairement à
  // deleteColumn/deletePage, il faut donc construire ici un instantané
  // autonome avant de le passer à moveToTrash, pour que la restauration
  // dispose de toute la hiérarchie. Pas de window.confirm ici : Sidebar.jsx
  // confirme déjà en amont, un second confirm ferait doublon.
  const deleteProject = (projectId) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    const subs = subProjects[projectId] || [];
    const projectData = Object.fromEntries(
      subs.map((sub) => [sub.id, allProjectsData[sub.id] || []])
    );
    moveToTrash(
      {
        ...project,
        subProjects: subs,
        allProjectsData: projectData,
        knowledgeBaseByProject: knowledgeBaseByProject[projectId] || [],
      },
      "project",
      {}
    );

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
    const subId = newId("sp");

    setSubProjects((prev) => ({
      ...prev,
      [projectId]: [...(prev[projectId] || []), { id: subId, name }],
    }));
    setAllProjectsData((prev) => ({ ...prev, [subId]: [createDefaultColumn()] }));
    setActiveProjectId(projectId);
    setActiveSubProjectId(subId);
  };

  // Met à jour un livre (nom, statut, priorité, échéance, tâches…). `patch`
  // est un objet de champs, ou une fonction (livre) => champs.
  const updateSubProject = (projectId, subProjectId, patch) => {
    setSubProjects((prev) => ({
      ...prev,
      [projectId]: (prev[projectId] || []).map((sp) =>
        sp.id === subProjectId
          ? { ...sp, ...(typeof patch === "function" ? patch(sp) : patch) }
          : sp
      ),
    }));
  };

  // Même raison qu'au-dessus pour deleteProject : un livre n'embarque pas ses
  // arcs/chapitres en ligne, il faut les rattacher explicitement avant
  // moveToTrash. Pas de window.confirm ici non plus (déjà fait dans Sidebar.jsx).
  const deleteSubProject = (projectId, subProjectId) => {
    const book = (subProjects[projectId] || []).find((sp) => sp.id === subProjectId);
    if (!book) return;
    moveToTrash(
      { ...book, allProjectsData: allProjectsData[subProjectId] || [] },
      "subProject",
      { projectId }
    );

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

  // Retourne l'id créé : KanbanBoard s'en sert pour faire entrer le nouvel
  // arc immédiatement en mode renommage, plutôt que de laisser "Nouvel arc"
  // tel quel sans étape de nommage (incohérent avec chapitres/scènes/tâches).
  const addColumn = () => {
    const newColumn = { id: newId("col"), title: "Nouvel arc", color: "slate", pages: [] };
    setColumns((prev) => [...prev, newColumn]);
    return newColumn.id;
  };

  // Renommage ({ title }) ou changement de couleur ({ color }) d'un arc.
  const updateColumn = (columnId, fields) => {
    setColumns((prev) => prev.map((c) => (c.id === columnId ? { ...c, ...fields } : c)));
  };

  // Confirmation demandée en amont par Column.jsx.
  const deleteColumn = (columnId) => {
    const col = columns.find((c) => c.id === columnId);
    if (!col) return;
    moveToTrash(col, "column", {
      projectId: activeProjectId,
      subProjectId: activeSubProjectId,
    });
    setColumns((prev) => prev.filter((c) => c.id !== columnId));
  };

  // --- PAGES ---
  // title est garanti non vide par l'appelant (Column.jsx valide avant
  // d'appeler onAddPage) : aucun chapitre "Nouveau Chapitre" par défaut.
  const addPage = (columnId, title) => {
    const newPage = { id: newId("p"), title, content: "" };
    setColumns((prev) =>
      prev.map((col) => (col.id === columnId ? { ...col, pages: [...col.pages, newPage] } : col))
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
  // Passe par handleSavePage pour rester synchronisé avec activePage pendant
  // l'édition (sinon l'éditeur ouvert afficherait des scènes obsolètes).
  const getPage = (pageId) => columns.flatMap((c) => c.pages).find((p) => p.id === pageId);

  const addScene = (pageId, title) => {
    if (!title.trim()) return;
    const scenes = [
      ...(getPage(pageId)?.scenes || []),
      { id: newId("scene"), title: title.trim(), content: "", tasks: [] },
    ];
    handleSavePage(pageId, { scenes });
  };

  // La scène part dans la corbeille avec son chapitre et sa position
  // d'origine, pour y être remise à sa place (cf. lib/trashRestore.js).
  const deleteScene = (pageId, sceneId) => {
    const scenes = getPage(pageId)?.scenes || [];
    const sceneIndex = scenes.findIndex((s) => s.id === sceneId);
    if (sceneIndex === -1) return;
    moveToTrash({ ...scenes[sceneIndex], pageId, sceneIndex }, "scene", {
      projectId: activeProjectId,
      subProjectId: activeSubProjectId,
    });
    handleSavePage(pageId, { scenes: scenes.filter((s) => s.id !== sceneId) });
  };

  const handleSaveScene = (pageId, sceneId, updates) => {
    const scenes = (getPage(pageId)?.scenes || []).map((s) =>
      s.id === sceneId ? { ...s, ...updates } : s
    );
    handleSavePage(pageId, { scenes });
  };

  // --- TÂCHES DE LIVRE --- (tâches de chapitre/scène : cf. MemoEditor)
  // `operation` : une des fonctions de lib/tasks.js, appliquée à la liste à
  // jour au moment de la mise à jour d'état.
  const updateSubProjectTasks = (projectId, subProjectId, operation, arg) =>
    updateSubProject(projectId, subProjectId, (sp) => ({ tasks: operation(sp.tasks, arg) }));

  const addSubProjectTask = (projectId, subProjectId, label) =>
    updateSubProjectTasks(projectId, subProjectId, addTask, label);
  const toggleSubProjectTask = (projectId, subProjectId, taskId) =>
    updateSubProjectTasks(projectId, subProjectId, toggleTask, taskId);
  const deleteSubProjectTask = (projectId, subProjectId, taskId) =>
    updateSubProjectTasks(projectId, subProjectId, removeTask, taskId);

  // --- BASE DE CONNAISSANCES (scoped to activeProjectId) ---
  // subProjectIds vide/absent = portée "univers entier" ; sinon la fiche
  // n'est visible que pour les livres listés (cf. lib/knowledgeBase.js).
  const addKbFile = (name, content, subProjectIds = []) => {
    if (!activeProjectId) return;
    const id = newId("kb");
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
  // La logique de destination vit dans lib/trashRestore.js (testée) ;
  // l'élément ne quitte la corbeille que si la restauration a réellement eu
  // lieu.
  const handleRestore = (item) => {
    const result = restoreTrashItem(
      {
        projects,
        subProjects,
        allProjectsData,
        knowledgeBaseByProject,
        activeProjectId,
        activeSubProjectId,
        trash: trashItems,
      },
      item
    );
    if (!result.restored) {
      showToast("error", result.reason);
      return;
    }
    const { changes } = result;
    if (changes.projects) setProjects(changes.projects);
    if (changes.subProjects) setSubProjects(changes.subProjects);
    if (changes.allProjectsData) setAllProjectsData(changes.allProjectsData);
    if (changes.knowledgeBaseByProject) setKnowledgeBaseByProject(changes.knowledgeBaseByProject);
    removeFromTrash(item.trashId);
    if (result.notice) showToast("success", result.notice);
  };

  // --- PARAMÈTRES ---
  // Sauvegarde complète : tout ce qu'il faut pour une restauration à
  // l'identique (données éditoriales + réglages utilisateur).
  const buildFullBackup = () => ({ ...persistedData(), exportedAt: new Date().toISOString() });

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
      buildZipEntries(
        { projects, subProjects, allProjectsData, knowledgeBaseByProject },
        htmlToMarkdown
      ).forEach(({ path, content }) => zip.file(path, content));
      zip.file("export.json", JSON.stringify(buildFullBackup(), null, 2));

      const blob = await zip.generateAsync({ type: "blob" });
      triggerDownload(blob, `horizon-export-${Date.now()}.zip`);
      showToast("success", "Archive ZIP téléchargée.");
    } catch (error) {
      console.error("Erreur lors de l'export ZIP :", error);
      showToast("error", "Échec de l'export ZIP.");
    }
  };

  // Remplace toutes les données par celles d'une sauvegarde JSON (format de
  // buildFullBackup ci-dessus). Renvoie { ok, message }.
  const importBackup = (text) => {
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return { ok: false, message: "Ce fichier n'est pas un export JSON d'Horizon." };
    }
    const problem = validateBackup(data);
    if (problem) return { ok: false, message: problem };

    sync.cancelPendingSave();
    setActivePage(null);
    applyData(data);
    // Écrit les données importées même si elles ressemblent à la dernière
    // version synchronisée.
    sync.markUnsynced();
    showToast("success", "Sauvegarde importée.");
    return { ok: true };
  };

  return {
    mounted: sync.mounted,
    user: sync.user,
    isGuest: sync.isGuest,
    loading: sync.loading,
    awaitingServer: sync.awaitingServer,
    isAuthModalOpen: sync.isAuthModalOpen,
    setIsAuthModalOpen: sync.setIsAuthModalOpen,
    handleGuestLogin: sync.handleGuestLogin,
    handleLogout: sync.handleLogout,
    flushSave: sync.flushSave,
    storageUsage: sync.storageUsage,
    deleteAllData: sync.deleteAllData,
    projects,
    subProjects,
    activeProjectId,
    activeSubProjectId,
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
    importBackup,
    trashItems,
    handleCreateProject,
    handleRenameProject,
    deleteProject,
    handleCreateSubProject,
    updateSubProject,
    deleteSubProject,
    deletePage,
    handleRestore,
    addColumn,
    addPage,
    handleSavePage,
    setColumns,
    removeFromTrash,
    updateColumn,
    deleteColumn,
    knowledgeBase,
    addKbFile,
    deleteKbFile,
    setKbFileScope,
    updateKbFileContent,
    addScene,
    deleteScene,
    handleSaveScene,
    addSubProjectTask,
    toggleSubProjectTask,
    deleteSubProjectTask,
    getUniverseSummary,
  };
}
