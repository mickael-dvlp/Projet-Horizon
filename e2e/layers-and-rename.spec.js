import { test, expect } from "@playwright/test";
import { loginAsGuest, createUniverse } from "./helpers.js";

test.describe("Échap, renommage et brouillons", () => {
  test("Échap ferme seulement le menu ouvert, pas l'éditeur en dessous", async ({ page }) => {
    await loginAsGuest(page);
    await createUniverse(page, "UniversCouches");
    await page.getByText("Ajouter un chapitre").click();
    await page.getByPlaceholder("Nom du chapitre...").fill("Chapitre couches");
    await page.keyboard.press("Enter");
    await page.getByText("Chapitre couches", { exact: true }).click();

    await page.getByTitle("Scènes").click();
    await page.getByPlaceholder("Nom de la nouvelle scène...").fill("Scène couches");
    await page.getByRole("button", { name: "Ajouter", exact: true }).click();
    await page.getByLabel("Options de la scène Scène couches").click();
    await expect(page.getByRole("button", { name: "Renommer", exact: true })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Renommer", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Fermer l'éditeur" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Fermer l'éditeur" })).toHaveCount(0);
  });

  test("Échap pendant un renommage d'arc n'applique pas le nouveau nom", async ({ page }) => {
    await loginAsGuest(page);
    await createUniverse(page, "UniversRenommageArc");

    await page.getByLabel("Options de l’arc Arc 1").click();
    await page.getByRole("button", { name: "Modifier le nom", exact: true }).click();
    await page.keyboard.type("Nom abandonné");
    await page.keyboard.press("Escape");

    await expect(page.getByRole("heading", { name: "Arc 1" })).toBeVisible();
    await expect(page.getByText("Nom abandonné")).toHaveCount(0);
  });

  test("abandonner un brouillon de fiche demande confirmation", async ({ page }) => {
    await loginAsGuest(page);
    await createUniverse(page, "UniversFiche");

    await page.locator('input[type="file"][accept=".md,.txt"]').setInputFiles({
      name: "personnages.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Personnages\n\nAlice"),
    });
    await page.getByText("personnages.md", { exact: true }).click();
    await page.getByRole("button", { name: "Modifier", exact: true }).click();
    await page.getByLabel("Contenu de la fiche (Markdown)").fill("# Personnages\n\nAlice et Bob");

    await page.keyboard.press("Escape");
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("Abandonner les modifications ?");

    await dialog.getByRole("button", { name: "Continuer l’édition" }).click();
    await expect(page.getByLabel("Contenu de la fiche (Markdown)")).toHaveValue("# Personnages\n\nAlice et Bob");
  });
});
