"use client";
import { useEffect, useState } from "react";

// Délai maximal d'attente de la confirmation serveur avant de fermer : hors
// ligne, setDoc ne se résout jamais, mais la copie locale est déjà écrite et
// l'écriture Firestore reste dans sa file persistante.
const CLOSE_SAVE_TIMEOUT_MS = 2000;

// Le processus principal Electron (electron/main.js) intercepte la fermeture
// de la fenêtre et attend une réponse via IPC avant de fermer pour de vrai —
// ce hook affiche la confirmation côté renderer (modale Tailwind cohérente
// avec le reste de l'app) et relaie la décision. Inerte hors d'Electron
// (pas de window.electronAPI dans un navigateur classique).
//
// `onBeforeClose` : enregistre ce qui n'est encore qu'un état local (éditeur
// ouvert) ; `onPersist` : écrit immédiatement la sauvegarde en attente et
// renvoie une promesse résolue une fois l'écriture terminée.
export function useElectronCloseConfirm({ onBeforeClose, onPersist } = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (!window.electronAPI?.onConfirmClose) return;
    return window.electronAPI.onConfirmClose(() => setIsOpen(true));
  }, []);

  // S'exécute au rendu qui suit confirmClose : l'effet de sauvegarde de
  // useKanbanLogic (appelé plus tôt dans le même composant, donc exécuté
  // avant celui-ci) a alors déjà pris en compte le contenu de l'éditeur.
  useEffect(() => {
    if (!isClosing) return;
    const timeout = new Promise((resolve) => setTimeout(resolve, CLOSE_SAVE_TIMEOUT_MS));
    Promise.race([onPersist?.(), timeout]).finally(() => {
      window.electronAPI?.respondConfirmClose(true);
    });
    // Ne doit s'exécuter qu'une fois, au passage de isClosing à true.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClosing]);

  const confirmClose = () => {
    onBeforeClose?.();
    setIsOpen(false);
    setIsClosing(true);
  };

  const cancelClose = () => {
    window.electronAPI?.respondConfirmClose(false);
    setIsOpen(false);
  };

  return { isOpen, confirmClose, cancelClose };
}
