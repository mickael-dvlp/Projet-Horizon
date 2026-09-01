// Convertit le HTML produit par l'éditeur (contentEditable) en Markdown.
// Utilise le DOM du navigateur : client-only.
export function htmlToMarkdown(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;

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
