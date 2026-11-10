import { sanitizeFilename, createNameAllocator } from "@/lib/download";

const KB_FOLDER = "Base de connaissances";

function splitExtension(name) {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? { base: name.slice(0, dot), ext: name.slice(dot) } : { base: name, ext: "" };
}

// Arborescence de l'export ZIP : un dossier par univers / livre / arc, un
// fichier Markdown par chapitre, ses scènes dans <chapitre>/Scènes/. Fonction
// pure (renvoie la liste des fichiers { path, content }) pour rester
// testable sans JSZip ; `toMarkdown` convertit le HTML des chapitres.
//
// Une fiche de connaissances "univers entier" va sous Base de connaissances/
// à la racine de l'univers ; une fiche scopée va dans le dossier de chacun
// des livres auxquels elle est rattachée (dupliquée si plusieurs), pour que
// chaque export de livre reste autonome.
export function buildZipEntries(
  { projects, subProjects, allProjectsData, knowledgeBaseByProject },
  toMarkdown
) {
  const entries = [];
  const markdownDoc = (title, html) =>
    `# ${title || "Sans titre"}\n\n${toMarkdown(html || "")}`;
  const allocProject = createNameAllocator(["export.json"]);

  projects.forEach((project) => {
    const projectPath = allocProject(sanitizeFilename(project.name));
    const books = subProjects[project.id] || [];
    const allocBook = createNameAllocator([KB_FOLDER]);
    const bookPaths = new Map(
      books.map((book) => [book.id, `${projectPath}/${allocBook(sanitizeFilename(book.name))}`])
    );

    books.forEach((book) => {
      const allocArc = createNameAllocator([KB_FOLDER]);
      (allProjectsData[book.id] || []).forEach((col) => {
        const arcPath = `${bookPaths.get(book.id)}/${allocArc(sanitizeFilename(col.title))}`;
        const allocChapter = createNameAllocator();
        (col.pages || []).forEach((page) => {
          const chapterPath = `${arcPath}/${allocChapter(sanitizeFilename(page.title || "chapitre"))}`;
          entries.push({ path: `${chapterPath}.md`, content: markdownDoc(page.title, page.content) });
          const allocScene = createNameAllocator();
          (page.scenes || []).forEach((scene) => {
            const sceneFile = allocScene(sanitizeFilename(scene.title || "scène"), ".md");
            entries.push({
              path: `${chapterPath}/Scènes/${sceneFile}`,
              content: markdownDoc(scene.title, scene.content),
            });
          });
        });
      });
    });

    const kbAllocators = new Map();
    const allocKbIn = (folder) => {
      if (!kbAllocators.has(folder)) kbAllocators.set(folder, createNameAllocator());
      return kbAllocators.get(folder);
    };
    (knowledgeBaseByProject[project.id] || []).forEach((file) => {
      const { base, ext } = splitExtension(sanitizeFilename(file.name));
      const scope = file.subProjectIds || [];
      const folders =
        scope.length === 0
          ? [`${projectPath}/${KB_FOLDER}`]
          : scope.filter((id) => bookPaths.has(id)).map((id) => `${bookPaths.get(id)}/${KB_FOLDER}`);
      folders.forEach((folder) => {
        entries.push({ path: `${folder}/${allocKbIn(folder)(base, ext)}`, content: file.content || "" });
      });
    });
  });

  return entries;
}
