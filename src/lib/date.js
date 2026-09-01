// Formate une date "YYYY-MM-DD" en construisant un Date local à partir de ses
// composants (plutôt que new Date(str), qui parse en UTC et peut afficher la
// veille selon le fuseau horaire du visiteur).
export function formatShortDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// "YYYY-MM-DD" du jour, construit depuis les composants locaux (jamais
// toISOString(), qui convertit en UTC et peut décaler d'un jour selon le
// fuseau horaire du visiteur).
function getTodayString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Classe une échéance "YYYY-MM-DD" par rapport à la date locale du jour.
// Comparaison en chaîne (pas de conversion en Date) : sûre pour ce format,
// évite tout risque de décalage de fuseau horaire.
export function getDeadlineStatus(dateStr) {
  if (!dateStr) return null;
  const today = getTodayString();
  if (dateStr < today) return "overdue";
  if (dateStr === today) return "today";
  return "upcoming";
}
