import { redirect } from 'next/navigation';
import { obtenerSesion } from '@/lib/session';
import Sidebar from '@/components/nav/Sidebar';
import MobileHeader from '@/components/nav/MobileHeader';
import StorageAlert from '@/components/ui/StorageAlert';
import StorageWidget from '@/components/ui/StorageWidget';

const NAV_USER = [
  { href: '/nueva-compra', label: 'Nueva compra', icon: '➕' },
  { href: '/mis-compras', label: 'Mis compras', icon: '📋' },
  { href: '/devoluciones', label: 'Devoluciones', icon: '🔄' },
  { href: '/gasto-chofer', label: 'Gasto de chofer', icon: '🚛' },
  { href: '/mis-gastos', label: 'Mis gastos de chofer', icon: '💸' },
];

const NAV_SECRETARIA = [
  { href: '/flota', label: 'Flota / Camiones', icon: '🚚' },
  { href: '/viajes', label: 'Viajes', icon: '🛣️' },
  { href: '/seguros', label: 'Seguros', icon: '🛡️' },
  { href: '/choferes', label: 'Conductores', icon: '👨‍✈️' },
  { href: '/reportes', label: 'Reportes mensuales', icon: '📅' },
  { href: '/impuestos', label: 'Impuestos', icon: '🧾' },
  { href: '/catalogos', label: 'Catálogos', icon: '🏷️' },
  { href: '/gastos-placa', label: 'Gastos por placa', icon: '🔍' },
];

const NAV_SUPERVISOR = [
  { href: '/historial', label: 'Historial global', icon: '📊' },
  { href: '/flota', label: 'Flota / Camiones', icon: '🚚' },
  { href: '/viajes', label: 'Viajes', icon: '🛣️' },
  { href: '/seguros', label: 'Seguros', icon: '🛡️' },
  { href: '/choferes', label: 'Conductores', icon: '👨‍✈️' },
  { href: '/reportes', label: 'Reportes mensuales', icon: '📅' },
  { href: '/impuestos', label: 'Impuestos', icon: '🧾' },
  { href: '/gastos-choferes', label: 'Gastos conductores', icon: '📋' },
  { href: '/gastos-placa', label: 'Gastos por placa', icon: '🔍' },
  { href: '/catalogos', label: 'Catálogos', icon: '🏷️' },
];

const NAV_ADMIN = [
  { href: '/historial', label: 'Historial global', icon: '📊' },
  { href: '/flota', label: 'Flota / Camiones', icon: '🚚' },
  { href: '/viajes', label: 'Viajes', icon: '🛣️' },
  { href: '/impuestos', label: 'Impuestos', icon: '🧾' },
  { href: '/seguros', label: 'Seguros', icon: '🛡️' },
  { href: '/choferes', label: 'Conductores', icon: '👨‍✈️' },
  { href: '/reportes', label: 'Reportes mensuales', icon: '📅' },
  { href: '/gastos-choferes', label: 'Gastos conductores', icon: '📋' },
  { href: '/gastos-placa', label: 'Gastos por placa', icon: '🔍' },
  { href: '/usuarios', label: 'Usuarios', icon: '👥' },
  { href: '/catalogos', label: 'Catálogos', icon: '🏷️' },
];

export default async function AppLayout({ children }) {
  const sesion = await obtenerSesion();
  if (!sesion) redirect('/login?motivo=sesion');
  let items = NAV_USER;
  if (sesion.role === 'admin') items = NAV_ADMIN;
  else if (sesion.role === 'supervisor') items = NAV_SUPERVISOR;
  else if (sesion.role === 'secretaria') items = NAV_SECRETARIA;
  const nombre = sesion.nombre;
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 md:grid md:grid-cols-[240px_1fr]">
      <Sidebar items={items} nombre={nombre} />
      <div className="flex flex-col min-h-screen min-w-0">
        <div className="sticky top-0 z-30">
          <MobileHeader items={items} nombre={nombre} />
          <StorageAlert />
        </div>
        <main className="flex-1 p-4 md:p-6 min-w-0 pb-8">{children}</main>
        {sesion.role === 'admin' && (
          <footer className="px-4 md:px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="max-w-5xl mx-auto">
              <StorageWidget />
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}
