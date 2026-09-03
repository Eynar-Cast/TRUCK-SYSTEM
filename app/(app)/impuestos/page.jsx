'use client';
import { useState, useEffect, useCallback } from 'react';
import SkeletonTable from '@/components/ui/SkeletonTable';

export default function ImpuestosPage(){
  const [impuestos, setImpuestos]=useState([]);
  const [resumen, setResumen]=useState(null);
  const [q, setQ]=useState('');
  const [filtroPagado, setFiltroPagado]=useState('');
  const [page, setPage]=useState(1);
  const [pagination, setPagination]=useState({page:1,limit:50,totalCount:0,totalPages:1});
  const [cargando,setCargando]=useState(true);
  const [error,setError]=useState('');
  const [modal,setModal]=useState(false);
  const [form,setForm]=useState({ placa:'', flota_id:'', concepto:'', monto:'', fecha_registro:'', pagado:false, observaciones:'' });
  const [guardando,setGuardando]=useState(false);
  const [errorModal,setErrorModal]=useState('');
  const [flota,setFlota]=useState([]);

  const cargar=useCallback(async(signal)=>{
    try{
      const p=new URLSearchParams(); if(q) p.set('placa', q.toUpperCase()); if(filtroPagado) p.set('pagado', filtroPagado); p.set('page',String(page)); p.set('limit','50');
      const res=await fetch(`/api/impuestos?${p.toString()}`,{signal});
      const d=await res.json(); if(!res.ok) throw new Error(d.error);
      setImpuestos(d.impuestos); setResumen(d.resumen); if(d.pagination) setPagination(d.pagination);
    }catch(e){ if(!signal?.aborted) setError(e.message||'Error'); }
    setCargando(false);
  },[q,filtroPagado,page]);

  useEffect(()=>{const c=new AbortController(); const t=setTimeout(()=>cargar(c.signal),250); return()=>{clearTimeout(t);c.abort();}},[cargar]);
  useEffect(()=>{ fetch('/api/flota?limit=100').then(r=>r.json()).then(d=>setFlota(d.vehiculos||[])).catch(()=>{}); },[]);

  async function guardar(e){
    e.preventDefault(); setGuardando(true); setErrorModal('');
    if(!form.flota_id){ setErrorModal('Selecciona una placa registrada de la flota'); setGuardando(false); return; }
    const payload={...form};
    if(payload.flota_id){ const f=flota.find(x=>String(x.id)===String(payload.flota_id)); if(f) payload.placa=f.placa; }
    try{
      const res=await fetch('/api/impuestos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const d=await res.json(); if(!res.ok) throw new Error(d.error);
      setModal(false); setForm({ placa:'', flota_id:'', concepto:'', monto:'', fecha_registro:'', pagado:false, observaciones:'' }); await cargar();
    }catch(err){ setErrorModal(err.message);} setGuardando(false);
  }
  async function togglePagado(id){
    await fetch(`/api/impuestos/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({accion:'toggle'})});
    await cargar();
  }

  const inputCls='w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Impuestos por camión</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Deudas básicas por camión — fecha de registro y si fue pagado</p>
        </div>
        <button onClick={()=>{setForm({ placa:'', flota_id:'', concepto:'', monto:'', fecha_registro: new Date().toISOString().slice(0,10), pagado:false, observaciones:'' }); setErrorModal(''); setModal(true);}} className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-xl text-sm">➕ Nuevo impuesto</button>
      </div>

      {resumen && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <div className="text-xs text-slate-400 uppercase font-semibold">Total deudas</div>
            <div className="text-xl font-bold">{resumen.total||0}</div>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900 p-4">
            <div className="text-xs text-amber-700 dark:text-amber-300 uppercase font-semibold">Pendientes</div>
            <div className="text-xl font-bold text-amber-700">{resumen.pendientes||0} · Bs. {Number(resumen.deuda||0).toLocaleString('es-BO')}</div>
          </div>
          <div className="bg-green-50 dark:bg-green-950/30 rounded-xl border border-green-200 dark:border-green-900 p-4">
            <div className="text-xs text-green-700 uppercase font-semibold">Pagados</div>
            <div className="text-xl font-bold text-green-700">{(resumen.total||0) - (resumen.pendientes||0)}</div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input value={q} onChange={e=>{setQ(e.target.value);setPage(1);}} placeholder="Filtrar por placa..." className={inputCls} />
          <select value={filtroPagado} onChange={e=>{setFiltroPagado(e.target.value);setPage(1);}} className={inputCls}>
            <option value="">Todos</option>
            <option value="false">Pendientes</option>
            <option value="true">Pagados</option>
          </select>
        </div>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-100 text-red-600 text-sm">{error}</div>}

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {cargando ? <SkeletonTable columns={6} rows={8}/> : impuestos.length===0 ? (
          <div className="p-12 text-center text-slate-400"><div className="text-4xl mb-2">🧾</div><p>Sin impuestos registrados</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b-2 border-slate-200 dark:border-slate-800 text-left whitespace-nowrap">
                  {['Placa','Concepto','Monto','Fecha registro','Pagado','Fecha pago','Obs','Acción'].map(h=>(
                    <th key={h} className="px-3 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {impuestos.map(r=>(
                  <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-3 py-2 font-mono font-bold text-slate-900 dark:text-slate-100">{r.placa}</td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{r.concepto||'—'}</td>
                    <td className="px-3 py-2 font-bold text-slate-900 dark:text-slate-100">{r.monto!=null? `Bs. ${Number(r.monto).toLocaleString('es-BO')}`:'—'}</td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{r.fecha_registro? new Date(r.fecha_registro).toLocaleDateString('es-BO'):'—'}</td>
                    <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${r.pagado?'bg-green-100 text-green-700':'bg-amber-100 text-amber-700'}`}>{r.pagado?'Pagado':'Pendiente'}</span></td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{r.fecha_pago? new Date(r.fecha_pago).toLocaleDateString('es-BO'):'—'}</td>
                    <td className="px-3 py-2 max-w-[160px] truncate text-slate-700 dark:text-slate-300">{r.observaciones||'—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <button onClick={()=>togglePagado(r.id)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border whitespace-nowrap ${r.pagado?'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200':'bg-green-600 text-white border-green-600 hover:bg-green-700'}`}>✓ {r.pagado?'Marcar pendiente':'Marcar pagado'}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e=>{if(e.target===e.currentTarget) setModal(false);}}>
          <form onSubmit={guardar} className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-4 sm:p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Nuevo impuesto</h3>
              <button type="button" onClick={()=>setModal(false)} className="text-slate-400 text-xl">✕</button>
            </div>
            {errorModal && <div className="mb-3 p-3 rounded-lg bg-red-100 text-red-600 text-sm">{errorModal}</div>}
            <div className="grid gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Camión * (solo placas registradas)</label>
                <select required value={form.flota_id} onChange={e=>{const v=e.target.value; const f=flota.find(x=>String(x.id)===v); setForm({...form, flota_id:v, placa: f?f.placa: ''});}} className={inputCls}>
                  <option value="">Elige camión — placa obligatoria</option>
                  {flota.map(f=><option key={f.id} value={f.id}>{f.placa} — {f.marca} {f.modelo}</option>)}
                </select>
                {flota.length===0 && <p className="text-[11px] text-amber-600 mt-1">Registra camiones en Flota primero.</p>}
              </div>
              <input placeholder="Concepto (ej: Impuesto municipal)" value={form.concepto} onChange={e=>setForm({...form, concepto:e.target.value})} className={inputCls} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="number" min={0} step="any" placeholder="Monto deuda" value={form.monto} onChange={e=>setForm({...form, monto:e.target.value})} className={inputCls} />
                <input type="date" value={form.fecha_registro} onChange={e=>setForm({...form, fecha_registro:e.target.value})} className={inputCls} />
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.pagado} onChange={e=>setForm({...form, pagado:e.target.checked})} /> Pagado</label>
              <input placeholder="Observaciones" value={form.observaciones} onChange={e=>setForm({...form, observaciones:e.target.value})} className={inputCls} />
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
