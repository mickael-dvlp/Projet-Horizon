import { describe, expect, it } from "vitest";
import { restoreTrashItem } from "./trashRestore";

const baseState = () => ({
  projects: [{ id: "proj-1", name: "Univers" }],
  subProjects: { "proj-1": [{ id: "sp-1", name: "Livre 1" }] },
  allProjectsData: {
    "sp-1": [{ id: "col-1", title: "Arc 1", color: "indigo", pages: [{ id: "p-1", title: "Existant" }] }],
  },
  knowledgeBaseByProject: { "proj-1": [] },
  activeProjectId: "proj-1",
  activeSubProjectId: "sp-1",
});

const trashed = (fields) => ({ trashId: "trash-1", deletedAt: "2026-01-01T00:00:00.000Z", ...fields });

describe("restoreTrashItem", () => {
  it("restaure un chapitre en tête de son arc d'origine", () => {
    const item = trashed({
      id: "p-2", title: "Supprimé", columnId: "col-1",
      originalType: "page", projectId: "proj-1", subProjectId: "sp-1",
    });
    const result = restoreTrashItem(baseState(), item);
    expect(result.restored).toBe(true);
    expect(result.changes.allProjectsData["sp-1"][0].pages.map((p) => p.id)).toEqual(["p-2", "p-1"]);
    expect(result.changes.allProjectsData["sp-1"][0].pages[0]).not.toHaveProperty("columnId");
  });

  it("recrée un arc quand le livre n'en a plus aucun", () => {
    const state = { ...baseState(), allProjectsData: { "sp-1": [] } };
    const item = trashed({
      id: "p-2", title: "Supprimé", columnId: "col-1",
      originalType: "page", projectId: "proj-1", subProjectId: "sp-1",
    });
    const result = restoreTrashItem(state, item);
    expect(result.restored).toBe(true);
    const cols = result.changes.allProjectsData["sp-1"];
    expect(cols).toHaveLength(1);
    expect(cols[0].pages.map((p) => p.id)).toEqual(["p-2"]);
  });

  it("retombe sur le livre actif quand le livre d'origine n'existe plus", () => {
    const item = trashed({
      id: "col-9", title: "Arc", pages: [],
      originalType: "column", projectId: "proj-x", subProjectId: "sp-disparu",
    });
    const result = restoreTrashItem(baseState(), item);
    expect(result.restored).toBe(true);
    expect(result.changes.allProjectsData["sp-1"].map((c) => c.id)).toEqual(["col-1", "col-9"]);
  });

  it("refuse (sans rien modifier) quand aucun livre n'est disponible", () => {
    const state = { ...baseState(), activeSubProjectId: null };
    const item = trashed({
      id: "p-2", title: "Supprimé", originalType: "page", projectId: "proj-x", subProjectId: "sp-disparu",
    });
    const result = restoreTrashItem(state, item);
    expect(result.restored).toBe(false);
    expect(result.reason).toMatch(/livre/);
  });

  it("refuse la restauration d'un livre quand aucun univers n'existe", () => {
    const state = { ...baseState(), projects: [], activeProjectId: null };
    const item = trashed({
      id: "sp-2", name: "Livre 2", allProjectsData: [], originalType: "subProject", projectId: "proj-disparu",
    });
    expect(restoreTrashItem(state, item).restored).toBe(false);
  });

  it("refuse la restauration d'une fiche quand aucun univers n'existe", () => {
    const state = { ...baseState(), projects: [], activeProjectId: null };
    const item = trashed({ id: "kb-1", name: "fiche.md", originalType: "kbFile", projectId: "proj-disparu" });
    expect(restoreTrashItem(state, item).restored).toBe(false);
  });

  it("restaure un livre avec ses arcs dans son univers d'origine", () => {
    const cols = [{ id: "col-7", title: "Arc", pages: [] }];
    const item = trashed({
      id: "sp-2", name: "Livre 2", allProjectsData: cols, originalType: "subProject", projectId: "proj-1",
    });
    const result = restoreTrashItem(baseState(), item);
    expect(result.changes.subProjects["proj-1"].map((s) => s.id)).toEqual(["sp-1", "sp-2"]);
    expect(result.changes.subProjects["proj-1"][1]).not.toHaveProperty("allProjectsData");
    expect(result.changes.allProjectsData["sp-2"]).toEqual(cols);
  });

  it("régénère l'id d'un univers restauré s'il entre en collision", () => {
    const item = trashed({
      id: "proj-1", name: "Doublon", subProjects: [], allProjectsData: {}, knowledgeBaseByProject: [],
      originalType: "project",
    });
    const result = restoreTrashItem(baseState(), item);
    const restored = result.changes.projects[1];
    expect(restored.name).toBe("Doublon");
    expect(restored.id).not.toBe("proj-1");
  });

  it("remet une scène à sa place dans son chapitre, même déplacé dans un autre arc", () => {
    const state = {
      ...baseState(),
      allProjectsData: {
        "sp-1": [
          { id: "col-1", title: "Arc 1", pages: [] },
          { id: "col-2", title: "Arc 2", pages: [{ id: "p-1", title: "Chap", scenes: [{ id: "s-1" }, { id: "s-3" }] }] },
        ],
      },
    };
    const item = trashed({
      id: "s-2", title: "Scène", content: "texte", pageId: "p-1", sceneIndex: 1,
      originalType: "scene", projectId: "proj-1", subProjectId: "sp-1",
    });
    const result = restoreTrashItem(state, item);
    expect(result.restored).toBe(true);
    expect(result.notice).toBeUndefined();
    const scenes = result.changes.allProjectsData["sp-1"][1].pages[0].scenes;
    expect(scenes.map((s) => s.id)).toEqual(["s-1", "s-2", "s-3"]);
    expect(scenes[1]).toEqual({ id: "s-2", title: "Scène", content: "texte" });
  });

  it("refuse une scène dont le chapitre est en corbeille, en nommant l'élément à restaurer d'abord", () => {
    const state = {
      ...baseState(),
      trash: [
        trashed({
          trashId: "trash-0", id: "col-9", title: "Arc supprimé", originalType: "column",
          pages: [{ id: "p-9", title: "Chap" }],
        }),
      ],
    };
    const item = trashed({
      id: "s-1", title: "Scène", pageId: "p-9", originalType: "scene", projectId: "proj-1", subProjectId: "sp-1",
    });
    const result = restoreTrashItem(state, item);
    expect(result.restored).toBe(false);
    expect(result.reason).toContain("« Arc supprimé »");
  });

  it("restaure comme chapitre une scène dont le chapitre a été supprimé définitivement", () => {
    const item = trashed({
      id: "s-1", title: "Scène", content: "texte", pageId: "p-disparu", sceneIndex: 0,
      originalType: "scene", projectId: "proj-1", subProjectId: "sp-1",
    });
    const result = restoreTrashItem(baseState(), item);
    expect(result.restored).toBe(true);
    expect(result.notice).toMatch(/comme chapitre/);
    expect(result.changes.allProjectsData["sp-1"][0].pages[0]).toEqual({ id: "s-1", title: "Scène", content: "texte" });
  });
});
