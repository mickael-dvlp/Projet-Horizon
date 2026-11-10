import { test, expect } from "@playwright/test";
import { loginAsGuest, createUniverse, confirmAppDialog } from "./helpers.js";

async function openNewChapter(page, title) {
  await page.getByText("Ajouter un chapitre").click();
  await page.getByPlaceholder("Nom du chapitre...").fill(title);
  await page.keyboard.press("Enter");
  await page.getByText(title, { exact: true }).click();
}

test.describe("Éditeur — pas de perte du texte non enregistré", () => {
  test("ouvrir puis refermer la liste des scènes conserve le texte du chapitre", async ({ page }) => {
    await loginAsGuest(page);
    await createUniverse(page, "UniversPerte1");
    await openNewChapter(page, "Chapitre perte");

    await page.locator(".memo-editor").click();
    await page.keyboard.type("texte jamais enregistré");

    await page.getByTitle("Scènes").click();
    await page.getByTitle("Scènes").click();
    await expect(page.locator(".memo-editor")).toContainText("texte jamais enregistré");
  });

  test("revenir au chapitre puis rouvrir la scène conserve le texte de la scène", async ({ page }) => {
    await loginAsGuest(page);
    await createUniverse(page, "UniversPerte2");
    await openNewChapter(page, "Chapitre scènes");

    await page.getByTitle("Scènes").click();
    await page.getByPlaceholder("Nom de la nouvelle scène...").fill("Scène perte");
    await page.getByRole("button", { name: "Ajouter", exact: true }).click();
    await page.getByText("Scène perte", { exact: true }).click();
    await page.locator(".memo-editor").click();
    await page.keyboard.type("brouillon de scène");

    await page.getByTitle("Retour au chapitre").click();
    await page.getByText("Scène perte", { exact: true }).click();
    await expect(page.locator(".memo-editor")).toContainText("brouillon de scène");
  });

  test("« Annuler » avec des modifications demande confirmation", async ({ page }) => {
    await loginAsGuest(page);
    await createUniverse(page, "UniversPerte3");
    await openNewChapter(page, "Chapitre annuler");

    await page.locator(".memo-editor").click();
    await page.keyboard.type("à ne pas perdre");
    await page.getByRole("button", { name: "Annuler", exact: true }).click();

    await expect(page.getByText("Modifications non enregistrées")).toBeVisible();
  });
});

test.describe("Corbeille — une restauration impossible ne détruit rien", () => {
  test("un chapitre restauré dans un livre sans arc recrée un arc", async ({ page }) => {
    await loginAsGuest(page);
    await createUniverse(page, "UniversOrphelin");

    await page.getByText("Ajouter un chapitre").click();
    await page.getByPlaceholder("Nom du chapitre...").fill("Chap-orphelin");
    await page.keyboard.press("Enter");

    await page.getByLabel("Options du chapitre Chap-orphelin").click();
    await page.getByRole("button", { name: "Supprimer", exact: true }).click();
    await page.getByLabel("Options de l’arc Arc 1").click();
    await page.getByRole("button", { name: "Supprimer l'arc", exact: true }).click();
    await confirmAppDialog(page, "Supprimer");
    await expect(page.getByText("0 arcs · 0 chapitres")).toBeVisible();

    await page.getByText("Corbeille", { exact: true }).click();
    await page.getByLabel("Restaurer Chap-orphelin").click();
    await page.getByRole("button", { name: "Fermer", exact: true }).click();

    await expect(page.getByText("Arc restauré", { exact: true })).toBeVisible();
    await expect(page.getByText("Chap-orphelin", { exact: true })).toBeVisible();
  });
});
