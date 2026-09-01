/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactCompiler: true,
  // L'indicateur de dev (coin bas-gauche par défaut) chevauche le bouton
  // "Corbeille" de la sidebar.
  devIndicators: {
    position: "bottom-right",
  },
  // Export statique : nécessaire pour empaqueter l'app dans Electron
  // (pas de serveur Next au runtime, tout est servi en fichiers statiques).
  output: "export",
  images: {
    // L'optimisation d'image de Next nécessite un serveur, indisponible
    // en export statique / dans le shell Electron.
    unoptimized: true,
  },
};

export default nextConfig;
