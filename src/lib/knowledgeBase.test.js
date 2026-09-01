import { describe, expect, it } from "vitest";
import { isKbFileVisibleForBook } from "./knowledgeBase";

describe("isKbFileVisibleForBook", () => {
  it("une fiche sans portée est visible pour n'importe quel livre de l'univers", () => {
    const file = { subProjectIds: [] };
    expect(isKbFileVisibleForBook(file, "sub-1")).toBe(true);
    expect(isKbFileVisibleForBook(file, "sub-2")).toBe(true);
  });

  it("une ancienne fiche sans champ subProjectIds est traitée comme univers entier", () => {
    expect(isKbFileVisibleForBook({}, "sub-1")).toBe(true);
    expect(isKbFileVisibleForBook({ name: "x" }, null)).toBe(true);
  });

  it("une fiche scopée n'est visible que pour les livres listés", () => {
    const file = { subProjectIds: ["sub-1", "sub-2"] };
    expect(isKbFileVisibleForBook(file, "sub-1")).toBe(true);
    expect(isKbFileVisibleForBook(file, "sub-3")).toBe(false);
  });

  it("une fiche scopée est masquée quand aucun livre n'est actif", () => {
    const file = { subProjectIds: ["sub-1"] };
    expect(isKbFileVisibleForBook(file, null)).toBe(false);
  });
});
