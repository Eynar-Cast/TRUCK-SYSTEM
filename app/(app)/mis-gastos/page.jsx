'use client';
import { useState, useEffect, useCallback } from 'react';

const FILTROS = [
  { key: 'dia', label: 'Hoy' },
  { key: 'semana', label: 'Semana' },
  { key: 'mes', label: 'Mes' },
  { key: 'todo', label: 'Todo' },
];

function fmt(n) {
  return 'Bs. ' + Number(n).toFixed(2);
}
function fmtFecha(iso) {
  return new Date(iso).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtFechaHora(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
}

function StatCard({ icon, label, valor }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
      <div className="text-xl mb-1">{icon}</div>
      <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{label}</div>
      <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">{valor}</div>
    </div>
  );
}

export default function MisGastosPage() {
  const [filtro, setFiltro] = useState('dia');
  const [gastos, setGastos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const [detalle, setDetalle] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState('');
  const [imagenGrande, setImagenGrande] = useState(null);

  const cargarGastos = useCallback(async () => {
    try {
      const res = await fetch(`/api/gastos-choferes?periodo=${filtro}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar');
      setGastos(data.gastos);
      setError('');
    } catch (err) {
      setError(err.message);
    }
    setCargando(false);
  }, [filtro]);

  useEffect(() => { cargarGastos(); }, [cargarGastos]);

  async function verDetalle(id) {
    setErrorDetalle('');
    setCargandoDetalle(true);
    setDetalle({ id }); // abre el modal ya en estado de carga
    try {
      const res = await fetch(`/api/gastos-choferes/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar el detalle');
      setDetalle(data.gasto);
    } catch (err) {
      setErrorDetalle(err.message);
    }
    setCargandoDetalle(false);
  }

  const total = gastos.reduce((a, g) => a + Number(g.monto), 0);
  const pagados = gastos.filter(g => g.pagado).reduce((a, g) => a + Number(g.monto), 0);

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Mis Gastos de Chofer</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Historial de gastos que registraste</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {FILTROS.map(f => (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                filtro === f.key ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300 text-sm">{error}</div>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <StatCard icon="🚛" label="Gastos" valor={gastos.length} />
        <StatCard icon="💰" label="Total" valor={fmt(total)} />
        <StatCard icon="✅" label="Pagado" valor={fmt(pagados)} />
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {cargando ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500">Cargando...</div>
        ) : gastos.length === 0 ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500">
            <div className="text-4xl mb-3">📭</div>
            <p className="font-medium">No hay gastos en este período</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b-2 border-slate-200 dark:border-slate-800 text-left">
                  <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Gasto</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Chofer</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Monto</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Factura</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Pago</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Fecha</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {gastos.map(g => (
                  <tr key={g.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{g.nombre}</div>
                      {g.descripcion && <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{g.descripcion}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{g.chofer_nombre}</div>
                      <div className="text-xs text-slate-400 dark:text-slate-500">{g.chofer_placa}</div>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">{fmt(g.monto)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${g.tiene_factura ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300'}`}>
                        {g.tiene_factura ? '✅ Con factura' : '❌ Sin factura'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">{g.tipo_pago === 'qr' ? '📱 QR / Transferencia' : '💵 Físico'}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">{fmtFecha(g.fecha)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => verDetalle(g.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600"
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de detalle */}
      {detalle && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setDetalle(null); }}
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Detalle de Gasto</h3>
              <button onClick={() => setDetalle(null)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-xl">✕</button>
            </div>

            {cargandoDetalle ? (
              <div className="p-8 text-center text-slate-400 dark:text-slate-500">Cargando...</div>
            ) : errorDetalle ? (
              <div className="p-3 rounded-lg bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300 text-sm">{errorDetalle}</div>
            ) : (
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3">
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold uppercase mb-1">Gasto</div>
                    <div className="font-bold text-slate-900 dark:text-slate-100">{detalle.nombre}</div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3">
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold uppercase mb-1">Monto</div>
                    <div className="font-bold text-slate-900 dark:text-slate-100 text-lg">{fmt(detalle.monto)}</div>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3">
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold uppercase mb-1">Chofer</div>
                  <div className="text-slate-700 dark:text-slate-300 text-sm">{detalle.chofer_nombre} — {detalle.chofer_placa}</div>
                </div>

                {detalle.descripcion && (
                  <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3">
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold uppercase mb-1">Descripción</div>
                    <div className="text-slate-700 dark:text-slate-300 text-sm">{detalle.descripcion}</div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3">
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold uppercase mb-1">Factura</div>
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${detalle.tiene_factura ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300'}`}>
                      {detalle.tiene_factura ? '✅ Con factura' : '❌ Sin factura'}
                    </span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3">
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold uppercase mb-1">Pago</div>
                    <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">{detalle.tipo_pago === 'qr' ? '📱 QR / Transferencia' : '💵 Físico'}</span>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3">
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold uppercase mb-1">Fecha</div>
                  <div className="text-slate-700 dark:text-slate-300 text-sm">{fmtFechaHora(detalle.fecha)}</div>
                </div>

                {detalle.foto_factura && (
                  <div>
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">📄 Foto de factura</div>
                    <img
                      src={detalle.foto_factura}
                      alt="Factura"
                      className="max-h-44 rounded-lg border border-slate-200 dark:border-slate-800 cursor-zoom-in"
                      onClick={() => setImagenGrande(detalle.foto_factura)}
                    />
                  </div>
                )}
                {detalle.foto_qr && (
                  <div>
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">📱 Comprobante QR</div>
                    <img
                      src={detalle.foto_qr}
                      alt="Comprobante"
                      className="max-h-44 rounded-lg border border-slate-200 dark:border-slate-800 cursor-zoom-in"
                      onClick={() => setImagenGrande(detalle.foto_qr)}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Zoom de imagen */}
      {imagenGrande && (
        <div
          className="fixed inset-0 bg-black/85 z-[60] flex items-center justify-center p-4"
          onClick={() => setImagenGrande(null)}
        >
          <img src={imagenGrande} alt="" className="max-w-full max-h-[85vh] rounded-xl object-contain" />
        </div>
      )}
    </div>
  );
}
