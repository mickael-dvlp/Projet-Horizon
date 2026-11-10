import { describe, expect, it } from "vitest";
import { htmlToMarkdown } from "./htmlToMarkdown";

describe("htmlToMarkdown", () => {
  it("convertit titres, gras, italique et listes", () => {
    const html = "<h1>Titre</h1><p><b>gras</b> et <i>italique</i></p><ul><li>un</li><li>deux</li></ul>";
    expect(htmlToMarkdown(html)).toBe("# Titre\n**gras** et *italique*\n- un\n- deux");
  });

  it("numérote les listes ordonnées", () => {
    expect(htmlToMarkdown("<ol><li>a</li><li>b</li></ol>")).toBe("1. a\n2. b");
  });

  it("tolère un contenu vide ou absent", () => {
    expect(htmlToMarkdown("")).toBe("");
    expect(htmlToMarkdown(undefined)).toBe("");
  });

  it("ignore les balises actives sans les exécuter", () => {
    window.__horizonXss = false;
    const md = htmlToMarkdown('<p>texte</p><img src="x" onerror="window.__horizonXss = true">');
    expect(md).toBe("texte");
    expect(window.__horizonXss).toBe(false);
  });
});
