import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { obtenerSesion } from '@/lib/session';
import { filtrosChoferes, whereDe } from '@/lib/reportes';

const ORDEN = {
  nro: 'c.id',
  nombre: 'c.nombre',
  documento: 'c.documento',
  licencia: 'c.licencia',
  calificacion: 'c.calificacion',
};

const PAGE_SIZE = 50;

/** Valida y normaliza los datos del conductor (hoja Excel "Conductores"). */
function validarConductor(body = {}) {
  const texto = v => {
    const t = String(v ?? '').trim();
    return t === '' ? null : t;
  };
  const nombre = texto(body.nombre);
  if (!nombre) return { ok: false, error: 'El nombre del conductor es obligatorio' };

  const placa = texto(body.placa); // se mantiene por compatibilidad con Gastos de Chofer
  if (!placa) return { ok: false, error: 'La placa es obligatoria' };

  const documento = texto(body.documento);
  if (documento && !/^[A-Za-z0-9.\-]{4,20}$/.test(documento)) {
    return { ok: false, error: 'El documento debe tener entre 4 y 20 caracteres (letras, números, punto o guion)' };
  }
  const licencia = texto(body.licencia);
  if (licencia && !/^[A-Za-z0-9\-]{4,20}$/.test(licencia)) {
    return { ok: false, error: 'El número de licencia debe tener entre 4 y 20 caracteres' };
  }
  const telefono = texto(body.telefono);
  if (telefono && !/^[+\d][\d\s\-()]{5,20}$/.test(telefono)) {
    return { ok: false, error: 'El teléfono/celular no tiene un formato válido' };
  }

  let calificacion = body.calificacion === '' || body.calificacion === null || body.calificacion === undefined
    ? null
    : Number(body.calificacion);
  if (calificacion !== null && (!Number.isInteger(calificacion) || calificacion < 1 || calificacion > 5)) {
    return { ok: false, error: 'La calificación debe ser entre 1 y 5 estrellas' };
  }

  return {
    ok: true,
    datos: { nombre, placa, documento, licencia, telefono, direccion: texto(body.direccion), calificacion },
  };
}

export async function GET(request) {
  const sesion = await obtenerSesion();
  if (!sesion) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const filtro = whereDe(filtrosChoferes(Object.fromEntries(searchParams.entries())));
  const orden = ORDEN[searchParams.get('sort')] || 'nombre';
  const dir = searchParams.get('dir') === 'desc' ? 'DESC' : 'ASC';
  const page = Math.max(1, parseInt(searchParams.get('page'), 10) || 1);
  const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit'), 10) || PAGE_SIZE));
  const offset = (page - 1) * limit;

  // Ejecutar query paginada + count + resumen EN PARALELO
  const [choferes, countResult, resumenRows] = await Promise.all([
    query(
      `SELECT c.* FROM choferes c ${filtro.texto}
       ORDER BY ${orden} ${dir} NULLS LAST, c.nombre ASC
       LIMIT $${filtro.params.length + 1} OFFSET $${filtro.params.length + 2}`,
      [...filtro.params, limit, offset]
    ),
    query(
      `SELECT COUNT(*)::int AS total FROM choferes c ${filtro.texto}`,
      filtro.params
    ),
    query(`
      SELECT count(*) FILTER (WHERE activo)::int AS total_activos,
             count(*)::int AS total,
             count(*) FILTER (WHERE activo AND calificacion = 1)::int AS cal_1,
             count(*) FILTER (WHERE activo AND calificacion = 2)::int AS cal_2,
             count(*) FILTER (WHERE activo AND calificacion = 3)::int AS cal_3,
             count(*) FILTER (WHERE activo AND calificacion = 4)::int AS cal_4,
             count(*) FILTER (WHERE activo AND calificacion = 5)::int AS cal_5
      FROM choferes`),
  ]);

  const totalCount = countResult[0]?.total || 0;
  const totalPages = Math.ceil(totalCount / limit);

  return NextResponse.json({
    choferes,
    resumen: resumenRows[0],
    pagination: { page, limit, totalCount, totalPages },
  });
}

export async function POST(request) {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await request.json();
  const validacion = validarConductor(body);
  if (!validacion.ok) return NextResponse.json({ error: validacion.error }, { status: 400 });
  const d = validacion.datos;

  try {
    const rows = await query(
      `INSERT INTO choferes (nombre, placa, documento, licencia, telefono, direccion, calificacion)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [d.nombre, d.placa, d.documento, d.licencia, d.telefono, d.direccion, d.calificacion]
    );
    return NextResponse.json({ chofer: rows[0] }, { status: 201 });
  } catch (err) {
    if (err.code === '23514') {
      return NextResponse.json({ error: 'Datos inválidos (revise la calificación)' }, { status: 400 });
    }
    throw err;
  }
}
