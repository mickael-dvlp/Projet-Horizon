import { test, expect } from "@playwright/test";
import { loginAsGuest, createUniverse, confirmAppDialog } from "./helpers.js";

async function addChapter(page, title) {
  await page.getByText("Ajouter un chapitre").click();
  await page.getByPlaceholder("Nom du chapitre...").fill(title);
  await page.keyboard.press("Enter");
}

test.describe("Corrections fonctionnelles", () => {
  test("renommer une carte après un renommage dans l'éditeur garde le nouveau titre", async ({ page }) => {
    await loginAsGuest(page);
    await createUniverse(page, "UniversRenommage");
    await addChapter(page, "Ancien titre");

    // Renommage depuis l'éditeur.
    await page.getByText("Ancien titre", { exact: true }).click();
    await page.getByTitle("Cliquer pour renommer").click();
    await page.keyboard.press("Control+A");
    await page.keyboard.type("Nouveau titre");
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Fermer l'éditeur" }).click();

    // Puis renommage depuis la carte, validé sans rien changer.
    await page.getByLabel("Options du chapitre Nouveau titre").click();
    await page.getByRole("button", { name: "Renommer", exact: true }).click();
    await page.keyboard.press("Enter");

    await expect(page.getByText("Nouveau titre", { exact: true })).toBeVisible();
    await expect(page.getByText("Ancien titre", { exact: true })).toHaveCount(0);
  });

  test("Entrée sur une carte focalisée ouvre le chapitre", async ({ page }) => {
    await loginAsGuest(page);
    await createUniverse(page, "UniversClavier");
    await addChapter(page, "Chapitre clavier");

    await page.getByRole("button", { name: /Chapitre clavier/ }).first().focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("textbox", { name: "Contenu du chapitre" })).toBeVisible();
  });

  test("une sauvegarde JSON exportée puis réimportée restaure les données", async ({ page }) => {
    await loginAsGuest(page);
    await createUniverse(page, "UniversSauvegarde");
    await addChapter(page, "Chapitre sauvegardé");

    await page.getByRole("button", { name: "Paramètres" }).click();
    await page.getByText("Données").click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByText("Exporter mes données (.json)").click(),
    ]);
    const backupPath = await download.path();

    await page.getByPlaceholder("SUPPRIMER").fill("SUPPRIMER");
    await page.getByRole("button", { name: "Supprimer toutes mes données" }).click();
    await expect(page.getByText("Toutes les données ont été supprimées.")).toBeVisible();

    await page.getByLabel("Fichier de sauvegarde à importer").setInputFiles(backupPath);
    await confirmAppDialog(page, "Remplacer");
    await expect(page.getByRole("status").filter({ hasText: "Sauvegarde importée." }).first()).toBeVisible();
    await page.getByRole("button", { name: "Fermer", exact: true }).click();

    await expect(page.getByRole("button", { name: "UniversSauvegarde", exact: true }).first()).toBeVisible();
    await expect(page.getByText("Chapitre sauvegardé", { exact: true })).toBeVisible();

    // Les données importées sont bien enregistrées (survivent au rechargement).
    await page.waitForTimeout(700);
    await page.reload();
    await expect(page.getByText("Chapitre sauvegardé", { exact: true })).toBeVisible();
  });
});
