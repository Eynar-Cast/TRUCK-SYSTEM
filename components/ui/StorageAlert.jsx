'use client';
import { useEffect, useState } from 'react';

export default function StorageAlert() {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch('/api/admin/storage').then(r=>r.json()).then(d=>{ if(d.pct>=75) setData(d); }).catch(()=>{});
  }, []);
  if (!data) return null;
  const critico = data.pct >= 85;
  return (
    <div className={`${critico ? 'bg-red-600 text-white animate-pulse' : 'bg-amber-500 text-white'} px-4 py-2.5 text-center text-sm font-semibold`}>
      {critico ? '🚨' : '⚠️'} Almacenamiento {data.pct}% lleno ({data.usedPretty} / {data.totalPretty}) — Contactar al desarrollador para hacer mantenimiento del sistema
    </div>
  );
}
