import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { obtenerSesion } from '@/lib/session';
import { esID } from '@/lib/utils';

const TIPOS_FIJOS = ['luz', 'agua', 'croquis'];

/**
 * Documentación del conductor:
 *  - luz / agua / croquis: registro único por tipo (marcar como tenida +
 *    adjunto opcional de imagen). Reenviar el tipo ACTUALIZA su registro.
 *  - adjunto: documentos libres (uno o varios).
 */
export async function POST(request, { params }) {
  const sesion = await obtenerSesion();
  if (!sesion || !['admin','secretaria'].includes(sesion.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;
  if (!esID(id)) return NextResponse.json({ error: 'Conductor no encontrado' }, { status: 404 });

  const body = await request.json();
  const tipo = String(body.tipo || '').trim();
  if (![...TIPOS_FIJOS, 'adjunto'].includes(tipo)) {
    return NextResponse.json({ error: 'Tipo de documento inválido' }, { status: 400 });
  }
  const archivo = String(body.archivo || '').trim() || null;
  const observacion = String(body.observacion || '').trim() || null;

  const existe = await query('SELECT id FROM choferes WHERE id = $1', [id]);
  if (existe.length === 0) return NextResponse.json({ error: 'Conductor no encontrado' }, { status: 404 });

  // Para luz/agua/croquis se conserva un solo registro por tipo
  if (TIPOS_FIJOS.includes(tipo)) {
    const rows = await query(
      `UPDATE conductor_documentos SET archivo=$3, observacion=$4
       WHERE chofer_id=$1 AND tipo=$2
       RETURNING *`,
      [id, tipo, archivo, observacion]
    );
    if (rows.length > 0) return NextResponse.json({ documento: rows[0] });
  }

  const insertados = await query(
    'INSERT INTO conductor_documentos (chofer_id, tipo, archivo, observacion) VALUES ($1,$2,$3,$4) RETURNING *',
    [id, tipo, archivo, observacion]
  );
  return NextResponse.json({ documento: insertados[0] }, { status: 201 });
}

export async function DELETE(request, { params }) {
  const sesion = await obtenerSesion();
  if (!sesion || !['admin','secretaria'].includes(sesion.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;
  if (!esID(id)) return NextResponse.json({ error: 'Conductor no encontrado' }, { status: 404 });

  const itemId = new URL(request.url).searchParams.get('itemId');
  if (!esID(itemId)) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });

  const rows = await query(
    'DELETE FROM conductor_documentos WHERE id = $1 AND chofer_id = $2 RETURNING id',
    [itemId, id]
  );
  if (rows.length === 0) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
