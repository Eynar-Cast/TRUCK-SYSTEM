import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { obtenerSesion } from '@/lib/session';
import { REPORTES, rangoMes } from '@/lib/reportes-mensuales';

/** Datos JSON de un reporte mensual: ?tipo=llantas&mes=2026-08 */
export async function GET(request) {
  const sesion = await obtenerSesion();
  if (!sesion || !['admin','secretaria'].includes(sesion.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get('tipo');
  const mes = searchParams.get('mes');

  const def = REPORTES[tipo];
  if (!def) return NextResponse.json({ error: 'Tipo de reporte inválido' }, { status: 400 });

  const rango = rangoMes(mes);
  if (!rango) return NextResponse.json({ error: 'Mes inválido (formato AAAA-MM)' }, { status: 400 });

  const filas = await query(def.sql, [rango.inicio, rango.fin]);

  return NextResponse.json({
    tipo,
    titulo: `${def.titulo} — ${mes}`,
    mes,
    columnas: def.columnas.map(([label]) => label),
    filas: filas.map(r => def.fila(r)),
  });
}
