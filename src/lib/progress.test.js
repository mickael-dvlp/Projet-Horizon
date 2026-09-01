import { describe, expect, it } from "vitest";
import { computeChapterProgress, computeBookProgress } from "./progress";

describe("computeChapterProgress", () => {
  it("se base sur les scènes quand il y en a", () => {
    const page = {
      scenes: [{ status: "done" }, { status: "todo" }, { status: "done" }],
    };
    expect(computeChapterProgress(page)).toEqual({ total: 3, done: 2, percent: 67 });
  });

  it("se base sur le statut du chapitre quand il n'a pas de scène", () => {
    expect(computeChapterProgress({ status: "done", scenes: [] })).toEqual({
      total: 1,
      done: 1,
      percent: 100,
    });
    expect(computeChapterProgress({ status: "todo" })).toEqual({
      total: 1,
      done: 0,
      percent: 0,
    });
  });

  it("tolère une ancienne page sans champ status ni scenes", () => {
    expect(computeChapterProgress({})).toEqual({ total: 1, done: 0, percent: 0 });
  });
});

describe("computeBookProgress", () => {
  it("compte les chapitres terminés sur le total, tous arcs confondus", () => {
    const columns = [
      { pages: [{ status: "done" }, { status: "todo" }] },
      { pages: [{ status: "done" }] },
    ];
    expect(computeBookProgress(columns)).toEqual({ total: 3, done: 2, percent: 67 });
  });

  it("renvoie 0% sans division par zéro quand il n'y a aucun chapitre", () => {
    expect(computeBookProgress([])).toEqual({ total: 0, done: 0, percent: 0 });
    expect(computeBookProgress([{ pages: [] }])).toEqual({ total: 0, done: 0, percent: 0 });
  });

  it("tolère un ancien livre sans colonnes", () => {
    expect(computeBookProgress(undefined)).toEqual({ total: 0, done: 0, percent: 0 });
  });
});
