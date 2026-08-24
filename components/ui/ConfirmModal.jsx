'use client';

export default function ConfirmModal({
  abierto,
  titulo = 'Confirmar',
  mensaje = '',
  onConfirmar,
  onCancelar,
  confirmarTexto = 'Confirmar',
  cargando = false,
}) {
  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancelar(); }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm p-6 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{titulo}</h3>
          <button onClick={onCancelar} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 text-xl">✕</button>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{mensaje}</p>
        <div className="flex gap-2 justify-end mt-6">
          <button
            onClick={onCancelar}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-200 text-slate-700 dark:text-slate-300 dark:bg-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            disabled={cargando}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
          >
            {cargando ? 'Procesando...' : confirmarTexto}
          </button>
        </div>
      </div>
    </div>
  );
}