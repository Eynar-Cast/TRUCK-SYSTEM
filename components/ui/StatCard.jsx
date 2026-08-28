'use client';

/**
 * StatCard — tarjeta de estadística reutilizable.
 *
 * Props:
 *   titulo  – texto descriptivo (ej. "Total compras")
 *   valor   – valor principal a mostrar (ej. "Bs. 12,500.00" o "23")
 *   icono   – emoji o string que se muestra junto al título (ej. "🛒")
 *   color   – variante de color: 'blue' | 'green' | 'amber' | 'red' | 'violet' (default: 'blue')
 */

const COLORES = {
  blue:   'bg-gradient-to-br from-blue-50 to-blue-50/50 border-blue-200/60 text-blue-700 dark:from-blue-950/40 dark:to-blue-900/20 dark:border-blue-900/50 dark:text-blue-300 shadow-blue-500/5',
  green:  'bg-gradient-to-br from-emerald-50 to-emerald-50/50 border-emerald-200/60 text-emerald-700 dark:from-emerald-950/40 dark:to-emerald-900/20 dark:border-emerald-900/50 dark:text-emerald-300 shadow-emerald-500/5',
  amber:  'bg-gradient-to-br from-amber-50 to-amber-50/50 border-amber-200/60 text-amber-700 dark:from-amber-950/40 dark:to-amber-900/20 dark:border-amber-900/50 dark:text-amber-300 shadow-amber-500/5',
  red:    'bg-gradient-to-br from-red-50 to-red-50/50 border-red-200/60 text-red-700 dark:from-red-950/40 dark:to-red-900/20 dark:border-red-900/50 dark:text-red-300 shadow-red-500/5',
  violet: 'bg-gradient-to-br from-violet-50 to-violet-50/50 border-violet-200/60 text-violet-700 dark:from-violet-950/40 dark:to-violet-900/20 dark:border-violet-900/50 dark:text-violet-300 shadow-violet-500/5',
};

const ICON_BG = {
  blue: 'bg-blue-600 text-white shadow-blue-600/20',
  green: 'bg-emerald-600 text-white shadow-emerald-600/20',
  amber: 'bg-amber-500 text-white shadow-amber-500/20',
  red: 'bg-red-500 text-white shadow-red-500/20',
  violet: 'bg-violet-600 text-white shadow-violet-600/20',
};

export default function StatCard({ titulo, valor, icono, color = 'blue' }) {
  const colorClasses = COLORES[color] || COLORES.blue;
  const iconBg = ICON_BG[color] || ICON_BG.blue;

  return (
    <div className={`group rounded-2xl border p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 ${colorClasses}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wide uppercase opacity-60">
          <span>{titulo}</span>
        </div>
        {icono && <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm shadow-md ring-1 ring-white/20 group-hover:scale-105 transition-transform ${iconBg}`}>{icono}</span>}
      </div>
      <div className="text-2xl font-bold tracking-tight">{valor}</div>
    </div>
  );
}
