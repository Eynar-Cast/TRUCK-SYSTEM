import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { obtenerSesion } from '@/lib/session';
import { esID } from '@/lib/utils';
import { estadoSeguroSql } from '@/lib/reportes';
import { validarDatosVehiculo } from '@/lib/flota';

/** Detalle completo del vehículo: ficha + llantas + aceites + seguros (vehículo y de carga). */
export async function GET(request, { params }) {
  const sesion = await obtenerSesion();
  if (!sesion) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  if (!esID(id)) return NextResponse.json({ error: 'Vehículo no encontrado' }, { status: 404 });

  // Primero obtener el vehículo para tener la placa
  const rows = await query(
    `SELECT f.*, ch.nombre AS conductor_designado,
            COALESCE(seg.estado_seguro,'') AS estado_seguro_actual
     FROM flota f
     LEFT JOIN choferes ch ON ch.id = f.chofer_id
     LEFT JOIN LATERAL (
       SELECT s.fecha_vencimiento, ${estadoSeguroSql('s.fecha_vencimiento')} AS estado_seguro
       FROM seguros s WHERE s.placa = f.placa AND s.activo
       ORDER BY s.creado DESC, s.id DESC LIMIT 1
     ) seg ON TRUE
     WHERE f.id = $1`,
    [id]
  );
  if (rows.length === 0) return NextResponse.json({ error: 'Vehículo no encontrado' }, { status: 404 });
  const vehiculo = {
    ...rows[0],
    estado_vehiculo: rows[0].estado_seguro_actual === 'Vencido' ? 'Seguro Vencido' : 'Disponible',
  };

  // Ejecutar las 4 queries secundarias EN PARALELO (antes eran secuenciales = 4 round-trips)
  const [seguros, llantas, aceites, segurosCarga] = await Promise.all([
    query(
      `SELECT s.*, ${estadoSeguroSql('s.fecha_vencimiento')} AS estado
       FROM seguros s WHERE s.placa = $1
       ORDER BY s.creado DESC, s.id DESC`,
      [vehiculo.placa]
    ),
    query(
      'SELECT * FROM llantas WHERE flota_id = $1 ORDER BY creado DESC, id DESC',
      [id]
    ),
    query(
      `SELECT * FROM aceites WHERE flota_id = $1
       ORDER BY CASE tipo WHEN 'motor' THEN 1 WHEN 'caja' THEN 2 ELSE 3 END,
                fecha_ultimo_cambio DESC NULLS LAST, id DESC`,
      [id]
    ),
    query(
      `SELECT sc.*, ${estadoSeguroSql('sc.fecha_expiracion')} AS estado
       FROM seguros_carga sc WHERE sc.flota_id = $1
       ORDER BY sc.creado DESC, sc.id DESC`,
      [id]
    ),
  ]);

  return NextResponse.json({
    vehiculo,
    seguros,
    llantas,
    aceites,
    seguros_carga: segurosCarga,
  });
}

export async function PUT(request, { params }) {
  const sesion = await obtenerSesion();
  if (!sesion || !['admin','secretaria'].includes(sesion.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;
  if (!esID(id)) return NextResponse.json({ error: 'Vehículo no encontrado' }, { status: 404 });
  const body = await request.json();

  if (body.accion === 'toggle') {
    const rows = await query('UPDATE flota SET activo = NOT activo WHERE id = $1 RETURNING id, activo', [id]);
    if (rows.length === 0) return NextResponse.json({ error: 'Vehículo no encontrado' }, { status: 404 });
    return NextResponse.json({ vehiculo: rows[0] });
  }

  const validacion = validarDatosVehiculo(body);
  if (!validacion.ok) return NextResponse.json({ error: validacion.error }, { status: 400 });
  const d = validacion.datos;

  const duplicado = await query('SELECT id FROM flota WHERE placa = $1 AND id <> $2', [d.placa, id]);
  if (duplicado.length > 0) {
    return NextResponse.json({ error: `Ya existe otro vehículo con la placa ${d.placa}` }, { status: 409 });
  }

  if (d.chofer_id !== null) {
    const chofer = await query('SELECT id FROM choferes WHERE id = $1', [d.chofer_id]);
    if (chofer.length === 0) return NextResponse.json({ error: 'El conductor designado no existe' }, { status: 400 });
  }

  for (const [tipoCat, valor] of [['tipo_vehiculo', d.tipo], ['marca', d.marca], ['modelo', d.modelo]]) {
    await query('INSERT INTO catalogos (tipo, valor) VALUES ($1,$2) ON CONFLICT (tipo, valor) DO NOTHING', [tipoCat, valor]);
  }

  try {
    const rows = await query(
      `UPDATE flota SET tipo=$1, marca=$2, modelo=$3, placa=$4, numero_serie=$5, color=$6,
              anio=$7, carga_maxima_kg=$8, operador_logistico=$9, chofer_id=$10
       WHERE id=$11 RETURNING *`,
      [d.tipo, d.marca, d.modelo, d.placa, d.numero_serie, d.color, d.anio, d.carga_maxima_kg,
       d.operador_logistico, d.chofer_id, id]
    );
    return NextResponse.json({ vehiculo: rows[0] });
  } catch (err) {
    if (err.code === '23503') {
      return NextResponse.json({ error: 'No se puede cambiar la placa: tiene registros asociados que impiden la operación' }, { status: 409 });
    }
    throw err;
  }
}
