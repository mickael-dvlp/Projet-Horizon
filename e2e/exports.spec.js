import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { loginAsGuest, createUniverse } from "./helpers.js";

test.describe("Exports", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsGuest(page);
    await createUniverse(page, "UniversExport");
    await page.getByText("Ajouter un chapitre").click();
    await page.getByPlaceholder("Nom du chapitre...").fill("Chapitre export");
    await page.keyboard.press("Enter");
  });

  test("export Markdown d'un chapitre déclenche un téléchargement", async ({ page }) => {
    await page.getByText("Chapitre export", { exact: true }).click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTitle("Exporter en .md").click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.md$/);
  });

  test("export JSON global déclenche un téléchargement", async ({ page }) => {
    await page.getByRole("button", { name: "Paramètres" }).click();
    await page.getByText("Données").click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByText("Exporter mes données (.json)").click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.json$/);
  });

  test("export ZIP déclenche un téléchargement", async ({ page }) => {
    await page.getByRole("button", { name: "Paramètres" }).click();
    await page.getByText("Données").click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByText(/Exporter en \.zip/).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.zip$/);
  });
});

test.describe("Export Markdown — régression corps manquant", () => {
  test("exporter depuis la vue liste de scènes inclut le corps du chapitre, pas seulement le titre", async ({ page }) => {
    await loginAsGuest(page);
    await createUniverse(page, "UniversExportRegression");

    await page.getByText("Ajouter un chapitre").click();
    await page.getByPlaceholder("Nom du chapitre...").fill("Chapitre avec scène");
    await page.keyboard.press("Enter");
    await page.getByText("Chapitre avec scène", { exact: true }).click();

    await page.locator(".memo-editor").click();
    await page.keyboard.type("Corps du chapitre qui ne doit pas disparaître à l'export.");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForTimeout(200);

    // Créer une scène : par défaut, la vue bascule sur la liste des scènes
    // (showScenes=true), démontant la zone éditable — c'est exactement le
    // contexte du bug corrigé.
    await page.getByTitle("Scènes").click();
    await page.getByPlaceholder("Nom de la nouvelle scène...").fill("Une scène");
    await page.getByRole("button", { name: "Ajouter", exact: true }).click();
    await expect(page.getByText("Aucune scène pour l’instant")).not.toBeVisible();

    // Export déclenché depuis cette vue (liste de scènes affichée, éditeur non monté).
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTitle("Exporter en .md").click(),
    ]);
    const filePath = await download.path();
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("# Chapitre avec scène");
    expect(content).toContain("Corps du chapitre qui ne doit pas disparaître à l'export.");
  });

  test("exporter un chapitre vide ne lève pas d'erreur et contient seulement le titre", async ({ page }) => {
    await loginAsGuest(page);
    await createUniverse(page, "UniversExportVide");
    await page.getByText("Ajouter un chapitre").click();
    await page.getByPlaceholder("Nom du chapitre...").fill("Chapitre vide");
    await page.keyboard.press("Enter");
    await page.getByText("Chapitre vide", { exact: true }).click();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTitle("Exporter en .md").click(),
    ]);
    const filePath = await download.path();
    const content = readFileSync(filePath, "utf-8");
    expect(content.trim()).toBe("# Chapitre vide");
  });

  test("un titre à caractères spéciaux produit un nom de fichier valide", async ({ page }) => {
    await loginAsGuest(page);
    await createUniverse(page, "UniversExportSpecial");
    await page.getByText("Ajouter un chapitre").click();
    await page.getByPlaceholder("Nom du chapitre...").fill('Titre : "spécial" / test?');
    await page.keyboard.press("Enter");
    await page.getByText('Titre : "spécial" / test?', { exact: true }).click();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTitle("Exporter en .md").click(),
    ]);
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/\.md$/);
    expect(filename).not.toMatch(/[/\\:*?"<>|]/);
  });
});
