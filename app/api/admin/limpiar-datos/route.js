import { NextResponse } from 'next/server';
import { del, list, put } from '@vercel/blob';
import { query } from '@/lib/db';
import { obtenerSesion } from '@/lib/session';

const FRASE_CONFIRMACION = 'BORRAR';
const PREFIJO_RESPALDOS = 'respaldos-automaticos/';

// ============================================================
// GET — estadísticas actuales + lista de respaldos automáticos
// anteriores, para mostrar antes de limpiar.
// ============================================================
export async function GET() {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const [compras] = await query('SELECT COUNT(*)::int AS n, MIN(fecha) AS desde FROM compras');
  const [devoluciones] = await query('SELECT COUNT(*)::int AS n FROM devoluciones');
  const [gastos] = await query('SELECT COUNT(*)::int AS n FROM gastos_chofer');
  const [fotos] = await query(`
    SELECT
      (SELECT COUNT(*) FROM compras WHERE foto_factura IS NOT NULL) +
      (SELECT COUNT(*) FROM compras WHERE foto_qr IS NOT NULL) +
      (SELECT COUNT(*) FROM devoluciones WHERE comprobante IS NOT NULL) +
      (SELECT COUNT(*) FROM gastos_chofer WHERE foto_factura IS NOT NULL) +
      (SELECT COUNT(*) FROM gastos_chofer WHERE foto_qr IS NOT NULL)
    AS n
  `);

  let respaldosAutomaticos = [];
  try {
    const { blobs } = await list({ prefix: PREFIJO_RESPALDOS });
    respaldosAutomaticos = blobs
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
      .map(b => ({ url: b.url, nombre: b.pathname.replace(PREFIJO_RESPALDOS, ''), fecha: b.uploadedAt, tamano: b.size }));
  } catch {
    // Si falla el listado, no bloqueamos la pantalla por esto
  }

  return NextResponse.json({
    compras: compras.n,
    devoluciones: devoluciones.n,
    gastosChofer: gastos.n,
    fotos: Number(fotos.n),
    desde: compras.desde,
    respaldosAutomaticos,
  });
}

// ============================================================
// Arma el respaldo JSON completo (mismas tablas que /api/admin/exportar
// con formato=json&periodo=todo), para subirlo a Blob antes de borrar.
// ============================================================
async function construirRespaldoCompleto() {
  const usuarios = await query(
    'SELECT id, username, password_hash, nombre, cargo, role, activo, creado FROM usuarios ORDER BY id'
  );
  const choferes = await query(
    'SELECT id, nombre, placa, telefono, direccion, activo, creado FROM choferes ORDER BY id'
  );
  const compras = await query(`
    SELECT c.id, c.fecha, c.user_id, u.nombre AS usuario, c.producto, c.precio, c.descripcion,
           c.tiene_factura, c.foto_factura, c.tipo_pago, c.foto_qr, c.devuelto
    FROM compras c JOIN usuarios u ON u.id = c.user_id ORDER BY c.id`);
  const devoluciones = await query(`
    SELECT d.id, d.compra_id, d.fecha, d.motivo, d.tipo_pago, d.comprobante
    FROM devoluciones d ORDER BY d.id`);
  const gastosChofer = await query(`
    SELECT g.id, g.fecha, g.user_id, u.nombre AS usuario, g.chofer_id, ch.nombre AS chofer, ch.placa,
           g.nombre AS gasto, g.monto, g.descripcion, g.tiene_factura, g.foto_factura,
           g.pagado, g.tipo_pago, g.foto_qr
    FROM gastos_chofer g
    JOIN choferes ch ON ch.id = g.chofer_id
    JOIN usuarios u ON u.id = g.user_id
    ORDER BY g.id`);

  return {
    version: 1,
    generadoEn: new Date().toISOString(),
    motivo: 'Respaldo automático generado justo antes de una limpieza de base de datos',
    tablas: { usuarios, choferes, compras, devoluciones, gastos_chofer: gastosChofer },
  };
}

