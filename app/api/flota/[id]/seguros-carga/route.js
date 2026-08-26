import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { obtenerSesion } from '@/lib/session';
import { esID } from '@/lib/utils';
import { estadoSeguroSql } from '@/lib/reportes';

/**
 * Seguro de CARGA del camión: póliza con fecha de trámite, inicio y
 * expiración. El estado (Vigente/Vencido) se deriva automáticamente.
 * Historial = varios registros por vehículo.
 */
function validarSeguroCarga(body = {}) {
  const texto = v => {
    const t = String(v ?? '').trim();
    return t === '' ? null : t;
  };
  const fecha = v => {
    const t = String(v ?? '').trim();
    if (t === '') return null;
    return /^\d{4}-\d{2}-\d{2}$/.test(t) && !isNaN(new Date(`${t}T00:00:00`).getTime()) ? t : undefined;
  };

  const poliza = texto(body.poliza);
  if (!poliza) return { error: 'Los datos de la póliza son obligatorios' };

  const tramite = fecha(body.fecha_tramite);
  if (tramite === undefined) return { error: 'Fecha de trámite inválida' };
  const inicio = fecha(body.fecha_inicio);
  if (inicio === undefined) return { error: 'Fecha de inicio inválida' };
  const expiracion = fecha(body.fecha_expiracion);
  if (expiracion === undefined) return { error: 'Fecha de expiración inválida' };

  if (inicio && expiracion && inicio > expiracion) {
    return { error: 'La fecha de inicio no puede ser posterior a la de expiración' };
  }

  return { datos: { poliza, fecha_tramite: tramite, fecha_inicio: inicio, fecha_expiracion: expiracion } };
}

export async function POST(request, { params }) {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;
  if (!esID(id)) return NextResponse.json({ error: 'Vehículo no encontrado' }, { status: 404 });

  const validacion = validarSeguroCarga(await request.json());
  if (validacion.error) return NextResponse.json({ error: validacion.error }, { status: 400 });
  const d = validacion.datos;

  const existe = await query('SELECT id FROM flota WHERE id = $1', [id]);
  if (existe.length === 0) return NextResponse.json({ error: 'Vehículo no encontrado' }, { status: 404 });

  const rows = await query(
    `INSERT INTO seguros_carga (flota_id, poliza, fecha_tramite, fecha_inicio, fecha_expiracion)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [id, d.poliza, d.fecha_tramite, d.fecha_inicio, d.fecha_expiracion]
  );
  const conEstado = await query(
    `SELECT *, ${estadoSeguroSql('fecha_expiracion')} AS estado FROM seguros_carga WHERE id = $1`,
    [rows[0].id]
  );
  return NextResponse.json({ seguro_carga: conEstado[0] }, { status: 201 });
}

export async function DELETE(request, { params }) {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;
  if (!esID(id)) return NextResponse.json({ error: 'Vehículo no encontrado' }, { status: 404 });

  const itemId = new URL(request.url).searchParams.get('itemId');
  if (!esID(itemId)) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });

  const rows = await query('DELETE FROM seguros_carga WHERE id = $1 AND flota_id = $2 RETURNING id', [itemId, id]);
  if (rows.length === 0) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
