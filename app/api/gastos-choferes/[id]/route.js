import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { obtenerSesion } from '@/lib/session';
import { esID } from '@/lib/utils';

export async function GET(request, { params }) {
  const sesion = await obtenerSesion();
  if (!sesion) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  if (!esID(id)) {
    return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 });
  }
  const rows = await query(
    `SELECT g.*, c.nombre AS chofer_nombre, c.placa AS chofer_placa, u.nombre AS usuario_nombre
     FROM gastos_chofer g
     JOIN choferes c ON c.id = g.chofer_id
     JOIN usuarios u ON u.id = g.user_id
     WHERE g.id = $1`,
    [id]
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 });
  }

  const gasto = rows[0];

  // Seguridad: un usuario normal solo ve sus propios gastos
  if (sesion.role !== 'admin' && gasto.user_id !== sesion.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  return NextResponse.json({ gasto });
}

export async function PUT(request, { params }) {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;
  if (!esID(id)) {
    return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 });
  }
  const { tipoPago, fotoQr } = await request.json();

  if (tipoPago === 'qr' && !fotoQr) {
    return NextResponse.json({ error: 'Debes subir el comprobante QR' }, { status: 400 });
  }

  const rows = await query(
    `UPDATE gastos_chofer
     SET pagado = true, tipo_pago = $1, foto_qr = $2
     WHERE id = $3 RETURNING *`,
    [tipoPago, tipoPago === 'qr' ? fotoQr : null, id]
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 });
  }
  return NextResponse.json({ gasto: rows[0] });
}