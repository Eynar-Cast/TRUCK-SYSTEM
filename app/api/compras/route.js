import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { obtenerSesion } from '@/lib/session';

const PAGE_SIZE = 50;

export async function GET(request) {
  const sesion = await obtenerSesion();
  if (!sesion) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const periodo = searchParams.get('periodo') || 'todo';
  const userId = searchParams.get('userId') || '';
  const desde = searchParams.get('desde') || '';
  const hasta = searchParams.get('hasta') || '';
  const q = searchParams.get('q') || '';
  const page = Math.max(1, parseInt(searchParams.get('page'), 10) || 1);
  const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit'), 10) || PAGE_SIZE));
  const offset = (page - 1) * limit;

  // No se devuelven foto_factura/foto_qr en el listado: son data URLs de hasta 5MB
  let whereClauses = ['1=1'];
  const params = [];

  if (!['admin','supervisor'].includes(sesion.role)) {
    params.push(sesion.id);
    whereClauses.push(`user_id = $${params.length}`);
  } else if (userId) {
    params.push(userId);
    whereClauses.push(`user_id = $${params.length}`);
  }

  if (q) {
    params.push(`%${q}%`);
    whereClauses.push(`(producto ILIKE $${params.length} OR descripcion ILIKE $${params.length})`);
  }

  if (desde || hasta) {
    if (desde) { params.push(desde); whereClauses.push(`fecha >= $${params.length}::date`); }
    if (hasta) { params.push(hasta); whereClauses.push(`fecha < ($${params.length}::date + interval '1 day')`); }
  } else {
    if (periodo === 'dia') whereClauses.push("fecha >= date_trunc('day', now())");
    if (periodo === 'semana') whereClauses.push("fecha >= date_trunc('week', now())");
    if (periodo === 'mes') whereClauses.push("fecha >= date_trunc('month', now())");
  }

  const whereSQL = whereClauses.join(' AND ');

  // Ejecutar query paginada + COUNT total EN PARALELO
  const [compras, countResult] = await Promise.all([
    query(
      `SELECT id, user_id, producto, precio, descripcion, tiene_factura, tipo_pago, devuelto, fecha
       FROM compras WHERE ${whereSQL}
       ORDER BY fecha DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    ),
    query(
      `SELECT COUNT(*)::int AS total FROM compras WHERE ${whereSQL}`,
      params
    ),
  ]);

  const totalCount = countResult[0]?.total || 0;
  const totalPages = Math.ceil(totalCount / limit);

  return NextResponse.json({
    compras,
    total: totalCount,
    pagination: { page, limit, totalCount, totalPages },
  });
}

export async function POST(request) {
  const sesion = await obtenerSesion();
  if (!sesion) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { producto, precio, descripcion, tieneFactura, fotoFactura, tipoPago, fotoQr, enlace, numero_factura, numero_comprobante, placa, flota_id } = await request.json();

  if (!producto || !precio || precio <= 0) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }
  // Ya no se exige imagen QR; se pide Nº comprobante en texto si es QR
  const enlaceTxt = (enlace || fotoFactura || fotoQr || '').trim() || null;
  const numFact = (numero_factura || '').trim() || null;
  const numComp = (numero_comprobante || '').trim() || null;
  let flotaId = flota_id ? Number(flota_id) : null;
  if (flotaId && (!Number.isInteger(flotaId) || flotaId<=0)) flotaId=null;
  let placaNorm = placa ? String(placa).trim().toUpperCase() : null;
  if (flotaId) {
    const f = await query('SELECT placa FROM flota WHERE id=$1', [flotaId]);
    if (f.length) placaNorm = f[0].placa;
  } else if (placaNorm) {
    const f = await query('SELECT id FROM flota WHERE placa=$1 LIMIT 1', [placaNorm]);
    if (f.length) flotaId = f[0].id;
  }

  const rows = await query(
    `INSERT INTO compras (user_id, producto, precio, descripcion, tiene_factura, foto_factura, tipo_pago, foto_qr, enlace, numero_factura, numero_comprobante, placa, flota_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [sesion.id, producto, precio, descripcion || null, !!tieneFactura, fotoFactura || null, tipoPago, fotoQr || null, enlaceTxt, numFact, numComp, placaNorm, flotaId]
  );

  return NextResponse.json({ compra: rows[0] }, { status: 201 });
}
