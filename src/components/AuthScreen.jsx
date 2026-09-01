"use client";
import Image from "next/image";
import AuthModal from "@/components/AuthModal";

export default function AuthScreen({ isAuthModalOpen, setIsAuthModalOpen, onGuestLogin }) {
  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Image de fond floutté pour éviter la monoc-couleur */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/fond-livre.jpg"
          alt="Background"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        {/* Voile de transparence pour que le texte reste lisible */}
        <div className="absolute inset-0 bg-white/30 dark:bg-slate-950/70 backdrop-blur-sm" />
      </div>

      {/* Contenu (Au-dessus de l'image avec Z-index) */}
      <div className="relative z-10 flex flex-col items-center text-center p-6">
        <div className="w-48 h-24 bg-indigo-600 rounded-4xl mb-10 shadow-2xl flex items-center justify-center text-white font-black text-2xl transform -rotate-2 hover:rotate-0 transition-transform duration-500">
          Horizon
        </div>

        <h1 className="text-5xl md:text-7xl font-black text-slate-800 dark:text-slate-100 mb-6 tracking-tighter max-w-4xl leading-tight">
          Ouvrir ses perspectives <br />
          <span className="text-indigo-600 dark:text-indigo-400">grâce à ses notes</span>
        </h1>

        <p className="text-slate-600 dark:text-slate-300 mb-12 max-w-xl text-lg md:text-xl font-medium leading-relaxed">
          Rejoignez l’espace où vos idées prennent forme. Connectez-vous pour
          accéder à vos projets et synchroniser vos pages.
        </p>

        <button
          onClick={() => setIsAuthModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-12 py-5 rounded-2xl font-black text-xl shadow-[0_20px_50px_rgba(79,70,229,0.3)] transition-all transform hover:scale-105 active:scale-95"
        >
          Commencer l’aventure
        </button>
      </div>

      {/* La modale (Formule de co et d'inscription qui est prio) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onGuestLogin={onGuestLogin}
      />
    </div>
  );
}
