import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { obtenerSesion } from '@/lib/session';
import { textoO } from '@/lib/reportes';

const TIPOS = ['tipo_vehiculo', 'marca', 'modelo'];

export async function GET(request) {
  const sesion = await obtenerSesion();
  if (!sesion) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const tipo = textoO(searchParams.get('tipo'));

  const rows = tipo && TIPOS.includes(tipo)
    ? await query('SELECT * FROM catalogos WHERE tipo = $1 ORDER BY valor ASC', [tipo])
    : await query('SELECT * FROM catalogos ORDER BY tipo ASC, valor ASC');

  return NextResponse.json({ catalogos: rows });
}

export async function POST(request) {
  const sesion = await obtenerSesion();
  if (!sesion || !['admin','secretaria'].includes(sesion.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { tipo, valor } = await request.json();
  if (!TIPOS.includes(tipo)) {
    return NextResponse.json({ error: 'Tipo de catálogo inválido' }, { status: 400 });
  }
  const v = String(valor || '').trim();
  if (!v) return NextResponse.json({ error: 'El valor es obligatorio' }, { status: 400 });

  // Si existía desactivado, se reactiva (evita duplicados por el UNIQUE)
  const rows = await query(
    `INSERT INTO catalogos (tipo, valor) VALUES ($1, $2)
     ON CONFLICT (tipo, valor) DO UPDATE SET activo = TRUE
     RETURNING *`,
    [tipo, v]
  );
  return NextResponse.json({ catalogo: rows[0] }, { status: 201 });
}
