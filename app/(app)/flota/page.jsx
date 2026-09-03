'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import StatCard from '@/components/ui/StatCard';
import SkeletonTable from '@/components/ui/SkeletonTable';
import { descargar } from '@/lib/utils';

/**
 * Reporte de Camiones — listado y consulta de la flota.
 * Tipos de unidad: Tracto / Chata / Sider · con operador logístico
 * y conductor designado.
 */

const ESTADO_VEHICULO_ESTILO = {
  'Disponible': 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  'Seguro Vencido': 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300',
  'Mantenimiento': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'En ruta': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
};

const VACIO = { tipo: '', marca: '', modelo: '', placa: '', numero_serie: '', color: '', anio: '', carga_maxima_kg: '', operador_logistico: '', chofer_id: '' };

// Columnas del reporte (key = campo ordenable)
const COLUMNAS = [
  { key: 'nro', label: 'Nro' },
  { key: 'placa', label: 'Placa' },
  { key: 'color', label: 'Color' },
  { key: 'tipo', label: 'Tipo' },
  { key: 'anio', label: 'Año' },
  { key: 'modelo', label: 'Modelo' },
  { key: null, label: 'Operador logístico' },
  { key: null, label: 'Conductor designado' },
  { key: 'estado', label: 'Estado' },
  { key: null, label: '🛣️ Viaje' },
  { key: null, label: '🛞 Llantas' },
  { key: null, label: '🛢️ Aceites' },
];

const ESTADO_MANT_ESTILO = {
  'Cambiar ya': 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300',
  'Por cambiar': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'Al día': 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
};

function BadgeMantenimiento({ estado, titulo }) {
  if (!estado) return <span className="text-slate-400 dark:text-slate-500 text-xs">—</span>;
  return (
    <span title={titulo || ''} className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${ESTADO_MANT_ESTILO[estado]}`}>
      {estado}
    </span>
  );
}

// Componente de fila de tabla memorizado para evitar re-render innecesario
const FilaVehiculo = ({ v, i, sort, dir, ordenarPor, abrirEditar, toggleActivo, marcarVendido }) => {
  const aceitesTitulo = useMemo(() => {
    if (!v.aceites_estado) return '';
    return Object.entries(v.aceites_detalle || {})
      .filter(([, d]) => d.estado === v.aceites_estado)
      .map(([t, d]) => `${t}: ${d.fecha?.slice(0, 10)}`)
      .join(' · ');
  }, [v.aceites_estado, v.aceites_detalle]);

  return (
    <tr className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
      <td className="px-3 py-2.5 text-slate-400">{i + 1}</td>
      <td className="px-3 py-2.5">
        <span className={`font-mono text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${v.activo ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'}`}>
          {v.placa}{!v.activo && ' · Inactivo'}
        </span>
      </td>
      <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400">{v.color || '—'}</td>
      <td className="px-3 py-2.5 whitespace-nowrap text-slate-700 dark:text-slate-300">{v.tipo}</td>
      <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">{v.anio ?? '—'}</td>
      <td className="px-3 py-2.5 whitespace-nowrap font-medium text-slate-800 dark:text-slate-200">{v.marca} {v.modelo}</td>
      <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400">{v.operador_logistico || '—'}</td>
      <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400">{v.conductor_designado || '—'}</td>
      <td className="px-3 py-2.5">
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${ESTADO_VEHICULO_ESTILO[v.estado_vehiculo] || 'bg-slate-100 text-slate-600'}`}>
          {v.activo ? v.estado_vehiculo : 'Inactivo'}
        </span>
      </td>
      <td className="px-3 py-2.5">
        {v.viaje_actual ? (
          <span title={`${v.viaje_actual.tramo||''} · ${v.viaje_actual.producto||''} ${v.viaje_actual.codigo?`· ${v.viaje_actual.codigo}`:''}`} className="inline-flex flex-col text-xs leading-tight">
            <span className="font-semibold text-blue-700 dark:text-blue-300">🛣️ {v.viaje_actual.tramo||'En ruta'}</span>
            <span className="text-slate-400 text-[11px]">{v.viaje_actual.producto||''} {v.viaje_actual.codigo?`· ${v.viaje_actual.codigo}`:''}</span>
          </span>
        ) : <span className="text-slate-400 text-xs">—</span>}
      </td>
      <td className="px-3 py-2.5">
        <BadgeMantenimiento estado={v.llantas_estado}
          titulo={v.llantas_proxima ? `Próximo cambio: ${v.llantas_proxima.slice(0, 10)}` : 'Sin registro de próximo cambio'} />
      </td>
      <td className="px-3 py-2.5">
        {!v.aceites_estado
          ? <span className="text-slate-400 dark:text-slate-500 text-xs">—</span>
          : <BadgeMantenimiento estado={v.aceites_estado} titulo={aceitesTitulo} />}
      </td>
      <td className="px-3 py-2.5 no-print">
        <div className="flex gap-1.5 whitespace-nowrap">
          <Link href={`/flota/${v.id}`} className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 hover:bg-blue-200">🔍 Ver</Link>
          <button onClick={() => abrirEditar(v)} className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 hover:bg-slate-300">✏️ Editar</button>
          <button onClick={() => toggleActivo(v)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium ${v.activo ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300 hover:bg-red-200' : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 hover:bg-green-200'}`}>
            {v.activo ? 'Desactivar' : 'Activar'}
          </button>
          <button onClick={() => marcarVendido(v)} className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 hover:bg-amber-200" title="Marcar como vendido y eliminar">💰 Vendido</button>
        </div>
      </td>
    </tr>
  );
};

