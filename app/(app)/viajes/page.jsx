'use client';
import { useState, useEffect, useCallback } from 'react';
import SkeletonTable from '@/components/ui/SkeletonTable';

const ESTADOS = ['Programado','En ruta','Entregado','Cancelado'];
const VACIO = { placa: '', tipo: '', chofer_nombre: '', tramo: '', fecha_carga: '', producto: '', cantidad_palets: '', fecha_entrada: '', fecha_llegada: '', planilla: '', codigo_carga: '', observaciones: '', flota_id: '', chofer_id: '', estado: 'En ruta' };

export default function ViajesPage() {
  const [viajes, setViajes] = useState([]);
  const [pagination, setPagination] = useState({ page:1, limit:50, totalCount:0, totalPages:1 });
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [errorModal, setErrorModal] = useState('');
  const [flota, setFlota] = useState([]);
  const [choferes, setChoferes] = useState([]);
  const [confirmEstado, setConfirmEstado] = useState(null); // {v, nuevoEstado}

  const cargar = useCallback(async (signal) => {
    try {
      const p = new URLSearchParams(); if(q) p.set('q', q); p.set('page', String(page)); p.set('limit','50');
      const res = await fetch(`/api/viajes?${p.toString()}`, { signal });
      const text = await res.text();
      let d; try{ d = JSON.parse(text); } catch { throw new Error(text || `Error ${res.status}`); }
      if(!res.ok) throw new Error(d.error || `Error ${res.status}`);
      setViajes(d.viajes||[]); if(d.pagination) setPagination(d.pagination); setError('');
    } catch(e){ if(!signal?.aborted) setError(e.message||'Error'); }
    setCargando(false);
  }, [q, page]);

  useEffect(()=>{ const c=new AbortController(); const t=setTimeout(()=>cargar(c.signal),300); return()=>{clearTimeout(t);c.abort();}},[cargar]);
  useEffect(()=>{ fetch('/api/flota?limit=100').then(r=>r.json()).then(d=>setFlota(d.vehiculos||[])).catch(()=>{}); fetch('/api/choferes?limit=100').then(r=>r.json()).then(d=>setChoferes(d.choferes||[])).catch(()=>{}); },[]);

  async function guardar(e){
    e.preventDefault(); setGuardando(true); setErrorModal('');
    // chofer_nombre se deriva si se eligió chofer_id
    const payload = { ...form };
    if(payload.flota_id) {
      const f = flota.find(x=>String(x.id)===String(payload.flota_id));
      if(f) payload.placa = f.placa;
    }
    if(payload.chofer_id){
      const ch = choferes.find(x=>String(x.id)===String(payload.chofer_id));
      if(ch) payload.chofer_nombre = ch.nombre;
    }
    try{
      const res = await fetch('/api/viajes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const d=await res.json(); if(!res.ok) throw new Error(d.error);
      setModal(false); setForm(VACIO); await cargar();
    }catch(err){ setErrorModal(err.message);} setGuardando(false);
  }
  async function cambiarEstado(v, nuevoEstado){
    const actual = v.estado || 'En ruta';
    if (actual === 'Entregado' || actual === 'Cancelado') return;
    if (nuevoEstado === 'Entregado' || nuevoEstado === 'Cancelado') {
      setConfirmEstado({ v, nuevoEstado });
      return;
    }
    const res = await fetch(`/api/viajes/${v.id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({estado: nuevoEstado})});
    if(!res.ok){ const d=await res.json().catch(()=>({})); alert(d.error||'No se pudo cambiar estado'); return; }
    await cargar();
  }
  async function confirmarCambioEstado(){
    if(!confirmEstado) return;
    const { v, nuevoEstado } = confirmEstado;
    const res = await fetch(`/api/viajes/${v.id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({estado: nuevoEstado})});
    if(!res.ok){ const d=await res.json().catch(()=>({})); alert(d.error||'No se pudo cambiar estado'); return; }
    setConfirmEstado(null);
    await cargar();
  }

  const inputCls='w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Viajes</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Registro manual básico — si el camión está en ruta aparece como No disponible</p>
        </div>
        <button onClick={()=>{setForm(VACIO);setErrorModal('');setModal(true);}} className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-xl text-sm shadow">➕ Nuevo viaje</button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 mb-4">
        <input value={q} onChange={e=>{setQ(e.target.value);setPage(1);}} placeholder="Buscar por placa, tramo, producto, código..." className={inputCls} />
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-100 text-red-600 text-sm">{error}</div>}

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {cargando ? <SkeletonTable columns={8} rows={8}/> : viajes.length===0 ? (
          <div className="p-12 text-center text-slate-400"><div className="text-4xl mb-2">🚚</div><p>Sin viajes registrados</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b-2 border-slate-200 dark:border-slate-800 text-left whitespace-nowrap">
                  {['Placa','Tipo','Chofer','Tramo','Fecha carga','Producto','Palets','Entrada','Llegada','Planilla','Código','Estado','Obs'].map(h=>(
                    <th key={h} className="px-3 py-3 text-[11px] font-semibold text-slate-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {viajes.map(v=>(
                  <tr key={v.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-3 py-2 font-mono font-bold">{v.placa}</td>
                    <td className="px-3 py-2">{v.tipo||'—'}</td>
                    <td className="px-3 py-2">{v.chofer_nombre||'—'}</td>
                    <td className="px-3 py-2">{v.tramo||'—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{v.fecha_carga? new Date(v.fecha_carga).toLocaleDateString('es-BO'): '—'}</td>
                    <td className="px-3 py-2">{v.producto||'—'}</td>
                    <td className="px-3 py-2 text-center">{v.cantidad_palets??'—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{v.fecha_entrada? new Date(v.fecha_entrada).toLocaleDateString('es-BO'): '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{v.fecha_llegada? new Date(v.fecha_llegada).toLocaleDateString('es-BO'): <span className="text-amber-600 font-semibold">—</span>}</td>
                    <td className="px-3 py-2">{v.planilla||'—'}</td>
                    <td className="px-3 py-2 font-mono text-xs">{v.codigo_carga||'—'}</td>
                    <td className="px-3 py-2">
                      <select value={v.estado||'En ruta'} onChange={e=>cambiarEstado(v, e.target.value)} disabled={v.estado==='Entregado' || v.estado==='Cancelado'} className={`text-xs rounded-lg px-2 py-1 border font-semibold disabled:opacity-60 disabled:cursor-not-allowed ${v.estado==='En ruta'?'bg-blue-100 text-blue-700 border-blue-200':v.estado==='Entregado'?'bg-green-100 text-green-700 border-green-200':v.estado==='Cancelado'?'bg-red-100 text-red-600 border-red-200':'bg-amber-100 text-amber-700 border-amber-200'}`} title={v.estado==='Entregado' || v.estado==='Cancelado' ? 'Estado final — no se puede editar' : 'Cambiar estado'}>
                        {ESTADOS.map(s=><option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2 max-w-[150px] truncate" title={v.observaciones||''}>{v.observaciones||'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pagination.totalPages>1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800 text-sm">
            <span className="text-slate-500">{pagination.totalCount} viajes</span>
            <div className="flex gap-1">
              <button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="px-3 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 disabled:opacity-40 text-xs">← Anterior</button>
              <span className="px-2 py-1 text-xs">{page}/{pagination.totalPages}</span>
              <button disabled={page>=pagination.totalPages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 disabled:opacity-40 text-xs">Siguiente →</button>
            </div>
          </div>
        )}
      </div>

      {confirmEstado && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={e=>{if(e.target===e.currentTarget) setConfirmEstado(null);}}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm p-4 sm:p-6 shadow-xl border border-slate-200 dark:border-slate-800 text-center animate-scale-in">
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-3 text-xl">⚠️</div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">¿Cambiar a {confirmEstado.nuevoEstado}?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">El viaje <span className="font-mono font-bold">{confirmEstado.v.placa}</span> quedará bloqueado y no se podrá editar su estado después.</p>
            <div className="flex gap-2 justify-center mt-5">
              <button onClick={()=>setConfirmEstado(null)} className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200">Cancelar</button>
              <button onClick={confirmarCambioEstado} className="px-4 py-2 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white shadow">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e=>{if(e.target===e.currentTarget) setModal(false);}}>
          <form onSubmit={guardar} className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl p-4 sm:p-4 sm:p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Nuevo viaje — registro manual</h3>
              <button type="button" onClick={()=>setModal(false)} className="text-slate-400 text-xl">✕</button>
            </div>
            {errorModal && <div className="mb-3 p-3 rounded-lg bg-red-100 text-red-600 text-sm">{errorModal}</div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Placa *</label>
                <select value={form.flota_id} onChange={e=>{const v=e.target.value; const f=flota.find(x=>String(x.id)===v); setForm({...form, flota_id:v, placa: f?f.placa: form.placa});}} className={inputCls}>
                  <option value="">Elige camión</option>
                  {flota.map(f=><option key={f.id} value={f.id}>{f.placa} — {f.marca} {f.modelo}</option>)}
                </select>
                <input placeholder="o escribe placa manual" value={form.placa} onChange={e=>setForm({...form, placa:e.target.value.toUpperCase(), flota_id:''})} className={`${inputCls} mt-1 font-mono`} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Tipo</label>
                <input value={form.tipo} onChange={e=>setForm({...form, tipo:e.target.value})} className={inputCls} placeholder="Ej: Refrigerado" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Chofer</label>
                <select value={form.chofer_id} onChange={e=>{const v=e.target.value; const ch=choferes.find(x=>String(x.id)===v); setForm({...form, chofer_id:v, chofer_nombre: ch?ch.nombre:''});}} className={inputCls}>
                  <option value="">Elige chofer</option>
                  {choferes.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
                <input placeholder="o escribe nombre" value={form.chofer_nombre} onChange={e=>setForm({...form, chofer_nombre:e.target.value, chofer_id:''})} className={`${inputCls} mt-1`} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Tramo</label>
                <input value={form.tramo} onChange={e=>setForm({...form, tramo:e.target.value})} className={inputCls} placeholder="Ej: La Paz - Santa Cruz" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Fecha de carga</label>
                <input type="date" value={form.fecha_carga} onChange={e=>setForm({...form, fecha_carga:e.target.value})} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Producto</label>
                <input value={form.producto} onChange={e=>setForm({...form, producto:e.target.value})} className={inputCls} placeholder="Ej: Pollo" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Cantidad palets</label>
                <input type="number" min={0} value={form.cantidad_palets} onChange={e=>setForm({...form, cantidad_palets:e.target.value})} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Fecha entrada</label>
                <input type="date" value={form.fecha_entrada} onChange={e=>setForm({...form, fecha_entrada:e.target.value})} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Fecha llegada</label>
                <input type="date" value={form.fecha_llegada} onChange={e=>setForm({...form, fecha_llegada:e.target.value})} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Planilla</label>
                <input value={form.planilla} onChange={e=>setForm({...form, planilla:e.target.value})} className={inputCls} placeholder="Nro planilla" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Código de carga</label>
                <input value={form.codigo_carga} onChange={e=>setForm({...form, codigo_carga:e.target.value})} className={inputCls} placeholder="Ej: CAR-001" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Estado</label>
                <select value={form.estado} onChange={e=>setForm({...form, estado:e.target.value})} className={inputCls}>
                  {ESTADOS.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Observaciones</label>
                <input value={form.observaciones} onChange={e=>setForm({...form, observaciones:e.target.value})} className={inputCls} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={()=>setModal(false)} className="px-4 py-2 rounded-xl text-sm bg-slate-200 dark:bg-slate-700">Cancelar</button>
              <button type="submit" disabled={guardando} className="px-4 py-2 rounded-xl text-sm bg-blue-600 text-white disabled:opacity-60">{guardando?'Guardando...':'Guardar'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
