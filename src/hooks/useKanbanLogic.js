import { useState, useEffect, useRef } from "react";
import JSZip from "jszip";
import { auth, db, googleProvider } from "@/firebase/config";
import { useTrash } from "@/hooks/useTrash";
import { htmlToMarkdown } from "@/lib/htmlToMarkdown";
import { buildUniverseSummary } from "@/lib/universeSummary";
import { triggerDownload } from "@/lib/download";
import { buildZipEntries } from "@/lib/exportData";
import { restoreTrashItem } from "@/lib/trashRestore";
import { validateBackup } from "@/lib/backup";
import { newId } from "@/lib/id";
import { addTask, toggleTask, removeTask } from "@/lib/tasks";
import { onAuthStateChanged, signOut, deleteUser, reauthenticateWithPopup } from "firebase/auth";
import {
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  waitForPendingWrites,
  terminate,
  clearIndexedDbPersistence,
} from "firebase/firestore";
import { BACKGROUND_OPTIONS } from "@/lib/backgrounds";

// Marqueur localStorage distinct des données elles-mêmes : indique qu'une
// session invité était active, pour la restaurer après un rechargement.
const GUEST_SESSION_KEY = "horizon-guest-session";
const GUEST_DATA_KEY = "kanban-data-guest";
const userDataKey = (uid) => `kanban-data-${uid}`;

// 30 jours par défaut pour les nouveaux comptes : une corbeille jamais purgée
// grossit indéfiniment (elle garde le texte intégral des chapitres
// supprimés) et rapproche le document Firestore de sa limite de taille.
// Un réglage déjà enregistré (y compris "Jamais" = null) reste prioritaire.
const DEFAULT_SETTINGS = { trashRetentionDays: 30, sidebarBg: null, mainBg: null };

const SAVE_DEBOUNCE_MS = 500;
// Attente maximale de la synchronisation avant déconnexion / suppression.
const LOGOUT_SYNC_TIMEOUT_MS = 3000;
const DELETE_SYNC_TIMEOUT_MS = 5000;

// Limites de stockage : 1 Mio par document Firestore (compte connecté), et
// ~5 millions de caractères pour le localStorage de Chromium (invité).
const FIRESTORE_DOC_LIMIT = 1_048_576;
const LOCAL_STORAGE_LIMIT = 5_000_000;
const USAGE_WARNING_RATIO = 0.8;
const USAGE_CRITICAL_RATIO = 0.95;

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

// Empreinte servant à détecter un changement à sauvegarder. `lastActive` en
// est exclu : la navigation seule ne doit déclencher aucune écriture, et deux
// appareils ouverts sur des livres différents se renverraient sinon leur
// position en boucle à chaque synchronisation.
function syncFingerprint(data) {
  const { lastActive, ...content } = data;
  return stableStringify(content);
}

function computeStorageUsage(serialized, isGuest) {
  const used = isGuest ? serialized.length : new TextEncoder().encode(serialized).length;
  const limit = isGuest ? LOCAL_STORAGE_LIMIT : FIRESTORE_DOC_LIMIT;
  const ratio = used / limit;
  const level =
    ratio >= USAGE_CRITICAL_RATIO ? "critical" : ratio >= USAGE_WARNING_RATIO ? "warning" : "ok";
  return { used, limit, ratio, level };
}

const USAGE_LEVEL_RANK = { ok: 0, warning: 1, critical: 2 };

