import { describe, expect, it } from "vitest";
import { addTask, toggleTask, removeTask } from "./tasks";

describe("tâches", () => {
  it("ajoute une tâche nettoyée et non cochée, sans modifier la liste reçue", () => {
    const tasks = [];
    const next = addTask(tasks, "  Relire  ");
    expect(tasks).toEqual([]);
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ label: "Relire", done: false });
    expect(next[0].id).toMatch(/^task-/);
  });

  it("ignore un libellé vide ou composé d'espaces", () => {
    const tasks = [{ id: "t1", label: "A", done: false }];
    expect(addTask(tasks, "   ")).toBe(tasks);
    expect(addTask(tasks, "")).toBe(tasks);
  });

  it("coche puis décoche une tâche", () => {
    const tasks = [{ id: "t1", label: "A", done: false }, { id: "t2", label: "B", done: false }];
    const checked = toggleTask(tasks, "t1");
    expect(checked.map((t) => t.done)).toEqual([true, false]);
    expect(toggleTask(checked, "t1")[0].done).toBe(false);
  });

  it("supprime une tâche", () => {
    const tasks = [{ id: "t1" }, { id: "t2" }];
    expect(removeTask(tasks, "t1")).toEqual([{ id: "t2" }]);
  });

  it("tolère une liste absente", () => {
    expect(toggleTask(undefined, "x")).toEqual([]);
    expect(removeTask(undefined, "x")).toEqual([]);
    expect(addTask(undefined, "A")).toHaveLength(1);
  });
});
