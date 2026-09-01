// Remplace les caractères invalides dans un nom de fichier/dossier.
export function sanitizeFilename(name) {
  return (name || "sans-titre").replace(/[/\\:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();
}

// Déclenche le téléchargement d'un Blob depuis le navigateur.
//
// L'ancre est ajoutée au DOM avant le clic (certains navigateurs n'exécutent
// pas l'action par défaut d'un clic synthétique sur un élément détaché) et
// l'URL objet n'est révoquée qu'après un court délai, pour laisser le temps
// au téléchargement de démarrer avant d'invalider le blob.
export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
