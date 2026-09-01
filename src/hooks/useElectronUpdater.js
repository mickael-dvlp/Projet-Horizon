"use client";
import { useCallback, useEffect, useState } from "react";

// `window.electronAPI` n'existe que dans l'app Electron (exposé par
// electron/preload.js) — absent dans un navigateur classique, où ce hook
// reste inerte (isElectron: false).
export function useElectronUpdater() {
  const [isElectron, setIsElectron] = useState(false);
  const [status, setStatus] = useState({ state: "idle" });

  useEffect(() => {
    if (!window.electronAPI) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsElectron(true);
    return window.electronAPI.onUpdateStatus(setStatus);
  }, []);

  const checkForUpdates = useCallback(async () => {
    if (!window.electronAPI) return;
    setStatus({ state: "checking" });
    const result = await window.electronAPI.checkForUpdates();
    // En dev (pas de build packagée) : aucun évènement autoUpdater ne suivra,
    // donc c'est ce retour direct qui doit informer l'interface.
    if (result?.state === "unavailable" || result?.state === "error") {
      setStatus(result);
    }
  }, []);

  const quitAndInstall = useCallback(() => {
    window.electronAPI?.quitAndInstall();
  }, []);

  return { isElectron, status, checkForUpdates, quitAndInstall };
}
