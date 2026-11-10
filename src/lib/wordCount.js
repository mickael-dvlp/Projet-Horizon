// Balises qui séparent visuellement le texte (paragraphes, lignes, titres,
// listes…) : remplacées par un espace. Les balises en ligne (<b>, <i>,
// <span>…) sont simplement retirées, pour ne pas couper un mot en deux
// ("<b>gr</b>as" reste un seul mot).
const BLOCK_TAG = /<\/?(?:p|div|br|h[1-6]|li|ul|ol|blockquote|pre|hr|table|tr|td|th)\b[^>]*>/gi;
const ANY_TAG = /<[^>]*>/g;

const NAMED_ENTITIES = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match;
  });
}

// Compte mots/caractères depuis du HTML, sans dépendre du DOM — reste donc
// correct même quand l'élément affichant ce contenu n'est pas monté (ex.
// liste des scènes affichée à la place de l'éditeur). Source unique du
// compteur : l'éditeur l'utilise aussi pendant la frappe, pour que le
// chiffre ne change pas d'une méthode de calcul à l'autre.
export function countWordsFromHtml(html) {
  const text = decodeEntities((html || "").replace(BLOCK_TAG, " ").replace(ANY_TAG, "")).trim();
  return {
    chars: text.length,
    words: text ? text.split(/\s+/).filter(Boolean).length : 0,
  };
}
