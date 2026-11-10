// Découpage des données pour Firestore : le document principal ne garde que
// la structure (univers, livres, arcs, titres, statuts, tâches…), et chaque
// texte — champ `content` d'un chapitre, d'une scène ou d'une fiche, y
// compris dans la corbeille — est stocké dans son propre document
// users/{uid}/contents/{id}. Le document principal reste ainsi loin de la
// limite de 1 Mio, et modifier un chapitre n'écrit que ce chapitre.
//
// Fonctions pures : l'état de l'app garde sa forme habituelle (textes en
// ligne) ; seule la couche de sauvegarde découpe et recompose.

const isPlainObject = (value) => !!value && typeof value === "object" && !Array.isArray(value);

// Copie profonde de `data` sans les champs `content` (texte) des objets
// identifiés, et table id → texte extraite. Les valeurs `undefined` sont
// omises (Firestore les refuse).
export function splitContents(data) {
  const contents = {};
  const walk = (node) => {
    if (Array.isArray(node)) return node.map(walk);
    if (!isPlainObject(node)) return node;
    const out = {};
    for (const [key, child] of Object.entries(node)) {
      if (child === undefined) continue;
      if (key === "content" && typeof node.id === "string" && typeof child === "string") {
        contents[node.id] = child;
        continue;
      }
      out[key] = walk(child);
    }
    return out;
  };
  return { main: walk(data), contents };
}

// Inverse de splitContents : remet chaque texte connu dans l'objet portant
// son id. Un texte déjà présent dans l'objet (ancien format, textes en
// ligne) est conservé tel quel.
export function mergeContents(main, contents) {
  const walk = (node) => {
    if (Array.isArray(node)) return node.map(walk);
    if (!isPlainObject(node)) return node;
    const out = {};
    for (const [key, child] of Object.entries(node)) out[key] = walk(child);
    if (typeof node.id === "string" && !("content" in node) && Object.hasOwn(contents, node.id)) {
      out.content = contents[node.id];
    }
    return out;
  };
  return walk(main);
}

// Tous les ids présents dans les données (éléments vivants et corbeille).
export function collectIds(data) {
  const ids = new Set();
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!isPlainObject(node)) return;
    if (typeof node.id === "string") ids.add(node.id);
    Object.values(node).forEach(walk);
  };
  walk(data);
  return ids;
}

// Écritures nécessaires pour passer des textes déjà enregistrés
// (`previous`) aux textes actuels (`next`) : textes nouveaux ou modifiés à
// écrire, et documents à supprimer. Un texte n'est supprimé que si plus
// aucun élément ne porte son id (élément supprimé définitivement) — jamais
// parce qu'il manque momentanément, ce qui effacerait le texte d'un élément
// existant.
export function planContentWrites(previous, next, referencedIds) {
  const upserts = Object.entries(next).filter(([id, content]) => previous[id] !== content);
  const deletes = Object.keys(previous).filter((id) => !(id in next) && !referencedIds.has(id));
  return { upserts, deletes };
}

// Découpe une liste en paquets de `size` éléments au plus (une écriture
// groupée Firestore est limitée à 500 opérations).
export function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

// Vrai si des textes sont encore stockés dans le document principal (ancien
// format) : il faut alors les déplacer dans leurs propres documents.
export function hasInlineContents(data) {
  return Object.keys(splitContents(data).contents).length > 0;
}
