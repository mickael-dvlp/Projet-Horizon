"use client";
import { useEffect, useState } from "react";

// Le processus principal Electron (electron/main.js) intercepte la fermeture
// de la fenêtre et attend une réponse via IPC avant de fermer pour de vrai —
// ce hook affiche la confirmation côté renderer (modale Tailwind cohérente
// avec le reste de l'app) et relaie la décision. Inerte hors d'Electron
// (pas de window.electronAPI dans un navigateur classique).
export function useElectronCloseConfirm() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!window.electronAPI?.onConfirmClose) return;
    return window.electronAPI.onConfirmClose(() => setIsOpen(true));
  }, []);

  const confirmClose = () => {
    window.electronAPI?.respondConfirmClose(true);
    setIsOpen(false);
  };

  const cancelClose = () => {
    window.electronAPI?.respondConfirmClose(false);
    setIsOpen(false);
  };

  return { isOpen, confirmClose, cancelClose };
}
