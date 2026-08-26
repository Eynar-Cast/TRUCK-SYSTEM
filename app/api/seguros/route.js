import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { obtenerSesion } from '@/lib/session';
import { filtrosSeguros, whereDe, estadoSeguroSql } from '@/lib/reportes';
import { validarDatosSeguro, HOY_BOLIVIA_SQL } from '@/lib/flota';

const ORDEN = {
  nro: 's.id',
  placa: 's.placa',
  aseguradora: 's.aseguradora',
  poliza: 's.poliza',
  inicio: 's.fecha_inicio',
  vencimiento: 's.fecha_vencimiento',
  importe: 's.importe_pagado',
  estado: estadoSeguroSql('s.fecha_vencimiento'),
};

export async function GET(request) {
  const sesion = await obtenerSesion();
  if (!sesion) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const filtro = whereDe(filtrosSeguros(Object.fromEntries(searchParams.entries())));

  const orden = ORDEN[searchParams.get('sort')] || ORDEN.vencimiento;
  const dir = searchParams.get('dir') === 'desc' ? 'DESC' : 'ASC';

  const rows = await query(
    `SELECT s.*, ${estadoSeguroSql('s.fecha_vencimiento')} AS estado,
            f.id AS vehiculo_id
     FROM seguros s
     LEFT JOIN flota f ON f.placa = s.placa
     ${filtro.texto}
     ORDER BY ${orden} ${dir} NULLS LAST, s.id DESC`,
    filtro.params
  );

  // Alertas globales: vencidos y próximos a vencer (30 días)
  const alertasRows = await query(`
    SELECT
      count(*) FILTER (WHERE s.activo AND s.fecha_vencimiento IS NOT NULL AND s.fecha_vencimiento < ${HOY_BOLIVIA_SQL})::int AS vencidos,
      count(*) FILTER (WHERE s.activo AND s.fecha_vencimiento IS NOT NULL AND s.fecha_vencimiento >= ${HOY_BOLIVIA_SQL}
                        AND s.fecha_vencimiento < ${HOY_BOLIVIA_SQL} + interval '30 days')::int AS proximos
    FROM seguros s`);

  return NextResponse.json({ seguros: rows, alertas: alertasRows[0] });
}

export async function POST(request) {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await request.json();
  const validacion = validarDatosSeguro(body);
  if (!validacion.ok) return NextResponse.json({ error: validacion.error }, { status: 400 });
  const d = validacion.datos;

  // La póliza se asocia a un vehículo existente mediante la placa
  const vehiculo = await query('SELECT id FROM flota WHERE placa = $1', [d.placa]);
  if (vehiculo.length === 0) {
    return NextResponse.json({ error: `No existe un vehículo con la placa ${d.placa}. Regístrelo primero en Flota.` }, { status: 400 });
  }

  const rows = await query(
    `INSERT INTO seguros (placa, aseguradora, poliza, fecha_inicio, fecha_vencimiento, importe_pagado, fecha_pago)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [d.placa, d.aseguradora, d.poliza, d.fecha_inicio, d.fecha_vencimiento, d.importe_pagado, d.fecha_pago]
  );

  const conEstado = await query(`SELECT *, ${estadoSeguroSql('fecha_vencimiento')} AS estado FROM seguros WHERE id = $1`, [rows[0].id]);
  return NextResponse.json({ seguro: conEstado[0] }, { status: 201 });
}
