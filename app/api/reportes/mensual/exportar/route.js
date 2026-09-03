import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { obtenerSesion } from '@/lib/session';
import { REPORTES, rangoMes } from '@/lib/reportes-mensuales';
import { nuevoWorkbook, estilosExcel, responderXlsx, generarHojaPlantilla, esReportePlantilla } from '@/lib/reportes';

/** Exportación a Excel de un reporte mensual: ?tipo=X&mes=AAAA-MM
 *  Para flota/multas/seguros/conductores usa la plantilla idéntica al Excel
 *  control-de-flota-vehicular.xlsx (colores, anchos, grupos, fórmulas).
 *  Para compras/devoluciones/gastos mantiene el estilo genérico.
 */
export async function GET(request) {
  const sesion = await obtenerSesion();
  if (!sesion || !['admin','secretaria'].includes(sesion.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get('tipo');
  const mes = searchParams.get('mes');

  const def = REPORTES[tipo];
  if (!def) return NextResponse.json({ error: 'Tipo de reporte inválido' }, { status: 400 });
  const rango = rangoMes(mes);
  if (!rango) return NextResponse.json({ error: 'Mes inválido (formato AAAA-MM)' }, { status: 400 });

  const filas = await query(def.sql, [rango.inicio, rango.fin]);

  const wb = nuevoWorkbook();

  if (esReportePlantilla(tipo)) {
    // Plantilla idéntica al Excel: colores FFC4EEFE / 0C9B74 / 17406D, anchos, grupos, fórmulas, filtros
    generarHojaPlantilla(wb, tipo, def, filas, mes);
  } else {
    // Reportes genéricos (compras, devoluciones, gastos)
    const hoja = wb.addWorksheet(def.hoja || tipo.charAt(0).toUpperCase() + tipo.slice(1));
    hoja.columns = def.columnas.map(([header, width]) => ({ header, width }));
    const estilos = estilosExcel();
    hoja.addRow([`${def.titulo} — ${mes}`]).font = estilos.titulo.font;
    hoja.addRow([`Generado: ${new Date().toLocaleDateString('es-BO')} — ${filas.length} registro(s)`]).font = estilos.subtitulo.font;
    hoja.addRow([]);
    hoja.getRow(4).eachCell(c => Object.assign(c, estilos.encabezado));
    hoja.views = [{ state: 'frozen', ySplit: 4 }];
    for (const r of filas) hoja.addRow(def.fila(r));
  }

  return responderXlsx(wb, `reporte_${tipo}_${mes}`);
}
