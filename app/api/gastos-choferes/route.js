import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { obtenerSesion } from '@/lib/session';

export async function GET(request) {
  const sesion = await obtenerSesion();
  if (!sesion) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const periodo = searchParams.get('periodo') || 'todo';
  const choferId = searchParams.get('choferId') || '';
  const desde = searchParams.get('desde') || '';
  const hasta = searchParams.get('hasta') || '';

  let sql = `
    SELECT g.id, g.chofer_id, g.user_id, g.nombre, g.monto, g.descripcion,
           g.tiene_factura, g.pagado, g.tipo_pago, g.fecha,
           c.nombre AS chofer_nombre, c.placa AS chofer_placa, u.nombre AS usuario_nombre
    FROM gastos_chofer g
    JOIN choferes c ON c.id = g.chofer_id
    JOIN usuarios u ON u.id = g.user_id
    WHERE 1=1`;
  const params = [];

  if (sesion.role !== 'admin') {
    params.push(sesion.id);
    sql += ` AND g.user_id = $${params.length}`;
  } else if (choferId) {
    params.push(choferId);
    sql += ` AND g.chofer_id = $${params.length}`;
  }

  if (desde || hasta) {
    if (desde) { params.push(desde); sql += ` AND g.fecha >= $${params.length}::date`; }
    if (hasta) { params.push(hasta); sql += ` AND g.fecha < ($${params.length}::date + interval '1 day')`; }
  } else {
    if (periodo === 'dia') sql += " AND g.fecha >= date_trunc('day', now())";
    if (periodo === 'semana') sql += " AND g.fecha >= date_trunc('week', now())";
    if (periodo === 'mes') sql += " AND g.fecha >= date_trunc('month', now())";
  }

  sql += ' ORDER BY g.fecha DESC';

  const gastos = await query(sql, params);
  return NextResponse.json({ gastos });
}

export async function POST(request) {
  const sesion = await obtenerSesion();
  if (!sesion) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { choferId, nombre, monto, descripcion, tieneFactura, fotoFactura, pagado, tipoPago, fotoQr } = await request.json();

  if (!choferId) return NextResponse.json({ error: 'Selecciona un chofer' }, { status: 400 });
  if (!nombre?.trim()) return NextResponse.json({ error: 'El nombre del gasto es obligatorio' }, { status: 400 });
  if (!monto || monto <= 0) return NextResponse.json({ error: 'Ingresa un monto válido' }, { status: 400 });
  if (pagado && tipoPago === 'qr' && !fotoQr) {
    return NextResponse.json({ error: 'Debes subir el comprobante QR' }, { status: 400 });
  }

  const rows = await query(
    `INSERT INTO gastos_chofer (chofer_id, user_id, nombre, monto, descripcion, tiene_factura, foto_factura, pagado, tipo_pago, foto_qr)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [choferId, sesion.id, nombre, monto, descripcion || null, !!tieneFactura, fotoFactura || null, !!pagado, pagado ? tipoPago : null, fotoQr || null]
  );

  return NextResponse.json({ gasto: rows[0] }, { status: 201 });
}