'use client';

/**
 * Calificacion — calificación controlada por estrellas (1 a 5).
 *
 * Equivalente al sistema de estrellas del Excel (★★★★). El usuario no
 * puede introducir valores arbitrarios: solo selecciona estrellas.
 *
 * Props:
 *   valor     – 1..5 o null
 *   editable  – si es true muestra un selector interactivo
 *   onChange  – callback(nuevoValor) cuando es editable
 *   tamano    – clase de tamaño del texto (default: 'text-base')
 */

const ESTRELLAS = [1, 2, 3, 4, 5];

export default function Calificacion({ valor, editable = false, onChange, tamano = 'text-base' }) {
  if (!editable) {
    const n = Number(valor);
    if (!n || n < 1) return <span className="text-slate-400 dark:text-slate-500 text-sm">—</span>;
    return (
      <span className={`${tamano} tracking-widest whitespace-nowrap`} title={`${n} de 5`}>
        {ESTRELLAS.map(i => (
          <span key={i} className={i <= n ? 'text-amber-400' : 'text-slate-300 dark:text-slate-600'}>★</span>
        ))}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {ESTRELLAS.map(i => (
        <button
          key={i}
          type="button"
          onClick={() => onChange && onChange(valor === i ? null : i)}
          className={`text-2xl leading-none transition ${i <= (valor || 0) ? 'text-amber-400' : 'text-slate-300 dark:text-slate-600 hover:text-amber-300'}`}
          aria-label={`${i} ${i === 1 ? 'estrella' : 'estrellas'}`}
        >
          ★
        </button>
      ))}
      {valor ? (
        <button type="button" onClick={() => onChange && onChange(null)}
          className="ml-2 text-xs text-slate-400 hover:text-red-500 underline">
          quitar
        </button>
      ) : (
        <span className="ml-2 text-xs text-slate-400">Sin calificar</span>
      )}
    </div>
  );
}
