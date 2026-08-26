import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { obtenerSesion } from '@/lib/session';
import { esID } from '@/lib/utils';
import { estadoSeguroSql } from '@/lib/reportes';

/** Detalle del conductor: datos personales + referencias + seguro individual (con estado derivado). */
export async function GET(request, { params }) {
  const sesion = await obtenerSesion();
  if (!sesion) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  if (!esID(id)) return NextResponse.json({ error: 'Conductor no encontrado' }, { status: 404 });

  const choferes = await query('SELECT * FROM choferes WHERE id = $1', [id]);
  if (choferes.length === 0) return NextResponse.json({ error: 'Conductor no encontrado' }, { status: 404 });

  const referencias = await query(
    'SELECT * FROM conductor_referencias WHERE chofer_id = $1 ORDER BY creado ASC, id ASC',
    [id]
  );
  const segurosIndividuales = await query(
    `SELECT cs.*, ${estadoSeguroSql('cs.fecha_expiracion')} AS estado
     FROM conductor_seguros cs WHERE cs.chofer_id = $1
     ORDER BY cs.creado DESC, cs.id DESC`,
    [id]
  );

  // Multas del conductor (historial)
  const multas = await query(
    `SELECT m.*, COALESCE(m.monto, 0)::float8 AS monto_num
     FROM multas m WHERE m.chofer_id = $1
     ORDER BY m.fecha DESC, m.id DESC`,
    [id]
  );

  // Documentación: fotocopia de luz, agua, croquis y adjuntos
  const documentos = await query(
    'SELECT * FROM conductor_documentos WHERE chofer_id = $1 ORDER BY creado ASC, id ASC',
    [id]
  );

  return NextResponse.json({ chofer: choferes[0], referencias, seguros_individuales: segurosIndividuales, multas, documentos });
}

export async function PUT(request, { params }) {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;
  if (!esID(id)) return NextResponse.json({ error: 'Conductor no encontrado' }, { status: 404 });
  const body = await request.json();

  if (body.accion === 'toggle') {
    const rows = await query(
      'UPDATE choferes SET activo = NOT activo WHERE id = $1 RETURNING id, activo',
      [id]
    );
    if (rows.length === 0) return NextResponse.json({ error: 'Conductor no encontrado' }, { status: 404 });
    return NextResponse.json({ chofer: rows[0] });
  }

  const texto = v => {
    const t = String(v ?? '').trim();
    return t === '' ? null : t;
  };
  const nombre = texto(body.nombre);
  const placa = texto(body.placa);
  if (!nombre || !placa) {
    return NextResponse.json({ error: 'Nombre y placa son obligatorios' }, { status: 400 });
  }

  const documento = texto(body.documento);
  if (documento && !/^[A-Za-z0-9.\-]{4,20}$/.test(documento)) {
    return NextResponse.json({ error: 'El documento debe tener entre 4 y 20 caracteres' }, { status: 400 });
  }
  const licencia = texto(body.licencia);
  if (licencia && !/^[A-Za-z0-9\-]{4,20}$/.test(licencia)) {
    return NextResponse.json({ error: 'El número de licencia debe tener entre 4 y 20 caracteres' }, { status: 400 });
  }
  const telefono = texto(body.telefono);

  let calificacion = body.calificacion === '' || body.calificacion === null || body.calificacion === undefined
    ? null
    : Number(body.calificacion);
  if (calificacion !== null && (!Number.isInteger(calificacion) || calificacion < 1 || calificacion > 5)) {
    return NextResponse.json({ error: 'La calificación debe ser entre 1 y 5 estrellas' }, { status: 400 });
  }

  const rows = await query(
    `UPDATE choferes SET nombre=$1, placa=$2, documento=$3, licencia=$4, telefono=$5, direccion=$6, calificacion=$7
     WHERE id=$8 RETURNING *`,
    [nombre, placa, documento, licencia, telefono, texto(body.direccion), calificacion, id]
  );
  if (rows.length === 0) return NextResponse.json({ error: 'Conductor no encontrado' }, { status: 404 });
  return NextResponse.json({ chofer: rows[0] });
}
