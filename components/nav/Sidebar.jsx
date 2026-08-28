'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LogoutButton from './LogoutButton';
import CambiarPassword from './CambiarPassword';
import ThemeToggle from './ThemeToggle';

const RUTAS_OCULTAS = new Set(['/exportar', '/limpiar-datos']);

export default function Sidebar({ items, nombre }) {
  const pathname = usePathname();
  const itemsVisibles = items.filter(i => !RUTAS_OCULTAS.has(i.href));

  return (
    <aside className="hidden md:flex w-60 bg-slate-900 dark:bg-slate-950 text-slate-300 flex-col print:hidden fixed top-0 left-0 h-screen overflow-y-auto z-40 border-r border-white/[0.06] shadow-2xl shadow-black/20">
      <div className="p-5 border-b border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/20 ring-1 ring-white/10">
            🏭
          </div>
          <div>
            <div className="font-bold text-white tracking-tight leading-none">GestorCompras</div>
            <div className="text-[11px] text-slate-400 font-medium tracking-wide mt-0.5">{nombre}</div>
          </div>
        </div>
      </div>
      <nav className="p-3 flex-1 space-y-0.5">
        {itemsVisibles.map(i => {
          const activo = pathname.startsWith(i.href);
          return (
            <Link
              key={i.href}
              href={i.href}
              className={`group flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                activo
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 ring-1 ring-blue-500/30'
                  : 'text-slate-400 hover:bg-white/[0.06] hover:text-white hover:translate-x-0.5'
              }`}
            >
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm transition ${activo ? 'bg-white/15' : 'bg-white/[0.04] group-hover:bg-white/[0.08]'}`}>{i.icon}</span>
              <span>{i.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-white/[0.06] space-y-1 bg-slate-900/50 backdrop-blur">
        <ThemeToggle />
        <CambiarPassword />
        <LogoutButton />
      </div>
    </aside>
  );
}