import { NextResponse } from 'next/server';
import { getClient } from '@/lib/db';
import { obtenerSesion } from '@/lib/session';
import { esID } from '@/lib/utils';

export async function POST(request) {
  const sesion = await obtenerSesion();
  if (!sesion) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { compraId, motivo, tipoPago, comprobante } = await request.json();

  if (!compraId || !motivo?.trim()) {
    return NextResponse.json({ error: 'Selecciona una compra e indica el motivo' }, { status: 400 });
  }
  if (!esID(compraId)) {
    return NextResponse.json({ error: 'Compra no encontrada o ya devuelta' }, { status: 400 });
  }
  if (tipoPago === 'transferencia' && !comprobante) {
    return NextResponse.json({ error: 'Sube el comprobante de transferencia' }, { status: 400 });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Verifica que la compra sea del usuario y no esté ya devuelta
    const compraRes = await client.query(
      'SELECT * FROM compras WHERE id = $1 AND user_id = $2 AND devuelto = false FOR UPDATE',
      [compraId, sesion.id]
    );
    if (compraRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Compra no encontrada o ya devuelta' }, { status: 400 });
    }

    await client.query('UPDATE compras SET devuelto = true WHERE id = $1', [compraId]);

    const devRes = await client.query(
      `INSERT INTO devoluciones (compra_id, motivo, tipo_pago, comprobante)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [compraId, motivo, tipoPago, comprobante || null]
    );

    await client.query('COMMIT');
    return NextResponse.json({ devolucion: devRes.rows[0] }, { status: 201 });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return NextResponse.json({ error: 'Error al registrar la devolución' }, { status: 500 });
  } finally {
    client.release();
  }
}