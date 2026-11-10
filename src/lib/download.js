// Noms interdits par Windows, avec ou sans extension ("CON", "nul.md"…).
const WINDOWS_RESERVED_NAME = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
const MAX_FILENAME_LENGTH = 120;

// Rend un titre utilisable comme nom de fichier/dossier sur tous les
// systèmes : caractères interdits remplacés, caractères de contrôle retirés,
// points et espaces retirés aux extrémités (".." remonterait d'un dossier à
// l'extraction, et Windows refuse un nom finissant par un point), noms
// réservés de Windows suffixés, longueur limitée.
export function sanitizeFilename(name) {
  const cleaned = (name || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[/\\:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, MAX_FILENAME_LENGTH)
    .replace(/^[.\s]+|[.\s]+$/g, "");
  if (!cleaned) return "sans-titre";
  return WINDOWS_RESERVED_NAME.test(cleaned) ? `${cleaned}_` : cleaned;
}

// Attribue des noms uniques au sein d'un même dossier : un doublon reçoit
// " (2)", " (3)"… avant son extension — sans quoi un second chapitre (ou
// livre, arc, fiche) du même nom écrasait le premier dans l'archive.
// Comparaison insensible à la casse, comme Windows et macOS.
export function createNameAllocator(reserved = []) {
  const used = new Set(reserved.map((n) => n.toLowerCase()));
  return (name, ext = "") => {
    let candidate = `${name}${ext}`;
    for (let n = 2; used.has(candidate.toLowerCase()); n++) {
      candidate = `${name} (${n})${ext}`;
    }
    used.add(candidate.toLowerCase());
    return candidate;
  };
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
