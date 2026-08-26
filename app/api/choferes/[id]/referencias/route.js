import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { obtenerSesion } from '@/lib/session';
import { esID } from '@/lib/utils';

/** Referencias familiares del conductor (nombre, parentesco, contacto). */
export async function POST(request, { params }) {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;
  if (!esID(id)) return NextResponse.json({ error: 'Conductor no encontrado' }, { status: 404 });

  const body = await request.json();
  const texto = v => {
    const t = String(v ?? '').trim();
    return t === '' ? null : t;
  };
  const nombre = texto(body.nombre);
  if (!nombre) return NextResponse.json({ error: 'El nombre del familiar es obligatorio' }, { status: 400 });
  const telefono = texto(body.telefono);
  if (telefono && !/^[+\d][\d\s\-()]{5,20}$/.test(telefono)) {
    return NextResponse.json({ error: 'El número de contacto no tiene un formato válido' }, { status: 400 });
  }

  const existe = await query('SELECT id FROM choferes WHERE id = $1', [id]);
  if (existe.length === 0) return NextResponse.json({ error: 'Conductor no encontrado' }, { status: 404 });

  const rows = await query(
    'INSERT INTO conductor_referencias (chofer_id, nombre, parentesco, telefono) VALUES ($1,$2,$3,$4) RETURNING *',
    [id, nombre, texto(body.parentesco), telefono]
  );
  return NextResponse.json({ referencia: rows[0] }, { status: 201 });
}

export async function DELETE(request, { params }) {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;
  if (!esID(id)) return NextResponse.json({ error: 'Conductor no encontrado' }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const refId = searchParams.get('refId');
  if (!esID(refId)) return NextResponse.json({ error: 'Referencia no encontrada' }, { status: 404 });

  const rows = await query(
    'DELETE FROM conductor_referencias WHERE id = $1 AND chofer_id = $2 RETURNING id',
    [refId, id]
  );
  if (rows.length === 0) return NextResponse.json({ error: 'Referencia no encontrada' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
