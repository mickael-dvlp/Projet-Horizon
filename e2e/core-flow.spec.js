import { test, expect } from "@playwright/test";
import { loginAsGuest, createUniverse } from "./helpers.js";

test.describe("Parcours de création complet", () => {
  test("univers -> livre -> arc -> chapitre, sans doublon à la création", async ({ page }) => {
    await loginAsGuest(page);
    await createUniverse(page, "Univers E2E");

    // Le livre par défaut ("Livre 1") est créé avec l'univers ; on ajoute un
    // second livre nommé explicitement.
    await page.getByTitle("Ajouter un livre").click();
    await page.getByPlaceholder("Nom du livre...").fill("Second livre");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Second livre" })).toBeVisible();

    // Renommer/ajouter un arc puis un chapitre.
    await page.getByText("Ajouter un chapitre").click();
    await page.getByPlaceholder("Nom du chapitre...").fill("Premier chapitre");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Premier chapitre", { exact: true })).toBeVisible();

    // Un seul chapitre créé, même si Entrée déclenche aussi un blur juste après.
    await expect(page.getByText("1 arc · 1 chapitre")).toBeVisible();
  });

  test("Entrée puis perte de focus rapprochées ne créent pas de doublon", async ({ page }) => {
    await loginAsGuest(page);
    await createUniverse(page, "UniversDoublon");

    await page.getByText("Ajouter un chapitre").click();
    const input = page.getByPlaceholder("Nom du chapitre...");
    await input.fill("Chapitre unique");
    await input.press("Enter");
    // Un clic ailleurs juste après simule une perte de focus qui, avant le
    // correctif, aurait pu re-soumettre le même nom.
    await page.locator("body").click({ position: { x: 10, y: 10 } });
    await page.waitForTimeout(200);

    const cards = page.locator("text=Chapitre unique");
    await expect(cards).toHaveCount(1);
  });

  test("déplacer un chapitre d'un arc à un autre", async ({ page }) => {
    await loginAsGuest(page);
    await createUniverse(page, "UniversDnD");

    await page.getByText("Ajouter un chapitre").click();
    await page.getByPlaceholder("Nom du chapitre...").fill("Chapitre à déplacer");
    await page.keyboard.press("Enter");

    await page.getByText("Nouvel arc").click();
    // Le nouvel arc entre immédiatement en mode renommage (voir Column.jsx) ;
    // Échap referme ce mode et conserve le nom par défaut "Nouvel arc".
    await page.keyboard.press("Escape");
    await expect(page.getByText("2 arc", { exact: false })).toBeVisible();

    const sourceColumn = page.locator("div", { has: page.getByRole("heading", { name: "Arc 1" }) }).first();
    const targetColumn = page.locator("div", { has: page.getByRole("heading", { name: "Nouvel arc" }) }).first();
    const card = sourceColumn.getByText("Chapitre à déplacer", { exact: true });

    const cardBox = await card.boundingBox();
    const targetBox = await targetColumn.boundingBox();

    await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(cardBox.x + cardBox.width / 2 + 20, cardBox.y + cardBox.height / 2, { steps: 5 });
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + 60, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    await expect(targetColumn.getByText("Chapitre à déplacer", { exact: true })).toBeVisible();
  });

  test("création d'une tâche de livre et d'une scène", async ({ page }) => {
    await loginAsGuest(page);
    await createUniverse(page, "UniversTaches");

    // Tâche de livre (dans l'en-tête du tableau)
    await page.getByRole("button", { name: /Tâches/ }).first().click();
    const taskInput = page.getByPlaceholder("Ajouter une tâche...");
    await taskInput.fill("Relire le premier jet");
    await taskInput.press("Enter");
    await expect(page.getByText("Relire le premier jet")).toBeVisible();

    // Scène à l'intérieur d'un chapitre
    await page.getByText("Ajouter un chapitre").click();
    await page.getByPlaceholder("Nom du chapitre...").fill("Chapitre avec scène");
    await page.keyboard.press("Enter");
    await page.getByText("Chapitre avec scène", { exact: true }).click();
    await page.getByTitle("Scènes").click();
    await page.getByPlaceholder("Nom de la nouvelle scène...").fill("Scène A");
    await page.getByRole("button", { name: "Ajouter", exact: true }).click();
    await expect(page.getByText("Scène A", { exact: true })).toBeVisible();
  });

  test("passage chapitre -> scène -> chapitre sans mélange du compteur de mots", async ({ page }) => {
    await loginAsGuest(page);
    await createUniverse(page, "UniversCompteur");

    await page.getByText("Ajouter un chapitre").click();
    await page.getByPlaceholder("Nom du chapitre...").fill("Chapitre compteur");
    await page.keyboard.press("Enter");
    await page.getByText("Chapitre compteur", { exact: true }).click();

    const editor = page.locator(".memo-editor");
    await editor.click();
    await page.keyboard.type("un deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze");
    await page.getByRole("button", { name: "Enregistrer" }).click();

    await page.getByTitle("Scènes").click();
    await page.getByPlaceholder("Nom de la nouvelle scène...").fill("Scène compteur");
    await page.getByRole("button", { name: "Ajouter", exact: true }).click();
    await page.getByText("Scène compteur", { exact: true }).click();
    await page.locator(".memo-editor").click();
    await page.keyboard.type("alpha beta gamma delta epsilon zeta eta");
    await page.getByRole("button", { name: "Enregistrer" }).click();

    await page.getByTitle("Retour au chapitre").click();
    await expect(page.getByText("14 mots · 75 caractères")).toBeVisible();
  });

  test("isolation de la base de connaissances entre deux univers", async ({ page }) => {
    await loginAsGuest(page);
    await createUniverse(page, "UniversA");
    const [chooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.getByTitle("Importer un fichier .md").click(),
    ]);
    await chooser.setFiles({
      name: "note-a.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Note pour A"),
    });
    await expect(page.getByText("note-a.md")).toBeVisible();

    await createUniverse(page, "UniversB");
    await expect(page.getByText("note-a.md")).not.toBeVisible();
    await expect(page.getByText(/Aucun fichier/)).toBeVisible();
  });
});
