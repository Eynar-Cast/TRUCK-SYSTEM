'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LogoutButton from './LogoutButton';
import CambiarPassword from './CambiarPassword';
import ThemeToggle from './ThemeToggle';

export default function Sidebar({ items, nombre }) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-60 bg-slate-900 text-slate-300 min-h-screen flex-col print:hidden">
      <div className="p-5 border-b border-white/10">
        <div className="font-bold text-white">GestorCompras</div>
        <div className="text-xs text-slate-500">{nombre}</div>
      </div>
      <nav className="p-3 flex-1">
        {items.map(i => {
          const activo = pathname.startsWith(i.href);
          return (
            <Link
              key={i.href}
              href={i.href}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm mb-1 transition ${
                activo ? 'bg-blue-600/25 text-blue-400 border-l-2 border-blue-400' : 'hover:bg-white/10 hover:text-white'
              }`}
            >
              <span>{i.icon}</span><span>{i.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-white/10 space-y-1">
        <ThemeToggle />
        <CambiarPassword />
        <LogoutButton />
      </div>
    </aside>
  );
}