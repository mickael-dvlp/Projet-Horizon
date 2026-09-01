import { test, expect } from "@playwright/test";
import { loginAsGuest, createUniverse } from "./helpers.js";

test.describe("Correctifs divers — arc, scène, tableau de bord", () => {
  test("un nouvel arc s'ouvre en mode renommage immédiat", async ({ page }) => {
    await loginAsGuest(page);
    await createUniverse(page, "UniversArcRename");

    await page.getByText("Nouvel arc").click();
    // Le champ de renommage doit déjà être affiché et prêt à recevoir la saisie.
    const input = page.getByLabel("Nouveau nom de l’arc Nouvel arc");
    await expect(input).toBeVisible();
    await input.fill("Arc renommé à la création");
    await input.press("Enter");

    await expect(page.getByRole("heading", { name: "Arc renommé à la création" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Nouvel arc" })).not.toBeVisible();
  });

  test("renommer une scène depuis son menu d'options", async ({ page }) => {
    await loginAsGuest(page);
    await createUniverse(page, "UniversSceneRename");

    await page.getByText("Ajouter un chapitre").click();
    await page.getByPlaceholder("Nom du chapitre...").fill("Chapitre pour scène");
    await page.keyboard.press("Enter");
    await page.getByText("Chapitre pour scène", { exact: true }).click();
    await page.getByTitle("Scènes").click();
    await page.getByPlaceholder("Nom de la nouvelle scène...").fill("Scène originale");
    await page.getByRole("button", { name: "Ajouter", exact: true }).click();
    await expect(page.getByText("Scène originale", { exact: true })).toBeVisible();

    await page.getByLabel("Options de la scène Scène originale").click();
    await page.locator("#memo-scenes-panel").getByRole("button", { name: "Renommer" }).click();
    const input = page.getByLabel("Nouveau nom de la scène Scène originale");
    await expect(input).toBeVisible();
    await input.fill("Scène renommée");
    await input.press("Enter");

    await expect(page.getByText("Scène renommée", { exact: true })).toBeVisible();
    await expect(page.getByText("Scène originale", { exact: true })).not.toBeVisible();
  });

  test("cliquer une tâche du tableau de bord ouvre le panneau Tâches et la met en évidence", async ({ page }) => {
    await loginAsGuest(page);
    await createUniverse(page, "UniversDashboardTask");
    await expect(page.getByText("Ajouter un chapitre")).toBeVisible();

    // Tâche de livre : le bouton Tâches de KanbanBoard n'a qu'un aria-label
    // (dynamique avec le compte), pas de title — contrairement à celui de
    // MemoEditor pour les tâches de chapitre.
    const tasksButton = page.getByRole("button", { name: /^Tâches/ });
    await tasksButton.click();
    await page.getByPlaceholder("Ajouter une tâche...").fill("QA-Tâche-Dashboard");
    await page.keyboard.press("Enter");
    await expect(page.getByText("QA-Tâche-Dashboard", { exact: true })).toBeVisible();
    await tasksButton.click(); // referme le panneau pour repartir d'un état fermé

    await page.getByText("Tableau de bord", { exact: true }).click();
    await page.getByText("QA-Tâche-Dashboard", { exact: true }).click();

    // Retour sur le livre, panneau Tâches ouvert automatiquement (pas besoin
    // de recliquer sur "Tâches"), avec la tâche visible et mise en évidence.
    await expect(page.getByText("Tâches du livre")).toBeVisible();
    await expect(page.getByText("QA-Tâche-Dashboard", { exact: true })).toBeVisible();
  });
});
