"use client";
// Composant de la modale d'authentification pour la connexion et l'inscription des utilisateurs
import { useState } from "react";
import { auth, googleProvider } from "@/firebase/config";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { X, Mail, Lock, User } from "lucide-react";

// Composant de la modale d'authentification
export default function AuthModal({ isOpen, onClose, onGuestLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pseudo, setPseudo] = useState("");
  const [error, setError] = useState("");

  // Si la modale n'est pas ouverte, ne rien afficher
  if (!isOpen) return null;

  const getAuthError = (err) => {
    switch (err.code) {
      case "auth/invalid-credential":
      case "auth/user-not-found":
      case "auth/wrong-password":
        return "Email ou mot de passe incorrect.";
      case "auth/email-already-in-use":
        return "Cette adresse email est déjà utilisée.";
      case "auth/weak-password":
        return "Le mot de passe doit contenir au moins 6 caractères.";
      case "auth/invalid-email":
        return "Adresse email invalide.";
      case "auth/too-many-requests":
        return "Trop de tentatives. Réessayez dans quelques minutes.";
      case "auth/popup-closed-by-user":
        return "Connexion annulée.";
      default:
        return "Une erreur est survenue. Veuillez réessayer.";
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setError("");
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );
        await updateProfile(userCredential.user, {
          displayName: pseudo,
        });
      }
      onClose();
    } catch (err) {
      setError(getAuthError(err));
    }
  };

  const handleGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      onClose();
    } catch (err) {
      setError(getAuthError(err));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xl p-4">
      {/* Conteneur de la Modale */}
      <div className="relative bg-white w-full max-w-120 p-8 md:p-12 rounded-[3rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] overflow-y-auto max-h-[90vh] animate-in fade-in zoom-in duration-500">
        {/* IMAGE DE FOND (TRANSVERSALE) */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[3rem]">
          <img
            src="/images/fond-livre.jpg"
            alt="Background Decor"
            className="w-full h-full object-cover opacity-20"
          />
        </div>

        {/* CONTENU */}
        <div className="relative z-10 flex flex-col">
          <button
            onClick={onClose}
            className="absolute -right-4 -top-6 p-3 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all duration-300"
          >
            <X size={24} />
          </button>

          <div className="text-center mb-8">
            <h2 className="text-4xl font-black text-slate-800 tracking-tight mb-4">
              {isLogin ? "Bon retour !" : "Bienvenue"}
            </h2>
            <p className="text-slate-500 text-base leading-relaxed max-w-70 mx-auto">
              {isLogin
                ? "Heureux de vous revoir sur votre espace Horizon."
                : "Commencez à organiser vos idées dès aujourd'hui."}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-4">
              {/* CHAMP PSEUDO */}
              {!isLogin && (
                <div className="relative group animate-in slide-in-from-top-2">
                  <User
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors"
                    size={20}
                  />
                  <input
                    type="text"
                    value={pseudo}
                    onChange={(e) => setPseudo(e.target.value)}
                    className="w-full pl-14 pr-6 py-4 bg-slate-50 border-none rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-slate-700 shadow-sm"
                    placeholder="Votre pseudonyme"
                    required={!isLogin}
                  />
                </div>
              )}
              {/* CHAMP EMAIL */}
              <div className="relative group">
                <Mail
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors"
                  size={20}
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-14 pr-6 py-4 bg-slate-50 border-none rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-slate-700 shadow-sm"
                  placeholder="Adresse email"
                  required
                />
              </div>
              {/* CHAMP MOT DE PASSE */}
              <div className="relative group">
                <Lock
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors"
                  size={20}
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-14 pr-6 py-4 bg-slate-50 border-none rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-slate-700 shadow-sm"
                  placeholder="Mot de passe"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-500 p-4 rounded-2xl text-sm font-semibold border border-red-100 text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:shadow-indigo-300 hover:-translate-y-1 transition-all active:scale-[0.97] cursor-pointer"
            >
              {isLogin ? "Se connecter" : "Créer mon compte"}
            </button>

            {/* BOUTON INVITÉ */}
            <button
              type="button"
              onClick={() => {
                onGuestLogin();
                onClose();
              }}
              className="w-full py-5 rounded-2xl font-black text-lg hover:-translate-y-1 transition-all active:scale-[0.97] cursor-pointer"
              style={{
                backgroundColor: "#fecdd3",
                color: "#9f1239",
                boxShadow: "0 20px 25px -5px rgba(251,113,133,0.3)",
              }}
            >
              Continuer en tant qu'invité
            </button>

            {/* SÉPARATEUR */}
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 border-t border-slate-100"></div>
              <span className="text-xs text-slate-300 font-bold tracking-widest uppercase">Ou</span>
              <div className="flex-1 border-t border-slate-100"></div>
            </div>

            {/* BOUTON GOOGLE */}
            <button
              type="button"
              onClick={handleGoogle}
              className="w-full bg-slate-50 py-4 rounded-2xl flex items-center justify-center gap-4 hover:bg-slate-100 transition-all font-bold text-slate-600 cursor-pointer"
            >
              <img
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                className="w-6 h-6"
                alt="Google Icon"
              />
              Continuer avec Google
            </button>

            <p className="text-center text-slate-400 font-medium pt-2">
              {isLogin ? "Nouveau ici ?" : "Déjà membre ?"}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="ml-2 text-indigo-600 font-black hover:text-indigo-800 transition-colors underline-offset-4 hover:underline"
              >
                {isLogin ? "Inscrivez-vous" : "Connectez-vous"}
              </button>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

// Note : Le code ci-dessus inclut les modifications récentes pour ajouter la gestion du pseudo lors de l'inscription, ainsi que des commentaires pour expliquer les différentes parties du composant.
