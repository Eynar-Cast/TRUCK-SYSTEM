import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { obtenerSesion } from '@/lib/session';
import { esID } from '@/lib/utils';

export async function PUT(request, { params }) {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;
  if (!esID(id)) {
    return NextResponse.json({ error: 'Chofer no encontrado' }, { status: 404 });
  }
  const body = await request.json();

  if (body.accion === 'toggle') {
    const rows = await query(
      `UPDATE choferes SET activo = NOT activo WHERE id = $1 RETURNING id, activo`,
      [id]
    );
    if (rows.length === 0) return NextResponse.json({ error: 'Chofer no encontrado' }, { status: 404 });
    return NextResponse.json({ chofer: rows[0] });
  }

  const { nombre, placa, telefono, direccion } = body;
  if (!nombre?.trim() || !placa?.trim()) {
    return NextResponse.json({ error: 'Nombre y placa son obligatorios' }, { status: 400 });
  }

  const rows = await query(
    `UPDATE choferes SET nombre=$1, placa=$2, telefono=$3, direccion=$4 WHERE id=$5 RETURNING *`,
    [nombre, placa, telefono || null, direccion || null, id]
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Chofer no encontrado' }, { status: 404 });
  }
  return NextResponse.json({ chofer: rows[0] });
}