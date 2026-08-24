'use client';

export default function ThemeToggle({ variant = 'fila' }) {
  function toggle() {
    const oscuro = document.documentElement.classList.toggle('dark');
    try {
      localStorage.setItem('gestor-tema', oscuro ? 'oscuro' : 'claro');
    } catch (e) {}
  }

  if (variant === 'icono') {
    return (
      <button
        onClick={toggle}
        aria-label="Cambiar tema"
        title="Cambiar tema"
        className="w-9 h-9 flex items-center justify-center text-lg rounded-lg hover:bg-white/10 transition"
      >
        <span className="dark:hidden">🌙</span>
        <span className="hidden dark:inline">☀️</span>
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      aria-label="Cambiar tema"
      className="group w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
    >
      <span className="w-7 h-7 rounded-lg flex items-center justify-center text-base bg-white/5 group-hover:bg-white/10">
        <span className="dark:hidden">🌙</span>
        <span className="hidden dark:inline">☀️</span>
      </span>
      <span className="font-medium">
        <span className="dark:hidden">Modo oscuro</span>
        <span className="hidden dark:inline">Modo claro</span>
      </span>
    </button>
  );
}
