import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { obtenerSesion } from '@/lib/session';
import { hashPassword } from '@/lib/auth';
import { esID } from '@/lib/utils';

export async function PUT(request, { params }) {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;
  if (!esID(id)) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }
  const body = await request.json();

  if (body.accion === 'toggle') {
    const rows = await query(
      `UPDATE usuarios SET activo = NOT activo WHERE id = $1 RETURNING id, activo`,
      [id]
    );
    if (rows.length === 0) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    return NextResponse.json({ usuario: rows[0] });
  }

  if (body.accion === 'password') {
    if (!body.password || body.password.length < 6) {
      return NextResponse.json({ error: 'Mínimo 6 caracteres' }, { status: 400 });
    }
    const hash = await hashPassword(body.password);
    await query('UPDATE usuarios SET password_hash = $1 WHERE id = $2', [hash, id]);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
}