import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { obtenerSesion } from '@/lib/session';
import { esID } from '@/lib/utils';

export async function PUT(request, { params }) {
  const sesion = await obtenerSesion();
  if (!sesion || !['admin','secretaria'].includes(sesion.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;
  if (!esID(id)) return NextResponse.json({ error: 'Catálogo no encontrado' }, { status: 404 });
  const body = await request.json();

  if (body.accion === 'toggle') {
    const rows = await query(
      'UPDATE catalogos SET activo = NOT activo WHERE id = $1 RETURNING id, activo',
      [id]
    );
    if (rows.length === 0) return NextResponse.json({ error: 'Catálogo no encontrado' }, { status: 404 });
    return NextResponse.json({ catalogo: rows[0] });
  }

  const v = String(body.valor || '').trim();
  if (!v) return NextResponse.json({ error: 'El valor es obligatorio' }, { status: 400 });

  try {
    const rows = await query(
      'UPDATE catalogos SET valor = $1 WHERE id = $2 RETURNING *',
      [v, id]
    );
    if (rows.length === 0) return NextResponse.json({ error: 'Catálogo no encontrado' }, { status: 404 });
    return NextResponse.json({ catalogo: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return NextResponse.json({ error: 'Ya existe ese valor en este catálogo' }, { status: 409 });
    }
    throw err;
  }
}
