import { describe, it, expect } from "vitest";
import { searchKbFiles } from "./kbSearch";

const files = [
  { id: "1", name: "Personnages.md", content: "Le héros s'appelle Aldric et vit dans la forêt." },
  { id: "2", name: "Lieux.md", content: "La capitale est entourée de montagnes enneigées." },
  { id: "3", name: "aldric-notes.md", content: "Notes diverses sans rapport." },
];

describe("searchKbFiles", () => {
  it("retourne un tableau vide pour une requête vide", () => {
    expect(searchKbFiles(files, "")).toEqual([]);
    expect(searchKbFiles(files, "   ")).toEqual([]);
  });

  it("trouve une correspondance dans le contenu, insensible à la casse", () => {
    const results = searchKbFiles(files, "ALDRIC");
    const ids = results.map((r) => r.file.id).sort();
    expect(ids).toEqual(["1", "3"]);
  });

  it("trouve une correspondance dans le nom même sans contenu correspondant", () => {
    const results = searchKbFiles(files, "lieux");
    expect(results).toHaveLength(1);
    expect(results[0].file.id).toBe("2");
  });

  it("génère un extrait autour de la première occurrence dans le contenu", () => {
    const results = searchKbFiles(files, "héros");
    expect(results[0].snippet).toContain("héros");
  });

  it("ne retourne rien si le mot n'apparaît nulle part", () => {
    expect(searchKbFiles(files, "dragon")).toEqual([]);
  });
});
