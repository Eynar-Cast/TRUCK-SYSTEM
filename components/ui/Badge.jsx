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
  factura:     'bg-emerald-100 text-emerald-700',
  sin_factura: 'bg-slate-100 text-slate-500',
  fisico:      'bg-blue-100 text-blue-700',
  qr:          'bg-violet-100 text-violet-700',
  devuelto:    'bg-amber-100 text-amber-700',
  activo:      'bg-emerald-100 text-emerald-700',
  inactivo:    'bg-red-100 text-red-600',
  admin:       'bg-indigo-100 text-indigo-700',
  user:        'bg-slate-100 text-slate-600',
  pagado:      'bg-emerald-100 text-emerald-700',
  pendiente:   'bg-amber-100 text-amber-700',
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
  const estilo = ESTILOS[tipo] || 'bg-slate-100 text-slate-600';
  const texto = label || LABELS[tipo] || tipo;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${estilo}`}>
      {texto}
    </span>
  );
}
