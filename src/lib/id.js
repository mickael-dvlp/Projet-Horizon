// Identifiant unique préfixé (ex. "p-3f2c…"). crypto.randomUUID plutôt que
// Date.now() : deux créations dans la même milliseconde (ou sur deux
// appareils) ne peuvent plus produire le même id.
export function newId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}
