'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import StatCard from '@/components/ui/StatCard';
import { descargar, fmtFechaISO } from '@/lib/utils';

/**
 * Módulo de Seguros — pólizas asociadas a los vehículos POR PLACA.
 * El estado (Vigente/Vencido) se calcula automáticamente según la fecha
 * actual; nunca lo escribe el usuario.
 */

const ESTADO_ESTILO = {
  Vigente: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  Vencido: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300',
};

const VACIO = { placa: '', aseguradora: '', poliza: '', fecha_inicio: '', fecha_vencimiento: '', importe_pagado: '', fecha_pago: '' };

function SegurosContenido() {
  const searchParams = useSearchParams();

  const [seguros, setSeguros] = useState([]);
  const [alertas, setAlertas] = useState({ vencidos: 0, proximos: 0 });
  const [vehiculos, setVehiculos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const [q, setQ] = useState('');
  const [fEstado, setFEstado] = useState('');
  const [inicioDesde, setInicioDesde] = useState('');
  const [inicioHasta, setInicioHasta] = useState('');
  const [vencDesde, setVencDesde] = useState('');
  const [vencHasta, setVencHasta] = useState('');
  const [sort, setSort] = useState('vencimiento');
  const [dir, setDir] = useState('asc');

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [errorModal, setErrorModal] = useState('');

  // Apertura desde la búsqueda global (/seguros?detalle=ID)
  useEffect(() => {
    const detalle = searchParams.get('detalle');
    if (!detalle) return;
    fetch(`/api/seguros/${detalle}`)
      .then(async r => {
        if (!r.ok) return;
        const data = await r.json();
        abrirEditar(data.seguro);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const params = useCallback(() => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (fEstado) p.set('estado', fEstado);
    if (inicioDesde) p.set('inicio_desde', inicioDesde);
    if (inicioHasta) p.set('inicio_hasta', inicioHasta);
    if (vencDesde) p.set('venc_desde', vencDesde);
    if (vencHasta) p.set('venc_hasta', vencHasta);
    p.set('sort', sort);
    p.set('dir', dir);
    return p;
  }, [q, fEstado, inicioDesde, inicioHasta, vencDesde, vencHasta, sort, dir]);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/seguros?${params().toString()}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSeguros(data.seguros);
      setAlertas(data.alertas);
      setError('');
    } catch {
      setError('No se pudo cargar el reporte de seguros');
    }
    setCargando(false);
  }, [params]);

  useEffect(() => { const t = setTimeout(cargar, 250); return () => clearTimeout(t); }, [cargar]);

  useEffect(() => {
    // Placas válidas para asociar pólizas (validación tipo lista desplegable del Excel)
    fetch('/api/flota')
      .then(r => r.json())
      .then(data => setVehiculos((data.vehiculos || []).map(v => ({ placa: v.placa, activo: v.activo }))))
      .catch(() => {});
  }, []);

  function ordenarPor(col) {
    if (sort === col) setDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSort(col); setDir('asc'); }
  }

  function abrirNuevo() {
    setEditando(null);
    setForm(VACIO);
    setErrorModal('');
    setModalAbierto(true);
  }

  function abrirEditar(s) {
    setEditando(s);
    setForm({
      placa: s.placa,
      aseguradora: s.aseguradora,
      poliza: s.poliza,
      fecha_inicio: s.fecha_inicio ? String(s.fecha_inicio).slice(0, 10) : '',
      fecha_vencimiento: s.fecha_vencimiento ? String(s.fecha_vencimiento).slice(0, 10) : '',
      importe_pagado: s.importe_pagado ?? '',
      fecha_pago: s.fecha_pago ? String(s.fecha_pago).slice(0, 10) : '',
    });
    setErrorModal('');
    setModalAbierto(true);
  }

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    try {
      const url = editando ? `/api/seguros/${editando.id}` : '/api/seguros';
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

  async function toggleActivo(s) {
    if (s.activo) {
      const ok = window.confirm(`¿Desactivar la póliza ${s.poliza} (${s.placa})? Dejará de considerarse como seguro actual del vehículo.`);
      if (!ok) return;
    }
    const res = await fetch(`/api/seguros/${s.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'toggle' }),
    });
    if (!res.ok) { setError('No se pudo cambiar el estado de la póliza'); return; }
    await cargar();
  }

  const inputCls = 'w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 no-print">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 hidden print:block">Reporte de Seguros</h1>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Seguros</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Pólizas asociadas a los vehículos por placa · estado automático</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="bg-slate-200 dark:bg-slate-700 dark:text-slate-200 hover:bg-slate-300 text-slate-700 font-medium px-4 py-2 rounded-lg text-sm">🖨️ Imprimir</button>
          <button onClick={() => descargar(`/api/seguros/exportar?${params().toString()}`)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-lg text-sm">⬇️ Exportar Excel</button>
          <button onClick={abrirNuevo} className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-sm">➕ Nuevo seguro</button>
        </div>
      </div>

      {/* Alertas */}
      {(alertas.vencidos > 0 || alertas.proximos > 0) && (
        <div className="grid md:grid-cols-2 gap-3 mb-4 no-print">
          {alertas.vencidos > 0 && (
            <button onClick={() => { setFEstado('Vencido'); }} className="text-left p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm hover:border-red-400 transition">
              ⚠️ <b>{alertas.vencidos}</b> póliza(s) vencida(s). Clic para verlas.
            </button>
          )}
          {alertas.proximos > 0 && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-300 text-sm">
              📅 <b>{alertas.proximos}</b> póliza(s) vence(n) en los próximos 30 días.
            </div>
          )}
        </div>
      )}

      {/* Indicadores permitidos en esta fase */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <StatCard titulo="Pólizas vencidas" valor={alertas.vencidos} icono="⚠️" color="red" />
        <StatCard titulo="Por vencer (30 días)" valor={alertas.proximos} icono="📅" color="amber" />
        <StatCard titulo="Pólizas listadas" valor={seguros.length} icono="🛡️" color="blue" />
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300 text-sm no-print">{error}</div>}

      {/* Filtros */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 mb-4 no-print">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar: placa, aseguradora, póliza…" className={`${inputCls} col-span-2`} />
          <select value={fEstado} onChange={e => setFEstado(e.target.value)} className={inputCls}>
            <option value="">Estado: todos</option>
            <option value="Vigente">Vigente</option>
            <option value="Vencido">Vencido</option>
          </select>
          <input type="date" value={vencDesde} onChange={e => setVencDesde(e.target.value)} title="Vencimiento desde" className={inputCls} />
          <input type="date" value={vencHasta} onChange={e => setVencHasta(e.target.value)} title="Vencimiento hasta" className={inputCls} />
          <input type="date" value={inicioDesde} onChange={e => setInicioDesde(e.target.value)} title="Inicio desde" className={inputCls} />
          <input type="date" value={inicioHasta} onChange={e => setInicioHasta(e.target.value)} title="Inicio hasta" className={inputCls} />
        </div>
        <div className="mt-2 text-[11px] text-slate-400">Los dos primeros campos de fecha filtran por vencimiento; los otros dos, por fecha de inicio.</div>
      </div>

      {/* Tabla / reporte */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {cargando ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500">Cargando...</div>
        ) : seguros.length === 0 ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500">
            <div className="text-4xl mb-3">🛡️</div>
            <p className="font-medium">No hay seguros que coincidan con la búsqueda</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b-2 border-slate-200 dark:border-slate-800 text-left whitespace-nowrap">
                  {[['nro', 'Nro'], ['placa', 'Placa'], ['aseguradora', 'Aseguradora'], ['poliza', 'Póliza'],
                    ['inicio', 'Fecha de inicio'], ['vencimiento', 'Vencimiento'], ['importe', 'Importe pagado'],
                    ['pago', 'Fecha de pago'], ['estado', 'Estado']].map(([key, label]) => (
                    <th key={key} onClick={() => ordenarPor(key)}
                      className="px-3 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:text-slate-700 dark:hover:text-slate-200">
                      {label}{sort === key && (dir === 'asc' ? ' ▲' : ' ▼')}
                    </th>
                  ))}
                  <th className="px-3 py-3 no-print"></th>
                </tr>
              </thead>
              <tbody>
                {seguros.map((s, i) => (
                  <tr key={s.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-3 py-2.5 text-slate-400">{i + 1}</td>
                    <td className="px-3 py-2.5">
                      <span className={`font-mono text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${s.activo ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'}`}>
                        {s.placa}{!s.activo && ' · Inactivo'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-medium text-slate-700 dark:text-slate-300">{s.aseguradora}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-700 dark:text-slate-300">{s.poliza}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-700 dark:text-slate-300">{fmtFechaISO(s.fecha_inicio)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-700 dark:text-slate-300">{fmtFechaISO(s.fecha_vencimiento)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-700 dark:text-slate-300">{s.importe_pagado != null ? `Bs. ${Number(s.importe_pagado).toLocaleString('es-BO')}` : '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-700 dark:text-slate-300">{fmtFechaISO(s.fecha_pago)}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${ESTADO_ESTILO[s.estado] || 'bg-slate-100 text-slate-400'}`}>
                        {s.estado || 'Sin fecha'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 no-print">
                      <div className="flex gap-1.5 whitespace-nowrap">
                        <button onClick={() => abrirEditar(s)} className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 hover:bg-slate-300">✏️ Editar</button>
                        {s.vehiculo_id && (
                          <Link href={`/flota/${s.vehiculo_id}`} className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 hover:bg-blue-200">🚚 Ver vehículo</Link>
                        )}
                        <button onClick={() => toggleActivo(s)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium ${s.activo ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300 hover:bg-red-200' : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 hover:bg-green-200'}`}>
                          {s.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal nuevo/editar */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setModalAbierto(false); }}>
          <form onSubmit={guardar} className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{editando ? `Editar póliza ${editando.poliza}` : 'Nuevo seguro'}</h3>
              <button type="button" onClick={() => setModalAbierto(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>

            {errorModal && <div className="mb-4 p-3 rounded-lg bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300 text-sm">{errorModal}</div>}

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Placa del vehículo *</label>
                <select required value={form.placa} onChange={e => setForm({ ...form, placa: e.target.value })} className={`${inputCls} font-mono`}>
                  <option value="">Seleccionar vehículo…</option>
                  {vehiculos.map(v => <option key={v.placa} value={v.placa}>{v.placa}</option>)}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">El seguro se asocia al vehículo mediante la placa.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Aseguradora *</label>
                <input required value={form.aseguradora} onChange={e => setForm({ ...form, aseguradora: e.target.value })} className={inputCls} placeholder="Ej: Soboce" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Póliza *</label>
                <input required value={form.poliza} onChange={e => setForm({ ...form, poliza: e.target.value })} className={`${inputCls} font-mono`} placeholder="Ej: POL-2026-001" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fecha de inicio</label>
                <input type="date" value={form.fecha_inicio} onChange={e => setForm({ ...form, fecha_inicio: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fecha de vencimiento</label>
                <input type="date" min={form.fecha_inicio || undefined} value={form.fecha_vencimiento} onChange={e => setForm({ ...form, fecha_vencimiento: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Importe pagado (Bs.)</label>
                <input type="number" min={0} step="any" value={form.importe_pagado} onChange={e => setForm({ ...form, importe_pagado: e.target.value })} className={inputCls} placeholder="Ej: 850.00" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fecha de pago</label>
                <input type="date" value={form.fecha_pago} onChange={e => setForm({ ...form, fecha_pago: e.target.value })} className={inputCls} />
              </div>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs text-blue-700 dark:text-blue-300">
              ℹ️ El estado de la póliza (Vigente/Vencido) se calcula automáticamente comparando la fecha de vencimiento con la fecha actual.
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

export default function SegurosPage() {
  return (
    <SegurosContenido />
  );
}
