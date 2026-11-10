const path = require("path");
const http = require("http");
const fs = require("fs");

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

// Politique de sécurité du contenu des pages servies. 'unsafe-inline' est
// requis par les scripts inline de l'export statique Next.js ; les autres
// directives limitent les échanges aux services Firebase/Google utilisés
// (Firestore, Auth et sa fenêtre de connexion, avatars Google).
//
// Envoyée en mode "Report-Only" tant qu'elle n'a pas été validée avec une
// vraie connexion Google : les violations s'affichent dans la console des
// DevTools sans rien bloquer. Une fois la console propre, passer
// CSP_ENFORCE à true. Seule violation attendue (mode invité vérifié) :
// "Evaluating a string as JavaScript", émise par le paquet
// is-generator-function qui teste `Function(...)` dans un try/catch avec
// repli — sans conséquence, ne pas ajouter 'unsafe-eval' pour elle.
const CSP_ENFORCE = false;
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://apis.google.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.googleusercontent.com https://www.gstatic.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.googleapis.com https://*.firebaseapp.com https://apis.google.com",
  "frame-src https://*.firebaseapp.com https://*.web.app https://accounts.google.com https://apis.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const HTML_HEADERS = {
  "Content-Type": MIME_TYPES[".html"],
  [CSP_ENFORCE ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only"]:
    CONTENT_SECURITY_POLICY,
};

// Vrai si `filePath` est situé dans `rootDir` (et pas dans un dossier
// voisin dont le nom commence pareil, ex. "out-backup" pour "out").
function isInside(rootDir, filePath) {
  const rel = path.relative(rootDir, filePath);
  return !path.isAbsolute(rel) && rel.split(path.sep)[0] !== "..";
}

// Refuse les requêtes adressées sous un autre nom d'hôte que localhost :
// protège contre le DNS rebinding (un site tiers qui ferait pointer son
// propre domaine vers 127.0.0.1 pour lire les réponses de ce serveur).
function isAllowedHost(hostHeader, port) {
  return hostHeader === `localhost:${port}` || hostHeader === `127.0.0.1:${port}`;
}

function reject(res, status) {
  res.writeHead(status);
  res.end();
}

// L'export statique Next.js doit être servi via http (et non file://) pour
// que les chemins absolus des assets (/_next/...) se résolvent correctement.
function startStaticServer(rootDir, port) {
  return new Promise((resolve, reject_) => {
    const server = http.createServer((req, res) => {
      if (!isAllowedHost(req.headers.host, server.address().port)) return reject(res, 403);

      // Toute URL mal encodée (ex. "/%") ou contenant un octet nul est
      // refusée : decodeURIComponent et fs lèveraient sinon une exception
      // non rattrapée dans le processus principal.
      let urlPath;
      try {
        urlPath = decodeURIComponent(req.url.split("?")[0]);
      } catch {
        return reject(res, 400);
      }
      if (urlPath.includes("\0")) return reject(res, 400);

      // Tester le suffixe "/" sur le chemin d'URL (toujours en slashes) avant
      // de le joindre : path.join normalise en "\" sous Windows, ce qui
      // ferait échouer ce test s'il était fait après coup.
      if (urlPath.endsWith("/")) urlPath += "index.html";
      const filePath = path.join(rootDir, urlPath);
      if (!isInside(rootDir, filePath)) return reject(res, 403);

      fs.readFile(filePath, (err, data) => {
        if (err) {
          // Pages Next.js exportées en <route>.html plutôt que <route>/index.html
          fs.readFile(`${filePath}.html`, (err2, data2) => {
            if (err2) {
              fs.readFile(path.join(rootDir, "404.html"), (err3, data3) => {
                res.writeHead(404, HTML_HEADERS);
                res.end(err3 ? "Not found" : data3);
              });
              return;
            }
            res.writeHead(200, HTML_HEADERS);
            res.end(data2);
          });
          return;
        }
        const ext = path.extname(filePath);
        res.writeHead(
          200,
          ext === ".html"
            ? HTML_HEADERS
            : { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" }
        );
        res.end(data);
      });
    });

    server.once("error", reject_);
    server.listen(port, "localhost", () => resolve(server));
  });
}

module.exports = { startStaticServer, isInside, isAllowedHost };
