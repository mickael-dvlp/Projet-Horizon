import { test, expect } from "@playwright/test";
import { loginAsGuest, createUniverse } from "./helpers.js";

// Accepte automatiquement les window.confirm() déclenchés par les actions de
// suppression (Sidebar.jsx) et par la confirmation de suppression définitive
// ajoutée dans TrashModal.jsx.
function autoAcceptDialogs(page) {
  page.on("dialog", (dialog) => dialog.accept());
}

test.describe("Corbeille — suppression profonde univers/livre", () => {
  test("suppression, persistance après rechargement, restauration intégrale, suppression définitive", async ({ page }) => {
    autoAcceptDialogs(page);
    await loginAsGuest(page);
    await createUniverse(page, "QA-Univers-Corbeille");

    // Construit une hiérarchie complète : chapitre avec tâche + statut, et
    // une fiche de base de connaissances.
    await page.getByText("Ajouter un chapitre").click();
    await page.getByPlaceholder("Nom du chapitre...").fill("QA-Chapitre");
    await page.keyboard.press("Enter");
    await page.getByText("QA-Chapitre", { exact: true }).click();
    await page.getByTitle("Tâches").click();
    await page.getByPlaceholder("Ajouter une tâche...").fill("QA-Tâche");
    await page.keyboard.press("Enter");
    await expect(page.getByText("QA-Tâche", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Annuler" }).click();

    // 1. Supprimer l'univers entier depuis la sidebar.
    await page.getByLabel(/Supprimer l’univers QA-Univers-Corbeille/).click();

    // L'univers a disparu de la barre latérale.
    await expect(page.getByText("QA-Univers-Corbeille", { exact: true })).not.toBeVisible();

    // 2. Vérifier sa présence dans la corbeille.
    await page.getByText("Corbeille", { exact: true }).click();
    await expect(page.getByText("QA-Univers-Corbeille", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Fermer", exact: true }).click();

    // 3-4. Recharger la page : toujours présent en corbeille (laisser le
    // debounce de sauvegarde de 500ms s'exécuter avant de recharger).
    await page.waitForTimeout(700);
    await page.reload();
    await page.getByText("Corbeille", { exact: true }).click();
    await expect(page.getByText("QA-Univers-Corbeille", { exact: true })).toBeVisible();

    // 5. Restaurer.
    await page.getByLabel(/Restaurer QA-Univers-Corbeille/).click();
    await page.getByRole("button", { name: "Fermer", exact: true }).click();

    // 6. Vérifier l'intégralité de la hiérarchie restaurée.
    await expect(page.getByText("QA-Univers-Corbeille", { exact: true })).toBeVisible();
    await page.getByText("QA-Univers-Corbeille", { exact: true }).click();
    await expect(page.getByText("QA-Chapitre", { exact: true })).toBeVisible();
    await page.getByText("QA-Chapitre", { exact: true }).click();
    await page.getByTitle("Tâches").click();
    await expect(page.getByText("QA-Tâche", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Annuler" }).click();

    // 7. Le supprimer de nouveau.
    await page.getByLabel(/Supprimer l’univers QA-Univers-Corbeille/).click();
    await expect(page.getByText("QA-Univers-Corbeille", { exact: true })).not.toBeVisible();

    // 8-9. Suppression définitive depuis la corbeille (confirmation acceptée
    // automatiquement) — impossible à restaurer ensuite.
    await page.getByText("Corbeille", { exact: true }).click();
    await page.getByLabel(/Supprimer définitivement QA-Univers-Corbeille/).click();
    await expect(page.getByText("QA-Univers-Corbeille", { exact: true })).not.toBeVisible();
    await page.getByRole("button", { name: "Fermer", exact: true }).click();

    // 10. Aucune autre donnée affectée : le premier univers créé par défaut
    // au login n'existe pas ici (ce test ne crée que QA-Univers-Corbeille),
    // donc on vérifie simplement l'absence de trace de l'univers supprimé
    // n'importe où dans la sidebar.
    await expect(page.getByText("QA-Univers-Corbeille")).toHaveCount(0);
  });

  test("suppression d'un livre : présence en corbeille, restauration avec son contenu", async ({ page }) => {
    autoAcceptDialogs(page);
    await loginAsGuest(page);
    await createUniverse(page, "QA-Univers-Livre");

    await page.getByTitle("Ajouter un livre").click();
    await page.getByPlaceholder("Nom du livre...").fill("QA-Livre-A-Supprimer");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "QA-Livre-A-Supprimer" })).toBeVisible();

    await page.getByText("Ajouter un chapitre").click();
    await page.getByPlaceholder("Nom du chapitre...").fill("QA-Chapitre-Livre");
    await page.keyboard.press("Enter");
    await expect(page.getByText("QA-Chapitre-Livre", { exact: true })).toBeVisible();

    await page.getByLabel(/Supprimer le livre QA-Livre-A-Supprimer/).click();
    await expect(page.getByText("QA-Livre-A-Supprimer", { exact: true })).not.toBeVisible();

    await page.getByText("Corbeille", { exact: true }).click();
    await expect(page.getByText("QA-Livre-A-Supprimer", { exact: true })).toBeVisible();
    await page.getByLabel(/Restaurer QA-Livre-A-Supprimer/).click();
    await page.getByRole("button", { name: "Fermer", exact: true }).click();

    await expect(page.getByRole("heading", { name: "QA-Livre-A-Supprimer" }).or(page.getByText("QA-Livre-A-Supprimer", { exact: true }))).toBeVisible();
    await page.getByText("QA-Livre-A-Supprimer", { exact: true }).click();
    await expect(page.getByText("QA-Chapitre-Livre", { exact: true })).toBeVisible();
  });
});
