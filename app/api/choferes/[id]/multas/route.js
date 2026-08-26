import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { obtenerSesion } from '@/lib/session';
import { esID } from '@/lib/utils';

/** Multas del conductor: fecha, motivo, monto (si corresponde) y observaciones. */
function validarMulta(body = {}) {
  const texto = v => {
    const t = String(v ?? '').trim();
    return t === '' ? null : t;
  };
  const t = String(body.fecha ?? '').trim();
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(t) && !isNaN(new Date(`${t}T00:00:00`).getTime()) ? t : null;
  if (!fecha) return { error: 'La fecha de la multa es obligatoria' };

  const motivo = texto(body.motivo);
  if (!motivo) return { error: 'El motivo de la multa es obligatorio' };

  let monto = body.monto === '' || body.monto === null || body.monto === undefined ? null : Number(body.monto);
  if (monto !== null && (!isFinite(monto) || monto < 0)) {
    return { error: 'El monto debe ser un número mayor o igual a 0' };
  }

  return { datos: { fecha, motivo, monto, observaciones: texto(body.observaciones) } };
}

export async function POST(request, { params }) {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;
  if (!esID(id)) return NextResponse.json({ error: 'Conductor no encontrado' }, { status: 404 });

  const validacion = validarMulta(await request.json());
  if (validacion.error) return NextResponse.json({ error: validacion.error }, { status: 400 });
  const d = validacion.datos;

  const existe = await query('SELECT id FROM choferes WHERE id = $1', [id]);
  if (existe.length === 0) return NextResponse.json({ error: 'Conductor no encontrado' }, { status: 404 });

  const rows = await query(
    'INSERT INTO multas (chofer_id, fecha, motivo, monto, observaciones) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [id, d.fecha, d.motivo, d.monto, d.observaciones]
  );
  return NextResponse.json({ multa: rows[0] }, { status: 201 });
}

export async function DELETE(request, { params }) {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;
  if (!esID(id)) return NextResponse.json({ error: 'Conductor no encontrado' }, { status: 404 });

  const itemId = new URL(request.url).searchParams.get('itemId');
  if (!esID(itemId)) return NextResponse.json({ error: 'Multa no encontrada' }, { status: 404 });

  const rows = await query('DELETE FROM multas WHERE id = $1 AND chofer_id = $2 RETURNING id', [itemId, id]);
  if (rows.length === 0) return NextResponse.json({ error: 'Multa no encontrada' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
