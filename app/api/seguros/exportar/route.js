import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { obtenerSesion } from '@/lib/session';
import { filtrosSeguros, whereDe, estadoSeguroSql, nuevoWorkbook, estilosExcel, fmtFechaCorta, responderXlsx } from '@/lib/reportes';

const COLUMNAS = [
  ['Nro', 6], ['Placa', 12], ['Aseguradora', 22], ['Póliza', 16],
  ['Fecha de inicio', 14], ['Fecha de vencimiento', 18],
  ['Importe pagado (Bs.)', 16], ['Fecha de pago', 14], ['Estado', 12],
];

/** Exportación a Excel del Reporte de Seguros (respeta los filtros en pantalla). */
export async function GET(request) {
  const sesion = await obtenerSesion();
  if (!sesion || !['admin','secretaria'].includes(sesion.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const filtro = whereDe(filtrosSeguros(Object.fromEntries(searchParams.entries())));

  const rows = await query(
    `SELECT s.*, ${estadoSeguroSql('s.fecha_vencimiento')} AS estado
     FROM seguros s
     ${filtro.texto}
     ORDER BY s.fecha_vencimiento ASC NULLS LAST, s.id DESC`,
    filtro.params
  );

  const wb = nuevoWorkbook();
  const hoja = wb.addWorksheet('Seguros');
  hoja.columns = COLUMNAS.map(([header, width]) => ({ header, width }));

  const estilos = estilosExcel();
  hoja.addRow(['Reporte de Seguros']).font = estilos.titulo.font;
  hoja.addRow([`Generado: ${fmtFechaCorta(new Date().toISOString())} — ${rows.length} póliza(s)`]).font = estilos.subtitulo.font;
  hoja.addRow([]);
  hoja.getRow(4).eachCell(c => Object.assign(c, estilos.encabezado));
  hoja.views = [{ state: 'frozen', ySplit: 4 }];

  for (const [i, s] of rows.entries()) {
    hoja.addRow([
      i + 1, s.placa, s.aseguradora, s.poliza,
      fmtFechaCorta(s.fecha_inicio), fmtFechaCorta(s.fecha_vencimiento),
      s.importe_pagado !== null ? Number(s.importe_pagado) : '',
      fmtFechaCorta(s.fecha_pago), s.estado || 'Sin fecha',
    ]);
  }

  return responderXlsx(wb, 'reporte_seguros');
}
