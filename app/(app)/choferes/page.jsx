'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import StatCard from '@/components/ui/StatCard';
import Calificacion from '@/components/ui/Calificacion';
import { descargar, fmtFechaISO } from '@/lib/utils';

/**
 * Módulo de Conductores (Chóferes) — hoja Excel "Conductores".
 *
 * Campos base: documento, nombre, licencia, dirección, teléfono y
 * calificación controlada (1-5 estrellas). Además contempla:
 *   - Referencias familiares (nombre, parentesco, contacto)
 *   - Seguro individual (inicio, expiración, estado derivado, historial)
 * La placa se mantiene porque el módulo de Gastos de Chofer la utiliza.
 */

const VACIO = { nombre: '', placa: '', documento: '', licencia: '', telefono: '', direccion: '', calificacion: null };

function ChoferesContenido() {
  const searchParams = useSearchParams();

  const [choferes, setChoferes] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const [q, setQ] = useState('');
  const [fCalif, setFCalif] = useState('');

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [errorModal, setErrorModal] = useState('');
  const [avisoDetalle, setAvisoDetalle] = useState('');

  // Detalle (referencias + seguro individual + multas + documentación)
  const [detalle, setDetalle] = useState(null);       // { chofer, referencias, seguros_individuales, multas, documentos }
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [nuevaRef, setNuevaRef] = useState({ nombre: '', parentesco: '', telefono: '' });
  const [nuevoSeg, setNuevoSeg] = useState({ fecha_inicio: '', fecha_expiracion: '' });
  const [nuevaMulta, setNuevaMulta] = useState({ fecha: '', motivo: '', monto: '', observaciones: '' });

  const cargar = useCallback(async () => {
    try {
      const p = new URLSearchParams();
      if (q) p.set('q', q);
      if (fCalif) p.set('calificacion', fCalif);
      const res = await fetch(`/api/choferes?${p.toString()}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setChoferes(data.choferes);
      setResumen(data.resumen);
      setError('');
    } catch {
      setError('No se pudo cargar la lista de conductores');
    }
    setCargando(false);
  }, [q, fCalif]);

  useEffect(() => { const t = setTimeout(cargar, 250); return () => clearTimeout(t); }, [cargar]);

  async function abrirDetalle(chofer) {
    setCargandoDetalle(true);
    setNuevaRef({ nombre: '', parentesco: '', telefono: '' });
    setNuevoSeg({ fecha_inicio: '', fecha_expiracion: '' });
    setNuevaMulta({ fecha: '', motivo: '', monto: '', observaciones: '' });
    setAvisoDetalle('');
    try {
      const res = await fetch(`/api/choferes/${chofer.id}`);
      const data = await res.json();
      if (res.ok) setDetalle(data);
      else setError('No se pudo cargar el detalle del conductor');
    } catch {
      setError('No se pudo cargar el detalle del conductor');
    }
    setCargandoDetalle(false);
  }

  // Apertura desde la búsqueda global (/choferes?detalle=ID)
  useEffect(() => {
    const id = searchParams.get('detalle');
    if (!id) return;
    abrirDetalle({ id: Number(id) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function abrirNuevo() {
    setEditando(null);
    setForm(VACIO);
    setErrorModal('');
    setModalAbierto(true);
  }

  function abrirEditar(c) {
    setEditando(c);
    setForm({
      nombre: c.nombre,
      placa: c.placa || '',
      documento: c.documento || '',
      licencia: c.licencia || '',
      telefono: c.telefono || '',
      direccion: c.direccion || '',
      calificacion: c.calificacion ?? null,
    });
    setErrorModal('');
    setModalAbierto(true);
  }

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    try {
      const url = editando ? `/api/choferes/${editando.id}` : '/api/choferes';
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
      if (detalle) await abrirDetalle(detalle.chofer);
    } catch {
      setErrorModal('Error de conexión al guardar');
    }
    setGuardando(false);
  }

  async function toggleChofer(c) {
    if (c.activo) {
      const ok = window.confirm(`¿Desactivar a "${c.nombre}"? No podrá registrarse gastos nuevos. Puedes reactivarlo después.`);
      if (!ok) return;
    }
    const res = await fetch(`/api/choferes/${c.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'toggle' }),
    });
    if (!res.ok) { setError('No se pudo cambiar el estado del conductor'); return; }
    await cargar();
  }

  async function agregarReferencia() {
    if (!nuevaRef.nombre.trim()) { setAvisoDetalle('El nombre del familiar es obligatorio'); return; }
    const res = await fetch(`/api/choferes/${detalle.chofer.id}/referencias`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nuevaRef),
    });
    const data = await res.json();
    if (!res.ok) { setAvisoDetalle(data.error || 'No se pudo agregar la referencia'); return; }
    setNuevaRef({ nombre: '', parentesco: '', telefono: '' });
    await abrirDetalle(detalle.chofer);
  }

  async function quitarReferencia(refId) {
    if (!window.confirm('¿Quitar esta referencia familiar?')) return;
    const res = await fetch(`/api/choferes/${detalle.chofer.id}/referencias?refId=${refId}`, { method: 'DELETE' });
    if (!res.ok) return;
    await abrirDetalle(detalle.chofer);
  }

  async function agregarSeguroIndividual() {
    const res = await fetch(`/api/choferes/${detalle.chofer.id}/seguros`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nuevoSeg),
    });
    const data = await res.json();
    if (!res.ok) { setAvisoDetalle(data.error || 'No se pudo registrar el seguro'); return; }
    setNuevoSeg({ fecha_inicio: '', fecha_expiracion: '' });
    await abrirDetalle(detalle.chofer);
  }

  async function quitarSeguroIndividual(segId) {
    if (!window.confirm('¿Eliminar este registro del historial del seguro individual?')) return;
    const res = await fetch(`/api/choferes/${detalle.chofer.id}/seguros?segId=${segId}`, { method: 'DELETE' });
    if (!res.ok) return;
    await abrirDetalle(detalle.chofer);
  }

  // ---- Multas ----
  async function agregarMulta() {
    if (!nuevaMulta.fecha || !nuevaMulta.motivo.trim()) { setAvisoDetalle('La fecha y el motivo de la multa son obligatorios'); return; }
    const res = await fetch(`/api/choferes/${detalle.chofer.id}/multas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nuevaMulta),
    });
    const data = await res.json();
    if (!res.ok) { setAvisoDetalle(data.error || 'No se pudo registrar la multa'); return; }
    setNuevaMulta({ fecha: '', motivo: '', monto: '', observaciones: '' });
    setAvisoDetalle('');
    await abrirDetalle(detalle.chofer);
  }

  async function quitarMulta(itemId) {
    if (!window.confirm('¿Eliminar esta multa del historial?')) return;
    const res = await fetch(`/api/choferes/${detalle.chofer.id}/multas?itemId=${itemId}`, { method: 'DELETE' });
    if (!res.ok) { setAvisoDetalle('No se pudo eliminar la multa'); return; }
    await abrirDetalle(detalle.chofer);
  }

  // ---- Documentación (luz, agua, croquis, adjuntos) ----
  async function subirArchivo(file) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'No se pudo subir el archivo');
    return data.url;
  }

  async function registrarDocumento(tipo, archivo = null) {
    try {
      const res = await fetch(`/api/choferes/${detalle.chofer.id}/documentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, archivo }),
      });
      const data = await res.json();
      if (!res.ok) { setAvisoDetalle(data.error || 'No se pudo registrar el documento'); return false; }
      setAvisoDetalle('');
      await abrirDetalle(detalle.chofer);
      return true;
    } catch (e) {
      setAvisoDetalle(e.message || 'Error al registrar el documento');
      return false;
    }
  }

  async function adjuntarDocumento(tipo, file) {
    try {
      setAvisoDetalle('Subiendo archivo…');
      const url = await subirArchivo(file);
      await registrarDocumento(tipo, url);
    } catch (e) {
      setAvisoDetalle(e.message || 'Error al subir el archivo');
    }
  }

  async function quitarDocumento(docId) {
    if (!window.confirm('¿Quitar este documento?')) return;
    const res = await fetch(`/api/choferes/${detalle.chofer.id}/documentos?itemId=${docId}`, { method: 'DELETE' });
    if (!res.ok) return;
    await abrirDetalle(detalle.chofer);
  }


  const inputCls = 'w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 no-print">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 hidden print:block">Reporte de Conductores</h1>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Conductores</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Datos personales, licencia, calificación, referencias y seguro individual</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="bg-slate-200 dark:bg-slate-700 dark:text-slate-200 hover:bg-slate-300 text-slate-700 font-medium px-4 py-2 rounded-lg text-sm">🖨️ Imprimir</button>
          <button onClick={() => {
            const p = new URLSearchParams();
            if (q) p.set('q', q);
            if (fCalif) p.set('calificacion', fCalif);
            descargar(`/api/choferes/exportar?${p.toString()}`);
          }} className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-lg text-sm">⬇️ Exportar Excel</button>
          <button onClick={abrirNuevo} className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-sm">➕ Nuevo conductor</button>
        </div>
      </div>

      {/* Indicadores permitidos */}
      {resumen && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <StatCard titulo="Conductores activos" valor={resumen.total_activos} icono="👨‍✈️" color="violet" />
          {[5, 4, 3].map(n => (
            <StatCard key={n} titulo={`Con ${n} ★`} valor={resumen[`cal_${n}`]} icono="⭐" color={n === 5 ? 'green' : n === 4 ? 'blue' : 'amber'} />
          ))}
          <StatCard titulo="Total registrados" valor={resumen.total} icono="📋" color="blue" />
        </div>
      )}

      {error && <div className="mb-4 p-3 rounded-lg bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300 text-sm no-print">{error}</div>}

      {/* Filtros */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 mb-4 no-print">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar: nombre, documento o licencia…" className={inputCls} />
          <select value={fCalif} onChange={e => setFCalif(e.target.value)} className={inputCls}>
            <option value="">Calificación: todas</option>
            {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{'★'.repeat(n)}</option>)}
          </select>
        </div>
      </div>

      {/* Tabla / reporte */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {cargando ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500">Cargando...</div>
        ) : choferes.length === 0 ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500">
            <div className="text-4xl mb-3">👨‍✈️</div>
            <p className="font-medium">No hay conductores que coincidan con la búsqueda</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b-2 border-slate-200 dark:border-slate-800 text-left whitespace-nowrap">
                  {['Nro', 'Documento', 'Nombre completo', 'Licencia', 'Dirección', 'Teléfono/Celular', 'Calificación', 'Estado'].map(h => (
                    <th key={h} className="px-3 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">{h}</th>
                  ))}
                  <th className="px-3 py-3 no-print"></th>
                </tr>
              </thead>
              <tbody>
                {choferes.map((c, i) => (
                  <tr key={c.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-3 py-2.5 text-slate-400">{i + 1}</td>
                    <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">{c.documento || '—'}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 shrink-0 rounded-full bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center font-bold text-violet-700 dark:text-violet-300 text-sm">
                          {c.nombre.charAt(0).toUpperCase()}
                        </div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {c.nombre}{!c.activo && <span className="ml-1.5 text-[10px] bg-red-100 text-red-500 px-1.5 py-0.5 rounded-full align-middle">Inactivo</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">{c.licencia || '—'}</td>
                    <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400 max-w-[220px] truncate" title={c.direccion || ''}>{c.direccion || '—'}</td>
                    <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400">{c.telefono || '—'}</td>
                    <td className="px-3 py-2.5"><Calificacion valor={c.calificacion} /></td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${c.activo ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300'}`}>
                        {c.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 no-print">
                      <div className="flex gap-1.5 whitespace-nowrap">
                        <button onClick={() => abrirDetalle(c)} className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 hover:bg-blue-200">🔍 Detalle</button>
                        <button onClick={() => abrirEditar(c)} className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 hover:bg-slate-300">✏️ Editar</button>
                        <button onClick={() => toggleChofer(c)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium ${c.activo ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300 hover:bg-red-200' : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 hover:bg-green-200'}`}>
                          {c.activo ? 'Desactivar' : 'Activar'}
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
          <form onSubmit={guardar} className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{editando ? 'Editar conductor' : 'Nuevo conductor'}</h3>
              <button type="button" onClick={() => setModalAbierto(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>

            {errorModal && <div className="mb-4 p-3 rounded-lg bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300 text-sm">{errorModal}</div>}

            <div className="grid gap-3.5">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre completo *</label>
                <input required value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} className={inputCls} placeholder="Ej: Pedro Quispe" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Documento de identidad</label>
                  <input value={form.documento} onChange={e => setForm({ ...form, documento: e.target.value })} className={inputCls} placeholder="Ej: 1234567" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">N° de licencia</label>
                  <input value={form.licencia} onChange={e => setForm({ ...form, licencia: e.target.value })} className={`${inputCls} font-mono`} placeholder="Ej: LIC-456789" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Teléfono/Celular</label>
                  <input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} className={inputCls} placeholder="Ej: 70012345" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Placa del camión *</label>
                  <input required value={form.placa} onChange={e => setForm({ ...form, placa: e.target.value.toUpperCase() })} className={`${inputCls} font-mono`} placeholder="Ej: 1234-BCD" title="Se mantiene para Gastos de Chofer" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Dirección</label>
                <input value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} className={inputCls} placeholder="Ej: Av. Montes 123, La Paz" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Calificación (1 a 5 estrellas)</label>
                <Calificacion editable valor={form.calificacion} onChange={v => setForm({ ...form, calificacion: v })} />
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

      {/* Modal de detalle con referencias y seguro individual */}
      {(detalle || cargandoDetalle) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setDetalle(null); }}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-xl p-6 max-h-[92vh] overflow-y-auto">
            {cargandoDetalle || !detalle ? (
              <p className="p-6 text-center text-slate-400">Cargando detalle...</p>
            ) : (
              <>
                <div className="flex justify-between items-start mb-5">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{detalle.chofer.nombre}</h3>
                    <p className="text-xs text-slate-400">Ficha del conductor · Nro interno {detalle.chofer.id}</p>
                  </div>
                  <button onClick={() => setDetalle(null)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
                  <Campo label="Documento" valor={detalle.chofer.documento} />
                  <Campo label="Licencia" valor={detalle.chofer.licencia} />
                  <Campo label="Teléfono/Celular" valor={detalle.chofer.telefono} />
                  <Campo label="Dirección" valor={detalle.chofer.direccion} />
                  <div>
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-0.5">Calificación</p>
                    <Calificacion valor={detalle.chofer.calificacion} />
                  </div>
                  <Campo label="Camión asignado" valor={detalle.chofer.placa} />
                </div>

                {avisoDetalle && <div className="mb-4 p-3 rounded-lg bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300 text-sm">{avisoDetalle}</div>}

                {/* Referencias familiares */}
                <section className="border-t border-slate-100 dark:border-slate-800 pt-4 mb-6">
                  <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm mb-2">Referencias familiares</h4>
                  {detalle.referencias.length === 0 ? (
                    <p className="text-xs text-slate-400 mb-2">Sin referencias registradas.</p>
                  ) : (
                    <ul className="space-y-1.5 mb-3">
                      {detalle.referencias.map(r => (
                        <li key={r.id} className="flex items-center justify-between text-sm bg-slate-50 dark:bg-slate-800/60 rounded-lg px-3 py-2">
                          <span><b>{r.nombre}</b>{r.parentesco ? ` · ${r.parentesco}` : ''}{r.telefono ? ` · ☎ ${r.telefono}` : ''}</span>
                          <button type="button" onClick={() => quitarReferencia(r.id)} className="text-red-400 hover:text-red-600 text-xs">Quitar</button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <input placeholder="Nombre del familiar *" value={nuevaRef.nombre} onChange={e => setNuevaRef({ ...nuevaRef, nombre: e.target.value })} className={`${inputCls} text-sm`} />
                    <input placeholder="Parentesco" value={nuevaRef.parentesco} onChange={e => setNuevaRef({ ...nuevaRef, parentesco: e.target.value })} className={`${inputCls} text-sm`} />
                    <input placeholder="N° de contacto" value={nuevaRef.telefono} onChange={e => setNuevaRef({ ...nuevaRef, telefono: e.target.value })} className={`${inputCls} text-sm`} />
                  </div>
                  <button type="button" onClick={agregarReferencia} className="mt-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 hover:bg-violet-200">+ Agregar referencia</button>
                </section>

                {/* Seguro individual (historial) */}
                <section className="border-t border-slate-100 dark:border-slate-800 pt-4">
                  <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm mb-2">Seguro individual · historial</h4>
                  {detalle.seguros_individuales.length === 0 ? (
                    <p className="text-xs text-slate-400 mb-2">Sin registros de seguro.</p>
                  ) : (
                    <table className="w-full text-xs mb-3">
                      <thead>
                        <tr className="text-left text-slate-400 uppercase text-[10px]">
                          <th className="py-1 pr-2">Inicio</th>
                          <th className="py-1 pr-2">Expiración</th>
                          <th className="py-1 pr-2">Estado</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalle.seguros_individuales.map(s => (
                          <tr key={s.id} className="border-t border-slate-100 dark:border-slate-800">
                            <td className="py-1.5 pr-2">{fmtFechaISO(s.fecha_inicio)}</td>
                            <td className="py-1.5 pr-2">{fmtFechaISO(s.fecha_expiracion)}</td>
                            <td className="py-1.5 pr-2">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                s.estado === 'Vigente' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                : s.estado === 'Vencido' ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300'
                                : 'bg-slate-100 text-slate-400'}`}>
                                {s.estado || 'Sin fecha'}
                              </span>
                            </td>
                            <td className="py-1.5 text-right">
                              <button type="button" onClick={() => quitarSeguroIndividual(s.id)} className="text-red-400 hover:text-red-600">Quitar</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <div className="grid grid-cols-3 gap-2 items-end">
                    <input type="date" title="Fecha de inicio" value={nuevoSeg.fecha_inicio} onChange={e => setNuevoSeg({ ...nuevoSeg, fecha_inicio: e.target.value })} className={`${inputCls} text-sm`} />
                    <input type="date" min={nuevoSeg.fecha_inicio || undefined} title="Fecha de expiración" value={nuevoSeg.fecha_expiracion} onChange={e => setNuevoSeg({ ...nuevoSeg, fecha_expiracion: e.target.value })} className={`${inputCls} text-sm`} />
                    <button type="button" onClick={agregarSeguroIndividual} className="px-3 py-2 rounded-lg text-xs font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 hover:bg-violet-200 whitespace-nowrap">+ Registrar seguro</button>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400">ℹ️ El estado del seguro se calcula automáticamente según la fecha actual.</p>
                </section>

                {/* Multas */}
                <section className="border-t border-slate-100 dark:border-slate-800 pt-4 mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Multas</h4>
                    {detalle.multas.length > 0 && (
                      <span className="text-xs text-slate-400">
                        Total: Bs. {detalle.multas.reduce((a, m) => a + Number(m.monto || 0), 0).toLocaleString('es-BO')}
                      </span>
                    )}
                  </div>
                  {detalle.multas.length === 0 ? (
                    <p className="text-xs text-slate-400 mb-2">Sin multas registradas.</p>
                  ) : (
                    <ul className="space-y-1.5 mb-3">
                      {detalle.multas.map(m => (
                        <li key={m.id} className="flex items-start justify-between gap-2 text-sm bg-slate-50 dark:bg-slate-800/60 rounded-lg px-3 py-2">
                          <div>
                            <b>{fmtFechaISO(m.fecha)}</b> · {m.motivo}
                            {m.monto != null && <span className="ml-1 font-medium">· Bs. {Number(m.monto).toLocaleString('es-BO')}</span>}
                            {m.observaciones && <p className="text-xs text-slate-400 mt-0.5">{m.observaciones}</p>}
                          </div>
                          <button type="button" onClick={() => quitarMulta(m.id)} className="text-red-400 hover:text-red-600 text-xs shrink-0">Quitar</button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <input type="date" title="Fecha" value={nuevaMulta.fecha} onChange={e => setNuevaMulta({ ...nuevaMulta, fecha: e.target.value })} className={`${inputCls} text-sm`} />
                    <input placeholder="Motivo *" value={nuevaMulta.motivo} onChange={e => setNuevaMulta({ ...nuevaMulta, motivo: e.target.value })} className={`${inputCls} text-sm`} />
                    <input type="number" min={0} step="any" placeholder="Monto (opcional)" value={nuevaMulta.monto} onChange={e => setNuevaMulta({ ...nuevaMulta, monto: e.target.value })} className={`${inputCls} text-sm`} />
                    <input placeholder="Observaciones" value={nuevaMulta.observaciones} onChange={e => setNuevaMulta({ ...nuevaMulta, observaciones: e.target.value })} className={`${inputCls} text-sm`} />
                  </div>
                  <button type="button" onClick={agregarMulta} className="mt-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 hover:bg-violet-200">+ Registrar multa</button>
                </section>

                {/* Documentación */}
                <DocumentacionSection
                  documentos={detalle.documentos}
                  onRegistrar={registrarDocumento}
                  onAdjuntar={adjuntarDocumento}
                  onQuitar={quitarDocumento}
                />

                <div className="flex justify-end mt-6 no-print">
                  <button onClick={() => abrirEditar(detalle.chofer)} className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 hover:bg-slate-300">✏️ Editar datos</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Campo({ label, valor, children }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
      {children || <p className="text-sm text-slate-800 dark:text-slate-200">{valor || '—'}</p>}
    </div>
  );
}

const DOCS_FIJOS = [
  { tipo: 'luz', label: 'Fotocopia de luz', icono: '💡' },
  { tipo: 'agua', label: 'Fotocopia de agua', icono: '🚰' },
  { tipo: 'croquis', label: 'Croquis del domicilio', icono: '🗺️' },
];

function DocumentacionSection({ documentos, onRegistrar, onAdjuntar, onQuitar }) {
  const porTipo = Object.fromEntries(documentos.map(d => [d.tipo, d]));
  const adjuntos = documentos.filter(d => d.tipo === 'adjunto');

  function filaDoc(icono, label, doc, tipo) {
    return (
      <li key={tipo} className="flex flex-wrap items-center justify-between gap-2 text-sm bg-slate-50 dark:bg-slate-800/60 rounded-lg px-3 py-2">
        <span>
          {icono} {label}
          {doc ? (
            <span className="ml-2 inline-flex items-center gap-1">
              <span className="text-green-600 dark:text-green-400 text-xs font-semibold">✓ Registrado</span>
              {doc.archivo && (
                <a href={doc.archivo} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-xs">Ver adjunto</a>
              )}
            </span>
          ) : (
            <span className="ml-2 text-xs text-slate-400">Falta</span>
          )}
        </span>
        <span className="flex items-center gap-2 shrink-0">
          {!doc && (
            <button type="button" onClick={() => onRegistrar(tipo)} className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 hover:bg-violet-200">Marcar</button>
          )}
          <label className={`px-2.5 py-1 rounded-lg text-[11px] font-medium cursor-pointer ${doc?.archivo ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 hover:bg-slate-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 hover:bg-blue-200'}`}>
            {doc?.archivo ? 'Cambiar' : 'Adjuntar'}
            <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files[0]) onAdjuntar(tipo, e.target.files[0]); }} />
          </label>
          {doc && (
            <button type="button" onClick={() => onQuitar(doc.id)} className="text-red-400 hover:text-red-600 text-xs">Quitar</button>
          )}
        </span>
      </li>
    );
  }

  return (
    <section className="border-t border-slate-100 dark:border-slate-800 pt-4">
      <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm mb-2">Documentación</h4>
      <ul className="space-y-1.5 mb-3">
        {DOCS_FIJOS.map(({ tipo, label, icono }) => filaDoc(icono, label, porTipo[tipo], tipo))}
      </ul>

      <div className="flex flex-wrap items-center gap-2 mb-2">
        <label className="px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 hover:bg-violet-200 cursor-pointer">
          + Adjuntar documento
          <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files[0]) onAdjuntar('adjunto', e.target.files[0]); }} />
        </label>
      </div>
      {adjuntos.length > 0 && (
        <ul className="space-y-1.5">
          {adjuntos.map(a => (
            <li key={a.id} className="flex items-center justify-between text-sm bg-slate-50 dark:bg-slate-800/60 rounded-lg px-3 py-2">
              📎 <a href={a.archivo} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline truncate max-w-[70%]">Documento adjunto ({new Date(a.creado).toLocaleDateString('es-BO')})</a>
              <button type="button" onClick={() => onQuitar(a.id)} className="text-red-400 hover:text-red-600 text-xs shrink-0">Quitar</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function ChoferesPage() {
  return <ChoferesContenido />;
}
