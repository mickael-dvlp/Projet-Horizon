// Taille maximale d'un fichier de sauvegarde accepté à l'import.
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

const isPlainObject = (value) => !!value && typeof value === "object" && !Array.isArray(value);

// Vérifie qu'un objet a la forme d'un export JSON d'Horizon (cf.
// buildFullBackup dans useKanbanLogic), y compris l'ancien format sans
// livres (`subProjects` absent, migré au chargement). Renvoie un message
// d'erreur lisible, ou null si la sauvegarde est exploitable.
export function validateBackup(data) {
  if (!isPlainObject(data)) return "Ce fichier n'est pas un export JSON d'Horizon.";
  if (!Array.isArray(data.projects) || data.projects.length === 0) {
    return "Cette sauvegarde ne contient aucun univers.";
  }
  if (!data.projects.every((p) => isPlainObject(p) && typeof p.id === "string" && typeof p.name === "string")) {
    return "Sauvegarde invalide : univers mal formés.";
  }
  for (const key of ["subProjects", "allData", "knowledgeBaseByProject", "settings"]) {
    if (data[key] !== undefined && !isPlainObject(data[key])) {
      return `Sauvegarde invalide : champ « ${key} » mal formé.`;
    }
  }
  for (const books of Object.values(data.subProjects || {})) {
    if (!Array.isArray(books) || !books.every((b) => isPlainObject(b) && typeof b.id === "string")) {
      return "Sauvegarde invalide : livres mal formés.";
    }
  }
  for (const columns of Object.values(data.allData || {})) {
    if (!Array.isArray(columns) || !columns.every((c) => isPlainObject(c) && Array.isArray(c.pages))) {
      return "Sauvegarde invalide : arcs mal formés.";
    }
  }
  for (const files of Object.values(data.knowledgeBaseByProject || {})) {
    if (!Array.isArray(files)) return "Sauvegarde invalide : base de connaissances mal formée.";
  }
  if (data.trash !== undefined && !Array.isArray(data.trash)) {
    return "Sauvegarde invalide : corbeille mal formée.";
  }
  return null;
}