// Premier arc de tout nouveau livre.
const createDefaultColumn = () => ({ id: newId("col"), title: "Arc 1", color: "indigo", pages: [] });

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
  const [storageUsage, setStorageUsage] = useState(null);

  const showToast = (type, message) => setToast({ type, message, id: Date.now() });
  const dismissToast = () => setToast(null);

  // Sauvegarde en attente (debounce) : données, empreinte et destination
  // (compte ou invité) figées au moment du changement, pour pouvoir être
  // écrites plus tard — ou immédiatement via flushSave — sans dépendre de
  // l'état React du moment.
  const pendingSaveRef = useRef(null);
  const saveTimerRef = useRef(null);
  const usageLevelRef = useRef("ok");
  // Navigation courante, lisible depuis l'écoute Firestore (enregistrée une
  // seule fois au montage, donc sans accès direct à l'état à jour).
  const activeRef = useRef({ activeProjectId: null, activeSubProjectId: null, activePage: null });
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

  // `isRemote` : mise à jour reçue d'un autre appareil (et non chargement
  // initial). La navigation locale est alors conservée — le "lastActive"
  // enregistré par l'autre appareil n'a pas à faire changer de livre celui-ci,
  // ce qui laissait l'éditeur ouvert sur un chapitre d'un autre livre et
  // perdait silencieusement ses sauvegardes.
  // `guest` : données du stockage invité (limite de taille différente).
  const applyData = (rawData, { isRemote = false, guest = false } = {}) => {
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

    const loadedProjects = data.projects || [];
    const loadedSubProjects = data.subProjects || {};
    const loadedData = data.allData || {};
    // Ancien champ "knowledgeBase" (base de connaissances globale) volontairement
    // ignoré : elle est désormais scopée par univers, sans migration automatique.
    const loadedKb = data.knowledgeBaseByProject || {};
    const loadedArcs = data.arcsByProject || {};
    const loadedTrash = data.trash || [];
    const loadedSettings = { ...DEFAULT_SETTINGS, ...data.settings };
    // Les fonds servent à construire un chemin d'image : seules les valeurs
    // connues sont acceptées.
    for (const key of ["sidebarBg", "mainBg"]) {
      if (!BACKGROUND_OPTIONS.includes(loadedSettings[key])) loadedSettings[key] = null;
    }

    setProjects(loadedProjects);
    setSubProjects(loadedSubProjects);
    setAllProjectsData(loadedData);
    setKnowledgeBaseByProject(loadedKb);
    setArcsByProject(loadedArcs);
    setTrashItems(loadedTrash);
    setSettings(loadedSettings);

    const firstBookOf = (projectId) => loadedSubProjects[projectId]?.[0]?.id || null;

    if (isRemote) {
      const { activeProjectId: curProj, activeSubProjectId: curSub, activePage: curPage } =
        activeRef.current;
      const projStillExists = !!curProj && loadedProjects.some((p) => p.id === curProj);
      const subStillExists =
        !!curSub && Object.values(loadedSubProjects).some((subs) => subs.some((s) => s.id === curSub));

      if ((curProj && !projStillExists) || (curSub && !subStillExists)) {
        const fallbackProj = projStillExists ? curProj : loadedProjects[0]?.id || null;
        setActiveProjectId(fallbackProj);
        setActiveSubProjectId(firstBookOf(fallbackProj));
        if (curPage) {
          setActivePage(null);
          showToast("error", "Le livre ouvert a été supprimé depuis un autre appareil.");
        }
      } else if (
        curPage &&
        !(loadedData[curSub] || []).some((c) => c.pages.some((p) => p.id === curPage.id))
      ) {
        setActivePage(null);
        showToast("error", "Le chapitre ouvert a été supprimé ou déplacé depuis un autre appareil.");
      }
    } else if (data.lastActive?.subProjectId) {
      setActiveProjectId(data.lastActive.projectId);
      setActiveSubProjectId(data.lastActive.subProjectId);
    } else if (loadedProjects[0]) {
      setActiveProjectId(loadedProjects[0].id);
      setActiveSubProjectId(firstBookOf(loadedProjects[0].id));
    }

    lastSyncedRef.current = syncFingerprint({
      projects: loadedProjects,
      subProjects: loadedSubProjects,
      allData: loadedData,
      knowledgeBaseByProject: loadedKb,
      arcsByProject: loadedArcs,
      trash: loadedTrash,
      settings: loadedSettings,
    });
    trackStorageUsage(lastSyncedRef.current, guest);
  };

  // Charge une copie locale (localStorage) ; données vides si absente ou
  // illisible.
  const applyLocalData = (key) => {
    const guest = key === GUEST_DATA_KEY;
    const saved = localStorage.getItem(key);
    try {
      applyData(saved ? JSON.parse(saved) : {}, { guest });
    } catch {
      applyData({}, { guest });
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
        // Remet l'écran de chargement à chaque connexion, y compris après une
        // déconnexion sans rechargement de la page : sinon l'interface vide
        // ("Créez votre premier univers") s'affichait en attendant Firestore,
        // et créer un univers à ce moment écrasait tout le document distant.
        setLoading(true);
        setIsInitialLoad(true);
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
                applyLocalData(userDataKey(currentUser.uid));
              }
              setIsInitialLoad(false);
              setLoading(false);
              return;
            }

            // Changement fait depuis un autre appareil. Si des modifications
            // locales attendent encore leur sauvegarde (debounce), elles sont
            // envoyées d'abord et ce snapshot est ignoré : l'appliquer les
            // effacerait sans qu'elles aient jamais été enregistrées.
            if (pendingSaveRef.current) {
              flushSave();
              return;
            }
            if (docSnap.exists()) applyData(docSnap.data(), { isRemote: true });
          },
          (error) => {
            console.error("Erreur d'écoute Firestore :", error);
            if (isFirstSnapshot) {
              isFirstSnapshot = false;
              applyLocalData(userDataKey(currentUser.uid));
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
        applyLocalData(GUEST_DATA_KEY);
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
  // Avertit une fois à chaque franchissement de seuil (80 %, puis 95 %) de
  // l'espace disponible : au-delà de 100 %, toutes les sauvegardes échouent.
  const trackStorageUsage = (serialized, guest) => {
    const usage = computeStorageUsage(serialized, guest);
    setStorageUsage(usage);
    const previous = usageLevelRef.current;
    usageLevelRef.current = usage.level;
    if (USAGE_LEVEL_RANK[usage.level] <= USAGE_LEVEL_RANK[previous]) return;
    const percent = Math.round(usage.ratio * 100);
    showToast(
      "error",
      usage.level === "critical"
        ? `Espace de stockage presque plein (${percent} %) : videz la corbeille ou exportez puis supprimez d'anciens contenus.`
        : `Espace de stockage utilisé à ${percent} % : pensez à vider la corbeille.`
    );
  };

  // Écrit d'abord la copie locale (synchrone), puis lance l'écriture
  // Firestore SANS l'attendre pour enchaîner les suivantes : setDoc ne se
  // résout qu'une fois l'écriture confirmée par le serveur, donc jamais tant
  // qu'on est hors-ligne — l'attendre bloquait toutes les sauvegardes
  // suivantes en mémoire, perdues à la fermeture de l'app. Le SDK applique
  // de toute façon les écritures d'un même client dans leur ordre d'émission.
  // Renvoie une promesse résolue à true/false une fois l'écriture distante
  // confirmée ou refusée (utile pour attendre avant de fermer l'app).
  const persist = ({ dataToSave, serialized, uid, guest }) => {
    if (!uid && !guest) return Promise.resolve(true);
    lastSyncedRef.current = serialized;
    trackStorageUsage(serialized, guest);

    try {
      localStorage.setItem(uid ? userDataKey(uid) : GUEST_DATA_KEY, JSON.stringify(dataToSave));
    } catch (error) {
      console.error("Erreur lors de la copie locale :", error);
      if (guest) {
        // En mode invité, le stockage local est la seule copie.
        lastSyncedRef.current = null;
        showToast("error", "Stockage local plein : vos dernières modifications n'ont pas pu être enregistrées.");
        return Promise.resolve(false);
      }
      showToast("error", "Copie locale impossible (stockage plein) ; la synchronisation en ligne continue.");
    }
    if (!uid) return Promise.resolve(true);

    let write;
    try {
      write = setDoc(doc(db, "users", uid), dataToSave);
    } catch (error) {
      write = Promise.reject(error);
    }
    return write.then(
      () => true,
      (error) => {
        console.error("Erreur lors de la sauvegarde :", error);
        // Autorise une nouvelle tentative au prochain changement.
        if (lastSyncedRef.current === serialized) lastSyncedRef.current = null;
        showToast("error", "Échec de l'enregistrement en ligne : vérifiez votre connexion.");
        return false;
      }
    );
  };

  // Écrit immédiatement la sauvegarde en attente (sans attendre la fin du
  // debounce) : fermeture de la page/de l'app, déconnexion, conflit avec une
  // mise à jour distante.
  const flushSave = () => {
    clearTimeout(saveTimerRef.current);
    const pending = pendingSaveRef.current;
    if (!pending) return Promise.resolve(true);
    pendingSaveRef.current = null;
    return persist(pending);
  };

  useEffect(() => {
    // `projects.length === 0` seul ne suffit plus à ignorer la sauvegarde :
    // supprimer le dernier univers actif vide `projects` tout en peuplant la
    // corbeille — sans cette exception, cette suppression (et tout ce qui la
    // suit) ne serait jamais persistée, et un rechargement la ferait
    // disparaître de la corbeille comme si elle n'avait jamais eu lieu.
    if (!mounted || isInitialLoad || (projects.length === 0 && trashItems.length === 0)) {
      pendingSaveRef.current = null;
      return;
    }

    const dataToSave = {
      ...persistedData(),
      lastActive: { projectId: activeProjectId, subProjectId: activeSubProjectId },
    };

    const serialized = syncFingerprint(dataToSave);
    // Identique à la dernière version connue de Firestore (chargement initial
    // ou mise à jour reçue d'un autre appareil via onSnapshot) : rien à
    // réécrire — évite la boucle décrite dans l'effet d'auth ci-dessus.
    if (serialized === lastSyncedRef.current) {
      pendingSaveRef.current = null;
      return;
    }

    // Debounce court : regroupe les changements rapprochés (ex. plusieurs
    // champs modifiés en quelques secondes) en une seule écriture au lieu
    // d'une requête Firestore par changement d'état.
    pendingSaveRef.current = { dataToSave, serialized, uid: user?.uid || null, guest: isGuest };
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(flushSave, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(saveTimerRef.current);
    // activeProjectId & activeSubProjectId exclus : la navigation seule ne déclenche pas de sauvegarde
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, subProjects, allProjectsData, knowledgeBaseByProject, arcsByProject, trashItems, settings, mounted, user, isGuest, isInitialLoad]);

  // Fermeture/rechargement de la page : écrit tout de suite ce qui attendait
  // la fin du debounce, au lieu de le perdre.
  useEffect(() => {
    window.addEventListener("pagehide", flushSave);
    return () => window.removeEventListener("pagehide", flushSave);
    // flushSave ne lit que des refs : la version du montage reste valable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    applyLocalData(GUEST_DATA_KEY);
    localStorage.setItem(GUEST_SESSION_KEY, "1");
    setIsInitialLoad(false);
    setIsGuest(true);
  };

  const handleLogout = async () => {
    // Écrit les dernières modifications avant de vider l'état (sinon
    // l'effet de sauvegarde, voyant des données vides, les abandonne).
    flushSave();

    if (user) {
      const synced = await Promise.race([
        waitForPendingWrites(db).then(() => true),
        new Promise((resolve) => setTimeout(() => resolve(false), LOGOUT_SYNC_TIMEOUT_MS)),
      ]);
      if (
        !synced &&
        !window.confirm(
          "Certaines modifications ne sont pas encore synchronisées (pas de connexion ?). " +
            "Se déconnecter maintenant les effacera de cet appareil. Continuer ?"
        )
      ) {
        return;
      }
      const uid = user.uid;
      await signOut(auth);
      await purgeDeviceCacheAndReload(uid);
      return;
    }

    localStorage.removeItem(GUEST_SESSION_KEY);
    setIsGuest(false);
    resetAllState();
    setUser(null);
  };

  const resetAllState = () => {
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
    setStorageUsage(null);
    usageLevelRef.current = "ok";
  };

  // Sur un ordinateur partagé, rien du compte ne doit rester lisible après
  // déconnexion : copie locale et cache Firestore (IndexedDB). terminate()
  // est requis avant la purge du cache et rend `db` inutilisable, d'où le
  // rechargement de la page.
  const purgeDeviceCacheAndReload = async (uid) => {
    localStorage.removeItem(userDataKey(uid));
    try {
      await terminate(db);
      await clearIndexedDbPersistence(db);
    } catch (error) {
      console.error("Purge du cache Firestore impossible :", error);
    }
    window.location.reload();
  };

  // Firebase exige une connexion récente pour supprimer un compte : si elle
  // date, on redemande la connexion Google avant de réessayer.
  const deleteCurrentAccount = async () => {
    try {
      await deleteUser(auth.currentUser);
    } catch (error) {
      if (error?.code !== "auth/requires-recent-login") throw error;
      await reauthenticateWithPopup(auth.currentUser, googleProvider);
      await deleteUser(auth.currentUser);
    }
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

    clearTimeout(saveTimerRef.current);
    pendingSaveRef.current = null;
    setActivePage(null);
    applyData(data, { guest: isGuest });
    // applyData tient ces données pour déjà synchronisées : on efface cette
    // référence pour que l'effet de sauvegarde les écrive bien.
    lastSyncedRef.current = null;
    showToast("success", "Sauvegarde importée.");
    return { ok: true };
  };

  // Supprime toutes les données — et, sur demande, le compte Firebase.
  // Renvoie { ok, message } : les Paramètres n'annoncent la suppression que
  // si elle a réellement eu lieu (ou est en file d'attente hors-ligne).
  const deleteAllData = async ({ deleteAccount = false } = {}) => {
    // Abandonne toute sauvegarde en attente : elle réécrirait les données
    // qu'on est en train de supprimer.
    clearTimeout(saveTimerRef.current);
    pendingSaveRef.current = null;

    if (!user) {
      resetAllState();
      if (isGuest) localStorage.removeItem(GUEST_DATA_KEY);
      return { ok: true };
    }

    // deleteDoc ne se résout qu'à la confirmation du serveur : hors-ligne,
    // la suppression reste dans la file persistante de Firestore et sera
    // appliquée à la reconnexion. L'état local n'est vidé qu'ensuite, pour
    // ne rien effacer à l'écran si la suppression est refusée.
    const uid = user.uid;
    const outcome = await Promise.race([
      deleteDoc(doc(db, "users", uid)).then(
        () => "done",
        (error) => {
          console.error("Erreur lors de la suppression :", error);
          return "error";
        }
      ),
      new Promise((resolve) => setTimeout(() => resolve("queued"), DELETE_SYNC_TIMEOUT_MS)),
    ]);
    if (outcome === "error") {
      return { ok: false, message: "La suppression a échoué : vérifiez votre connexion puis réessayez." };
    }
    resetAllState();
    lastSyncedRef.current = null;
    localStorage.removeItem(userDataKey(uid));

    if (!deleteAccount) {
      return outcome === "queued"
        ? { ok: true, message: "Suppression enregistrée : elle sera finalisée à la prochaine connexion." }
        : { ok: true };
    }
    if (outcome === "queued") {
      return {
        ok: false,
        message: "Données supprimées, mais une connexion est nécessaire pour supprimer le compte. Réessayez une fois en ligne.",
      };
    }
    try {
      await deleteCurrentAccount();
    } catch (error) {
      console.error("Erreur lors de la suppression du compte :", error);
      return { ok: false, message: "Données supprimées, mais le compte n'a pas pu être supprimé. Réessayez." };
    }
    await purgeDeviceCacheAndReload(uid);
    return { ok: true };
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
    flushSave,
    storageUsage,
    exportAllData,
    exportAllDataZip,
    importBackup,
    deleteAllData,
    trashItems,
    handleLogout,
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
