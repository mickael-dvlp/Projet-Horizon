const { app, BrowserWindow, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const http = require("http");
const fs = require("fs");

// Port fixe (et non aléatoire) : Chromium isole le localStorage/IndexedDB par
// origine (protocole+hôte+port). Un port différent à chaque lancement — donc
// une origine différente — effaçait la session Firebase, le choix "invité"
// et les préférences locales à chaque redémarrage de l'app.
const APP_PORT = 47893;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
};

// L'export statique Next.js doit être servi via http (et non file://) pour
// que les chemins absolus des assets (/_next/...) se résolvent correctement.
function startStaticServer(rootDir, port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let urlPath = decodeURIComponent(req.url.split("?")[0]);
      // Tester le suffixe "/" sur le chemin d'URL (toujours en slashes) avant
      // de le joindre : path.join normalise en "\" sous Windows, ce qui
      // ferait échouer ce test s'il était fait après coup.
      if (urlPath.endsWith("/")) urlPath += "index.html";
      const filePath = path.join(rootDir, urlPath);
      if (!path.normalize(filePath).startsWith(path.normalize(rootDir))) {
        res.writeHead(403);
        res.end();
        return;
      }

      fs.readFile(filePath, (err, data) => {
        if (err) {
          // Pages Next.js exportées en <route>.html plutôt que <route>/index.html
          fs.readFile(`${filePath}.html`, (err2, data2) => {
            if (err2) {
              fs.readFile(path.join(rootDir, "404.html"), (err3, data3) => {
                res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
                res.end(err3 ? "Not found" : data3);
              });
              return;
            }
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            res.end(data2);
          });
          return;
        }
        const ext = path.extname(filePath);
        res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
        res.end(data);
      });
    });

    server.once("error", reject);
    server.listen(port, "localhost", () => resolve(server));
  });
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

async function createWindow(url) {
  closeConfirmed = false;
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

  mainWindow.on("close", (e) => {
    if (closeConfirmed) return;
    e.preventDefault();
    mainWindow.webContents.send("app:confirm-close");
  });

  await mainWindow.loadURL(url);
}

ipcMain.on("app:confirm-close-response", (_event, confirmed) => {
  if (confirmed && mainWindow && !mainWindow.isDestroyed()) {
    closeConfirmed = true;
    mainWindow.close();
  }
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
