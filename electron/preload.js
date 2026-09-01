const { contextBridge, ipcRenderer } = require("electron");

// Pont exposé au renderer (contextIsolation actif : pas d'accès direct à
// ipcRenderer/Node depuis le code de l'app) — surface volontairement réduite
// aux seules actions nécessaires à la mise à jour manuelle et à la
// confirmation de fermeture.
contextBridge.exposeInMainWorld("electronAPI", {
  getAppVersion: () => ipcRenderer.invoke("app:get-version"),
  checkForUpdates: () => ipcRenderer.invoke("updater:check"),
  quitAndInstall: () => ipcRenderer.send("updater:quit-and-install"),
  onUpdateStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on("updater:status", listener);
    return () => ipcRenderer.removeListener("updater:status", listener);
  },
  onConfirmClose: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("app:confirm-close", listener);
    return () => ipcRenderer.removeListener("app:confirm-close", listener);
  },
  respondConfirmClose: (confirmed) => ipcRenderer.send("app:confirm-close-response", confirmed),
});
