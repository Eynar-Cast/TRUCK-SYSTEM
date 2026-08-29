import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { obtenerSesion } from '@/lib/session';

// Límite real Neon Free (Hobby → Free: 512 MB = 0.5 GB). Antes Vercel Postgres era 256 MB.
// Tu proyecto está en Hobby (ver VERCEL_OIDC_TOKEN: plan:hobby), tras migración Neon Free = 0.5 GB.
// Se puede sobreescribir con STORAGE_LIMIT_GB en .env si tu plan es distinto.
const TOTAL_BYTES = Math.round(parseFloat(process.env.STORAGE_LIMIT_GB || '0.5') * 1024 * 1024 * 1024);

export async function GET() {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  try {
    const r = await query("SELECT pg_database_size(current_database())::bigint AS bytes");
    const used = Number(r[0]?.bytes || 0);
    const total = TOTAL_BYTES;
    const pct = total > 0 ? Math.round((used / total) * 1000) / 10 : 0; // 1 decimal
    const pretty = (b) => {
      if (b >= 1024*1024*1024) return (b/1024/1024/1024).toFixed(2)+' GB';
      if (b >= 1024*1024) return (b/1024/1024).toFixed(1)+' MB';
      if (b >= 1024) return (b/1024).toFixed(0)+' kB';
      return b+' B';
    };
    return NextResponse.json({
      used, total, pct,
      usedPretty: pretty(used),
      totalPretty: pretty(total),
      // umbrales: warning 75%, critical 85%
      nivel: pct >= 85 ? 'critico' : pct >= 75 ? 'advertencia' : 'ok',
    });
  } catch (e) {
    console.error('storage', e);
    return NextResponse.json({ error: 'No se pudo obtener almacenamiento' }, { status: 500 });
  }
}
