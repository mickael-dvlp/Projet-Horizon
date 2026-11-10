import { describe, expect, it } from "vitest";
import { buildZipEntries } from "./exportData";

const identity = (html) => html;

describe("buildZipEntries", () => {
  it("produit un fichier par chapitre et par scène", () => {
    const entries = buildZipEntries(
      {
        projects: [{ id: "proj-1", name: "Univers" }],
        subProjects: { "proj-1": [{ id: "sp-1", name: "Livre" }] },
        allProjectsData: {
          "sp-1": [
            {
              id: "col-1",
              title: "Arc",
              pages: [{ id: "p-1", title: "Chap", content: "texte", scenes: [{ id: "s-1", title: "Sc", content: "x" }] }],
            },
          ],
        },
        knowledgeBaseByProject: {},
      },
      identity
    );
    expect(entries.map((e) => e.path)).toEqual([
      "Univers/Livre/Arc/Chap.md",
      "Univers/Livre/Arc/Chap/Scènes/Sc.md",
    ]);
    expect(entries[0].content).toBe("# Chap\n\ntexte");
  });

  it("n'écrase pas deux chapitres de même titre dans un même arc", () => {
    const entries = buildZipEntries(
      {
        projects: [{ id: "proj-1", name: "U" }],
        subProjects: { "proj-1": [{ id: "sp-1", name: "L" }] },
        allProjectsData: {
          "sp-1": [
            {
              id: "col-1",
              title: "A",
              pages: [
                { id: "p-1", title: "Prologue", content: "un" },
                { id: "p-2", title: "prologue", content: "deux" },
              ],
            },
          ],
        },
        knowledgeBaseByProject: {},
      },
      identity
    );
    expect(entries.map((e) => e.path)).toEqual(["U/L/A/Prologue.md", "U/L/A/prologue (2).md"]);
  });

  it("sépare deux livres et deux univers de même nom", () => {
    const entries = buildZipEntries(
      {
        projects: [
          { id: "proj-1", name: "Saga" },
          { id: "proj-2", name: "Saga" },
        ],
        subProjects: {
          "proj-1": [
            { id: "sp-1", name: "Tome" },
            { id: "sp-2", name: "Tome" },
          ],
          "proj-2": [{ id: "sp-3", name: "Tome" }],
        },
        allProjectsData: {
          "sp-1": [{ id: "c1", title: "Arc", pages: [{ id: "p1", title: "Ch" }] }],
          "sp-2": [{ id: "c2", title: "Arc", pages: [{ id: "p2", title: "Ch" }] }],
          "sp-3": [{ id: "c3", title: "Arc", pages: [{ id: "p3", title: "Ch" }] }],
        },
        knowledgeBaseByProject: {},
      },
      identity
    );
    expect(entries.map((e) => e.path)).toEqual([
      "Saga/Tome/Arc/Ch.md",
      "Saga/Tome (2)/Arc/Ch.md",
      "Saga (2)/Tome/Arc/Ch.md",
    ]);
  });

  it("range les fiches selon leur portée, sans collision de noms", () => {
    const entries = buildZipEntries(
      {
        projects: [{ id: "proj-1", name: "U" }],
        subProjects: { "proj-1": [{ id: "sp-1", name: "L" }] },
        allProjectsData: { "sp-1": [] },
        knowledgeBaseByProject: {
          "proj-1": [
            { id: "kb-1", name: "lieux.md", content: "a" },
            { id: "kb-2", name: "lieux.md", content: "b" },
            { id: "kb-3", name: "perso.md", content: "c", subProjectIds: ["sp-1", "sp-disparu"] },
          ],
        },
      },
      identity
    );
    expect(entries.map((e) => e.path)).toEqual([
      "U/Base de connaissances/lieux.md",
      "U/Base de connaissances/lieux (2).md",
      "U/L/Base de connaissances/perso.md",
    ]);
  });
});
