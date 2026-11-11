import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";

// --- Faux Firestore en mémoire -------------------------------------------
// Simule ce dont la synchronisation dépend : documents, écoutes temps réel
// (premier instantané, puis instantanés locaux "en attente" après nos propres
// écritures, et instantanés serveur pour les changements d'un autre
// appareil), écritures groupées, et mode hors-ligne d'un appareil jamais
// synchronisé (instantanés "du cache", vides).
const fake = vi.hoisted(() => {
  const state = {
    docs: new Map(),
    listeners: new Set(),
    log: [],
    authCallback: null,
    online: true,
  };

  const snapshotFor = (ref, pending) => {
    const source = state.online ? state.docs : new Map();
    const metadata = { hasPendingWrites: pending, fromCache: !state.online };
    if (ref.isCollection) {
      const prefix = `${ref.path}/`;
      const docs = [...source]
        .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes("/"))
        .map(([path, data]) => ({ id: path.slice(prefix.length), data: () => data }));
      return { docs, metadata };
    }
    const data = source.get(ref.path);
    return { exists: () => data !== undefined, data: () => data, metadata };
  };

  const resultKey = (snapshot) =>
    snapshot.docs
      ? JSON.stringify(snapshot.docs.map((d) => [d.id, d.data()]).sort())
      : JSON.stringify(snapshot.exists() ? snapshot.data() : "<absent>");

  const metadataKey = (snapshot) => `${snapshot.metadata.fromCache}|${snapshot.metadata.hasPendingWrites}`;

  // Comme le vrai SDK : une écoute n'est notifiée que si SES résultats ont
  // changé — ou, avec includeMetadataChanges, leurs métadonnées.
  const deliver = (listener, pending) => {
    const snapshot = snapshotFor(listener.ref, pending);
    const key = resultKey(snapshot);
    const meta = metadataKey(snapshot);
    const metadataChanged = listener.includeMetadataChanges && meta !== listener.lastMeta;
    if (key === listener.lastKey && !metadataChanged) return;
    listener.lastKey = key;
    listener.lastMeta = meta;
    listener.onNext(snapshot);
  };

  const notify = (pending) => {
    for (const listener of state.listeners) deliver(listener, pending);
  };

  const firestore = {
    doc: (_db, ...segments) => ({ path: segments.join("/"), isCollection: false }),
    collection: (_db, ...segments) => ({ path: segments.join("/"), isCollection: true }),
    onSnapshot: (ref, ...args) => {
      const options = typeof args[0] === "object" ? args.shift() : {};
      const listener = {
        ref,
        onNext: args[0],
        includeMetadataChanges: !!options.includeMetadataChanges,
        lastKey: undefined,
        lastMeta: undefined,
      };
      state.listeners.add(listener);
      queueMicrotask(() => deliver(listener, false));
      return () => state.listeners.delete(listener);
    },
    writeBatch: () => {
      const ops = [];
      return {
        set: (ref, data) => ops.push({ type: "set", path: ref.path, data: structuredClone(data) }),
        delete: (ref) => ops.push({ type: "delete", path: ref.path }),
        commit: () => {
          for (const op of ops) {
            if (op.type === "set") state.docs.set(op.path, op.data);
            else state.docs.delete(op.path);
            state.log.push(op);
          }
          queueMicrotask(() => notify(true));
          return Promise.resolve();
        },
      };
    },
    waitForPendingWrites: () => Promise.resolve(),
    terminate: () => Promise.resolve(),
    clearIndexedDbPersistence: () => Promise.resolve(),
  };

  // Modification faite par un autre appareil, confirmée par le serveur.
  const remoteWrite = (changes) => {
    for (const [path, data] of Object.entries(changes)) {
      if (data === null) state.docs.delete(path);
      else state.docs.set(path, structuredClone(data));
    }
    notify(false);
  };

  // Retour (ou perte) de la connexion : les écoutes reçoivent l'état du
  // serveur (ou du cache vide).
  const setOnline = (online) => {
    state.online = online;
    notify(false);
  };

  return { state, firestore, remoteWrite, setOnline };
});

vi.mock("@/firebase/config", () => ({ auth: {}, db: {}, googleProvider: {} }));
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth, callback) => {
    fake.state.authCallback = callback;
    return () => {};
  },
  signOut: vi.fn(() => Promise.resolve()),
  deleteUser: vi.fn(() => Promise.resolve()),
  reauthenticateWithPopup: vi.fn(() => Promise.resolve()),
}));
vi.mock("firebase/firestore", () => fake.firestore);

const { useKanbanLogic } = await import("./useKanbanLogic");

// --- Outillage ---------------------------------------------------------------
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root;
let container;
let logic;

function Harness() {
  logic = useKanbanLogic({ confirm: async () => true });
  return null;
}

