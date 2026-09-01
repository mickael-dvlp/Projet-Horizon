// Convention Next.js App Router : servi automatiquement sur
// /manifest.webmanifest et lié dans le <head>, sans édition manuelle de
// `metadata`. Pas de service worker / cache hors-ligne ici (volontairement
// exclu — voir la demande d'origine).
export const dynamic = "force-static";

export default function manifest() {
  return {
    name: "Horizon",
    short_name: "Horizon",
    description: "Organisez vos univers d'écriture : livres, arcs, chapitres, scènes et base de connaissances.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#4f46e5",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
