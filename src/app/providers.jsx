"use client";
import { ConfirmProvider } from "@/components/ConfirmDialog";

// Contextes partagés par toute l'app côté client (layout.jsx reste un
// composant serveur).
export default function Providers({ children }) {
  return <ConfirmProvider>{children}</ConfirmProvider>;
}
