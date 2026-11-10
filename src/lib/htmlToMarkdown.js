// Convertit le HTML produit par l'éditeur (contentEditable) en Markdown.
// Utilise le DOM du navigateur : client-only. DOMParser produit un document
// inerte : contrairement à innerHTML sur un élément de la page, aucun
// gestionnaire (ex. <img onerror>) ne s'y exécute et aucune ressource n'est
// chargée — le contenu exporté n'est pas forcément passé par DOMPurify.
export function htmlToMarkdown(html) {
  const tmp = new DOMParser().parseFromString(html || "", "text/html").body;

  const walk = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    const tag = node.nodeName.toLowerCase();
    const kids = () => Array.from(node.childNodes).map(walk).join("");
    switch (tag) {
      case "h1": return `\n# ${kids()}\n`;
      case "h2": return `\n## ${kids()}\n`;
      case "h3": return `\n### ${kids()}\n`;
      case "strong": case "b": return `**${kids()}**`;
      case "em":    case "i": return `*${kids()}*`;
      case "u": return `<u>${kids()}</u>`;
      case "p":   return `${kids()}\n`;
      case "div": return `${kids()}\n`;
      case "br":  return "\n";
      case "ul":
        return (
          Array.from(node.childNodes)
            .filter((n) => n.nodeName.toLowerCase() === "li")
            .map((li) => `- ${Array.from(li.childNodes).map(walk).join("")}`)
            .join("\n") + "\n"
        );
      case "ol":
        return (
          Array.from(node.childNodes)
            .filter((n) => n.nodeName.toLowerCase() === "li")
            .map((li, i) => `${i + 1}. ${Array.from(li.childNodes).map(walk).join("")}`)
            .join("\n") + "\n"
        );
      default: return kids();
    }
  };

  return walk(tmp).replace(/\n{3,}/g, "\n\n").trim();
}
