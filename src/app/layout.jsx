import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata = {
  title: "Horizon",
  description: "Organisez vos univers d'écriture : livres, arcs, chapitres, scènes et base de connaissances.",
};

// viewport-fit=cover laisse l'app dessiner sous l'encoche/la zone
// d'accueil en mode PWA standalone ; les zones de sécurité elles-mêmes
// sont gérées via env(safe-area-inset-*) dans les composants concernés.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
};

// Applique la classe "dark" avant l'hydratation React pour éviter un flash
// de thème clair. Doit rester synchronisé avec la logique de useTheme.js.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("horizon-theme");
    var isDark =
      stored === "dark" ||
      (stored !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", isDark);
  } catch (e) {}
})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className={jakarta.className} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}
