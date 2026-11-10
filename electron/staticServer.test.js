// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const { startStaticServer, isInside } = require("./staticServer.js");

let tmpDir;
let rootDir;
let server;
let port;

// Requête brute (sans normalisation d'URL côté client), avec en-tête Host
// configurable.
function get(rawPath, host = `localhost:${port}`) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: "localhost", port, path: rawPath, method: "GET", headers: { Host: host } },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
      }
    );
    req.on("error", reject);
    req.end();
  });
}

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "horizon-static-"));
  rootDir = path.join(tmpDir, "out");
  fs.mkdirSync(rootDir);
  fs.writeFileSync(path.join(rootDir, "index.html"), "<p>accueil</p>");
  fs.writeFileSync(path.join(rootDir, "404.html"), "<p>introuvable</p>");
  // Dossier voisin dont le nom commence comme le dossier servi.
  fs.mkdirSync(path.join(tmpDir, "out-secret"));
  fs.writeFileSync(path.join(tmpDir, "out-secret", "secret.txt"), "secret");

  server = await startStaticServer(rootDir, 0);
  port = server.address().port;
});

afterAll(() => {
  server?.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("serveur statique Electron", () => {
  it("sert la page d'accueil avec une politique CSP", async () => {
    const res = await get("/");
    expect(res.status).toBe(200);
    expect(res.body).toContain("accueil");
    const csp =
      res.headers["content-security-policy"] || res.headers["content-security-policy-report-only"];
    expect(csp).toContain("default-src 'self'");
  });

  it("répond 400 à une URL mal encodée au lieu de planter", async () => {
    expect((await get("/%")).status).toBe(400);
    expect((await get("/%E0%A4%A")).status).toBe(400);
  });

  it("répond 400 à un octet nul", async () => {
    expect((await get("/index.html%00")).status).toBe(400);
  });

  it("refuse de sortir du dossier servi, y compris vers un dossier voisin", async () => {
    expect((await get("/..%2fout-secret%2fsecret.txt")).status).toBe(403);
    expect((await get("/..%2f..%2fetc%2fpasswd")).status).toBe(403);
  });

  it("refuse un en-tête Host étranger (DNS rebinding)", async () => {
    expect((await get("/", `attacker.example:${port}`)).status).toBe(403);
  });

  it("renvoie la page 404 pour un fichier absent", async () => {
    const res = await get("/absent.js");
    expect(res.status).toBe(404);
    expect(res.body).toContain("introuvable");
  });
});

describe("isInside", () => {
  it("distingue un dossier voisin au nom proche", () => {
    const root = path.join(os.tmpdir(), "out");
    expect(isInside(root, path.join(root, "a", "b.js"))).toBe(true);
    expect(isInside(root, path.join(os.tmpdir(), "out-secret", "x"))).toBe(false);
    expect(isInside(root, path.join(root, "..", "x"))).toBe(false);
  });
});
