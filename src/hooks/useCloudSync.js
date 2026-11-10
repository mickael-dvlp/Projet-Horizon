import { useState, useEffect, useRef } from "react";
import { auth, db, googleProvider } from "@/firebase/config";
import { onAuthStateChanged, signOut, deleteUser, reauthenticateWithPopup } from "firebase/auth";
import {
  doc,
  collection,
  onSnapshot,
  writeBatch,
  waitForPendingWrites,
  terminate,
  clearIndexedDbPersistence,
} from "firebase/firestore";
import { syncFingerprint, stableStringify, computeStorageUsage, USAGE_LEVEL_RANK } from "@/lib/sync";
import {
  splitContents,
  mergeContents,
  collectIds,
  planContentWrites,
  chunk,
  hasInlineContents,
} from "@/lib/contentStore";
import { readLocalRecord, writeLocalRecord, deleteLocalRecord } from "@/lib/localStore";

// Marqueur localStorage distinct des données elles-mêmes : indique qu'une
// session invité était active, pour la restaurer après un rechargement.
const GUEST_SESSION_KEY = "horizon-guest-session";
const GUEST_DATA_KEY = "kanban-data-guest";
const userDataKey = (uid) => `kanban-data-${uid}`;

// Version du format Firestore : 2 = textes stockés dans users/{uid}/contents
// (cf. lib/contentStore.js) ; absente = ancien format, textes dans le
// document principal, migré automatiquement à la première sauvegarde.
const SCHEMA_VERSION = 2;
// Marge sous la limite de 500 opérations d'une écriture groupée Firestore.
const MAX_BATCH_OPS = 400;

const SAVE_DEBOUNCE_MS = 500;
// Attente maximale de la synchronisation avant déconnexion / suppression.
const LOGOUT_SYNC_TIMEOUT_MS = 3000;
const DELETE_SYNC_TIMEOUT_MS = 5000;

const delay = (ms, value) => new Promise((resolve) => setTimeout(() => resolve(value), ms));
const userDoc = (uid) => doc(db, "users", uid);
const contentDoc = (uid, id) => doc(db, "users", uid, "contents", id);

