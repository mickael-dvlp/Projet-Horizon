// Recherche simple (insensible à la casse) sur le nom et le contenu des
// fiches de la base de connaissances. Pour chaque fiche correspondante,
// calcule un court extrait centré sur la première occurrence trouvée dans
// le contenu, pour donner un aperçu du contexte sans ouvrir la fiche.
export function searchKbFiles(files, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return files
    .map((file) => {
      const name = file.name || "";
      const content = file.content || "";
      const nameMatches = name.toLowerCase().includes(q);
      const matchIndex = content.toLowerCase().indexOf(q);

      if (!nameMatches && matchIndex === -1) return null;

      let snippet = null;
      if (matchIndex !== -1) {
        const start = Math.max(0, matchIndex - 40);
        const end = Math.min(content.length, matchIndex + q.length + 60);
        snippet =
          (start > 0 ? "…" : "") +
          content.slice(start, end).replace(/\s+/g, " ").trim() +
          (end < content.length ? "…" : "");
      }

      return { file, snippet };
    })
    .filter(Boolean);
}