// ============================================================
// POST — ejecuta la limpieza (requiere frase de confirmación)
//
// 1. Genera un respaldo JSON completo y lo sube a Vercel Blob (red de
//    seguridad silenciosa, independiente de que el cliente haya
//    guardado bien su descarga manual).
// 2. Borra las fotos correspondientes en Blob.
// 3. Borra compras, devoluciones (cascada) y gastos_chofer.
//    NO toca usuarios ni choferes (son datos maestros).
// ============================================================
export async function POST(request) {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  if (body.confirmacion !== FRASE_CONFIRMACION) {
    return NextResponse.json(
      { error: `Debes enviar la confirmación exacta ("${FRASE_CONFIRMACION}")` },
      { status: 400 }
    );
  }

  // ---- 1. Contar antes de borrar (para el reporte final) ----
  const [{ n: totalCompras }] = await query('SELECT COUNT(*)::int AS n FROM compras');
  const [{ n: totalDevoluciones }] = await query('SELECT COUNT(*)::int AS n FROM devoluciones');
  const [{ n: totalGastos }] = await query('SELECT COUNT(*)::int AS n FROM gastos_chofer');

  // ---- 2. Respaldo automático a Blob, ANTES de tocar nada ----
  let respaldoUrl = null;
  try {
    const cuerpoRespaldo = await construirRespaldoCompleto();
    const nombreArchivo = `gestorcompras_respaldo_emergencia_${new Date().toISOString().slice(0, 10)}_${Date.now()}.json`;
    const blob = await put(
      `${PREFIJO_RESPALDOS}${nombreArchivo}`,
      JSON.stringify(cuerpoRespaldo, null, 2),
      { access: 'public', contentType: 'application/json' }
    );
    respaldoUrl = blob.url;

    // ---- Retención: conservar solo los últimos 6 respaldos automáticos ----
    // (evita que esta carpeta crezca sin límite después de años de uso)
    const LIMITE_RESPALDOS = 6;
    try {
      const { blobs } = await list({ prefix: PREFIJO_RESPALDOS });
      const ordenados = blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
      const sobrantes = ordenados.slice(LIMITE_RESPALDOS);
      for (const viejo of sobrantes) {
        await del(viejo.url).catch(() => {});
      }
    } catch {
      // No es crítico si la limpieza de respaldos viejos falla — el respaldo
      // nuevo ya se guardó bien, que es lo que importa para continuar.
    }
  } catch (err) {
    // Si el respaldo automático falla, detenemos TODO el proceso de limpieza.
    // Preferimos no borrar nada antes que borrar sin tener ninguna copia de más.
    console.error('Error generando respaldo automático:', err);
    return NextResponse.json(
      { error: 'No se pudo generar el respaldo automático de seguridad. La limpieza se canceló para no arriesgar los datos.' },
      { status: 500 }
    );
  }

  // ---- 3. Reunir todas las URLs de fotos que hay que borrar de Blob ----
  const filasConFotos = await query(`
    SELECT foto_factura, foto_qr, NULL AS comprobante FROM compras
    UNION ALL
    SELECT NULL, NULL, comprobante FROM devoluciones
    UNION ALL
    SELECT foto_factura, foto_qr, NULL FROM gastos_chofer
  `);

  const urls = [];
  for (const fila of filasConFotos) {
    for (const campo of [fila.foto_factura, fila.foto_qr, fila.comprobante]) {
      if (campo && campo.startsWith('https://')) urls.push(campo);
    }
  }

  let fotosEliminadas = 0;
  let fotosConError = 0;
  for (const url of urls) {
    try {
      await del(url);
      fotosEliminadas++;
    } catch {
      fotosConError++;
    }
  }

  // ---- 4. Borrar las filas (compras arrastra devoluciones por CASCADE) ----
  await query('DELETE FROM compras');
  await query('DELETE FROM gastos_chofer');

  return NextResponse.json({
    ok: true,
    comprasEliminadas: totalCompras,
    devolucionesEliminadas: totalDevoluciones,
    gastosEliminados: totalGastos,
    fotosEliminadas,
    fotosConError,
    respaldoUrl,
    limpiadoEn: new Date().toISOString(),
  });
}