const wait = (ms) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));
const SAVE_DELAY = 600; // > debounce de 500 ms

async function signIn(uid = "u1") {
  await act(async () => {
    fake.state.authCallback({ uid });
  });
  await wait(0);
}

const contentPath = (id) => `users/u1/contents/${id}`;
const pageOf = (id) => logic.columns.flatMap((c) => c.pages).find((p) => p.id === id);

const structure = (pages) => ({
  schemaVersion: 2,
  projects: [{ id: "proj-1", name: "Univers" }],
  subProjects: { "proj-1": [{ id: "sp-1", name: "Livre" }] },
  allData: { "sp-1": [{ id: "col-1", title: "Arc", color: "indigo", pages }] },
  knowledgeBaseByProject: { "proj-1": [] },
  arcsByProject: {},
  trash: [],
  settings: { trashRetentionDays: null, sidebarBg: null, mainBg: null },
  lastActive: { projectId: "proj-1", subProjectId: "sp-1" },
});

beforeEach(async () => {
  fake.state.docs.clear();
  fake.state.listeners.clear();
  fake.state.log.length = 0;
  fake.state.online = true;
  localStorage.clear();
  container = document.createElement("div");
  root = createRoot(container);
  await act(async () => {
    root.render(<Harness />);
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
});

// --- Scénarios ---------------------------------------------------------------
describe("synchronisation Firestore (textes stockés séparément)", () => {
  it("migre un ancien document aux textes en ligne vers des documents séparés", async () => {
    const legacy = structure([{ id: "p-1", title: "Chap", content: "<p>texte</p>" }]);
    delete legacy.schemaVersion;
    fake.state.docs.set("users/u1", legacy);

    await signIn();
    expect(pageOf("p-1").content).toBe("<p>texte</p>");

    await wait(SAVE_DELAY);
    expect(fake.state.docs.get(contentPath("p-1"))).toEqual({ content: "<p>texte</p>" });
    const main = fake.state.docs.get("users/u1");
    expect(main.schemaVersion).toBe(2);
    expect(JSON.stringify(main)).not.toContain("<p>texte</p>");
  });

  it("recompose les textes au chargement d'un document au nouveau format", async () => {
    fake.state.docs.set("users/u1", structure([{ id: "p-1", title: "Chap" }]));
    fake.state.docs.set(contentPath("p-1"), { content: "<p>séparé</p>" });

    await signIn();
    expect(pageOf("p-1").content).toBe("<p>séparé</p>");
  });

  it("ne réécrit que le texte du chapitre modifié", async () => {
    fake.state.docs.set("users/u1", structure([{ id: "p-1", title: "Un" }, { id: "p-2", title: "Deux" }]));
    fake.state.docs.set(contentPath("p-1"), { content: "un" });
    fake.state.docs.set(contentPath("p-2"), { content: "deux" });
    await signIn();

    await act(async () => logic.handleSavePage("p-1", { content: "un modifié" }));
    await wait(SAVE_DELAY);

    const contentWrites = fake.state.log.filter((op) => op.path.includes("/contents/"));
    expect(contentWrites).toEqual([{ type: "set", path: contentPath("p-1"), data: { content: "un modifié" } }]);
    expect(fake.state.docs.get(contentPath("p-2"))).toEqual({ content: "deux" });
  });

  it("garde le texte d'un chapitre en corbeille et le supprime à la suppression définitive", async () => {
    fake.state.docs.set("users/u1", structure([{ id: "p-1", title: "Un" }]));
    fake.state.docs.set(contentPath("p-1"), { content: "un" });
    await signIn();

    await act(async () => logic.deletePage("p-1"));
    await wait(SAVE_DELAY);
    expect(fake.state.docs.get(contentPath("p-1"))).toEqual({ content: "un" });
    expect(logic.trashItems[0].content).toBe("un");

    await act(async () => logic.removeFromTrash(logic.trashItems[0].trashId));
    await wait(SAVE_DELAY);
    expect(fake.state.docs.has(contentPath("p-1"))).toBe(false);
  });

  it("garde le texte d'une scène en corbeille et la remet dans son chapitre", async () => {
    fake.state.docs.set("users/u1", structure([{ id: "p-1", title: "Un", scenes: [{ id: "s-1", title: "Scène" }] }]));
    fake.state.docs.set(contentPath("s-1"), { content: "texte de scène" });
    await signIn();

    await act(async () => logic.deleteScene("p-1", "s-1"));
    await wait(SAVE_DELAY);
    expect(pageOf("p-1").scenes).toEqual([]);
    expect(logic.trashItems[0]).toMatchObject({ originalType: "scene", pageId: "p-1", content: "texte de scène" });
    expect(fake.state.docs.get(contentPath("s-1"))).toEqual({ content: "texte de scène" });

    await act(async () => logic.handleRestore(logic.trashItems[0]));
    expect(pageOf("p-1").scenes.map((s) => [s.id, s.content])).toEqual([["s-1", "texte de scène"]]);
    expect(logic.trashItems).toEqual([]);
  });

  it("applique un texte modifié sur un autre appareil sans rien réécrire", async () => {
    fake.state.docs.set("users/u1", structure([{ id: "p-1", title: "Un" }]));
    fake.state.docs.set(contentPath("p-1"), { content: "un" });
    await signIn();
    fake.state.log.length = 0;

    await act(async () => fake.remoteWrite({ [contentPath("p-1")]: { content: "modifié ailleurs" } }));
    expect(pageOf("p-1").content).toBe("modifié ailleurs");

    await wait(SAVE_DELAY);
    expect(fake.state.log).toEqual([]);
  });

  it("une structure reçue avant son texte ne fait supprimer aucun texte", async () => {
    fake.state.docs.set("users/u1", structure([{ id: "p-1", title: "Un" }]));
    fake.state.docs.set(contentPath("p-1"), { content: "un" });
    await signIn();

    // Un autre appareil ajoute un chapitre : sa structure arrive d'abord.
    await act(async () =>
      fake.remoteWrite({ "users/u1": structure([{ id: "p-1", title: "Un" }, { id: "p-2", title: "Deux" }]) })
    );
    expect(pageOf("p-2")).toBeDefined();
    expect(pageOf("p-2").content).toBeUndefined();

    // Modification locale pendant que le texte de p-2 n'est pas encore là.
    await act(async () => logic.handleSavePage("p-1", { status: "done" }));
    await wait(SAVE_DELAY);
    expect(fake.state.log.some((op) => op.type === "delete")).toBe(false);

    // Le texte arrive ensuite et s'affiche.
    await act(async () => fake.remoteWrite({ [contentPath("p-2")]: { content: "deux" } }));
    expect(pageOf("p-2").content).toBe("deux");
  });

  it("un changement distant reçu après une sauvegarde locale ne ramène pas l'ancien texte", async () => {
    fake.state.docs.set("users/u1", structure([{ id: "p-1", title: "Un" }]));
    fake.state.docs.set(contentPath("p-1"), { content: "un" });
    await signIn();

    await act(async () => logic.handleSavePage("p-1", { content: "local enregistré" }));
    await wait(SAVE_DELAY);
    await act(async () =>
      fake.remoteWrite({ "users/u1": { ...structure([{ id: "p-1", title: "Un" }]), settings: { trashRetentionDays: 7 } } })
    );

    expect(logic.settings.trashRetentionDays).toBe(7);
    expect(pageOf("p-1").content).toBe("local enregistré");
  });

  it("une modification locale en attente n'est pas écrasée par un changement distant", async () => {
    fake.state.docs.set("users/u1", structure([{ id: "p-1", title: "Un" }]));
    fake.state.docs.set(contentPath("p-1"), { content: "un" });
    await signIn();

    await act(async () => logic.handleSavePage("p-1", { content: "local" }));
    // Changement distant reçu pendant le debounce de la sauvegarde locale.
    await act(async () =>
      fake.remoteWrite({ "users/u1": { ...structure([{ id: "p-1", title: "Un" }]), settings: { trashRetentionDays: 7 } } })
    );
    await wait(SAVE_DELAY);

    expect(pageOf("p-1").content).toBe("local");
    expect(fake.state.docs.get(contentPath("p-1"))).toEqual({ content: "local" });
  });

  it("hors-ligne sur un appareil jamais synchronisé, attend le serveur au lieu d'ouvrir un compte vide", async () => {
    fake.state.docs.set("users/u1", structure([{ id: "p-1", title: "Un" }]));
    fake.state.docs.set(contentPath("p-1"), { content: "un" });
    fake.state.online = false;
    await signIn();
    expect(logic.awaitingServer).toBe(true);
    expect(logic.loading).toBe(true);

    await wait(SAVE_DELAY);
    expect(fake.state.log).toEqual([]);

    await act(async () => fake.setOnline(true));
    expect(logic.awaitingServer).toBe(false);
    expect(logic.loading).toBe(false);
    expect(pageOf("p-1").content).toBe("un");
    await wait(SAVE_DELAY);
    expect(fake.state.log).toEqual([]);
  });

  it("hors-ligne, un nouveau compte s'ouvre une fois l'absence de données confirmée par le serveur", async () => {
    fake.state.online = false;
    await signIn();
    expect(logic.awaitingServer).toBe(true);

    // Le serveur confirme l'absence de document : seules les métadonnées
    // changent, les écoutes principales ne sont pas notifiées.
    await act(async () => fake.setOnline(true));
    expect(logic.awaitingServer).toBe(false);
    expect(logic.loading).toBe(false);
    expect(logic.projects).toEqual([]);
  });
});
