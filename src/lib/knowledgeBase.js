// Une fiche sans portée (subProjectIds absent ou vide) concerne tout
// l'univers ; sinon elle n'est visible que pour les livres listés.
export function isKbFileVisibleForBook(file, subProjectId) {
  const scope = file?.subProjectIds;
  if (!scope || scope.length === 0) return true;
  if (!subProjectId) return false;
  return scope.includes(subProjectId);
}
