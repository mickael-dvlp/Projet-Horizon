import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { triggerDownload, sanitizeFilename, createNameAllocator } from "./download";

describe("sanitizeFilename", () => {
  it("remplace les caractères invalides pour un nom de fichier", () => {
    expect(sanitizeFilename("Un/chapitre spécial")).toBe("Un-chapitre spécial");
    expect(sanitizeFilename('Titre: "spécial"?')).toBe("Titre- -spécial--");
  });

  it("retombe sur un nom par défaut si vide", () => {
    expect(sanitizeFilename("")).toBe("sans-titre");
    expect(sanitizeFilename(null)).toBe("sans-titre");
  });

  it("compacte les espaces multiples", () => {
    expect(sanitizeFilename("Un   titre   avec   espaces")).toBe("Un titre avec espaces");
  });

  it("neutralise les noms qui remonteraient d'un dossier", () => {
    expect(sanitizeFilename("..")).toBe("sans-titre");
    expect(sanitizeFilename("../secret")).toBe("-secret");
  });

  it("retire les points et espaces finaux refusés par Windows", () => {
    expect(sanitizeFilename("Chapitre 1. ")).toBe("Chapitre 1");
  });

  it("suffixe les noms réservés de Windows", () => {
    expect(sanitizeFilename("CON")).toBe("CON_");
    expect(sanitizeFilename("nul.md")).toBe("nul.md_");
  });

  it("retire les caractères de contrôle et limite la longueur", () => {
    expect(sanitizeFilename("a\u0000b\u001fc")).toBe("abc");
    expect(sanitizeFilename("x".repeat(500))).toHaveLength(120);
  });
});

describe("createNameAllocator", () => {
  it("suffixe les doublons sans tenir compte de la casse", () => {
    const alloc = createNameAllocator(["Réservé"]);
    expect(alloc("Chap", ".md")).toBe("Chap.md");
    expect(alloc("chap", ".md")).toBe("chap (2).md");
    expect(alloc("Chap", ".md")).toBe("Chap (3).md");
    expect(alloc("réservé")).toBe("réservé (2)");
  });
});

describe("triggerDownload", () => {
  let createObjectURL;
  let revokeObjectURL;
  let appendSpy;
  let removeSpy;
  let clickSpy;

  beforeEach(() => {
    vi.useFakeTimers();
    createObjectURL = vi.fn(() => "blob:mock-url");
    revokeObjectURL = vi.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;
    appendSpy = vi.spyOn(document.body, "appendChild");
    removeSpy = vi.spyOn(document.body, "removeChild");
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("crée une URL objet, ajoute puis retire l'ancre du DOM, et déclenche le clic", () => {
    const blob = new Blob(["contenu"], { type: "text/plain" });
    triggerDownload(blob, "export.txt");

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(appendSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();

    const anchor = appendSpy.mock.calls[0][0];
    expect(anchor.href).toContain("blob:mock-url");
    expect(anchor.download).toBe("export.txt");
  });

  it("ne révoque l'URL qu'après un court délai, pas immédiatement", () => {
    const blob = new Blob(["contenu"], { type: "text/plain" });
    triggerDownload(blob, "export.txt");

    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });
});
