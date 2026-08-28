'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LogoutButton from './LogoutButton';
import CambiarPassword from './CambiarPassword';
import ThemeToggle from './ThemeToggle';

const RUTAS_OCULTAS = new Set(['/exportar', '/limpiar-datos']);

export default function MobileHeader({ items, nombre }) {
  const [abierto, setAbierto] = useState(false);
  const pathname = usePathname();
  const itemsVisibles = items.filter(i => !RUTAS_OCULTAS.has(i.href));

  return (
    <>
      <div className="md:hidden flex items-center justify-between bg-slate-900 dark:bg-slate-950 text-white px-4 py-3 print:hidden border-b border-white/[0.06] shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-sm shadow-md ring-1 ring-white/10">🏭</div>
          <span className="font-bold text-sm tracking-tight">GestorCompras</span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle variant="icono" />
          <button onClick={() => setAbierto(true)} className="w-9 h-9 grid place-items-center rounded-xl bg-white/[0.06] hover:bg-white/10 transition text-lg leading-none">☰</button>
        </div>
      </div>

      {abierto && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setAbierto(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-slate-900 dark:bg-slate-950 text-slate-300 flex flex-col shadow-2xl border-r border-white/[0.06]">
            <div className="p-5 border-b border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-transparent flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg ring-1 ring-white/10">🏭</div>
                <div>
                  <div className="font-bold text-white tracking-tight leading-none">GestorCompras</div>
                  <div className="text-[11px] text-slate-400 font-medium">{nombre}</div>
                </div>
              </div>
              <button onClick={() => setAbierto(false)} className="w-8 h-8 grid place-items-center rounded-lg bg-white/[0.06] hover:bg-white/10 text-white transition">✕</button>
            </div>
            <nav className="p-3 flex-1 overflow-y-auto space-y-0.5">
              {itemsVisibles.map(i => {
                const activo = pathname.startsWith(i.href);
                return (
                  <Link
                    key={i.href}
                    href={i.href}
                    onClick={() => setAbierto(false)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition ${
                      activo ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm ${activo ? 'bg-white/15' : 'bg-white/[0.04]'}`}>{i.icon}</span><span>{i.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="p-3 border-t border-white/10 space-y-1">
              <CambiarPassword />
              <LogoutButton />
            </div>
          </div>
        </div>
      )}
    </>
  );
}