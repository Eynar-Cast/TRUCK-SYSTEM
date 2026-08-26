import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { obtenerSesion } from '@/lib/session';
import { esID } from '@/lib/utils';
import { estadoSeguroSql } from '@/lib/reportes';

/**
 * Seguro individual del conductor (historial: cada registro es una póliza
 * con fecha de inicio y expiración). El estado se deriva automáticamente:
 * sin fecha → '', vencida → 'Vencido', caso contrario → 'Vigente'.
 */
function validarFechas(body) {
  const limpiar = v => {
    const t = String(v ?? '').trim();
    if (!t) return null;
    return /^\d{4}-\d{2}-\d{2}$/.test(t) && !isNaN(new Date(`${t}T00:00:00`).getTime()) ? t : undefined;
  };
  const inicio = limpiar(body.fecha_inicio);
  if (inicio === undefined) return { error: 'Fecha de inicio inválida' };
  const expiracion = limpiar(body.fecha_expiracion);
  if (expiracion === undefined) return { error: 'Fecha de expiración inválida' };
  if (inicio && expiracion && inicio > expiracion) {
    return { error: 'La fecha de inicio no puede ser posterior a la de expiración' };
  }
  return { inicio, expiracion };
}

export async function POST(request, { params }) {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;
  if (!esID(id)) return NextResponse.json({ error: 'Conductor no encontrado' }, { status: 404 });

  const fechas = validarFechas(await request.json());
  if (fechas.error) return NextResponse.json({ error: fechas.error }, { status: 400 });
  if (!fechas.inicio && !fechas.expiracion) {
    return NextResponse.json({ error: 'Registre al menos una fecha' }, { status: 400 });
  }

  const existe = await query('SELECT id FROM choferes WHERE id = $1', [id]);
  if (existe.length === 0) return NextResponse.json({ error: 'Conductor no encontrado' }, { status: 404 });

  const rows = await query(
    'INSERT INTO conductor_seguros (chofer_id, fecha_inicio, fecha_expiracion) VALUES ($1,$2,$3) RETURNING *',
    [id, fechas.inicio, fechas.expiracion]
  );
  const conEstado = await query(
    `SELECT *, ${estadoSeguroSql('fecha_expiracion')} AS estado FROM conductor_seguros WHERE id = $1`,
    [rows[0].id]
  );
  return NextResponse.json({ seguro: conEstado[0] }, { status: 201 });
}

export async function DELETE(request, { params }) {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;
  if (!esID(id)) return NextResponse.json({ error: 'Conductor no encontrado' }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const segId = searchParams.get('segId');
  if (!esID(segId)) return NextResponse.json({ error: 'Seguro no encontrado' }, { status: 404 });

  const rows = await query(
    'DELETE FROM conductor_seguros WHERE id = $1 AND chofer_id = $2 RETURNING id',
    [segId, id]
  );
  if (rows.length === 0) return NextResponse.json({ error: 'Seguro no encontrado' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
