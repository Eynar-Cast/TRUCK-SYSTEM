'use client';
import { useState, useCallback, useEffect } from 'react';
import { descargar } from '@/lib/utils';

/**
 * Reportes mensuales — selecciona el tipo de reporte y el mes a consultar.
 * La tabla respeta exactamente las mismas filas que la exportación a Excel.
 */

const TIPOS = [
  { id: 'compras', label: '🛒 Compras' },
  { id: 'devoluciones', label: '🔄 Devoluciones' },
  { id: 'gastos_choferes', label: '💸 Gastos de conductores' },
  { id: 'camiones', label: '🚚 Camiones' },
  { id: 'llantas', label: '🛞 Llantas' },
  { id: 'aceites', label: '🛢️ Aceites' },
  { id: 'seguros_camiones', label: '🛡️ Seguros de camiones' },
  { id: 'conductores', label: '👨‍✈️ Conductores' },
  { id: 'seguros_individuales', label: '🧾 Seguros individuales' },
  { id: 'multas', label: '🚨 Multas' },
];

function mesActual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function ReportesPage() {
  const [tipo, setTipo] = useState('compras');
  const [mes, setMes] = useState(mesActual());
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const res = await fetch(`/api/reportes/mensual?tipo=${tipo}&mes=${mes}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Error al generar el reporte');
      setData(d);
    } catch (e) {
      setData(null);
      setError(e.message);
    }
    setCargando(false);
  }, [tipo, mes]);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 no-print">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Reportes mensuales</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Selecciona el módulo y el mes que deseas consultar</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} disabled={!data} className="bg-slate-200 dark:bg-slate-700 dark:text-slate-200 hover:bg-slate-300 text-slate-700 font-medium px-4 py-2 rounded-lg text-sm disabled:opacity-50">🖨️ Imprimir</button>
          <button onClick={() => descargar(`/api/reportes/mensual/exportar?tipo=${tipo}&mes=${mes}`)} disabled={!data}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-lg text-sm disabled:opacity-50">⬇️ Exportar Excel</button>
        </div>
      </div>

      {/* Selección */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 mb-4 no-print">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Reporte</label>
            <select value={tipo} onChange={e => setTipo(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100">
              {TIPOS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mes</label>
            <input type="month" value={mes} max={mesActual()} onChange={e => setMes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
          </div>
        </div>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300 text-sm">{error}</div>}

      {/* Título imprimible */}
      {data && (
        <div className="mb-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 print:block hidden">{data.titulo}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {TIPOS.find(t => t.id === data.tipo)?.label} · mes {data.mes} · {data.filas.length} registro(s)
          </p>
        </div>
      )}

      {/* Resultado */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden print:border-0">
        {cargando ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500">Generando reporte...</div>
        ) : !data || data.filas.length === 0 ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500">
            <div className="text-4xl mb-3">📅</div>
            <p className="font-medium">Sin registros para este reporte en el mes seleccionado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b-2 border-slate-200 dark:border-slate-800 text-left whitespace-nowrap">
                  {data.columnas.map((col, i) => (
                    <th key={i} className="px-3 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.filas.map((fila, i) => (
                  <tr key={i} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    {fila.map((celda, j) => (
                      <td key={j} className="px-3 py-2.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">{celda ?? '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