export default function FlotaPage() {
  const [vehiculos, setVehiculos] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, totalCount: 0, totalPages: 1 });
  const [catalogos, setCatalogos] = useState({ tipo_vehiculo: [], marca: [], modelo: [] });
  const [choferes, setChoferes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const [q, setQ] = useState('');
  const [fTipo, setFTipo] = useState('');
  const [fMarca, setFMarca] = useState('');
  const [fModelo, setFModelo] = useState('');
  const [fEstado, setFEstado] = useState('');
  const [sort, setSort] = useState('nro');
  const [dir, setDir] = useState('asc');
  const [page, setPage] = useState(1);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [errorModal, setErrorModal] = useState('');

  const params = useCallback(() => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (fTipo) p.set('tipo', fTipo);
    if (fMarca) p.set('marca', fMarca);
    if (fModelo) p.set('modelo', fModelo);
    if (fEstado) p.set('estado', fEstado);
    p.set('sort', sort);
    p.set('dir', dir);
    p.set('page', String(page));
    p.set('limit', '50');
    return p;
  }, [q, fTipo, fMarca, fModelo, fEstado, sort, dir, page]);

  const cargar = useCallback(async (signal) => {
    try {
      const res = await fetch(`/api/flota?${params().toString()}`, { signal });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setVehiculos(data.vehiculos);
      setResumen(data.resumen);
      if (data.pagination) setPagination(data.pagination);
      setError('');
    } catch {
      if (!signal?.aborted) setError('No se pudo cargar el reporte de camiones');
    }
    setCargando(false);
  }, [params]);

  useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(() => cargar(controller.signal), 250);
    return () => { clearTimeout(t); controller.abort(); };
  }, [cargar]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch('/api/catalogos', { signal: controller.signal }).then(r => r.json()),
      fetch('/api/choferes?limit=200', { signal: controller.signal }).then(r => r.json()),
    ]).then(([catalogoData, choferData]) => {
      const agrupado = { tipo_vehiculo: [], marca: [], modelo: [] };
      for (const c of catalogoData.catalogos || []) {
        if (c.activo && agrupado[c.tipo]) agrupado[c.tipo].push(c.valor);
      }
      setCatalogos(agrupado);
      setChoferes((choferData.choferes || []).filter(c => c.activo));
    }).catch(() => {});
    return () => controller.abort();
  }, []);

  function ordenarPor(col) {
    if (sort === col) setDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSort(col); setDir('asc'); }
    setPage(1);
  }

  function abrirNuevo() {
    setEditando(null);
    setForm(VACIO);
    setErrorModal('');
    setModalAbierto(true);
  }

  function abrirEditar(v) {
    setEditando(v);
    setForm({
      tipo: v.tipo, marca: v.marca, modelo: v.modelo, placa: v.placa,
      numero_serie: v.numero_serie || '', color: v.color || '',
      anio: v.anio ?? '', carga_maxima_kg: v.carga_maxima_kg ?? '',
      operador_logistico: v.operador_logistico || '',
      chofer_id: v.chofer_id ?? '',
    });
    setErrorModal('');
    setModalAbierto(true);
  }

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    const url = editando ? `/api/flota/${editando.id}` : '/api/flota';
    try {
      const res = await fetch(url, {
        method: editando ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorModal(data.error || 'Error al guardar');
        setGuardando(false);
        return;
      }
      setModalAbierto(false);
      await cargar();
    } catch {
      setErrorModal('Error de conexión al guardar');
    }
    setGuardando(false);
  }

  async function toggleActivo(v) {
    if (v.activo) {
      const ok = window.confirm(`¿Desactivar el vehículo con placa ${v.placa}? Puedes reactivarlo después.`);
      if (!ok) return;
    }
    const res = await fetch(`/api/flota/${v.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'toggle' }),
    });
    if (!res.ok) { setError('No se pudo cambiar el estado del vehículo'); return; }
    await cargar();
  }

  async function marcarVendido(v){
    const ok = window.confirm(`¿Marcar como VENDIDO y ELIMINAR el camión ${v.placa}? Esta acción elimina el camión y sus seguros asociados. No se puede deshacer.`);
    if(!ok) return;
    const res = await fetch(`/api/flota/${v.id}`, { method: 'DELETE' });
    const data = await res.json().catch(()=>({}));
    if(!res.ok){ setError(data.error || 'No se pudo vender/eliminar'); return; }
    await cargar();
  }

  const inputCls = 'w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100';

  // Cálculos de alertas memoizados
  const alertas = useMemo(() => {
    const yaLL = vehiculos.filter(v => v.llantas_estado === 'Cambiar ya');
    const prontoLL = vehiculos.filter(v => v.llantas_estado === 'Por cambiar');
    const yaAC = vehiculos.filter(v => v.aceites_estado === 'Cambiar ya');
    const prontoAC = vehiculos.filter(v => v.aceites_estado === 'Por cambiar');
    return { yaLL, prontoLL, yaAC, prontoAC };
  }, [vehiculos]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 no-print">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Flota / Camiones</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Tractocamiones y unidades chata o sider</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => descargar(`/api/flota/exportar?${params().toString()}`)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-lg text-sm">⬇️ Exportar Excel</button>
          <button onClick={abrirNuevo} className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-sm">➕ Nuevo vehículo</button>
        </div>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300 text-sm no-print">{error}</div>}

      {/* Búsqueda y filtros del módulo */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 mb-4 no-print">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="🔍 Buscar: placa, modelo, serie, operador…" className={`${inputCls} col-span-2`} />
          <select value={fTipo} onChange={e => { setFTipo(e.target.value); setPage(1); }} className={inputCls}>
            <option value="">Tipo: todos</option>
            {catalogos.tipo_vehiculo.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={fMarca} onChange={e => { setFMarca(e.target.value); setFModelo(''); setPage(1); }} className={inputCls}>
            <option value="">Marca: todas</option>
            {catalogos.marca.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={fModelo} onChange={e => { setFModelo(e.target.value); setPage(1); }} className={inputCls}>
            <option value="">Modelo: todos</option>
            {catalogos.modelo.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={fEstado} onChange={e => { setFEstado(e.target.value); setPage(1); }} className={inputCls}>
            <option value="">Estado: todos</option>
            <option value="Disponible">Disponible</option>
            <option value="En ruta">En ruta</option>
            <option value="Seguro Vencido">Seguro Vencido</option>
            <option value="Mantenimiento">Mantenimiento</option>
          </select>
        </div>
      </div>

      {/* Tabla / reporte */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {cargando ? (
          <SkeletonTable columns={12} rows={10} />
        ) : vehiculos.length === 0 ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500">
            <div className="text-4xl mb-3">🚛</div>
            <p className="font-medium">No hay vehículos que coincidan con la búsqueda</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b-2 border-slate-200 dark:border-slate-800 text-left whitespace-nowrap">
                    {COLUMNAS.map((col, i) => (
                      <th key={i} onClick={() => col.key && ordenarPor(col.key)}
                        className={`px-3 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase ${col.key ? 'cursor-pointer hover:text-slate-700 dark:hover:text-slate-200' : ''}`}>
                        {col.label}
                        {col.key && sort === col.key && (dir === 'asc' ? ' ▲' : ' ▼')}
                      </th>
                    ))}
                    <th className="px-3 py-3 no-print"></th>
                  </tr>
                </thead>
                <tbody>
                  {vehiculos.map((v, i) => (
                    <FilaVehiculo key={v.id} v={v} i={(pagination.page - 1) * pagination.limit + i} sort={sort} dir={dir} ordenarPor={ordenarPor} abrirEditar={abrirEditar} toggleActivo={toggleActivo} marcarVendido={marcarVendido} />
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

      {/* Modal nuevo/editar */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setModalAbierto(false); }}>
          <form onSubmit={guardar} className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl p-4 sm:p-4 sm:p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{editando ? `Editar vehículo ${editando.placa}` : 'Nuevo vehículo'}</h3>
              <button type="button" onClick={() => setModalAbierto(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>

            {errorModal && <div className="mb-4 p-3 rounded-lg bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300 text-sm">{errorModal}</div>}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo *</label>
                <input required list="lista-tipos" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} className={inputCls} placeholder="Ej: Tractocamión" />
                <datalist id="lista-tipos">{catalogos.tipo_vehiculo.map(t => <option key={t} value={t} />)}</datalist>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Marca *</label>
                <input required list="lista-marcas" value={form.marca} onChange={e => setForm({ ...form, marca: e.target.value })} className={inputCls} placeholder="Ej: Volvo" />
                <datalist id="lista-marcas">{catalogos.marca.map(m => <option key={m} value={m} />)}</datalist>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Modelo *</label>
                <input required list="lista-modelos" value={form.modelo} onChange={e => setForm({ ...form, modelo: e.target.value })} className={inputCls} placeholder="Ej: FH 460" />
                <datalist id="lista-modelos">{catalogos.modelo.map(m => <option key={m} value={m} />)}</datalist>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Placa * {editando?.estado_vehiculo==='En ruta' && <span className="text-[11px] text-amber-600">(bloqueada)</span>}</label>
                <input required value={form.placa} onChange={e => setForm({ ...form, placa: e.target.value.toUpperCase() })} className={`${inputCls} font-mono ${editando?.estado_vehiculo==='En ruta'?'bg-slate-100 opacity-60':''}`} placeholder="Ej: 1234-ABC" maxLength={15} disabled={editando?.estado_vehiculo==='En ruta'} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">N° de serie</label>
                <input value={form.numero_serie} onChange={e => setForm({ ...form, numero_serie: e.target.value })} className={inputCls} placeholder="Ej: YS2R4X20…" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Color</label>
                <input value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className={inputCls} placeholder="Ej: Blanco" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Año</label>
                <input type="number" min={1950} max={2100} value={form.anio} onChange={e => setForm({ ...form, anio: e.target.value })} className={inputCls} placeholder="Ej: 2022" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Carga máxima (Kg)</label>
                <input type="number" min={0} step="any" value={form.carga_maxima_kg} onChange={e => setForm({ ...form, carga_maxima_kg: e.target.value })} className={inputCls} placeholder="Ej: 38000" />
              </div>
            </div>

            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Asignación</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Operador logístico</label>
                <input value={form.operador_logistico} onChange={e => setForm({ ...form, operador_logistico: e.target.value })} className={inputCls} placeholder="Ej: Transportes Andina SRL" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Conductor designado {editando?.estado_vehiculo==='En ruta' && <span className="text-[11px] text-amber-600">(bloqueado: En ruta)</span>}</label>
                <select value={form.chofer_id} onChange={e => setForm({ ...form, chofer_id: e.target.value })} className={inputCls} disabled={editando?.estado_vehiculo==='En ruta'}>
                  <option value="">Sin asignar</option>
                  {choferes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
                {editando?.estado_vehiculo==='En ruta' && <p className="text-[11px] text-amber-600 mt-1">No se puede cambiar conductor mientras el camión está En ruta.</p>}
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <button type="button" onClick={() => setModalAbierto(false)} className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 hover:bg-slate-300">Cancelar</button>
              <button type="submit" disabled={guardando} className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
