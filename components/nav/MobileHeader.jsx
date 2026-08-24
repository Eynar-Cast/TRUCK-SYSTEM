'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LogoutButton from './LogoutButton';
import CambiarPassword from './CambiarPassword';
import ThemeToggle from './ThemeToggle';

export default function MobileHeader({ items, nombre }) {
  const [abierto, setAbierto] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <div className="md:hidden flex items-center justify-between bg-slate-900 text-white px-4 py-3 print:hidden">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-sm">🏭</div>
          <span className="font-bold text-sm">GestorCompras</span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle variant="icono" />
          <button onClick={() => setAbierto(true)} className="text-2xl leading-none px-1">☰</button>
        </div>
      </div>

      {abierto && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setAbierto(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-slate-900 text-slate-300 flex flex-col">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div>
                <div className="font-bold text-white">GestorCompras</div>
                <div className="text-xs text-slate-500">{nombre}</div>
              </div>
              <button onClick={() => setAbierto(false)} className="text-white text-xl">✕</button>
            </div>
            <nav className="p-3 flex-1 overflow-y-auto">
              {items.map(i => {
                const activo = pathname.startsWith(i.href);
                return (
                  <Link
                    key={i.href}
                    href={i.href}
                    onClick={() => setAbierto(false)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm mb-1 ${
                      activo ? 'bg-blue-600/25 text-blue-400' : 'hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span>{i.icon}</span><span>{i.label}</span>
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