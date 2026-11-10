import { describe, expect, it } from "vitest";
import { validateBackup } from "./backup";

const validBackup = () => ({
  projects: [{ id: "proj-1", name: "Univers" }],
  subProjects: { "proj-1": [{ id: "sp-1", name: "Livre 1" }] },
  allData: { "sp-1": [{ id: "col-1", title: "Arc 1", pages: [] }] },
  knowledgeBaseByProject: { "proj-1": [] },
  trash: [],
  settings: { trashRetentionDays: null },
});

describe("validateBackup", () => {
  it("accepte un export complet", () => {
    expect(validateBackup(validBackup())).toBeNull();
  });

  it("accepte l'ancien format sans livres", () => {
    expect(
      validateBackup({
        projects: [{ id: "proj-1", name: "Univers" }],
        allData: { "proj-1": [{ id: "col-1", title: "Arc", pages: [] }] },
      })
    ).toBeNull();
  });

  it("refuse ce qui n'est pas un objet", () => {
    expect(validateBackup(null)).toMatch(/export JSON/);
    expect(validateBackup([])).toMatch(/export JSON/);
    expect(validateBackup("texte")).toMatch(/export JSON/);
  });

  it("refuse une sauvegarde sans univers", () => {
    expect(validateBackup({ ...validBackup(), projects: [] })).toMatch(/aucun univers/);
  });

  it("refuse des arcs sans liste de chapitres", () => {
    const data = validBackup();
    data.allData["sp-1"] = [{ id: "col-1", title: "Arc 1" }];
    expect(validateBackup(data)).toMatch(/arcs/);
  });

  it("refuse une corbeille qui n'est pas une liste", () => {
    expect(validateBackup({ ...validBackup(), trash: {} })).toMatch(/corbeille/);
  });
});
