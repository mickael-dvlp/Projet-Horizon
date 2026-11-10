import { describe, expect, it } from "vitest";
import {
  splitContents,
  mergeContents,
  collectIds,
  planContentWrites,
  chunk,
  hasInlineContents,
} from "./contentStore";

const sample = () => ({
  projects: [{ id: "proj-1", name: "U" }],
  allData: {
    "sp-1": [
      {
        id: "col-1",
        title: "Arc",
        pages: [
          {
            id: "p-1",
            title: "Chap",
            content: "<p>texte</p>",
            tasks: [{ id: "task-1", label: "x", done: false }],
            scenes: [{ id: "scene-1", title: "Sc", content: "<p>scène</p>" }],
          },
        ],
      },
    ],
  },
  knowledgeBaseByProject: { "proj-1": [{ id: "kb-1", name: "f.md", content: "# Fiche" }] },
  trash: [
    {
      id: "col-9",
      trashId: "trash-1",
      originalType: "column",
      pages: [{ id: "p-9", title: "Supprimé", content: "<p>vieux</p>" }],
    },
  ],
  settings: { trashRetentionDays: 30, sidebarBg: null },
});

describe("splitContents / mergeContents", () => {
  it("extrait tous les textes, y compris dans les scènes, fiches et la corbeille", () => {
    const { main, contents } = splitContents(sample());
    expect(contents).toEqual({
      "p-1": "<p>texte</p>",
      "scene-1": "<p>scène</p>",
      "kb-1": "# Fiche",
      "p-9": "<p>vieux</p>",
    });
    expect(JSON.stringify(main)).not.toContain("content");
    expect(main.allData["sp-1"][0].pages[0].tasks).toEqual([{ id: "task-1", label: "x", done: false }]);
  });

  it("recompose exactement les données d'origine", () => {
    const data = sample();
    const { main, contents } = splitContents(data);
    expect(mergeContents(main, contents)).toEqual(data);
  });

  it("omet les valeurs undefined, refusées par Firestore", () => {
    const { main } = splitContents({ projects: [{ id: "p", name: "U", deadline: undefined }] });
    expect(main.projects[0]).toEqual({ id: "p", name: "U" });
  });

  it("conserve un texte encore stocké en ligne (ancien format)", () => {
    const merged = mergeContents({ pages: [{ id: "p-1", content: "en ligne" }] }, { "p-1": "séparé" });
    expect(merged.pages[0].content).toBe("en ligne");
  });

  it("laisse sans texte un élément dont le texte n'est pas (encore) connu", () => {
    const merged = mergeContents({ pages: [{ id: "p-2", title: "Nouveau" }] }, {});
    expect(merged.pages[0]).toEqual({ id: "p-2", title: "Nouveau" });
  });

  it("détecte l'ancien format à migrer", () => {
    expect(hasInlineContents(sample())).toBe(true);
    expect(hasInlineContents(splitContents(sample()).main)).toBe(false);
  });
});

describe("planContentWrites", () => {
  it("n'écrit que les textes nouveaux ou modifiés", () => {
    const { upserts } = planContentWrites(
      { a: "1", b: "2" },
      { a: "1", b: "2 modifié", c: "3" },
      new Set(["a", "b", "c"])
    );
    expect(upserts).toEqual([
      ["b", "2 modifié"],
      ["c", "3"],
    ]);
  });

  it("ne supprime un texte que si son élément a disparu", () => {
    const { deletes } = planContentWrites(
      { gone: "x", missing: "y" },
      {},
      new Set(["missing"])
    );
    expect(deletes).toEqual(["gone"]);
  });

  it("garde le texte d'un chapitre placé dans la corbeille", () => {
    const before = splitContents(sample());
    const data = sample();
    const page = data.allData["sp-1"][0].pages.pop();
    data.trash.push({ ...page, trashId: "trash-2", originalType: "page" });
    const after = splitContents(data);
    const { upserts, deletes } = planContentWrites(before.contents, after.contents, collectIds(after.main));
    expect(upserts).toEqual([]);
    expect(deletes).toEqual([]);
  });
});

describe("chunk", () => {
  it("découpe en paquets de taille maximale", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
  });
});
