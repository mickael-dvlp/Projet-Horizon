// Limites de stockage : 1 Mio par document Firestore (compte connecté), et
// ~5 millions de caractères pour le localStorage de Chromium (invité).
export const FIRESTORE_DOC_LIMIT = 1_048_576;
export const LOCAL_STORAGE_LIMIT = 5_000_000;
const USAGE_WARNING_RATIO = 0.8;
const USAGE_CRITICAL_RATIO = 0.95;

export const USAGE_LEVEL_RANK = { ok: 0, warning: 1, critical: 2 };

// Sérialisation stable (clés triées) : Firestore ne garantit pas l'ordre des
// clés d'un champ map après un aller-retour serveur, contrairement à un objet
// JS local — sans ce tri, une comparaison JSON.stringify() classique verrait
// une "différence" là où le contenu est en fait identique.
export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

// Empreinte servant à détecter un changement à sauvegarder. `lastActive` en
// est exclu : la navigation seule ne doit déclencher aucune écriture, et deux
// appareils ouverts sur des livres différents se renverraient sinon leur
// position en boucle à chaque synchronisation.
export function syncFingerprint(data) {
  const { lastActive, ...content } = data;
  return stableStringify(content);
}

// Part de l'espace disponible occupée par des données sérialisées, et niveau
// d'alerte correspondant ("ok", "warning" à 80 %, "critical" à 95 %).
export function computeStorageUsage(serialized, isGuest) {
  const used = isGuest ? serialized.length : new TextEncoder().encode(serialized).length;
  const limit = isGuest ? LOCAL_STORAGE_LIMIT : FIRESTORE_DOC_LIMIT;
  const ratio = used / limit;
  const level =
    ratio >= USAGE_CRITICAL_RATIO ? "critical" : ratio >= USAGE_WARNING_RATIO ? "warning" : "ok";
  return { used, limit, ratio, level };
}
