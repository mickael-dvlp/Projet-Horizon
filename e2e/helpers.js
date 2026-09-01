// Connexion en mode invité + création d'un univers, réutilisées par
// plusieurs specs. Le mode invité est utilisé partout (pas de dépendance à
// un vrai compte Firebase pour les tests E2E).
export async function loginAsGuest(page) {
  await page.goto("/");
  await page.getByText("Commencer l’aventure").click();
  await page.getByText("Continuer en tant qu’invité").click();
}

export async function createUniverse(page, name) {
  const createButton = page.getByText("Créer mon premier univers");
  if (await createButton.isVisible().catch(() => false)) {
    await createButton.click();
  } else {
    await page.getByTitle("Nouvel univers").click();
  }
  await page.getByPlaceholder("Nom de l'univers...").fill(name);
  await page.keyboard.press("Enter");
}
