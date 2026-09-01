import { test, expect } from "@playwright/test";
import { loginAsGuest, createUniverse } from "./helpers.js";

async function setup(page, universeName) {
  await loginAsGuest(page);
  await createUniverse(page, universeName);
}

test.describe("Création — chapitre (Column.jsx)", () => {
  test("Entrée avec un nom valide crée le chapitre", async ({ page }) => {
    await setup(page, "UniversFormChapitre1");
    await page.getByText("Ajouter un chapitre").click();
    await page.getByPlaceholder("Nom du chapitre...").fill("Chapitre valide");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Chapitre valide", { exact: true })).toBeVisible();
  });

  test("Échap annule sans créer", async ({ page }) => {
    await setup(page, "UniversFormChapitre2");
    await page.getByText("Ajouter un chapitre").click();
    await page.getByPlaceholder("Nom du chapitre...").fill("Ne doit pas exister");
    await page.keyboard.press("Escape");
    await expect(page.getByText("Ne doit pas exister")).not.toBeVisible();
    await expect(page.getByText("0 chapitre", { exact: false })).toBeVisible();
  });

  test("une saisie vide ne crée rien", async ({ page }) => {
    await setup(page, "UniversFormChapitre3");
    await page.getByText("Ajouter un chapitre").click();
    await page.keyboard.press("Enter");
    await expect(page.getByText("0 chapitre", { exact: false })).toBeVisible();
  });

  test("une saisie composée uniquement d'espaces ne crée rien", async ({ page }) => {
    await setup(page, "UniversFormChapitre4");
    await page.getByText("Ajouter un chapitre").click();
    await page.getByPlaceholder("Nom du chapitre...").fill("   ");
    await page.keyboard.press("Enter");
    await expect(page.getByText("0 chapitre", { exact: false })).toBeVisible();
  });

  test("des appuis rapides et répétés sur Entrée ne créent qu'un seul chapitre", async ({ page }) => {
    await setup(page, "UniversFormChapitre5");
    await page.getByText("Ajouter un chapitre").click();
    const input = page.getByPlaceholder("Nom du chapitre...");
    await input.fill("Chapitre unique");
    // Le formulaire se referme après la première création (flux "un coup") :
    // les appuis suivants ciblent le clavier directement (pas le champ, qui
    // aura disparu) pour vérifier qu'ils ne relancent pas de création.
    await input.press("Enter");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    await expect(page.getByText("Chapitre unique", { exact: true })).toHaveCount(1);
    await expect(page.getByText("1 chapitre", { exact: false })).toBeVisible();
  });
});

test.describe("Création — tâche de livre (TaskList.jsx)", () => {
  test("Entrée avec un nom valide crée la tâche", async ({ page }) => {
    await setup(page, "UniversFormTache1");
    await page.getByRole("button", { name: /Tâches/ }).first().click();
    const input = page.getByPlaceholder("Ajouter une tâche...");
    await input.fill("Tâche valide");
    await input.press("Enter");
    await expect(page.getByText("Tâche valide", { exact: true })).toBeVisible();
  });

  test("Échap vide le champ sans créer", async ({ page }) => {
    await setup(page, "UniversFormTache2");
    await page.getByRole("button", { name: /Tâches/ }).first().click();
    const input = page.getByPlaceholder("Ajouter une tâche...");
    await input.fill("Ne doit pas exister");
    await input.press("Escape");
    await expect(page.getByText("Ne doit pas exister")).not.toBeVisible();
    await expect(input).toHaveValue("");
  });

  test("saisie vide ou espaces uniquement ne crée rien", async ({ page }) => {
    await setup(page, "UniversFormTache3");
    await page.getByRole("button", { name: /Tâches/ }).first().click();
    const input = page.getByPlaceholder("Ajouter une tâche...");
    await input.press("Enter");
    await input.fill("   ");
    await input.press("Enter");
    await page.waitForTimeout(200);
    await expect(input).toHaveValue("");
    // Aucune barre de progression de tâches n'apparaît tant qu'aucune tâche réelle n'existe.
    await expect(page.getByText(/^0\/0$/)).not.toBeVisible();
  });

  test("appuis rapides répétés sur Entrée ne créent qu'une seule tâche", async ({ page }) => {
    await setup(page, "UniversFormTache4");
    await page.getByRole("button", { name: /Tâches/ }).first().click();
    const input = page.getByPlaceholder("Ajouter une tâche...");
    await input.fill("Tâche unique");
    await input.press("Enter");
    await input.press("Enter");
    await page.waitForTimeout(200);
    await expect(page.getByText("Tâche unique", { exact: true })).toHaveCount(1);
  });
});

test.describe("Création — scène (SceneListPanel.jsx)", () => {
  async function openSceneList(page, chapterTitle) {
    await page.getByText("Ajouter un chapitre").click();
    await page.getByPlaceholder("Nom du chapitre...").fill(chapterTitle);
    await page.keyboard.press("Enter");
    await page.getByText(chapterTitle, { exact: true }).click();
    await page.getByTitle("Scènes").click();
  }

  test("Entrée avec un nom valide crée la scène", async ({ page }) => {
    await setup(page, "UniversFormScene1");
    await openSceneList(page, "Chapitre scène 1");
    const input = page.getByPlaceholder("Nom de la nouvelle scène...");
    await input.fill("Scène valide");
    await input.press("Enter");
    await expect(page.getByText("Scène valide", { exact: true })).toBeVisible();
  });

  test("le bouton Ajouter crée la scène", async ({ page }) => {
    await setup(page, "UniversFormScene2");
    await openSceneList(page, "Chapitre scène 2");
    await page.getByPlaceholder("Nom de la nouvelle scène...").fill("Scène via bouton");
    await page.getByRole("button", { name: "Ajouter", exact: true }).click();
    await expect(page.getByText("Scène via bouton", { exact: true })).toBeVisible();
  });

  test("Échap vide le champ sans créer", async ({ page }) => {
    await setup(page, "UniversFormScene3");
    await openSceneList(page, "Chapitre scène 3");
    const input = page.getByPlaceholder("Nom de la nouvelle scène...");
    await input.fill("Ne doit pas exister");
    await input.press("Escape");
    await expect(page.getByText("Ne doit pas exister")).not.toBeVisible();
    await expect(input).toHaveValue("");
  });

  test("saisie vide ou espaces uniquement ne crée rien", async ({ page }) => {
    await setup(page, "UniversFormScene4");
    await openSceneList(page, "Chapitre scène 4");
    const button = page.getByRole("button", { name: "Ajouter", exact: true });
    await expect(button).toBeDisabled();
    await page.getByPlaceholder("Nom de la nouvelle scène...").fill("   ");
    await expect(button).toBeDisabled();
    await expect(page.getByText("Aucune scène pour l’instant")).toBeVisible();
  });

  test("appuis rapides répétés sur Entrée ne créent qu'une seule scène", async ({ page }) => {
    await setup(page, "UniversFormScene5");
    await openSceneList(page, "Chapitre scène 5");
    const input = page.getByPlaceholder("Nom de la nouvelle scène...");
    await input.fill("Scène unique");
    await input.press("Enter");
    await input.press("Enter");
    await page.waitForTimeout(200);
    await expect(page.getByText("Scène unique", { exact: true })).toHaveCount(1);
  });
});
