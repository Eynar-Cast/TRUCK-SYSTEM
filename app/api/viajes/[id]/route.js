import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { obtenerSesion } from '@/lib/session';
import { esID } from '@/lib/utils';

export async function PUT(request, { params }) {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { id } = await params;
  if (!esID(id)) return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });
  const body = await request.json();
  const estados = ['Programado','En ruta','Entregado','Cancelado'];
  const estado = String(body.estado||'').trim();
  if (!estados.includes(estado)) return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
  const actual = await query('SELECT estado FROM viajes WHERE id=$1', [id]);
  if (actual.length===0) return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });
  if (actual[0].estado === 'Entregado' || actual[0].estado === 'Cancelado') {
    return NextResponse.json({ error: 'Este viaje ya está finalizado y no se puede editar su estado' }, { status: 400 });
  }
  // Si pasa a Entregado y no hay fecha_llegada, poner hoy
  let fecha_llegada = null;
  if (estado === 'Entregado') {
    const r = await query('SELECT fecha_llegada FROM viajes WHERE id=$1', [id]);
    fecha_llegada = r[0].fecha_llegada || new Date().toISOString().slice(0,10);
  } else if (estado === 'En ruta' || estado === 'Programado') {
    // limpiar fecha_llegada si vuelve a ruta
    fecha_llegada = null;
  }
  const rows = await query('UPDATE viajes SET estado=$1, fecha_llegada=COALESCE($2, fecha_llegada) WHERE id=$3 RETURNING *', [estado, fecha_llegada, id]);
  if (rows.length===0) return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });
  return NextResponse.json({ viaje: rows[0] });
}

export async function DELETE(request, { params }) {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { id } = await params;
  if (!esID(id)) return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });
  const rows = await query('DELETE FROM viajes WHERE id=$1 RETURNING id', [id]);
  if (rows.length===0) return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
