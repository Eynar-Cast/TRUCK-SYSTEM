import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { obtenerSesion } from '@/lib/session';
import { filtrosChoferes, whereDe, estadoSeguroSql, nuevoWorkbook, estilosExcel, fmtFechaCorta, responderXlsx } from '@/lib/reportes';

const COLUMNAS = [
  ['Nro', 6], ['Documento', 14], ['Nombre completo', 28], ['N° de licencia', 14],
  ['Dirección', 30], ['Teléfono/Celular', 15], ['Camión asignado', 14], ['Calificación', 12],
  ['Documentación', 26], ['Referencias familiares', 36], ['Seguro individual', 18],
  ['Multas (cant.)', 12], ['Multas total (Bs.)', 16],
];

/** Exportación a Excel del Reporte de Conductores (respeta los filtros en pantalla). */
export async function GET(request) {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const filtro = whereDe(filtrosChoferes(Object.fromEntries(searchParams.entries())));

  const rows = await query(
    `SELECT c.*,
            (SELECT string_agg(r.nombre || COALESCE(' (' || r.parentesco || ')', ''), ', ' ORDER BY r.id)
             FROM conductor_referencias r WHERE r.chofer_id = c.id) AS referencias,
            (SELECT ${estadoSeguroSql('cs.fecha_expiracion')}
             FROM conductor_seguros cs
             WHERE cs.chofer_id = c.id
             ORDER BY cs.creado DESC, cs.id DESC LIMIT 1) AS seguro_individual_estado,
            (SELECT string_agg(d.tipo, ', ' ORDER BY d.id)
             FROM conductor_documentos d WHERE d.chofer_id = c.id) AS documentacion,
            (SELECT count(*)::int FROM multas m WHERE m.chofer_id = c.id) AS multas_cantidad,
            (SELECT COALESCE(sum(m.monto), 0)::float8 FROM multas m WHERE m.chofer_id = c.id) AS multas_total
     FROM choferes c
     ${filtro.texto}
     ORDER BY c.nombre ASC`,
    filtro.params
  );

  const wb = nuevoWorkbook();
  const hoja = wb.addWorksheet('Conductores');
  hoja.columns = COLUMNAS.map(([header, width]) => ({ header, width }));

  const estilos = estilosExcel();
  hoja.addRow(['Reporte de Conductores']).font = estilos.titulo.font;
  hoja.addRow([`Generado: ${fmtFechaCorta(new Date().toISOString())} — ${rows.length} conductor(es)`]).font = estilos.subtitulo.font;
  hoja.addRow([]);
  hoja.getRow(4).eachCell(c => Object.assign(c, estilos.encabezado));
  hoja.views = [{ state: 'frozen', ySplit: 4 }];

  for (const [i, c] of rows.entries()) {
    hoja.addRow([
      i + 1, c.documento || '', c.nombre, c.licencia || '',
      c.direccion || '', c.telefono || '', c.placa,
      c.calificacion ? '★'.repeat(c.calificacion) : '',
      c.documentacion ? c.documentacion.toUpperCase() : 'Sin documentos',
      c.referencias || 'Sin referencias',
      c.seguro_individual_estado || 'Sin registro',
      c.multas_cantidad ?? 0,
      c.multas_total ?? 0,
    ]);
  }

  return responderXlsx(wb, 'reporte_conductores');
}
