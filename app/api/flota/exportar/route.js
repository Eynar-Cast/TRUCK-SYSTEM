import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { obtenerSesion } from '@/lib/session';
import { filtrosFlota, whereDe, joinSeguroActual, joinAlertasMantenimiento, estadoVehiculoSql, nuevoWorkbook, estilosExcel, fmtFechaCorta, responderXlsx } from '@/lib/reportes';
import { evaluarProxima } from '@/lib/flota';

const COLUMNAS = [
  ['Nro', 6], ['Placa', 12], ['Color', 12], ['Tipo', 14], ['Año', 8],
  ['Modelo', 16], ['Operador logístico', 22], ['Conductor designado', 24],
  ['Estado vehículo', 16], ['Llantas', 14], ['Próx. cambio llantas', 18],
  ['Aceites', 14], ['Próx. cambio aceites', 20],
];

function fmtDiaCorto(iso) {
  if (!iso) return '';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

/** Exportación a Excel del Reporte de Camiones (respeta los filtros en pantalla). */
export async function GET(request) {
  const sesion = await obtenerSesion();
  if (!sesion || !['admin','secretaria'].includes(sesion.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const filtro = whereDe(filtrosFlota(Object.fromEntries(searchParams.entries())));

  const rows = await query(
    `SELECT f.*, ch.nombre AS conductor_designado,
            ${estadoVehiculoSql('f')} AS estado_vehiculo,
            llt.proxima AS llantas_proxima,
            ac.por_tipo AS aceites_proxima
     FROM flota f
     ${joinSeguroActual()}
     ${joinAlertasMantenimiento()}
     LEFT JOIN choferes ch ON ch.id = f.chofer_id
     ${filtro.texto}
     ORDER BY f.id ASC`,
    filtro.params
  );

  const wb = nuevoWorkbook();
  const hoja = wb.addWorksheet('Camiones');
  hoja.columns = COLUMNAS.map(([header, width]) => ({ header, width }));

  const estilos = estilosExcel();
  hoja.addRow(['Reporte de Camiones']).font = estilos.titulo.font;
  hoja.addRow([`Generado: ${fmtFechaCorta(new Date().toISOString())} — ${rows.length} unidad(es)`]).font = estilos.subtitulo.font;
  hoja.addRow([]);
  hoja.getRow(4).eachCell(c => Object.assign(c, estilos.encabezado));
  hoja.views = [{ state: 'frozen', ySplit: 4 }];

  for (const [i, v] of rows.entries()) {
    // Estado de aceites: el más crítico entre motor/caja/corona
    let aceitesEstado = '';
    let aceitesFecha = '';
    if (v.aceites_proxima && typeof v.aceites_proxima === 'object') {
      for (const [, fecha] of Object.entries(v.aceites_proxima)) {
        const e = evaluarProxima(fecha);
        if ((e === 'Cambiar ya') || (e === 'Por cambiar' && aceitesEstado !== 'Cambiar ya') || (!aceitesEstado && e === 'Al día')) {
          aceitesEstado = e;
        }
        if (e === 'Cambiar ya') { aceitesFecha = fmtDiaCorto(fecha); break; }
      }
    }

    hoja.addRow([
      i + 1, v.placa, v.color || '', v.tipo, v.anio ?? '',
      v.modelo, v.operador_logistico || '', v.conductor_designado || '',
      v.estado_vehiculo,
      evaluarProxima(v.llantas_proxima) || 'Sin registro',
      fmtDiaCorto(v.llantas_proxima),
      aceitesEstado || 'Sin registro',
      aceitesFecha,
    ]);
  }

  return responderXlsx(wb, 'reporte_camiones');
}
