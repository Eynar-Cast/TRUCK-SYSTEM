'use client';

/**
 * SkeletonCard — placeholder animado para tarjetas de estadísticas.
 * Mantiene dimensiones consistentes para reducir CLS.
 *
 * Props:
 *   count – número de tarjetas a mostrar (default: 4)
 */
export default function SkeletonCard({ count = 4 }) {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-${count} gap-3 mb-5`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 animate-pulse">
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-16 mb-2" />
          <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-24 mb-1" />
          <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-12" />
        </div>
      ))}
    </div>
  );
}