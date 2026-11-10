import { useState, useEffect, useRef } from "react";
import { auth, db, googleProvider } from "@/firebase/config";
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
import { syncFingerprint, computeStorageUsage, USAGE_LEVEL_RANK } from "@/lib/sync";

// Marqueur localStorage distinct des données elles-mêmes : indique qu'une
// session invité était active, pour la restaurer après un rechargement.
const GUEST_SESSION_KEY = "horizon-guest-session";
const GUEST_DATA_KEY = "kanban-data-guest";
const userDataKey = (uid) => `kanban-data-${uid}`;

const SAVE_DEBOUNCE_MS = 500;
// Attente maximale de la synchronisation avant déconnexion / suppression.
const LOGOUT_SYNC_TIMEOUT_MS = 3000;
const DELETE_SYNC_TIMEOUT_MS = 5000;

const delay = (ms, value) => new Promise((resolve) => setTimeout(() => resolve(value), ms));

// Connexion (compte Google ou invité), chargement et sauvegarde des données :
// document Firestore users/{uid} pour un compte, localStorage pour un invité,
// avec une copie locale dans les deux cas.
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
  // Écoute Firestore active (onSnapshot) pour l'utilisateur courant, à fermer
  // dès qu'elle change (changement de compte, déconnexion, démontage).
  const docUnsubRef = useRef(null);
  // Dernière version des données connue comme déjà synchronisée avec
  // Firestore (chargement initial ou mise à jour reçue via onSnapshot) —
  // sert de référence à l'effet de sauvegarde pour ne pas réécrire ce qui
  // vient tout juste d'être lu.
  const lastSyncedRef = useRef(null);

  // --- ESPACE DE STOCKAGE ---
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

  const resetAll = () => {
    resetData();
    setStorageUsage(null);
    usageLevelRef.current = "ok";
  };

  // --- CHARGEMENT ---
  // `guest` : données du stockage invité (limite de taille différente).
  const load = (raw, { isRemote = false, guest = false } = {}) => {
    lastSyncedRef.current = syncFingerprint(applyData(raw, { isRemote }));
    trackStorageUsage(lastSyncedRef.current, guest);
  };

  // Charge une copie locale (localStorage) ; données vides si absente ou
  // illisible.
  const loadLocal = (key) => {
    const guest = key === GUEST_DATA_KEY;
    const saved = localStorage.getItem(key);
    try {
      load(saved ? JSON.parse(saved) : {}, { guest });
    } catch {
      load({}, { guest });
    }
  };

  // --- SAUVEGARDE ---
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
            // sauvegarde redéclenche aussitôt le chargement -> effet de
            // sauvegarde -> setDoc -> nouvel écho, en boucle. La toute
            // première lecture (chargement/reconnexion) n'est jamais
            // filtrée, pour ne jamais rester bloqué sur "Chargement...".
            if (!isFirstSnapshot && docSnap.metadata.hasPendingWrites) return;

            if (isFirstSnapshot) {
              isFirstSnapshot = false;
              if (docSnap.exists()) load(docSnap.data());
              else loadLocal(userDataKey(currentUser.uid));
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
            if (docSnap.exists()) load(docSnap.data(), { isRemote: true });
          },
          (error) => {
            console.error("Erreur d'écoute Firestore :", error);
            if (isFirstSnapshot) {
              isFirstSnapshot = false;
              loadLocal(userDataKey(currentUser.uid));
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
        loadLocal(GUEST_DATA_KEY);
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
  const handleGuestLogin = () => {
    loadLocal(GUEST_DATA_KEY);
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

  // Supprime toutes les données — et, sur demande, le compte Firebase.
  // Renvoie { ok, message } : les Paramètres n'annoncent la suppression que
  // si elle a réellement eu lieu (ou est en file d'attente hors-ligne).
  const deleteAllData = async ({ deleteAccount = false } = {}) => {
    // Abandonne toute sauvegarde en attente : elle réécrirait les données
    // qu'on est en train de supprimer.
    cancelPendingSave();

    if (!user) {
      resetAll();
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
      delay(DELETE_SYNC_TIMEOUT_MS, "queued"),
    ]);
    if (outcome === "error") {
      return { ok: false, message: "La suppression a échoué : vérifiez votre connexion puis réessayez." };
    }
    resetAll();
    markUnsynced();
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
