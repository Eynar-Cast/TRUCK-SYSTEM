import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { obtenerSesion } from '@/lib/session';
import { esID } from '@/lib/utils';

export async function DELETE(request, { params }) {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { id } = await params;
  if (!esID(id)) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
  const rows = await query('DELETE FROM impuestos WHERE id=$1 RETURNING id', [id]);
  if (rows.length===0) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function PUT(request, { params }) {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { id } = await params;
  if (!esID(id)) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
  const body = await request.json();
  // Toggle pagado
  if (body.accion === 'toggle') {
    const rows = await query('UPDATE impuestos SET pagado = NOT pagado, fecha_pago = CASE WHEN pagado THEN NULL ELSE CURRENT_DATE END WHERE id=$1 RETURNING *', [id]);
    if (rows.length===0) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
    return NextResponse.json({ impuesto: rows[0] });
  }
  return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
}
