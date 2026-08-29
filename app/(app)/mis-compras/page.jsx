'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import StatCard from '@/components/ui/StatCard';
import SkeletonTable from '@/components/ui/SkeletonTable';

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

export default function MisComprasPage() {
  const [filtro, setFiltro] = useState('dia');
  const [compras, setCompras] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, totalCount: 0, totalPages: 1 });
  const [busqueda, setBusqueda] = useState('');
  const [page, setPage] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const [detalle, setDetalle] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState('');
  const [imagenGrande, setImagenGrande] = useState(null);

  const cargarCompras = useCallback(async (signal) => {
    try {
      const params = new URLSearchParams();
      params.set('periodo', filtro);
      if (busqueda) params.set('q', busqueda);
      params.set('page', String(page));
      params.set('limit', '50');
      const res = await fetch(`/api/compras?${params.toString()}`, { signal });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar');
      setCompras(data.compras);
      if (data.pagination) setPagination(data.pagination);
      setError('');
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message);
    }
    setCargando(false);
  }, [filtro, busqueda, page]);

  useEffect(() => {
    const controller = new AbortController();
    cargarCompras(controller.signal);
    return () => controller.abort();
  }, [cargarCompras]);

  async function verDetalle(id) {
    setErrorDetalle('');
    setCargandoDetalle(true);
    setDetalle({ id });
    try {
      const res = await fetch(`/api/compras/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar el detalle');
      setDetalle(data.compra);
    } catch (err) {
      setErrorDetalle(err.message);
    }
    setCargandoDetalle(false);
  }

  const totalGastado = useMemo(() => compras.reduce((a, c) => a + (c.devuelto ? 0 : Number(c.precio)), 0), [compras]);
  const totalDevueltas = useMemo(() => compras.filter(c => c.devuelto).length, [compras]);
  const totalDevuelto = useMemo(() => compras.filter(c => c.devuelto).reduce((a, c) => a + Number(c.precio), 0), [compras]);

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Mis Compras</h1>
          <p className="text-slate-500 dark:text-slate-400 dark:text-slate-500 text-sm">Historial personal de compras</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {FILTROS.map(f => (
            <button
              key={f.key}
              onClick={() => { setFiltro(f.key); setPage(1); }}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                filtro === f.key ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700 dark:text-slate-300 dark:bg-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300 text-sm">{error}</div>}

      <div className="mb-4">
        <input
          type="text"
          value={busqueda}
          onChange={e => { setBusqueda(e.target.value); setPage(1); }}
          placeholder="🔍 Buscar por nombre de producto..."
          className="w-full sm:w-72 px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 rounded-lg text-sm"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <StatCard titulo="Compras" valor={pagination.totalCount} icono="📦" color="blue" />
        <StatCard titulo="Total gastado" valor={fmt(totalGastado)} icono="💰" color="green" />
        <StatCard titulo="Devoluciones" valor={totalDevueltas} icono="🔄" color="amber" />
        <StatCard titulo="Total devuelto" valor={fmt(totalDevuelto)} icono="💸" color="red" />
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {cargando ? (
          <SkeletonTable columns={7} rows={10} />
        ) : compras.length === 0 ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500">
            <div className="text-4xl mb-3">📭</div>
            <p className="font-medium">No hay compras en este período</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b-2 border-slate-200 dark:border-slate-800 text-left">
                    <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase">Producto</th>
                    <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase">Precio</th>
                    <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase">Factura</th>
                    <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase">Pago</th>
                    <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase">Estado</th>
                    <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase">Fecha</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {compras.map(c => (
                    <tr key={c.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:bg-slate-800/60 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{c.producto}</div>
                        {c.descripcion && <div className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5">{c.descripcion}</div>}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">{fmt(c.precio)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${c.tiene_factura ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300'}`}>
                          {c.tiene_factura ? '✅ Con factura' : '❌ Sin factura'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                          {c.tipo_pago === 'qr' ? '📱 QR' : '💵 Físico'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {c.devuelto
                          ? <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300">🔄 Devuelto</span>
                          : <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300 dark:text-slate-400 dark:text-slate-500">Activo</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500 whitespace-nowrap">{fmtFecha(c.fecha)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => verDetalle(c.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-200 text-slate-700 dark:text-slate-300 dark:bg-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600"
                        >
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800 text-sm text-slate-600 dark:text-slate-400">
                <span>
                  Mostrando {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.totalCount)} de {pagination.totalCount}
                </span>
                <div className="flex gap-1">
                  <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-200 dark:bg-slate-700 dark:text-slate-200 hover:bg-slate-300 disabled:opacity-40">
                    ← Anterior
                  </button>
                  <span className="px-3 py-1 text-xs font-medium">{pagination.page} / {pagination.totalPages}</span>
                  <button disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}
                    className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-200 dark:bg-slate-700 dark:text-slate-200 hover:bg-slate-300 disabled:opacity-40">
                    Siguiente →
                  </button>
                </div>
              </div>
            )}
          </>
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
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Detalle de Compra</h3>
              <button onClick={() => setDetalle(null)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 dark:text-slate-500 text-xl">✕</button>
            </div>

            {cargandoDetalle ? (
              <div className="p-8 text-center text-slate-400 dark:text-slate-500">Cargando...</div>
            ) : errorDetalle ? (
              <div className="p-3 rounded-lg bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300 text-sm">{errorDetalle}</div>
            ) : (
              <div className="grid gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3">
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold uppercase mb-1">Producto</div>
                    <div className="font-bold text-slate-900 dark:text-slate-100">{detalle.producto}</div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3">
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold uppercase mb-1">Precio</div>
                    <div className="font-bold text-slate-900 dark:text-slate-100 text-lg">{fmt(detalle.precio)}</div>
                  </div>
                </div>
                {detalle.descripcion && (
                  <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3">
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold uppercase mb-1">Descripción</div>
                    <div className="text-slate-700 dark:text-slate-300 text-sm">{detalle.descripcion}</div>
                  </div>
                )}
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
                      width={400}
                      height={176}
                      className="max-h-44 rounded-lg border border-slate-200 dark:border-slate-800 cursor-zoom-in object-cover"
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
                      width={400}
                      height={176}
                      className="max-h-44 rounded-lg border border-slate-200 dark:border-slate-800 cursor-zoom-in object-cover"
                      onClick={() => setImagenGrande(detalle.foto_qr)}
                    />
                  </div>
                )}
                {detalle.devuelto && (
                  <div className="border border-red-200 rounded-lg p-3 bg-red-50 dark:border-red-900 dark:bg-red-950/40">
                    <div className="text-sm font-bold text-red-600 dark:text-red-300 mb-2">🔄 Esta compra fue devuelta</div>
                    {detalle.devolucion_motivo && (
                      <div className="text-sm text-slate-700 dark:text-slate-300 mb-1"><strong>Motivo:</strong> {detalle.devolucion_motivo}</div>
                    )}
                    {detalle.devolucion_tipo_pago && (
                      <div className="text-sm text-slate-700 dark:text-slate-300 mb-1">
                        <strong>Reembolso:</strong> {detalle.devolucion_tipo_pago === 'transferencia' ? 'Transferencia bancaria' : 'Cobro físico'}
                      </div>
                    )}
                    {detalle.devolucion_fecha && (
                      <div className="text-sm text-slate-700 dark:text-slate-300 mb-2"><strong>Fecha devolución:</strong> {fmtFecha(detalle.devolucion_fecha)}</div>
                    )}
                    {detalle.devolucion_comprobante && (
                      <img
                        src={detalle.devolucion_comprobante}
                        alt="Comprobante de reembolso"
                        width={400}
                        height={176}
                        className="max-h-44 rounded-lg border border-slate-200 dark:border-slate-800 cursor-zoom-in object-cover"
                        onClick={() => setImagenGrande(detalle.devolucion_comprobante)}
                      />
                    )}
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
