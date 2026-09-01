import { test, expect } from "@playwright/test";
import { loginAsGuest, createUniverse } from "./helpers.js";

test.describe("Synchronisation des panneaux Tâches/Scènes", () => {
  test("le panneau Tâches se referme en changeant de document (chapitre -> scène)", async ({ page }) => {
    await loginAsGuest(page);
    await createUniverse(page, "UniversPanelSync1");

    await page.getByText("Ajouter un chapitre").click();
    await page.getByPlaceholder("Nom du chapitre...").fill("Chapitre panneau");
    await page.keyboard.press("Enter");
    await page.getByText("Chapitre panneau", { exact: true }).click();

    const tasksButton = page.getByTitle("Tâches");
    await tasksButton.click();
    await expect(tasksButton).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#memo-tasks-panel")).toBeVisible();

    // Créer et ouvrir une scène : le panneau Tâches doit se refermer tout seul.
    await page.getByTitle("Scènes").click();
    await page.getByPlaceholder("Nom de la nouvelle scène...").fill("Scène panneau");
    await page.getByRole("button", { name: "Ajouter", exact: true }).click();
    await page.getByText("Scène panneau", { exact: true }).click();

    await expect(tasksButton).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#memo-tasks-panel")).not.toBeVisible();
  });

  test("le panneau Tâches se referme aussi au retour vers le chapitre", async ({ page }) => {
    await loginAsGuest(page);
    await createUniverse(page, "UniversPanelSync2");

    await page.getByText("Ajouter un chapitre").click();
    await page.getByPlaceholder("Nom du chapitre...").fill("Chapitre retour");
    await page.keyboard.press("Enter");
    await page.getByText("Chapitre retour", { exact: true }).click();
    await page.getByTitle("Scènes").click();
    await page.getByPlaceholder("Nom de la nouvelle scène...").fill("Scène retour");
    await page.getByRole("button", { name: "Ajouter", exact: true }).click();
    await page.getByText("Scène retour", { exact: true }).click();

    const tasksButton = page.getByTitle("Tâches");
    await tasksButton.click();
    await expect(tasksButton).toHaveAttribute("aria-expanded", "true");

    await page.getByTitle("Retour au chapitre").click();
    await expect(tasksButton).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#memo-tasks-panel")).not.toBeVisible();
  });

  test("ouverture/fermeture successives du panneau Tâches sans double-clic", async ({ page }) => {
    await loginAsGuest(page);
    await createUniverse(page, "UniversPanelSync3");

    await page.getByText("Ajouter un chapitre").click();
    await page.getByPlaceholder("Nom du chapitre...").fill("Chapitre toggle");
    await page.keyboard.press("Enter");
    await page.getByText("Chapitre toggle", { exact: true }).click();

    const tasksButton = page.getByTitle("Tâches");

    await tasksButton.click();
    await expect(tasksButton).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#memo-tasks-panel")).toBeVisible();

    await tasksButton.click();
    await expect(tasksButton).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#memo-tasks-panel")).not.toBeVisible();

    await tasksButton.click();
    await expect(tasksButton).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#memo-tasks-panel")).toBeVisible();
  });

  test("ouverture/fermeture successives du panneau Scènes, aria-expanded reflète l'état réel", async ({ page }) => {
    await loginAsGuest(page);
    await createUniverse(page, "UniversPanelSync4");

    await page.getByText("Ajouter un chapitre").click();
    await page.getByPlaceholder("Nom du chapitre...").fill("Chapitre scenes toggle");
    await page.keyboard.press("Enter");
    await page.getByText("Chapitre scenes toggle", { exact: true }).click();

    const scenesButton = page.getByTitle("Scènes");
    // Aucune scène pour ce chapitre : le panneau est fermé par défaut à l'ouverture.
    await expect(scenesButton).toHaveAttribute("aria-expanded", "false");

    await scenesButton.click();
    await expect(scenesButton).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#memo-scenes-panel")).toBeVisible();

    await scenesButton.click();
    await expect(scenesButton).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#memo-scenes-panel")).not.toBeVisible();
  });

  test("ouvrir Tâches ferme Scènes et inversement (exclusion mutuelle)", async ({ page }) => {
    await loginAsGuest(page);
    await createUniverse(page, "UniversPanelSyncExclusive");

    await page.getByText("Ajouter un chapitre").click();
    await page.getByPlaceholder("Nom du chapitre...").fill("Chapitre exclusif");
    await page.keyboard.press("Enter");
    await page.getByText("Chapitre exclusif", { exact: true }).click();

    const tasksButton = page.getByTitle("Tâches");
    const scenesButton = page.getByTitle("Scènes");

    await scenesButton.click();
    await expect(scenesButton).toHaveAttribute("aria-expanded", "true");

    await tasksButton.click();
    await expect(tasksButton).toHaveAttribute("aria-expanded", "true");
    await expect(scenesButton).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#memo-scenes-panel")).not.toBeVisible();

    await scenesButton.click();
    await expect(scenesButton).toHaveAttribute("aria-expanded", "true");
    await expect(tasksButton).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#memo-tasks-panel")).not.toBeVisible();
  });
});
