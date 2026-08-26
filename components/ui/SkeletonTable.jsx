'use client';

/**
 * SkeletonTable — placeholder animado para tablas mientras cargan datos.
 * Ayuda a reducir CLS al mantener dimensiones consistentes.
 *
 * Props:
 *   columns – número de columnas (default: 5)
 *   rows    – número de filas a mostrar (default: 5)
 */
export default function SkeletonTable({ columns = 5, rows = 5 }) {
  return (
    <div className="p-4">
      <div className="animate-pulse space-y-3">
        {/* Header skeleton */}
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {Array.from({ length: columns }).map((_, i) => (
            <div key={i} className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
          ))}
        </div>
        {/* Row skeletons */}
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {Array.from({ length: columns }).map((_, colIdx) => (
              <div key={colIdx} className="h-4 bg-slate-100 dark:bg-slate-800 rounded" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}