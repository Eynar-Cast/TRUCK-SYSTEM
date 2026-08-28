'use client';
import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();
  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }
  return (
    <button onClick={handleLogout} className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 ring-1 ring-transparent hover:ring-red-500/20 transition-all">
      <span className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-sm">🚪</span> Cerrar sesión
    </button>
  );
}