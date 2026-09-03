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

const UMBRAL_LIMPIEZA = 500;

function AdminAlertas(){
  const [a,setA]=useState(null);
  useEffect(()=>{
    Promise.all([
      fetch('/api/flota?limit=100').then(r=>r.json()).catch(()=>({vehiculos:[],resumen:{}})),
      fetch('/api/seguros?limit=100').then(r=>r.json()).catch(()=>({seguros:[],alertas:{}})),
    ]).then(([f,s])=>{
      const vehiculos = f.vehiculos || [];
      const seguros = s.seguros || [];
      const flotaResumen = f.resumen || {};
      const segAlertas = s.alertas || {};
      // Calcular llantas/aceites en ruta vs vencido con datos reales de flota
      const llantasCambiar = vehiculos.filter(v=>v.llantas_estado==='Cambiar ya' || v.llantas_estado==='Por cambiar').map(v=>v.placa);
      const aceitesCambiar = vehiculos.filter(v=>v.aceites_estado==='Cambiar ya' || v.aceites_estado==='Por cambiar').map(v=>v.placa);
      // Seguros vencidos/proximos: solo activos, placas únicas (evita duplicados por múltiples pólizas por placa)
      const vencidosRaw = seguros.filter(x=>x.activo && x.estado==='Vencido').map(x=>x.placa);
      const vencidosList = [...new Set(vencidosRaw)];
      const hoy = new Date(); hoy.setHours(0,0,0,0);
      const proximosRaw = seguros.filter(x=>{
        if(!x.activo || x.estado!=='Vigente' || !x.fecha_vencimiento) return false;
        const fv=new Date(x.fecha_vencimiento); fv.setHours(0,0,0,0);
        const diff=(fv-hoy)/(86400000);
        return diff>=0 && diff<=30;
      }).map(x=>x.placa);
      const proximosList = [...new Set(proximosRaw)];
      // Usar listas dedup como fuente de verdad (coherente conteo ↔ placas)
      const llantasSet = [...new Set(llantasCambiar)];
      const aceitesSet = [...new Set(aceitesCambiar)];
      setA({
        seguroVencidos: vencidosList.length,
        seguroProximos: proximosList.length,
        llantas: llantasSet.length,
        aceites: aceitesSet.length,
        _det: { vencidosList, proximosList, llantasCambiar: llantasSet, aceitesCambiar: aceitesSet, vehiculos }
      });
    }).catch(()=>{});
  },[]);
  if(!a) return null;
  const tiene = a.seguroVencidos>0 || a.seguroProximos>0 || a.llantas>0 || a.aceites>0;
  const placas = (arr)=> arr.length ? arr.slice(0,4).join(', ') + (arr.length>4?` +${arr.length-4} más`:'') : '—';
  if(!tiene) return <div className="mb-4 flex items-center gap-2 text-xs text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg px-3 py-2">✅ Sin alertas: seguros, llantas y aceites al día</div>;
  return (
    <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
      <div className={`rounded-lg border px-2.5 py-2 ${a.seguroVencidos>0?'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900':'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}>
        <div className="flex items-center gap-2">
          <span className="text-sm">🛡️</span>
          <div className="leading-tight">
            <div className="text-[10px] uppercase font-semibold text-slate-400">Seguro vencido</div>
            <div className={`text-sm font-bold ${a.seguroVencidos>0?'text-red-600':'text-slate-700 dark:text-slate-200'}`}>{a.seguroVencidos}</div>
          </div>
        </div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate" title={placas(a._det.vencidosList)}>{a._det.vencidosList.length ? `Placas: ${placas(a._det.vencidosList)}` : 'Sin placas'}</div>
      </div>
      <div className={`rounded-lg border px-2.5 py-2 ${a.seguroProximos>0?'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900':'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}>
        <div className="flex items-center gap-2">
          <span className="text-sm">⏰</span>
          <div className="leading-tight">
            <div className="text-[10px] uppercase font-semibold text-slate-400">Por vencer (30d)</div>
            <div className={`text-sm font-bold ${a.seguroProximos>0?'text-amber-700':'text-slate-700 dark:text-slate-200'}`}>{a.seguroProximos}</div>
          </div>
        </div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate" title={placas(a._det.proximosList)}>{a._det.proximosList.length ? `Placas: ${placas(a._det.proximosList)}` : 'Sin placas'}</div>
      </div>
      <div className={`rounded-lg border px-2.5 py-2 ${a.llantas>0?'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900':'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}>
        <div className="flex items-center gap-2">
          <span className="text-sm">🛞</span>
          <div className="leading-tight">
            <div className="text-[10px] uppercase font-semibold text-slate-400">Llantas cambio</div>
            <div className={`text-sm font-bold ${a.llantas>0?'text-amber-700':'text-slate-700 dark:text-slate-200'}`}>{a.llantas}</div>
          </div>
        </div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate" title={placas(a._det.llantasCambiar)}>{a._det.llantasCambiar.length ? `Placas: ${placas(a._det.llantasCambiar)}` : 'Sin placas'}</div>
      </div>
      <div className={`rounded-lg border px-2.5 py-2 ${a.aceites>0?'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900':'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}>
        <div className="flex items-center gap-2">
          <span className="text-sm">🛢️</span>
          <div className="leading-tight">
            <div className="text-[10px] uppercase font-semibold text-slate-400">Aceite cambio</div>
            <div className={`text-sm font-bold ${a.aceites>0?'text-amber-700':'text-slate-700 dark:text-slate-200'}`}>{a.aceites}</div>
          </div>
        </div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate" title={placas(a._det.aceitesCambiar)}>{a._det.aceitesCambiar.length ? `Placas: ${placas(a._det.aceitesCambiar)}` : 'Sin placas'}</div>
      </div>
    </div>
  );
}

function fmt(n) { return 'Bs. ' + Number(n).toFixed(2); }
function fmtFecha(iso) { return new Date(iso).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
function fmtFechaHora(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
}

export default function HistorialPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [compras, setCompras] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, totalCount: 0, totalPages: 1 });
  const [filtro, setFiltro] = useState('dia');
  const [userId, setUserId] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [page, setPage] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [totalCompras, setTotalCompras] = useState(0);

  const [detalle, setDetalle] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState('');
  const [imagenGrande, setImagenGrande] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/usuarios', { signal: controller.signal })
      .then(r => r.json())
      .then(d => setUsuarios(d.usuarios || []))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const cargarCompras = useCallback(async (signal) => {
    try {
      const params = new URLSearchParams();
      if (userId) params.set('userId', userId);
      if (busqueda) params.set('q', busqueda);
      if (desde || hasta) {
        if (desde) params.set('desde', desde);
        if (hasta) params.set('hasta', hasta);
      } else {
        params.set('periodo', filtro);
      }
      params.set('page', String(page));
      params.set('limit', '50');
      const res = await fetch(`/api/compras?${params.toString()}`, { signal });
      const data = await res.json();
      if (res.ok) {
        setCompras(data.compras);
        setTotalCompras(data.total);
        if (data.pagination) setPagination(data.pagination);
      }
    } catch {
      // silencioso: se conservan los datos previos (excepto abort)
    }
    setCargando(false);
  }, [filtro, userId, desde, hasta, busqueda, page]);

  useEffect(() => {
    const controller = new AbortController();
    cargarCompras(controller.signal);
    return () => controller.abort();
  }, [cargarCompras]);

  function limpiarFiltros() {
    setFiltro('todo'); setUserId(''); setDesde(''); setHasta(''); setBusqueda(''); setPage(1);
  }

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

  // Mapa de usuarios para búsqueda O(1)
  const usuariosMap = useMemo(() => {
    const map = new Map();
    for (const u of usuarios) map.set(u.id, u.nombre);
    return map;
  }, [usuarios]);

  // Cálculos pesados memoizados
  const estadisticas = useMemo(() => {
    let totalGastado = 0;
    let totalDev = 0;
    let devueltas = 0;
    for (const c of compras) {
      if (c.devuelto) {
        devueltas++;
        totalDev += Number(c.precio);
      } else {
        totalGastado += Number(c.precio);
      }
    }
    return { totalGastado, totalDev, devueltas, saldoNeto: totalGastado - totalDev };
  }, [compras]);

  function nombreUsuario(id) {
    return usuariosMap.get(id) || '—';
  }

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Historial de Compras</h1>
          <p className="text-slate-500 dark:text-slate-400 dark:text-slate-500 text-sm">Todas las compras de todos los usuarios</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {FILTROS.map(f => (
            <button key={f.key} onClick={() => { setDesde(''); setHasta(''); setFiltro(f.key); setPage(1); }}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${filtro === f.key && !desde && !hasta ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700 dark:text-slate-300 dark:bg-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 mb-4 flex gap-3 flex-wrap items-end print:hidden">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Buscar producto</label>
          <input
            type="text"
            value={busqueda}
            onChange={e => { setBusqueda(e.target.value); setPage(1); }}
            placeholder="Buscar por nombre..."
            className="w-56 px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Usuario</label>
          <select value={userId} onChange={e => { setUserId(e.target.value); setPage(1); }} className="w-40 px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg text-sm">
            <option value="">Todos</option>
            {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Desde</label>
          <input type="date" value={desde} onChange={e => { setDesde(e.target.value); setPage(1); }} className="w-36 px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Hasta</label>
          <input type="date" value={hasta} onChange={e => { setHasta(e.target.value); setPage(1); }} className="w-36 px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg text-sm" />
        </div>
        <button onClick={limpiarFiltros} className="px-3 py-2 rounded-lg text-sm font-medium bg-slate-200 text-slate-700 dark:text-slate-300 dark:bg-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600">Limpiar</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        <StatCard titulo="Total compras" valor={pagination.totalCount} icono="📦" color="blue" />
        <StatCard titulo="Total gastado" valor={fmt(estadisticas.totalGastado)} icono="💰" color="green" />
        <StatCard titulo="Devoluciones" valor={estadisticas.devueltas} icono="🔄" color="amber" />
        <StatCard titulo="Total devuelto" valor={fmt(estadisticas.totalDev)} icono="💸" color="red" />
        <StatCard titulo="Saldo neto" valor={fmt(estadisticas.saldoNeto)} icono="📊" color="violet" />
      </div>

      <AdminAlertas />

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {cargando ? (
          <SkeletonTable columns={8} rows={10} />
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
                    <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase">Usuario</th>
                    <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase">Precio</th>
                    <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase">Factura</th>
                    <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase">Pago</th>
                    <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase">Estado</th>
                    <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase">Fecha</th>
                    <th className="px-4 py-3 print:hidden"></th>
                  </tr>
                </thead>
                <tbody>
                  {compras.map(c => (
                    <tr key={c.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:bg-slate-800/60 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{c.producto}</div>
                        {c.descripcion && <div className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5">{c.descripcion}</div>}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{nombreUsuario(c.user_id)}</td>
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
                      <td className="px-4 py-3 print:hidden">
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
              <button onClick={() => setDetalle(null)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-300 dark:hover:text-slate-400 dark:text-slate-500 text-xl">✕</button>
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

                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3">
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold uppercase mb-1">Registrado por</div>
                  <div className="text-slate-700 dark:text-slate-300 text-sm">👤 {nombreUsuario(detalle.user_id)}</div>
                </div>

                {detalle.descripcion && (
                  <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3">
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold uppercase mb-1">Descripción</div>
                    <div className="text-slate-700 dark:text-slate-300 text-sm">{detalle.descripcion}</div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3">
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold uppercase mb-1">Factura</div>
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${detalle.tiene_factura ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300'}`}>
                      {detalle.tiene_factura ? '✅ Con factura' : '❌ Sin factura'}
                    </span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3">
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold uppercase mb-1">Tipo de pago</div>
                    <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                      {detalle.tipo_pago === 'qr' ? '📱 Transferencia QR' : '💵 Pago físico'}
                    </span>
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
