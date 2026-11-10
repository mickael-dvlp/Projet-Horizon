import { describe, it, expect } from "vitest";
import { countWordsFromHtml } from "./wordCount";

describe("countWordsFromHtml", () => {
  it("compte les mots d'un contenu HTML simple", () => {
    const html = "<p>un deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze</p>";
    expect(countWordsFromHtml(html)).toEqual({ words: 14, chars: 75 });
  });

  it("compte les mots d'une scène plus courte", () => {
    const html = "<p>alpha beta gamma delta epsilon zeta eta</p>";
    expect(countWordsFromHtml(html)).toEqual({ words: 7, chars: 39 });
  });

  it("retourne 0/0 pour un contenu vide", () => {
    expect(countWordsFromHtml("")).toEqual({ words: 0, chars: 0 });
    expect(countWordsFromHtml(null)).toEqual({ words: 0, chars: 0 });
    expect(countWordsFromHtml("<p></p>")).toEqual({ words: 0, chars: 0 });
  });

  it("ignore les balises et les espaces insécables lors du comptage", () => {
    const html = "<h1>Titre</h1><p>Un&nbsp;mot</p>";
    expect(countWordsFromHtml(html)).toEqual({ words: 3, chars: 13 });
  });

  it("ne coupe pas un mot mis en forme en plusieurs morceaux", () => {
    expect(countWordsFromHtml("<p><b>gr</b>as et <i>ita</i>lique</p>")).toEqual({ words: 3, chars: 16 });
  });

  it("sépare les lignes produites par l'éditeur", () => {
    expect(countWordsFromHtml("un<div>deux</div><div>trois<br></div>").words).toBe(3);
  });

  it("décode les entités HTML", () => {
    expect(countWordsFromHtml("<p>Tom &amp; Jerry &#233;t&#xE9;</p>")).toEqual({ words: 4, chars: 15 });
  });
});
