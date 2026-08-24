import { redirect } from 'next/navigation';
import { obtenerSesion } from '@/lib/session';
import Sidebar from '@/components/nav/Sidebar';
import MobileHeader from '@/components/nav/MobileHeader';

/**
 * AppLayout — layout principal de la aplicación (post-login).
 *
 * Lee la sesión en el servidor y pasa los items de navegación
 * a los componentes Sidebar (desktop) y MobileHeader (móvil).
 *
 * - Usuarios normales ven: Nueva compra, Mis compras, Devoluciones, Gasto de chofer.
 * - Administradores ven: Historial global, Choferes, Gastos choferes, Usuarios.
 */

const NAV_USER = [
  { href: '/nueva-compra', label: 'Nueva compra', icon: '➕' },
  { href: '/mis-compras', label: 'Mis compras', icon: '📋' },
  { href: '/devoluciones', label: 'Devoluciones', icon: '🔄' },
  { href: '/gasto-chofer', label: 'Gasto de chofer', icon: '🚛' },
  { href: '/mis-gastos', label: 'Mis gastos de chofer', icon: '💸' },
];

const NAV_ADMIN = [
  { href: '/historial', label: 'Historial global', icon: '📊' },
  { href: '/choferes', label: 'Choferes', icon: '🚛' },
  { href: '/gastos-choferes', label: 'Gastos choferes', icon: '📋' },
  { href: '/usuarios', label: 'Usuarios', icon: '👥' },
  { href: '/exportar', label: 'Exportar Datos', icon: '⬇️' },
  { href: '/limpiar-datos', label: 'Limpiar Base de Datos', icon: '🗑️' },
];

export default async function AppLayout({ children }) {
  const sesion = await obtenerSesion();

  if (!sesion) {
    redirect('/login?motivo=sesion');
  }

  const items = sesion.role === 'admin' ? NAV_ADMIN : NAV_USER;
  const nombre = sesion.nombre;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex">
      {/* Desktop sidebar */}
      <Sidebar items={items} nombre={nombre} />

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Mobile header */}
        <MobileHeader items={items} nombre={nombre} />

        <main className="flex-1 p-4 md:p-6 min-w-0 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}