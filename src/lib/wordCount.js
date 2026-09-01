// Compte mots/caractères depuis du HTML, sans dépendre du DOM — reste donc
// correct même quand l'élément affichant ce contenu n'est pas monté (ex.
// liste des scènes affichée à la place de l'éditeur).
export function countWordsFromHtml(html) {
  const text = (html || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").trim();
  return {
    chars: text.length,
    words: text ? text.split(/\s+/).filter(Boolean).length : 0,
  };
}
