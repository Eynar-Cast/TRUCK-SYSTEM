import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { obtenerSesion } from '@/lib/session';

export async function GET() {
  const sesion = await obtenerSesion();
  if (!sesion) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  // Cualquier usuario autenticado puede ver la lista (la necesita el formulario de gasto de chofer)
  const choferes = await query('SELECT * FROM choferes ORDER BY nombre ASC');
  return NextResponse.json({ choferes });
}

export async function POST(request) {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { nombre, placa, telefono, direccion } = await request.json();
  if (!nombre?.trim() || !placa?.trim()) {
    return NextResponse.json({ error: 'Nombre y placa son obligatorios' }, { status: 400 });
  }

  const rows = await query(
    `INSERT INTO choferes (nombre, placa, telefono, direccion) VALUES ($1,$2,$3,$4) RETURNING *`,
    [nombre, placa, telefono || null, direccion || null]
  );
  return NextResponse.json({ chofer: rows[0] }, { status: 201 });
}