// Copie locale d'un compte (secours si Firestore est injoignable au premier
// chargement) : localStorage, données brutes.
function readUserCopy(uid) {
  try {
    const saved = localStorage.getItem(userDataKey(uid));
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

// Connexion (compte Google ou invité), chargement et sauvegarde des données :
// Firestore pour un compte (document users/{uid} + un document par texte,
// avec une copie locale de secours), IndexedDB + localStorage pour un invité.
//
// Ce hook ne connaît pas la structure des données ; useKanbanLogic fournit :
// - `data` : l'objet à sauvegarder (hors navigation) ;
// - `lastActive` : la navigation courante, enregistrée avec les données ;
// - `applyData(brut, { isRemote })` : charge des données dans l'état et
//   renvoie leur version normalisée (même forme que `data`) ;
// - `resetData()` : vide l'état ;
// - `showToast`, et `confirm` (boîte de confirmation de l'app).
export function useCloudSync({ data, lastActive, applyData, resetData, showToast, confirm }) {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState(null);
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [storageUsage, setStorageUsage] = useState(null);

  // Sauvegarde en attente (debounce) : données, empreinte et destination
  // (compte ou invité) figées au moment du changement, pour pouvoir être
  // écrites plus tard — ou immédiatement via flushSave — sans dépendre de
  // l'état React du moment.
  const pendingSaveRef = useRef(null);
  const saveTimerRef = useRef(null);
  const usageLevelRef = useRef("ok");
  // Écoutes Firestore actives pour l'utilisateur courant, à fermer dès
  // qu'il change (changement de compte, déconnexion, démontage).
  const docUnsubRef = useRef(null);
  // Dernière version des données connue comme déjà synchronisée (chargement
  // ou mise à jour reçue d'un autre appareil) — sert de référence à l'effet
  // de sauvegarde pour ne pas réécrire ce qui vient tout juste d'être lu.
  const lastSyncedRef = useRef(null);
  // Textes (id → contenu) et document principal tels qu'enregistrés dans
  // Firestore : seules les différences sont réécrites.
  const lastContentsRef = useRef({});
  const lastMainRef = useRef(null);

  // --- ESPACE DE STOCKAGE (document Firestore principal) ---
  // Avertit une fois à chaque franchissement de seuil (80 %, puis 95 %) :
  // au-delà de 100 %, le document principal ne pourrait plus être écrit.
  const trackStorageUsage = (serializedMain) => {
    const usage = computeStorageUsage(serializedMain);
    setStorageUsage(usage);
    const previous = usageLevelRef.current;
    usageLevelRef.current = usage.level;
    if (USAGE_LEVEL_RANK[usage.level] <= USAGE_LEVEL_RANK[previous]) return;
    const percent = Math.round(usage.ratio * 100);
    showToast(
      "error",
      usage.level === "critical"
        ? `Espace de stockage presque plein (${percent} %) : videz la corbeille ou supprimez d'anciens éléments.`
        : `Espace de stockage utilisé à ${percent} % : pensez à vider la corbeille.`
    );
  };

  const resetAll = () => {
    resetData();
    setStorageUsage(null);
    usageLevelRef.current = "ok";
  };

  // --- CHARGEMENT ---
  // `guest` : pas de jauge (le stockage local d'un invité n'a pas la limite
  // de taille d'un document Firestore).
  const load = (raw, { isRemote = false, guest = false } = {}) => {
    const loaded = applyData(raw, { isRemote });
    lastSyncedRef.current = syncFingerprint(loaded);
    if (!guest) trackStorageUsage(stableStringify(splitContents(loaded).main));
  };

  // Document Firestore principal + textes (users/{uid}/contents). Ancien
  // format (textes dans le document principal) : la sauvegarde suivante est
  // forcée pour les déplacer dans leurs propres documents.
  const loadFromFirestore = (raw, contents, { isRemote }) => {
    lastContentsRef.current = contents;
    lastMainRef.current = null;
    load(mergeContents(raw, contents), { isRemote });
    if (raw.schemaVersion !== SCHEMA_VERSION && hasInlineContents(raw)) lastSyncedRef.current = null;
  };

  // Copie locale de secours d'un compte (Firestore injoignable ou document
  // absent) : rien n'est encore connu côté serveur, tout sera écrit.
  const loadUserCopy = (uid) => {
    lastContentsRef.current = {};
    lastMainRef.current = null;
    load(readUserCopy(uid) || {});
  };

  const loadGuest = async () => {
    load((await readLocalRecord(GUEST_DATA_KEY)) || {}, { guest: true });
  };

  // --- SAUVEGARDE ---
  // Écritures Firestore d'une sauvegarde : textes nouveaux ou modifiés, puis
  // document principal (s'il a changé), puis suppression des textes des
  // éléments supprimés définitivement. Ordre volontaire : le document
  // principal ne référence jamais un texte pas encore écrit. Les écritures
  // d'un même client sont appliquées par Firestore dans leur ordre d'émission.
  const writeToFirestore = (uid, dataToSave) => {
    const { main, contents } = splitContents(dataToSave);
    const serializedMain = stableStringify(main);
    const { upserts, deletes } = planContentWrites(lastContentsRef.current, contents, collectIds(main));
    lastContentsRef.current = contents;
    trackStorageUsage(serializedMain);

    const batches = chunk(upserts, MAX_BATCH_OPS).map((group) => {
      const batch = writeBatch(db);
      group.forEach(([id, content]) => batch.set(contentDoc(uid, id), { content }));
      return batch;
    });
    if (serializedMain !== lastMainRef.current) {
      lastMainRef.current = serializedMain;
      const batch = writeBatch(db);
      batch.set(userDoc(uid), { ...main, schemaVersion: SCHEMA_VERSION });
      batches.push(batch);
    }
    chunk(deletes, MAX_BATCH_OPS).forEach((group) => {
      const batch = writeBatch(db);
      group.forEach((id) => batch.delete(contentDoc(uid, id)));
      batches.push(batch);
    });
    return Promise.all(batches.map((batch) => batch.commit()));
  };

  // Écrit la copie locale, puis lance les écritures distantes SANS les
  // attendre pour enchaîner les suivantes : une écriture Firestore ne se
  // résout qu'une fois confirmée par le serveur, donc jamais tant qu'on est
  // hors-ligne — l'attendre bloquait toutes les sauvegardes suivantes en
  // mémoire, perdues à la fermeture de l'app.
  // Renvoie une promesse résolue à true/false une fois l'écriture terminée
  // ou refusée (utile pour attendre avant de fermer l'app).
  const persist = ({ dataToSave, serialized, uid, guest }) => {
    if (!uid && !guest) return Promise.resolve(true);
    lastSyncedRef.current = serialized;

    if (!uid) {
      return writeLocalRecord(GUEST_DATA_KEY, dataToSave).then((saved) => {
        if (!saved) {
          if (lastSyncedRef.current === serialized) lastSyncedRef.current = null;
          showToast("error", "Échec de l'enregistrement local : vos dernières modifications n'ont pas pu être enregistrées.");
        }
        return saved;
      });
    }

    try {
      localStorage.setItem(userDataKey(uid), JSON.stringify(dataToSave));
    } catch (error) {
      // Simple copie de secours : Firestore garde déjà les données hors-ligne.
      console.warn("Copie locale de secours impossible :", error);
    }

    let write;
    try {
      write = writeToFirestore(uid, dataToSave);
    } catch (error) {
      write = Promise.reject(error);
    }
    return write.then(
      () => true,
      (error) => {
        console.error("Erreur lors de la sauvegarde :", error);
        // Tout sera réécrit à la prochaine tentative.
        if (lastSyncedRef.current === serialized) lastSyncedRef.current = null;
        lastContentsRef.current = {};
        lastMainRef.current = null;
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

  // Abandonne la sauvegarde en attente (données remplacées ou supprimées).
  const cancelPendingSave = () => {
    clearTimeout(saveTimerRef.current);
    pendingSaveRef.current = null;
  };

  // Force la prochaine sauvegarde même si les données semblent inchangées
  // (ex. sauvegarde importée, à écrire telle quelle).
  const markUnsynced = () => {
    lastSyncedRef.current = null;
  };

  // Écoute du document principal et des textes d'un compte. Les deux vues
  // sont toujours mémorisées dans leur dernier état local (y compris nos
  // propres écritures en attente), mais ne sont réappliquées à l'état de
  // l'app que pour un changement venu du serveur.
  const listenToUser = (uid) => {
    let isFirst = true;
    let mainSnap = null;
    let contents = null;

    const finishFirstLoad = (loadFn) => {
      isFirst = false;
      loadFn();
      setIsInitialLoad(false);
      setLoading(false);
    };

    const apply = () => {
      if (!mainSnap || !contents) return;
      if (isFirst) {
        finishFirstLoad(() =>
          mainSnap.exists()
            ? loadFromFirestore(mainSnap.data(), contents, { isRemote: false })
            : loadUserCopy(uid)
        );
        return;
      }
      // Changement fait depuis un autre appareil. Si des modifications
      // locales attendent encore leur sauvegarde (debounce), elles sont
      // envoyées d'abord et ce changement est ignoré : l'appliquer les
      // effacerait sans qu'elles aient jamais été enregistrées.
      if (pendingSaveRef.current) {
        flushSave();
        return;
      }
      if (mainSnap.exists()) loadFromFirestore(mainSnap.data(), contents, { isRemote: true });
    };

    const onError = (error) => {
      console.error("Erreur d'écoute Firestore :", error);
      if (isFirst) finishFirstLoad(() => loadUserCopy(uid));
    };

    // Ignore l'écho de nos propres écritures pas encore confirmées par le
    // serveur : sans ce garde-fou, chaque sauvegarde redéclencherait aussitôt
    // le chargement -> effet de sauvegarde -> écriture -> nouvel écho, en
    // boucle. La toute première lecture n'est jamais filtrée, pour ne jamais
    // rester bloqué sur "Chargement...".
    const unsubMain = onSnapshot(
      userDoc(uid),
      (snap) => {
        mainSnap = snap;
        if (!isFirst && snap.metadata.hasPendingWrites) return;
        apply();
      },
      onError
    );
    const unsubContents = onSnapshot(
      collection(db, "users", uid, "contents"),
      (snap) => {
        contents = Object.fromEntries(snap.docs.map((d) => [d.id, d.data().content]));
        if (!isFirst && snap.metadata.hasPendingWrites) return;
        apply();
      },
      onError
    );
    return () => {
      unsubMain();
      unsubContents();
    };
  };

  // --- AUTH & CHARGEMENT ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      // Un changement de compte (ou une déconnexion) ferme l'écoute
      // précédente : sinon des données d'un compte différent pourraient
      // encore arriver après coup et se mélanger.
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
        docUnsubRef.current = listenToUser(currentUser.uid);
      } else if (localStorage.getItem(GUEST_SESSION_KEY) === "1") {
        // Restaure la session invité après un rechargement complet : sans ce
        // marqueur, seul le state React `isGuest` (jamais persisté) faisait
        // foi, donc tout `reload()` ramenait à l'écran de connexion malgré
        // des données invité toujours présentes.
        loadGuest().finally(() => {
          setIsGuest(true);
          setIsInitialLoad(false);
          setLoading(false);
        });
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
    // Ce listener ne doit s'enregistrer qu'une seule fois au montage, pas se
    // réabonner à chaque re-render : les fonctions qu'il appelle ne
    // dépendent que de refs et de setters d'état.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // `projects.length === 0` seul ne suffit pas à ignorer la sauvegarde :
    // supprimer le dernier univers actif vide `projects` tout en peuplant la
    // corbeille — sans cette exception, cette suppression (et tout ce qui la
    // suit) ne serait jamais persistée, et un rechargement la ferait
    // disparaître de la corbeille comme si elle n'avait jamais eu lieu.
    if (!mounted || isInitialLoad || (data.projects.length === 0 && data.trash.length === 0)) {
      pendingSaveRef.current = null;
      return;
    }

    const dataToSave = { ...data, lastActive };
    const serialized = syncFingerprint(dataToSave);
    // Identique à la dernière version connue (chargement initial ou mise à
    // jour reçue d'un autre appareil) : rien à réécrire — évite la boucle
    // décrite dans listenToUser.
    if (serialized === lastSyncedRef.current) {
      pendingSaveRef.current = null;
      return;
    }

    // Debounce court : regroupe les changements rapprochés (ex. plusieurs
    // champs modifiés en quelques secondes) en une seule écriture au lieu
    // d'une écriture par changement d'état.
    pendingSaveRef.current = { dataToSave, serialized, uid: user?.uid || null, guest: isGuest };
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(flushSave, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(saveTimerRef.current);
    // `lastActive` exclu : la navigation seule ne déclenche pas de sauvegarde.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    data.projects,
    data.subProjects,
    data.allData,
    data.knowledgeBaseByProject,
    data.arcsByProject,
    data.trash,
    data.settings,
    mounted,
    user,
    isGuest,
    isInitialLoad,
  ]);

  // Fermeture/rechargement de la page : écrit tout de suite ce qui attendait
  // la fin du debounce, au lieu de le perdre.
  useEffect(() => {
    window.addEventListener("pagehide", flushSave);
    return () => window.removeEventListener("pagehide", flushSave);
    // flushSave ne lit que des refs : la version du montage reste valable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- CONNEXION / DÉCONNEXION ---
  const handleGuestLogin = async () => {
    await loadGuest();
    localStorage.setItem(GUEST_SESSION_KEY, "1");
    setIsInitialLoad(false);
    setIsGuest(true);
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

  const handleLogout = async () => {
    // Écrit les dernières modifications avant de vider l'état (sinon
    // l'effet de sauvegarde, voyant des données vides, les abandonne).
    flushSave();

    if (user) {
      const synced = await Promise.race([
        waitForPendingWrites(db).then(() => true),
        delay(LOGOUT_SYNC_TIMEOUT_MS, false),
      ]);
      if (
        !synced &&
        !(await confirm({
          title: "Modifications non synchronisées",
          message:
            "Certaines modifications n’ont pas encore été envoyées (pas de connexion ?). " +
            "Se déconnecter maintenant les effacera de cet appareil.",
          confirmLabel: "Se déconnecter quand même",
          danger: true,
        }))
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
    resetAll();
    setUser(null);
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

  // Supprime le document principal et tous les textes d'un compte.
  const deleteFromFirestore = (uid) => {
    const batches = chunk(Object.keys(lastContentsRef.current), MAX_BATCH_OPS).map((group) => {
      const batch = writeBatch(db);
      group.forEach((id) => batch.delete(contentDoc(uid, id)));
      return batch;
    });
    const last = writeBatch(db);
    last.delete(userDoc(uid));
    batches.push(last);
    return Promise.all(batches.map((batch) => batch.commit()));
  };

  // Supprime toutes les données — et, sur demande, le compte Firebase.
  // Renvoie { ok, message } : les Paramètres n'annoncent la suppression que
  // si elle a réellement eu lieu (ou est en file d'attente hors-ligne).
  const deleteAllData = async ({ deleteAccount = false } = {}) => {
    // Abandonne toute sauvegarde en attente : elle réécrirait les données
    // qu'on est en train de supprimer.
    cancelPendingSave();

    if (!user) {
      resetAll();
      if (isGuest) await deleteLocalRecord(GUEST_DATA_KEY);
      return { ok: true };
    }

    // Les suppressions ne se résolvent qu'à la confirmation du serveur :
    // hors-ligne, elles restent dans la file persistante de Firestore et
    // seront appliquées à la reconnexion. L'état local n'est vidé qu'ensuite,
    // pour ne rien effacer à l'écran si la suppression est refusée.
    const uid = user.uid;
    const outcome = await Promise.race([
      deleteFromFirestore(uid).then(
        () => "done",
        (error) => {
          console.error("Erreur lors de la suppression :", error);
          return "error";
        }
      ),
      delay(DELETE_SYNC_TIMEOUT_MS, "queued"),
    ]);
    if (outcome === "error") {
      return { ok: false, message: "La suppression a échoué : vérifiez votre connexion puis réessayez." };
    }
    resetAll();
    markUnsynced();
    lastContentsRef.current = {};
    lastMainRef.current = null;
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
    isInitialLoad,
    isAuthModalOpen,
    setIsAuthModalOpen,
    storageUsage,
    flushSave,
    cancelPendingSave,
    markUnsynced,
    handleGuestLogin,
    handleLogout,
    deleteAllData,
  };
}
