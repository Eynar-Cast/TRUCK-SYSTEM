'use client';
import { useEffect, useState } from 'react';

const INTERVALO_DIAS = 30;
const STORAGE_KEY = 'mtto_ultimo';
const CONTACTO = 'EYNAR-CASTAÑETA CELL 69880053';

export default function MaintenanceAlert({ compact=false }){
  const [diasRestantes, setDiasRestantes] = useState(null);
  const [vencido, setVencido] = useState(false);

  useEffect(()=>{
    const raw = localStorage.getItem(STORAGE_KEY);
    const ultimo = raw ? new Date(raw) : null;
    const ahora = new Date();
    let diff = INTERVALO_DIAS;
    if(ultimo && !isNaN(ultimo)){
      diff = INTERVALO_DIAS - Math.floor((ahora - ultimo)/86400000);
    } else {
      // sin registro, mostrar como vencido para incentivar primer mantenimiento
      diff = 0;
    }
    setDiasRestantes(diff);
    setVencido(diff <= 0);
    // si no hay registro, guarda hoy como referencia inicial (no reinicia cada carga)
    if(!raw){
      localStorage.setItem(STORAGE_KEY, ahora.toISOString());
    }
  },[]);

  function marcarRealizado(){
    const ahora = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, ahora);
    setDiasRestantes(INTERVALO_DIAS);
    setVencido(false);
  }

  if(diasRestantes===null) return null;
  // Banner superior solo visible cuando vencido; al marcar realizado desaparece automático
  if(!compact && !vencido) return null;

  if(compact){
    return (
      <div className={`rounded-lg border px-3 py-2 ${vencido ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-900' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">🔧 Mantenimiento</span>
          <span className={`text-xs font-bold ${vencido ? 'text-amber-700' : 'text-green-600'}`}>{vencido ? '¡Requerido!' : `${diasRestantes}d restantes`}</span>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Limpieza BD, backups, dependencias, migraciones</p>
        {vencido && <p className="text-[11px] font-bold text-amber-700 mt-1">Contactar: {CONTACTO}</p>}
      </div>
    );
  }

  return (
    <div className={`${vencido ? 'bg-amber-500 text-white' : 'bg-blue-600 text-white'} px-4 py-2.5 text-center text-sm`}>
      <span className="font-semibold">🔧 Mantenimiento {vencido ? 'requerido' : `en ${diasRestantes} días`}</span>
      <span className="hidden sm:inline"> — Limpieza BD, backups, dependencias, migraciones</span>
      <span className="ml-2 font-bold">Contactar: {CONTACTO}</span>
      {vencido && <button onClick={marcarRealizado} className="ml-3 bg-white text-amber-700 px-2 py-0.5 rounded text-xs font-bold">Marcar realizado</button>}
    </div>
  );
}

export function MaintenanceWidget(){
  const [dias, setDias]=useState(null);
  const [vencido,setVencido]=useState(false);
  useEffect(()=>{
    const raw=localStorage.getItem(STORAGE_KEY);
    const ultimo= raw ? new Date(raw) : null;
    const ahora=new Date();
    let diff=INTERVALO_DIAS;
    if(ultimo && !isNaN(ultimo)) diff=INTERVALO_DIAS - Math.floor((ahora-ultimo)/86400000);
    else diff=0;
    setDias(diff); setVencido(diff<=0);
  },[]);
  function marcar(){
    const ahora=new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, ahora);
    setDias(INTERVALO_DIAS); setVencido(false);
  }
  if(dias===null) return null;
  if(!vencido) return null;
  return (
    <div className="rounded-xl border p-3 bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-900">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">🔧 Mantenimiento cada 30 días</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${vencido ? 'bg-amber-500 text-white' : 'bg-green-100 text-green-700'}`}>{vencido ? '¡Vencido!' : `${dias} días restantes`}</span>
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-300">Incluye: limpieza BD, backups, limpieza dependencias, migraciones, Vercel/Neon.</p>
      <p className="text-xs font-bold text-slate-800 dark:text-slate-100 mt-1">Contactar desarrollador: {CONTACTO}</p>
      <div className="flex gap-2 mt-2">
        <a href="tel:69880053" className="flex-1 text-center bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1.5 rounded-lg">📞 Llamar 69880053</a>
        <button onClick={marcar} className="flex-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold py-1.5 rounded-lg">✓ Marcar realizado</button>
      </div>
      <p className="text-[10px] text-slate-400 mt-2 text-center">Próximo: cada 30 días • Costo mantenimiento Bs. 500/mes</p>
    </div>
  );
}
