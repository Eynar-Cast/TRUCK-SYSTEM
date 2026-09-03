import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { obtenerSesion } from '@/lib/session';
import { esID } from '@/lib/utils';
import { estadoSeguroSql } from '@/lib/reportes';
import { validarDatosSeguro, normalizarPlaca } from '@/lib/flota';

export async function GET(request, { params }) {
  const sesion = await obtenerSesion();
  if (!sesion) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  if (!esID(id)) return NextResponse.json({ error: 'Seguro no encontrado' }, { status: 404 });

  const rows = await query(
    `SELECT s.*, ${estadoSeguroSql('s.fecha_vencimiento')} AS estado
     FROM seguros s WHERE s.id = $1`,
    [id]
  );
  if (rows.length === 0) return NextResponse.json({ error: 'Seguro no encontrado' }, { status: 404 });
  return NextResponse.json({ seguro: rows[0] });
}

export async function PUT(request, { params }) {
  const sesion = await obtenerSesion();
  if (!sesion || !['admin','secretaria'].includes(sesion.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;
  if (!esID(id)) return NextResponse.json({ error: 'Seguro no encontrado' }, { status: 404 });
  const body = await request.json();

  if (body.accion === 'toggle') {
    const rows = await query('UPDATE seguros SET activo = NOT activo WHERE id = $1 RETURNING id, activo', [id]);
    if (rows.length === 0) return NextResponse.json({ error: 'Seguro no encontrado' }, { status: 404 });
    return NextResponse.json({ seguro: rows[0] });
  }

  const validacion = validarDatosSeguro(body);
  if (!validacion.ok) return NextResponse.json({ error: validacion.error }, { status: 400 });
  const d = validacion.datos;

  const vehiculo = await query('SELECT id FROM flota WHERE placa = $1', [d.placa]);
  if (vehiculo.length === 0) {
    return NextResponse.json({ error: `No existe un vehículo con la placa ${d.placa}` }, { status: 400 });
  }

  const rows = await query(
    `UPDATE seguros SET placa=$1, aseguradora=$2, poliza=$3, fecha_inicio=$4,
            fecha_vencimiento=$5, importe_pagado=$6, fecha_pago=$7
     WHERE id=$8 RETURNING *`,
    [d.placa, d.aseguradora, d.poliza, d.fecha_inicio, d.fecha_vencimiento, d.importe_pagado, d.fecha_pago, id]
  );
  if (rows.length === 0) return NextResponse.json({ error: 'Seguro no encontrado' }, { status: 404 });

  const conEstado = await query(`SELECT *, ${estadoSeguroSql('fecha_vencimiento')} AS estado FROM seguros WHERE id = $1`, [id]);
  return NextResponse.json({ seguro: conEstado[0] });
}
