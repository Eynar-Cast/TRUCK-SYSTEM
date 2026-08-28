'use client';

/**
 * Badge — indicador visual de estado.
 *
 * Uso: <Badge tipo="factura" /> o <Badge tipo="qr" />
 *
 * Tipos soportados:
 *   factura, sin_factura, fisico, qr, devuelto, activo,
 *   inactivo, admin, user, pagado, pendiente
 */

const ESTILOS = {
  factura:     'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/15 dark:bg-emerald-950/40 dark:text-emerald-300',
  sin_factura: 'bg-slate-100 text-slate-600 ring-1 ring-slate-500/10 dark:bg-slate-800 dark:text-slate-400',
  fisico:      'bg-blue-50 text-blue-700 ring-1 ring-blue-600/15 dark:bg-blue-950/40 dark:text-blue-300',
  qr:          'bg-violet-50 text-violet-700 ring-1 ring-violet-600/15 dark:bg-violet-950/40 dark:text-violet-300',
  devuelto:    'bg-amber-50 text-amber-700 ring-1 ring-amber-500/15 dark:bg-amber-950/40 dark:text-amber-300',
  activo:      'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/15 dark:bg-emerald-950/40 dark:text-emerald-300',
  inactivo:    'bg-red-50 text-red-600 ring-1 ring-red-500/15 dark:bg-red-950/40 dark:text-red-300',
  admin:       'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/15 dark:bg-indigo-950/40 dark:text-indigo-300',
  user:        'bg-slate-100 text-slate-600 ring-1 ring-slate-500/10 dark:bg-slate-800 dark:text-slate-400',
  pagado:      'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/15 dark:bg-emerald-950/40 dark:text-emerald-300',
  pendiente:   'bg-amber-50 text-amber-700 ring-1 ring-amber-500/15 dark:bg-amber-950/40 dark:text-amber-300',
};

const LABELS = {
  factura:     '📄 Con factura',
  sin_factura: 'Sin factura',
  fisico:      '💵 Efectivo',
  qr:          '📱 QR',
  devuelto:    '↩ Devuelto',
  activo:      'Activo',
  inactivo:    'Inactivo',
  admin:       'Admin',
  user:        'Usuario',
  pagado:      'Pagado',
  pendiente:   'Pendiente',
};

export default function Badge({ tipo, label }) {
  const estilo = ESTILOS[tipo] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
  const texto = label || LABELS[tipo] || tipo;

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide ${estilo}`}>
      {texto}
    </span>
  );
}
