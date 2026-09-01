import { test, expect } from "@playwright/test";
import { loginAsGuest, createUniverse } from "./helpers.js";

test.describe("Persistance des données", () => {
  test("statut, priorité et échéance survivent à un rechargement complet", async ({ page }) => {
    await loginAsGuest(page);
    await createUniverse(page, "UniversPersist");

    await page.getByText("Ajouter un chapitre").click();
    await page.getByPlaceholder("Nom du chapitre...").fill("Chapitre à suivre");
    await page.keyboard.press("Enter");

    // Ouvre le menu d'options du chapitre (bouton "..." affiché au survol).
    await page.getByText("Chapitre à suivre", { exact: true })
      .locator("xpath=ancestor::div[contains(@class,'group')][1]")
      .getByLabel("Options du chapitre")
      .click();

    // Statut
    await page.getByText("En cours", { exact: true }).click();

    // Réouvrir le menu pour la priorité et l'échéance (StatusMenu referme le menu après sélection).
    await page.getByText("Chapitre à suivre", { exact: true })
      .locator("xpath=ancestor::div[contains(@class,'group')][1]")
      .getByLabel("Options du chapitre")
      .click();
    await page.getByText("Haute", { exact: true }).click();

    await page.getByText("Chapitre à suivre", { exact: true })
      .locator("xpath=ancestor::div[contains(@class,'group')][1]")
      .getByLabel("Options du chapitre")
      .click();
    await page.getByLabel("Échéance").fill("2027-05-20");

    await page.waitForTimeout(700); // laisse le debounce de sauvegarde s'exécuter

    await page.reload();
    await expect(page.getByText("Chapitre à suivre", { exact: true })).toBeVisible();
    await expect(page.getByText("20 mai", { exact: false })).toBeVisible();
  });

  test("changer de vue (Plan) puis revenir ne fait pas perdre l'échéance", async ({ page }) => {
    await loginAsGuest(page);
    await createUniverse(page, "UniversVue");

    await page.getByText("Ajouter un chapitre").click();
    await page.getByPlaceholder("Nom du chapitre...").fill("Chapitre vue");
    await page.keyboard.press("Enter");

    await page.getByText("Chapitre vue", { exact: true })
      .locator("xpath=ancestor::div[contains(@class,'group')][1]")
      .getByLabel("Options du chapitre")
      .click();
    await page.getByLabel("Échéance").fill("2027-01-10");
    await page.waitForTimeout(700);

    await page.getByTitle("Vue Plan").click();
    await page.getByTitle("Vue Arcs").click();

    await expect(page.getByText("10 janv.", { exact: false })).toBeVisible();
  });
});
