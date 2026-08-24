'use client';
import { useState } from 'react';

const FILTROS = [
  { key: 'dia', label: 'Hoy' },
  { key: 'semana', label: 'Semana' },
  { key: 'mes', label: 'Mes' },
  { key: 'todo', label: 'Todo' },
];

export default function ExportarPage() {
  const [periodo, setPeriodo] = useState('todo');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [descargando, setDescargando] = useState('');
  const [error, setError] = useState('');

  function elegirPeriodo(key) {
    setPeriodo(key);
    setDesde('');
    setHasta('');
  }

  function limpiarFiltros() {
    setPeriodo('todo');
    setDesde('');
    setHasta('');
  }

  async function descargar(formato) {
    setError('');
    setDescargando(formato);
    try {
      const params = new URLSearchParams({ formato });
      if (desde || hasta) {
        if (desde) params.set('desde', desde);
        if (hasta) params.set('hasta', hasta);
      } else {
        params.set('periodo', periodo);
      }

      const res = await fetch(`/api/admin/exportar?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'No se pudo generar el archivo');
      }

      const blob = await res.blob();
      const disposicion = res.headers.get('Content-Disposition') || '';
      const match = disposicion.match(/filename="(.+)"/);
      const nombreArchivo = match ? match[1] : `gestorcompras_respaldo.${formato}`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombreArchivo;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
    setDescargando('');
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">Exportar Datos</h1>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
        Descarga un respaldo completo de compras, devoluciones y gastos de chofer, agrupado por usuario.
      </p>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
        {/* Filtros rápidos de período */}
        <div className="mb-5">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Período</p>
          <div className="flex gap-2 flex-wrap">
            {FILTROS.map(f => (
              <button
                key={f.key}
                onClick={() => elegirPeriodo(f.key)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                  periodo === f.key && !desde && !hasta
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Rango de fechas manual */}
        <div className="mb-5">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            O elige un rango de fechas específico
          </p>
          <div className="flex gap-3 flex-wrap items-end">
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Desde</label>
              <input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className="px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Hasta</label>
              <input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className="px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg text-sm"
              />
            </div>
            <button
              onClick={limpiarFiltros}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600"
            >
              Limpiar
            </button>
          </div>
        </div>

        {error && <div className="mb-4 p-3 rounded-lg bg-red-100 text-red-600 text-sm">{error}</div>}

        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => descargar('xlsx')}
            disabled={!!descargando}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-medium px-5 py-2.5 rounded-lg transition"
          >
            {descargando === 'xlsx' ? 'Generando...' : '📊 Descargar Excel (.xlsx)'}
          </button>
          <button
            onClick={() => descargar('json')}
            disabled={!!descargando}
            className="bg-slate-700 hover:bg-slate-800 disabled:opacity-60 text-white font-medium px-5 py-2.5 rounded-lg transition"
          >
            {descargando === 'json' ? 'Generando...' : '🗂️ Descargar JSON (respaldo completo)'}
          </button>
        </div>

        <div className="mt-6 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 text-sm text-blue-800 dark:text-blue-300">
          💡 El Excel muestra, para cada usuario, sus totales y el detalle completo debajo (compras, devoluciones
          y gastos de chofer con fecha, descripción y motivo), además de hojas separadas con todo junto para filtrar libremente.
          El JSON es un respaldo técnico completo — incluye usuarios y choferes íntegros, suficiente para regenerar la base de datos si hiciera falta.
        </div>
      </div>
    </div>
  );
}