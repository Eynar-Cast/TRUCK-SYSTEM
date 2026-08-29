'use client';
import { useEffect, useState } from 'react';

export default function StorageWidget() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    let alive = true;
    async function cargar() {
      try {
        const res = await fetch('/api/admin/storage');
        if (!res.ok) throw new Error();
        const d = await res.json();
        if (alive) setData(d);
      } catch { if (alive) setError('No se pudo cargar'); }
    }
    cargar();
    const id = setInterval(cargar, 60000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  if (error || !data) return null;

  const pct = data.pct;
  const critico = pct >= 85;
  const advertencia = pct >= 75 && pct < 85;

  // Siempre mostrar alerta crítica aunque esté plegado
  if (critico && !abierto) {
    return (
      <div className="flex items-center gap-2">
        <button onClick={() => setAbierto(true)} className="flex-1 flex items-center gap-2 rounded-full bg-red-600 text-white px-3 py-1.5 text-xs font-bold shadow hover:bg-red-700 transition">
          <span>🚨 {pct}% lleno</span>
          <span className="hidden sm:inline font-normal">— Contactar desarrollador</span>
          <span className="ml-auto text-[10px] bg-white/20 rounded-full px-1.5 py-0.5">▼</span>
        </button>
        <button onClick={() => setAbierto(true)} className="text-xs text-slate-400 hover:text-slate-600">Ver</button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Cabecera plegable */}
      <button onClick={() => setAbierto(!abierto)} className="w-full flex items-center justify-between rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
        <span className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <span className={`w-2 h-2 rounded-full ${critico ? 'bg-red-600 animate-pulse' : advertencia ? 'bg-amber-500' : 'bg-blue-600'}`} />
          Almacenamiento {pct}%
          <span className="text-[11px] font-normal text-slate-400 hidden sm:inline">· {data.usedPretty} / {data.totalPretty}</span>
        </span>
        <span className="flex items-center gap-1 text-xs text-slate-400">
          {abierto ? '▲ Plegar' : '▼ Desplegar'}
        </span>
      </button>

      {abierto && (
        <div className="space-y-2 animate-slide-up">
          {/* Alerta prioridad alta */}
          {critico && (
            <div className="rounded-xl border-2 border-red-600 bg-red-50 dark:bg-red-950/40 px-3 py-3 flex items-start gap-2.5">
              <span className="text-lg leading-none">🚨</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-extrabold text-red-700 dark:text-red-300 uppercase tracking-wide">Almacenamiento por llenarse — Prioridad Alta</p>
                <p className="text-xs text-red-600 dark:text-red-300 mt-0.5">Uso {data.pct}% ({data.usedPretty} / {data.totalPretty}). Contactar al desarrollador para hacer mantenimiento del sistema.</p>
              </div>
            </div>
          )}
          {advertencia && !critico && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 flex items-start gap-2">
              <span className="text-sm">⚠️</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300">Almacenamiento en {data.pct}%</p>
                <p className="text-xs text-amber-700 dark:text-amber-300">Queda poco espacio. Contactar al desarrollador pronto.</p>
              </div>
            </div>
          )}

          {/* Detalle desplegable */}
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Uso detallado</span>
              <span className={`text-xs font-bold ${critico ? 'text-red-600' : advertencia ? 'text-amber-600' : 'text-slate-600 dark:text-slate-400'}`}>{data.pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div className={`h-full transition-all ${critico ? 'bg-red-600' : advertencia ? 'bg-amber-500' : 'bg-blue-600'}`} style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[11px] text-slate-400">{data.usedPretty} usado</span>
              <span className="text-[11px] text-slate-400">{data.totalPretty} total</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Base de datos Neon · Vercel · 512 MB</p>
          </div>
        </div>
      )}
    </div>
  );
}
