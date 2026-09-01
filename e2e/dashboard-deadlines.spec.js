import { test, expect } from "@playwright/test";
import { loginAsGuest, createUniverse } from "./helpers.js";

// Univers créés successivement dans un même test peuvent rester tous
// expansés dans la barre latérale (chaque "Livre 1" a son propre bouton
// "Statut") — .last() cible celui de l'univers le plus récemment créé
// (actif), toujours ajouté en dernier dans le DOM.
async function openBookMenu(page) {
  await page.getByTitle("Statut").last().click();
}

test.describe("Échéances sur le tableau de bord", () => {
  test("une échéance de livre sans aucun chapitre apparaît sur le tableau de bord (repro du bug)", async ({ page }) => {
    await loginAsGuest(page);
    await createUniverse(page, "UniversDeadline1");

    // Le livre par défaut "Livre 1" n'a encore aucun chapitre : c'est
    // exactement le cas qui masquait toute la section échéances avant le
    // correctif (isEmpty dépendait de totalChapters).
    await openBookMenu(page);
    await page.getByLabel("Échéance").fill("2027-08-01");
    await page.waitForTimeout(400);

    await page.getByRole("button", { name: "Tableau de bord" }).click();
    await expect(page.getByText("Prochaines échéances")).toBeVisible();
    await expect(page.getByText("Aucune échéance définie.")).not.toBeVisible();
    await expect(page.getByText("1 août", { exact: false })).toBeVisible();
  });

  test("persistance de l'échéance après rechargement complet", async ({ page }) => {
    await loginAsGuest(page);
    await createUniverse(page, "UniversDeadline2");

    await openBookMenu(page);
    await page.getByLabel("Échéance").fill("2027-09-15");
    await page.waitForTimeout(700);

    await page.reload();
    await page.getByRole("button", { name: "Tableau de bord" }).click();
    await expect(page.getByText("Prochaines échéances")).toBeVisible();
    await expect(page.getByText("Aucune échéance définie.")).not.toBeVisible();
  });

  test("modifier la date d'une échéance met à jour le tableau de bord", async ({ page }) => {
    await loginAsGuest(page);
    await createUniverse(page, "UniversDeadline3");

    await openBookMenu(page);
    await page.getByLabel("Échéance").fill("2027-03-01");
    await page.waitForTimeout(400);

    await openBookMenu(page);
    await page.getByLabel("Échéance").fill("2027-04-20");
    await page.waitForTimeout(400);

    await page.getByRole("button", { name: "Tableau de bord" }).click();
    await expect(page.getByText("20 avr.", { exact: false })).toBeVisible();
  });

  test("supprimer la date (revenir à vide) fait disparaître l'échéance du tableau de bord", async ({ page }) => {
    await loginAsGuest(page);
    await createUniverse(page, "UniversDeadline4");

    await openBookMenu(page);
    await page.getByLabel("Échéance").fill("2027-05-05");
    await page.waitForTimeout(400);

    await openBookMenu(page);
    await page.getByLabel("Échéance").fill("");
    await page.waitForTimeout(400);

    await page.getByRole("button", { name: "Tableau de bord" }).click();
    await expect(page.getByText("Aucune échéance définie.")).toBeVisible();
  });

  test("les échéances de deux univers différents ne se mélangent pas", async ({ page }) => {
    await loginAsGuest(page);
    await createUniverse(page, "UniversDeadlineA");
    await openBookMenu(page);
    await page.getByLabel("Échéance").fill("2027-06-01");
    await page.waitForTimeout(400);

    await createUniverse(page, "UniversDeadlineB");
    await page.getByRole("button", { name: "Tableau de bord" }).click();
    await expect(page.getByText("Aucune échéance définie.")).toBeVisible();

    await openBookMenu(page);
    await page.getByLabel("Échéance").fill("2027-07-10");
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: "Tableau de bord" }).click();
    await expect(page.getByText("Aucune échéance définie.")).not.toBeVisible();
    // Une seule échéance visible dans cet univers (celle de UniversDeadlineB, pas celle de A).
    await expect(page.getByText("10 juil.", { exact: false })).toBeVisible();
  });
});
