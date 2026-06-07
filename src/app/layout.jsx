import "./globals.css";

export const metadata = {
  title: "Memo App",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body className="bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
