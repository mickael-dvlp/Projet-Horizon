const { app, BrowserWindow, ipcMain, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const { startStaticServer } = require("./staticServer");

// Port fixe (et non aléatoire) : Chromium isole le localStorage/IndexedDB par
// origine (protocole+hôte+port). Un port différent à chaque lancement — donc
// une origine différente — effaçait la session Firebase, le choix "invité"
// et les préférences locales à chaque redémarrage de l'app.
const APP_PORT = 47893;

// Délai pour que la page accuse réception d'une demande de fermeture. Sans
// accusé (page plantée, figée, ou page d'erreur sans la modale), la fenêtre
// se ferme directement au lieu de rester impossible à fermer.
const CLOSE_ACK_TIMEOUT_MS = 1500;

// Seules fenêtres que l'app a le droit d'ouvrir elle-même : la fenêtre de
// connexion Google de Firebase Auth (signInWithPopup).
function isAuthPopupUrl(target) {
  if (target === "about:blank") return true;
  try {
    const { protocol, hostname } = new URL(target);
    return (
      protocol === "https:" &&
      (hostname.endsWith(".firebaseapp.com") ||
        hostname.endsWith(".web.app") ||
        hostname === "accounts.google.com")
    );
  } catch {
    return false;
  }
}

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

let server;
let mainWindow;
// Confirmation avant fermeture (protection anti-clic malencontreux sur la
// croix — couvre aussi Alt+F4, qui déclenche le même évènement "close").
// Affichée par le renderer lui-même (modale Tailwind cohérente avec le
// reste de l'app) plutôt qu'une boîte système, via un aller-retour IPC :
// le processus principal bloque la fermeture, demande confirmation à la
// page, et n'autorise réellement la fermeture qu'à sa réponse.
let closeConfirmed = false;
let closeAckTimer = null;

function forceClose() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  closeConfirmed = true;
  mainWindow.close();
}

async function createWindow(url) {
  closeConfirmed = false;
  const appOrigin = originOf(url);
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    autoHideMenuBar: true,
    backgroundColor: "#f8fafc",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Popups : uniquement la connexion Google ; tout autre lien http(s) part
  // dans le navigateur par défaut, le reste est refusé.
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    if (isAuthPopupUrl(target)) return { action: "allow" };
    if (/^https?:\/\//i.test(target)) shell.openExternal(target);
    return { action: "deny" };
  });

  // La fenêtre principale ne quitte jamais l'app (elle a accès au preload).
  mainWindow.webContents.on("will-navigate", (event) => {
    if (originOf(event.url) !== appOrigin) event.preventDefault();
  });

  mainWindow.on("close", (e) => {
    if (closeConfirmed || mainWindow.webContents.isCrashed()) return;
    e.preventDefault();
    if (closeAckTimer) return;
    mainWindow.webContents.send("app:confirm-close");
    closeAckTimer = setTimeout(() => {
      closeAckTimer = null;
      forceClose();
    }, CLOSE_ACK_TIMEOUT_MS);
  });

  await mainWindow.loadURL(url);
}

const isFromMainWindow = (event) =>
  !!mainWindow && !mainWindow.isDestroyed() && event.sender === mainWindow.webContents;

// La page a bien reçu la demande et affiche la confirmation : on attend
// désormais la décision de l'utilisateur, sans limite de temps.
ipcMain.on("app:confirm-close-ack", (event) => {
  if (!isFromMainWindow(event)) return;
  clearTimeout(closeAckTimer);
  closeAckTimer = null;
});

ipcMain.on("app:confirm-close-response", (event, confirmed) => {
  if (!isFromMainWindow(event)) return;
  if (confirmed) forceClose();
});

function sendUpdateStatus(status) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("updater:status", status);
  }
}

autoUpdater.on("checking-for-update", () => sendUpdateStatus({ state: "checking" }));
autoUpdater.on("update-available", (info) => sendUpdateStatus({ state: "available", version: info.version }));
autoUpdater.on("update-not-available", () => sendUpdateStatus({ state: "not-available" }));
autoUpdater.on("download-progress", (progress) =>
  sendUpdateStatus({ state: "downloading", percent: Math.round(progress.percent) })
);
autoUpdater.on("update-downloaded", (info) => sendUpdateStatus({ state: "downloaded", version: info.version }));
autoUpdater.on("error", (err) => sendUpdateStatus({ state: "error", message: err?.message || String(err) }));

// Déclenché par le bouton "Vérifier les mises à jour" des Paramètres — le
// résultat (trouvée/absente/erreur) arrive de façon asynchrone via les
// évènements autoUpdater ci-dessus, relayés par sendUpdateStatus.
ipcMain.handle("app:get-version", () => app.getVersion());

ipcMain.handle("updater:check", async () => {
  if (!app.isPackaged) return { state: "unavailable" };
  try {
    await autoUpdater.checkForUpdates();
    return { state: "ok" };
  } catch (err) {
    return { state: "error", message: err?.message || String(err) };
  }
});

ipcMain.on("updater:quit-and-install", () => {
  // L'utilisateur a déjà donné son accord explicite en cliquant sur
  // "Redémarrer et installer" — la confirmation de fermeture ne doit pas se
  // déclencher une seconde fois pour cette fermeture-là.
  closeConfirmed = true;
  autoUpdater.quitAndInstall();
});

// Une seule instance à la fois : une deuxième ne pourrait pas se lier sur
// APP_PORT (déjà pris par la première) et retomberait sur un port aléatoire,
// avec un stockage local vide/déconnecté de l'instance principale — source
// de confusion ("mes données ont disparu") plutôt qu'une vraie limitation.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    // ELECTRON_START_URL permet de pointer vers `next dev` (localhost:3000)
    // pendant le développement, sans passer par l'export statique.
    const devUrl = process.env.ELECTRON_START_URL;

    let url = devUrl;
    if (!url) {
      const outDir = app.isPackaged
        ? path.join(process.resourcesPath, "out")
        : path.join(__dirname, "..", "out");
      try {
        server = await startStaticServer(outDir, APP_PORT);
      } catch (err) {
        if (err.code !== "EADDRINUSE") throw err;
        // Port fixe déjà occupé par autre chose que cette app (rare, le verrou
        // mono-instance couvre déjà le cas d'un second lancement de l'app) :
        // on démarre quand même, avec un port aléatoire en dernier recours.
        server = await startStaticServer(outDir, 0);
      }
      url = `http://localhost:${server.address().port}/`;
    }

    await createWindow(url);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow(url);
    });

    // Uniquement sur une build installée (releases GitHub) : en dev, il n'y a
    // ni version packagée ni artefacts de mise à jour à comparer.
    if (app.isPackaged) {
      autoUpdater.checkForUpdatesAndNotify().catch(() => {});
    }
  });

  app.on("window-all-closed", () => {
    server?.close();
    if (process.platform !== "darwin") app.quit();
  });
}
