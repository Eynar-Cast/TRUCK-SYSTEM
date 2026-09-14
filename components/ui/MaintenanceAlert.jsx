'use client';
import { useEffect, useState } from 'react';

const CONTACTO = 'EYNAR-CASTAÑETA CELL 69880053';
const MENSAJE = '87% del uso de la base de datos free es necesario realizar una limpieza por favor contacte al desarrollador';

export default function MaintenanceAlert({ compact=false }){
  const [vencido, setVencido] = useState(false);
  const [dias, setDias] = useState(null);

  useEffect(()=>{
    let alive=true;
    async function cargar(){
      try{
        const res=await fetch('/api/dev/mantenimiento');
        const d=await res.json();
        if(!alive) return;
        setVencido(!!d.vencido);
        setDias(d.dias ?? null);
      }catch{}
    }
    cargar();
    const id=setInterval(cargar, 60000);
    return ()=>{ alive=false; clearInterval(id); };
  },[]);

  if(dias===null) return null;
  if(!vencido) return null;

  if(compact){
    return (
      <div className="rounded-lg border px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-900">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">🔧 Mantenimiento</span>
          <span className="text-xs font-bold text-amber-700">¡Requerido!</span>
        </div>
        <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">{MENSAJE}</p>
        <p className="text-[11px] font-bold text-amber-800 mt-1">{CONTACTO}</p>
      </div>
    );
  }

  return (
    <div className="bg-amber-500 text-white px-4 py-2.5 text-center text-sm">
      <span className="font-semibold">🔧 {MENSAJE}</span>
      <span className="ml-2 font-bold">{CONTACTO}</span>
    </div>
  );
}

export function MaintenanceWidget(){
  const [vencido,setVencido]=useState(false);
  const [dias,setDias]=useState(null);
  useEffect(()=>{
    let alive=true;
    async function cargar(){
      try{
        const res=await fetch('/api/dev/mantenimiento');
        const d=await res.json();
        if(!alive) return;
        setVencido(!!d.vencido);
        setDias(d.dias ?? null);
      }catch{}
    }
    cargar();
    const id=setInterval(cargar, 60000);
    return ()=>{ alive=false; clearInterval(id); };
  },[]);
  if(dias===null) return null;
  if(!vencido) return null;
  return (
    <div className="rounded-xl border p-3 bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-900">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">🔧 Mantenimiento cada mes</span>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white">¡Vencido!</span>
      </div>
      <p className="text-xs font-bold text-amber-700 dark:text-amber-300">{MENSAJE}</p>
      <p className="text-xs font-bold text-slate-800 dark:text-slate-100 mt-1">{CONTACTO}</p>
      <div className="flex gap-2 mt-2">
        <a href="tel:69880053" className="flex-1 text-center bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1.5 rounded-lg">📞 Llamar 69880053</a>
      </div>
    </div>
  );
}
