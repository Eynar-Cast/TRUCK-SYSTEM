'use client';
import { useState, useEffect, useCallback } from 'react';

const PERIODOS = [
  {v:'dia', l:'Diario'},
  {v:'semana', l:'Semanal'},
  {v:'mes', l:'Mensual'},
  {v:'anual', l:'Anual (póliza)'},
  {v:'todo', l:'Histórico total'},
];

export default function GastosPlacaPage(){
  const [placas, setPlacas]=useState([]);
  const [placa, setPlaca]=useState('');
  const [periodo, setPeriodo]=useState('mes');
  const [data, setData]=useState(null);
  const [cargando, setCargando]=useState(false);
  const [error, setError]=useState('');

  useEffect(()=>{ fetch('/api/flota?limit=100').then(r=>r.json()).then(d=>{setPlacas(d.vehiculos||[]); if(d.vehiculos?.[0]) setPlaca(d.vehiculos[0].placa)}).catch(()=>{}); },[]);
  const cargar=useCallback(async()=>{
    if(!placa) return;
    setCargando(true); setError('');
    try{
      const res=await fetch(`/api/gastos-placa?placa=${placa}&periodo=${periodo}`);
      const d=await res.json();
      if(!res.ok) throw new Error(d.error||'Error');
      setData(d);
    }catch(e){ setError(e.message); setData(null);}
    setCargando(false);
  },[placa,periodo]);
  useEffect(()=>{cargar();},[cargar]);

  const fmt = n=>`Bs. ${Number(n||0).toLocaleString('es-BO',{minimumFractionDigits:2})}`;

  return (
    <div>
      <h1 className="text-2xl font-bold dark:text-slate-100">Gastos por Placa</h1>
      <p className="text-sm text-slate-500 mb-4">Busca todos los gastos de una placa: chofer, repuestos, llantas, aceites, impuestos. Póliza es anual.</p>
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium mb-1 dark:text-slate-300">Placa</label>
          <select value={placa} onChange={e=>setPlaca(e.target.value)} className="px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg font-mono text-sm min-w-[180px]">
            <option value="">— Selecciona placa —</option>
            {placas.map(p=><option key={p.id} value={p.placa}>{p.placa} — {p.marca} {p.modelo}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1 dark:text-slate-300">Periodo</label>
          <select value={periodo} onChange={e=>setPeriodo(e.target.value)} className="px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg text-sm">
            {PERIODOS.map(p=> <option key={p.v} value={p.v}>{p.l}</option>)}
          </select>
        </div>
        <button onClick={cargar} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Buscar</button>
      </div>

      {error && <div className="mb-4 p-3 rounded bg-red-100 text-red-600 text-sm">{error}</div>}
      {cargando && <div className="p-8 text-center text-slate-400">Cargando...</div>}
      {data && !cargando && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Stat t="Viajes" v={data.resumen.viajes} />
            <Stat t="Gastos chofer" v={`${data.resumen.gastos_chofer.n} · ${fmt(data.resumen.gastos_chofer.total)}`} />
            <Stat t="Repuestos" v={`${data.resumen.repuestos.n} · ${fmt(data.resumen.repuestos.total)}`} />
            <Stat t="Llantas" v={`${data.resumen.llantas.n} · ${fmt(data.resumen.llantas.total)}`} />
            <Stat t="Aceites" v={`${data.resumen.aceites.n} · ${fmt(data.resumen.aceites.total)}`} />
            <Stat t="Impuestos" v={`${data.resumen.impuestos.n} · ${fmt(data.resumen.impuestos.total)}`} />
            <Stat t="Póliza (anual)" v={fmt(data.resumen.seguros.total)} small="No filtra diario/semanal/mensual" />
            <Stat t="TOTAL GENERAL" v={fmt(data.resumen.total_general)} highlight />
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 mb-4">
            <h3 className="font-semibold text-sm mb-2 dark:text-slate-100">Historial — {data.placa} {data.flota? `· ${data.flota.marca} ${data.flota.modelo}`:''}</h3>
            <p className="text-xs text-slate-400 mb-3">Viajes: {data.resumen.viajes} · Cambios llanta: {data.resumen.llantas.n} · Aceites: {data.resumen.aceites.n}</p>
            <div className="grid md:grid-cols-3 gap-4 text-xs">
              <div>
                <h4 className="font-semibold mb-1 dark:text-slate-200">Viajes recientes</h4>
                {data.historial.viajes.length===0? <span className="text-slate-400">Sin viajes</span> : <ul className="space-y-1">{data.historial.viajes.map(v=><li key={v.id} className="bg-slate-50 dark:bg-slate-800 dark:text-slate-200 rounded px-2 py-1">{v.fecha_carga?.slice(0,10)} · {v.tramo||'—'} · {v.producto||''}</li>)}</ul>}
              </div>
              <div>
                <h4 className="font-semibold mb-1 dark:text-slate-200">Cambios llanta</h4>
                {data.historial.llantas.length===0? <span className="text-slate-400">Sin cambios</span> : <ul className="space-y-1">{data.historial.llantas.map(l=><li key={l.id} className="bg-slate-50 dark:bg-slate-800 dark:text-slate-200 rounded px-2 py-1">{l.fecha_cambio?.slice(0,10)} · {l.llantas_tracto||0}+{l.llantas_chata||0} · {fmt(l.costo)}</li>)}</ul>}
              </div>
              <div>
                <h4 className="font-semibold mb-1 dark:text-slate-200">Cambios aceite</h4>
                {data.historial.aceites.length===0? <span className="text-slate-400">Sin cambios</span> : <ul className="space-y-1">{data.historial.aceites.map(a=><li key={a.id} className="bg-slate-50 dark:bg-slate-800 dark:text-slate-200 rounded px-2 py-1">{a.fecha_ultimo_cambio?.slice(0,10)} · {a.tipo} · {fmt(a.costo)}</li>)}</ul>}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
function Stat({t,v,small,highlight}){
  return <div className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 ${highlight?'border-blue-400 bg-blue-50 dark:bg-blue-950/30':''}`}><div className="text-[11px] uppercase text-slate-400 font-semibold">{t}</div><div className={`text-sm font-bold dark:text-slate-100 ${highlight?'text-blue-700 dark:text-blue-300':''}`}>{v}</div>{small && <div className="text-[10px] text-slate-400">{small}</div>}</div>;
}
