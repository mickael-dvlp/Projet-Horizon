"use client";
import { useState } from "react";
import { auth, googleProvider } from "@/firebase/config";
import { signInWithPopup } from "firebase/auth";
import { X } from "lucide-react";

export default function AuthModal({ isOpen, onClose, onGuestLogin }) {
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const getAuthError = (err) => {
    switch (err.code) {
      case "auth/popup-closed-by-user":
        return "Connexion annulée.";
      case "auth/too-many-requests":
        return "Trop de tentatives. Réessayez dans quelques minutes.";
      default:
        return "Une erreur est survenue. Veuillez réessayer.";
    }
  };

  const handleGoogle = async () => {
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
      onClose();
    } catch (err) {
      setError(getAuthError(err));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xl p-4">
      <div className="relative bg-white w-full max-w-sm p-10 rounded-[3rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] animate-in fade-in zoom-in duration-500">
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[3rem]">
          <img
            src="/images/fond-livre.jpg"
            alt=""
            className="w-full h-full object-cover opacity-20"
          />
        </div>

        <div className="relative z-10 flex flex-col">
          <button
            onClick={onClose}
            className="absolute -right-4 -top-6 p-3 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all duration-300"
          >
            <X size={24} />
          </button>

          <div className="text-center mb-8">
            <h2 className="text-3xl font-black text-slate-800 tracking-tight mb-3">
              Bon retour !
            </h2>
            <p className="text-slate-500 leading-relaxed">
              Connectez-vous pour accéder à vos projets et les synchroniser.
            </p>
          </div>

          <div className="space-y-4">
            <button
              onClick={handleGoogle}
              className="w-full bg-slate-50 py-4 rounded-2xl flex items-center justify-center gap-4 hover:bg-slate-100 transition-all font-bold text-slate-600 cursor-pointer"
            >
              <img
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                className="w-6 h-6"
                alt="Google"
              />
              Continuer avec Google
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 border-t border-slate-100" />
              <span className="text-xs text-slate-300 font-bold tracking-widest uppercase">
                Ou
              </span>
              <div className="flex-1 border-t border-slate-100" />
            </div>

            <button
              type="button"
              onClick={() => {
                onGuestLogin();
                onClose();
              }}
              className="w-full py-4 rounded-2xl font-bold text-lg hover:-translate-y-1 transition-all active:scale-[0.97] cursor-pointer"
              style={{
                backgroundColor: "#fecdd3",
                color: "#9f1239",
                boxShadow: "0 20px 25px -5px rgba(251,113,133,0.3)",
              }}
            >
              Continuer en tant qu'invité
            </button>
          </div>

          {error && (
            <div className="mt-4 bg-red-50 text-red-500 p-4 rounded-2xl text-sm font-semibold border border-red-100 text-center">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
