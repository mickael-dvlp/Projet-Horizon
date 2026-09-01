// Calcule la progression d'un chapitre à partir de ses scènes si elles
// existent, sinon à partir de son propre statut.
export function computeChapterProgress(page) {
  const scenes = page?.scenes || [];
  if (scenes.length > 0) {
    const done = scenes.filter((s) => s.status === "done").length;
    return { total: scenes.length, done, percent: Math.round((done / scenes.length) * 100) };
  }
  const done = page?.status === "done" ? 1 : 0;
  return { total: 1, done, percent: done ? 100 : 0 };
}

// Calcule la progression d'un livre à partir des chapitres de ses arcs.
export function computeBookProgress(columns = []) {
  const pages = columns.flatMap((c) => c.pages || []);
  const total = pages.length;
  const done = pages.filter((p) => p.status === "done").length;
  return { total, done, percent: total ? Math.round((done / total) * 100) : 0 };
}
