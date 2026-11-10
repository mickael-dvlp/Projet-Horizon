import { test, expect } from "@playwright/test";
import { loginAsGuest, createUniverse } from "./helpers.js";

test.describe("Stockage invité", () => {
  test("les données survivent au rechargement même quand le localStorage est plein", async ({ page }) => {
    await loginAsGuest(page);
    await createUniverse(page, "UniversQuota");

    // Remplit le localStorage jusqu'à son quota : la copie localStorage des
    // données devient impossible, seule la copie IndexedDB peut réussir.
    const filled = await page.evaluate(() => {
      let size = 1 << 20;
      let index = 0;
      while (size >= 1) {
        try {
          localStorage.setItem(`remplissage-${index++}`, "x".repeat(size));
        } catch {
          size = Math.floor(size / 2);
        }
      }
      return index;
    });
    expect(filled).toBeGreaterThan(0);

    await page.getByText("Ajouter un chapitre").click();
    await page.getByPlaceholder("Nom du chapitre...").fill("Chapitre IndexedDB");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Chapitre IndexedDB", { exact: true })).toBeVisible();

    await page.waitForTimeout(800);
    await page.reload();
    await expect(page.getByText("Chapitre IndexedDB", { exact: true })).toBeVisible();
  });
});
