import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { obtenerSesion } from '@/lib/session';
import { esID } from '@/lib/utils';

/**
 * GET /api/compras/[id]
 *
 * Devuelve el detalle completo de una compra, incluyendo la información
 * de devolución si existe (LEFT JOIN a tabla devoluciones).
 *
 * Seguridad:
 *   - Requiere sesión activa.
 *   - Un usuario normal solo puede ver sus propias compras.
 *   - Un admin puede ver cualquier compra.
 *
 * NOTA Next.js 16: params es ahora una Promise y debe ser await-eado.
 */
export async function GET(_request, { params }) {
  const sesion = await obtenerSesion();
  if (!sesion) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;

  if (!esID(id)) {
    return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 });
  }

  const sql = `
    SELECT
      c.*,
      d.id             AS devolucion_id,
      d.motivo         AS devolucion_motivo,
      d.tipo_pago      AS devolucion_tipo_pago,
      d.comprobante    AS devolucion_comprobante,
      d.fecha          AS devolucion_fecha
    FROM compras c
    LEFT JOIN devoluciones d ON d.compra_id = c.id
    WHERE c.id = $1
  `;

  const rows = await query(sql, [id]);

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 });
  }

  const compra = rows[0];

  // Seguridad: usuario normal solo ve sus propias compras
  if (sesion.role !== 'admin' && compra.user_id !== sesion.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  return NextResponse.json({ compra });
}