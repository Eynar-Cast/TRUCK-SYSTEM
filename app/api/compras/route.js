import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { obtenerSesion } from '@/lib/session';

export async function GET(request) {
  const sesion = await obtenerSesion();
  if (!sesion) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const periodo = searchParams.get('periodo') || 'todo';
  const userId = searchParams.get('userId') || '';
  const desde = searchParams.get('desde') || '';
  const hasta = searchParams.get('hasta') || '';
  const q = searchParams.get('q') || '';

  // No se devuelven foto_factura/foto_qr en el listado: son data URLs de hasta 5MB
  // que no se usan en las tablas (solo el detalle las necesita).
  let sql = `SELECT id, user_id, producto, precio, descripcion, tiene_factura, tipo_pago, devuelto, fecha
             FROM compras WHERE 1=1`;
  const params = [];

  if (sesion.role !== 'admin') {
    params.push(sesion.id);
    sql += ` AND user_id = $${params.length}`;
  } else if (userId) {
    params.push(userId);
    sql += ` AND user_id = $${params.length}`;
  }

  if (q) {
    params.push(`%${q}%`);
    sql += ` AND (producto ILIKE $${params.length} OR descripcion ILIKE $${params.length})`;
  }

  if (desde || hasta) {
    if (desde) { params.push(desde); sql += ` AND fecha >= $${params.length}::date`; }
    if (hasta) { params.push(hasta); sql += ` AND fecha < ($${params.length}::date + interval '1 day')`; }
  } else {
    if (periodo === 'dia') sql += " AND fecha >= date_trunc('day', now())";
    if (periodo === 'semana') sql += " AND fecha >= date_trunc('week', now())";
    if (periodo === 'mes') sql += " AND fecha >= date_trunc('month', now())";
  }

  sql += ' ORDER BY fecha DESC';

  const compras = await query(sql, params);

  // Total de compras (ignora filtros de fecha/producto) para el aviso de limpieza.
  let totalSql = `SELECT COUNT(*)::int AS total FROM compras WHERE 1=1`;
  const totalParams = [];
  if (sesion.role !== 'admin') {
    totalParams.push(sesion.id);
    totalSql += ` AND user_id = $${totalParams.length}`;
  }
  const [totalRow] = await query(totalSql, totalParams);

  return NextResponse.json({ compras, total: totalRow?.total || 0 });
}

export async function POST(request) {
  const sesion = await obtenerSesion();
  if (!sesion) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { producto, precio, descripcion, tieneFactura, fotoFactura, tipoPago, fotoQr } = await request.json();

  if (!producto || !precio || precio <= 0) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }
  if (tipoPago === 'qr' && !fotoQr) {
    return NextResponse.json({ error: 'Debes subir el comprobante QR' }, { status: 400 });
  }

  const rows = await query(
    `INSERT INTO compras (user_id, producto, precio, descripcion, tiene_factura, foto_factura, tipo_pago, foto_qr)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [sesion.id, producto, precio, descripcion || null, !!tieneFactura, fotoFactura || null, tipoPago, fotoQr || null]
  );

  return NextResponse.json({ compra: rows[0] }, { status: 201 });
}