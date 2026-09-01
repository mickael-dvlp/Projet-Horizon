import { describe, expect, it } from "vitest";
import { buildUniverseSummary } from "./universeSummary";

const subProjects = {
  "proj-1": [
    { id: "sub-1", name: "Livre 1", status: "in_progress", tasks: [{ id: "t1", label: "Relire le plan", done: false }] },
    { id: "sub-2", name: "Livre 2", deadline: "2026-01-10" },
  ],
};

const allProjectsData = {
  "sub-1": [
    {
      id: "col-1",
      pages: [
        {
          id: "p1",
          title: "Chapitre 1",
          status: "done",
          tasks: [{ id: "t2", label: "Corriger dialogue", done: false }],
          scenes: [
            { id: "s1", title: "Scène A", status: "to_review", deadline: "2026-02-01" },
          ],
        },
        { id: "p2", title: "Chapitre 2", status: "todo" },
      ],
    },
  ],
  "sub-2": [
    {
      id: "col-2",
      pages: [{ id: "p3", title: "Chapitre 3", status: "in_progress", deadline: "2026-01-05" }],
    },
  ],
};

describe("buildUniverseSummary", () => {
  it("calcule la progression de chaque livre à travers tous ses arcs", () => {
    const { books } = buildUniverseSummary(subProjects, allProjectsData, "proj-1");
    expect(books).toHaveLength(2);
    expect(books[0].progress).toEqual({ total: 2, done: 1, percent: 50 });
    expect(books[1].progress).toEqual({ total: 1, done: 0, percent: 0 });
  });

  it("agrège les tâches non cochées à tous les niveaux (livre + chapitre)", () => {
    const { undoneTasks } = buildUniverseSummary(subProjects, allProjectsData, "proj-1");
    expect(undoneTasks.map((t) => t.label).sort()).toEqual(["Corriger dialogue", "Relire le plan"]);
  });

  it("classe les éléments en cours et à relire, tous types confondus", () => {
    const { inProgressItems, toReviewItems } = buildUniverseSummary(subProjects, allProjectsData, "proj-1");
    expect(inProgressItems.map((i) => i.title)).toEqual(expect.arrayContaining(["Livre 1", "Chapitre 3"]));
    expect(toReviewItems.map((i) => i.title)).toEqual(["Scène A"]);
  });

  it("trie les échéances de la plus proche à la plus lointaine", () => {
    const { upcomingDeadlines } = buildUniverseSummary(subProjects, allProjectsData, "proj-1");
    expect(upcomingDeadlines.map((d) => d.deadline)).toEqual(["2026-01-05", "2026-01-10", "2026-02-01"]);
  });

  it("associe à une échéance de scène le titre de son chapitre parent, mais pas pour une échéance de livre/chapitre", () => {
    const { upcomingDeadlines } = buildUniverseSummary(subProjects, allProjectsData, "proj-1");
    const sceneDeadline = upcomingDeadlines.find((d) => d.kind === "scene");
    const bookDeadline = upcomingDeadlines.find((d) => d.kind === "book");
    const chapterDeadline = upcomingDeadlines.find((d) => d.kind === "chapter");
    expect(sceneDeadline.chapterTitle).toBe("Chapitre 1");
    expect(bookDeadline.chapterTitle).toBeNull();
    expect(chapterDeadline.chapterTitle).toBeNull();
  });

  it("renvoie des listes vides sans planter pour un univers inconnu", () => {
    const summary = buildUniverseSummary(subProjects, allProjectsData, "proj-inexistant");
    expect(summary).toEqual({
      books: [],
      undoneTasks: [],
      inProgressItems: [],
      toReviewItems: [],
      upcomingDeadlines: [],
    });
  });
});
