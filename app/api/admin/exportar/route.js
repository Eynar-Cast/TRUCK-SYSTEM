import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { query } from '@/lib/db';
import { obtenerSesion } from '@/lib/session';

function fmtFecha(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
}

// ============================================================
// Filtro de fecha reutilizable: soporta período rápido
// (dia/semana/mes/todo) o rango manual (desde/hasta), igual
// que en Historial y Gastos por Chofer.
// ============================================================
function construirFiltroFecha(columna, { periodo, desde, hasta }) {
  const cláusulas = [];
  const params = [];

  if (desde || hasta) {
    if (desde) { params.push(desde); cláusulas.push(`${columna} >= $${params.length}::date`); }
    if (hasta) { params.push(hasta); cláusulas.push(`${columna} < ($${params.length}::date + interval '1 day')`); }
  } else if (periodo === 'dia') {
    cláusulas.push(`${columna} >= date_trunc('day', now())`);
  } else if (periodo === 'semana') {
    cláusulas.push(`${columna} >= date_trunc('week', now())`);
  } else if (periodo === 'mes') {
    cláusulas.push(`${columna} >= date_trunc('month', now())`);
  }
  // 'todo' o sin parámetros → sin cláusula, trae todo

  return { texto: cláusulas.length ? 'WHERE ' + cláusulas.join(' AND ') : '', params };
}

export async function GET(request) {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const formato = searchParams.get('formato') === 'json' ? 'json' : 'xlsx';
  const periodo = searchParams.get('periodo') || 'todo';
  const desde = searchParams.get('desde') || '';
  const hasta = searchParams.get('hasta') || '';
  const filtro = { periodo, desde, hasta };

  // ---- Compras (con nombre de usuario) ----
  const fCompras = construirFiltroFecha('c.fecha', filtro);
  const compras = await query(`
    SELECT c.id, c.fecha, c.user_id, u.nombre AS usuario, u.username, c.producto, c.precio,
           c.descripcion, c.tiene_factura, c.foto_factura, c.tipo_pago, c.foto_qr, c.devuelto
    FROM compras c
    JOIN usuarios u ON u.id = c.user_id
    ${fCompras.texto}
    ORDER BY u.nombre ASC, c.fecha DESC`, fCompras.params);

  // ---- Devoluciones (con datos de la compra original) ----
  const fDev = construirFiltroFecha('d.fecha', filtro);
  const devoluciones = await query(`
    SELECT d.id, d.compra_id, d.fecha, u.id AS user_id, u.nombre AS usuario, c.producto, c.precio,
           d.motivo, d.tipo_pago, d.comprobante
    FROM devoluciones d
    JOIN compras c ON c.id = d.compra_id
    JOIN usuarios u ON u.id = c.user_id
    ${fDev.texto}
    ORDER BY u.nombre ASC, d.fecha DESC`, fDev.params);

  // ---- Gastos de chofer (con usuario que registró y chofer) ----
  const fGastos = construirFiltroFecha('g.fecha', filtro);
  const gastosChofer = await query(`
    SELECT g.id, g.fecha, g.user_id, u.nombre AS usuario, g.chofer_id, ch.nombre AS chofer, ch.placa,
           g.nombre AS gasto, g.monto, g.descripcion, g.tiene_factura, g.foto_factura,
           g.pagado, g.tipo_pago, g.foto_qr
    FROM gastos_chofer g
    JOIN choferes ch ON ch.id = g.chofer_id
    JOIN usuarios u ON u.id = g.user_id
    ${fGastos.texto}
    ORDER BY u.nombre ASC, g.fecha DESC`, fGastos.params);

  // ---- Agrupar todo por usuario (para el resumen detallado) ----
  const porUsuario = new Map();
  function usuarioGrupo(id, nombre) {
    if (!porUsuario.has(id)) {
      porUsuario.set(id, { id, nombre, compras: [], devoluciones: [], gastosChofer: [] });
    }
    return porUsuario.get(id);
  }
  compras.forEach(c => usuarioGrupo(c.user_id, c.usuario).compras.push(c));
  devoluciones.forEach(d => usuarioGrupo(d.user_id, d.usuario).devoluciones.push(d));
  gastosChofer.forEach(g => usuarioGrupo(g.user_id, g.usuario).gastosChofer.push(g));

  const resumenPorUsuario = Array.from(porUsuario.values()).map(u => ({
    usuario: u.nombre,
    compras: u.compras.length,
    totalCompras: u.compras.reduce((a, c) => a + (c.devuelto ? 0 : Number(c.precio)), 0),
    devoluciones: u.devoluciones.length,
    totalDevuelto: u.devoluciones.reduce((a, d) => a + Number(d.precio), 0),
    gastosChofer: u.gastosChofer.length,
    totalGastosChofer: u.gastosChofer.reduce((a, g) => a + Number(g.monto), 0),
  })).sort((a, b) => a.usuario.localeCompare(b.usuario));

  const etiquetaPeriodo = (desde || hasta)
    ? `${desde || '...'} a ${hasta || '...'}`
    : { dia: 'Hoy', semana: 'Esta semana', mes: 'Este mes', todo: 'Todo el historial' }[periodo] || 'Todo el historial';

  const nombreArchivo = `gestorcompras_respaldo_${new Date().toISOString().slice(0, 10)}`;

  // ============================================================
  // JSON — respaldo completo, suficiente para regenerar la BD
  // ============================================================
  if (formato === 'json') {
    // Tablas maestras completas (siempre íntegras, sin filtrar por fecha,
    // porque las compras/gastos filtrados igual las referencian)
    const usuariosCompletos = await query(
      'SELECT id, username, password_hash, nombre, cargo, role, activo, creado FROM usuarios ORDER BY id'
    );
    const choferesCompletos = await query(
      'SELECT id, nombre, placa, telefono, direccion, activo, creado FROM choferes ORDER BY id'
    );

    const cuerpo = {
      version: 1,
      generadoEn: new Date().toISOString(),
      periodo: etiquetaPeriodo,
      rangoFechas: { desde: desde || null, hasta: hasta || null },
      nota: 'Este archivo contiene el volcado completo de las tablas necesarias para reconstruir la base de datos (usuarios, choferes) y las transacciones filtradas (compras, devoluciones, gastos_chofer). Las tablas "usuarios" y "choferes" siempre se exportan completas, sin filtrar, porque son referenciadas por las transacciones.',
      resumenPorUsuario,
      tablas: {
        usuarios: usuariosCompletos,
        choferes: choferesCompletos,
        compras,
        devoluciones,
        gastos_chofer: gastosChofer,
      },
    };
    return new NextResponse(JSON.stringify(cuerpo, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${nombreArchivo}.json"`,
      },
    });
  }

  // ============================================================
  // EXCEL (.xlsx)
  // ============================================================
  const wb = new ExcelJS.Workbook();
  wb.creator = 'GestorCompras';
  wb.created = new Date();

  const estiloEncabezado = { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } } };
  const estiloUsuario = { font: { bold: true, size: 13, color: { argb: 'FF0F172A' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } } };
  const estiloSubtitulo = { font: { bold: true, italic: true, color: { argb: 'FF475569' } } };

  // ---- Hoja 1: Resumen por usuario, con el detalle debajo de cada uno ----
  const hoja = wb.addWorksheet('Resumen por usuario');
  hoja.columns = [
    { key: 'a', width: 14 }, { key: 'b', width: 26 }, { key: 'c', width: 14 },
    { key: 'd', width: 30 }, { key: 'e', width: 14 }, { key: 'f', width: 14 }, { key: 'g', width: 14 },
  ];

  hoja.addRow([`Reporte GestorCompras — ${etiquetaPeriodo}`]).font = { bold: true, size: 14 };
  hoja.addRow([`Generado: ${fmtFecha(new Date().toISOString())}`]);
  hoja.addRow([]);

  for (const grupo of Array.from(porUsuario.values()).sort((a, b) => a.nombre.localeCompare(b.nombre))) {
    const totalCompras = grupo.compras.reduce((a, c) => a + (c.devuelto ? 0 : Number(c.precio)), 0);
    const totalDevuelto = grupo.devoluciones.reduce((a, d) => a + Number(d.precio), 0);
    const totalGastos = grupo.gastosChofer.reduce((a, g) => a + Number(g.monto), 0);

    // Encabezado del usuario con sus totales
    const filaUsuario = hoja.addRow([grupo.nombre, '', 'Total compras:', totalCompras, 'Devuelto:', totalDevuelto, 'Gastos chofer: ' + totalGastos]);
    filaUsuario.eachCell(c => Object.assign(c, estiloUsuario));

    // --- Compras del usuario ---
    if (grupo.compras.length) {
      hoja.addRow(['Compras']).getCell(1).style = estiloSubtitulo;
      const filaEnc = hoja.addRow(['Fecha', 'Producto', 'Precio (Bs.)', 'Descripción', 'Factura', 'Pago', 'Estado']);
      filaEnc.eachCell(c => Object.assign(c, estiloEncabezado));
      grupo.compras.forEach(c => hoja.addRow([
        fmtFecha(c.fecha), c.producto, Number(c.precio), c.descripcion || '',
        c.tiene_factura ? 'Sí' : 'No', c.tipo_pago === 'qr' ? 'QR' : 'Físico', c.devuelto ? 'Devuelto' : 'Activo',
      ]));
    }

    // --- Devoluciones del usuario ---
    if (grupo.devoluciones.length) {
      hoja.addRow(['Devoluciones']).getCell(1).style = estiloSubtitulo;
      const filaEnc = hoja.addRow(['Fecha', 'Producto devuelto', 'Precio (Bs.)', 'Motivo', 'Tipo de reembolso']);
      filaEnc.eachCell(c => Object.assign(c, estiloEncabezado));
      grupo.devoluciones.forEach(d => hoja.addRow([
        fmtFecha(d.fecha), d.producto, Number(d.precio), d.motivo,
        d.tipo_pago === 'transferencia' ? 'Transferencia bancaria' : 'Cobro físico',
      ]));
    }

    // --- Gastos de chofer registrados por el usuario ---
    if (grupo.gastosChofer.length) {
      hoja.addRow(['Gastos de chofer registrados']).getCell(1).style = estiloSubtitulo;
      const filaEnc = hoja.addRow(['Fecha', 'Chofer', 'Placa', 'Gasto', 'Monto (Bs.)', 'Descripción', 'Factura', 'Pagado']);
      filaEnc.eachCell(c => Object.assign(c, estiloEncabezado));
      grupo.gastosChofer.forEach(g => hoja.addRow([
        fmtFecha(g.fecha), g.chofer, g.placa, g.gasto, Number(g.monto), g.descripcion || '',
        g.tiene_factura ? 'Sí' : 'No', g.pagado ? 'Sí' : 'No',
      ]));
    }

    hoja.addRow([]); // separador entre usuarios
  }

  // ---- Hoja 2: Compras (todas juntas, para filtrar/ordenar libremente) ----
  const hojaCompras = wb.addWorksheet('Compras');
  hojaCompras.columns = [
    { header: 'ID', key: 'id', width: 8 }, { header: 'Fecha', key: 'fecha', width: 18 },
    { header: 'Usuario', key: 'usuario', width: 20 }, { header: 'Producto', key: 'producto', width: 28 },
    { header: 'Precio (Bs.)', key: 'precio', width: 14 }, { header: 'Descripción', key: 'descripcion', width: 30 },
    { header: 'Con factura', key: 'tiene_factura', width: 12 }, { header: 'Tipo de pago', key: 'tipo_pago', width: 14 },
    { header: 'Devuelto', key: 'devuelto', width: 12 },
  ];
  hojaCompras.getRow(1).eachCell(c => Object.assign(c, estiloEncabezado));
  compras.forEach(c => hojaCompras.addRow({
    id: c.id, fecha: fmtFecha(c.fecha), usuario: c.usuario, producto: c.producto, precio: Number(c.precio),
    descripcion: c.descripcion || '', tiene_factura: c.tiene_factura ? 'Sí' : 'No',
    tipo_pago: c.tipo_pago === 'qr' ? 'QR' : 'Físico', devuelto: c.devuelto ? 'Sí' : 'No',
  }));

  // ---- Hoja 3: Devoluciones ----
  const hojaDev = wb.addWorksheet('Devoluciones');
  hojaDev.columns = [
    { header: 'ID', key: 'id', width: 8 }, { header: 'Fecha', key: 'fecha', width: 18 },
    { header: 'Usuario', key: 'usuario', width: 20 }, { header: 'Producto devuelto', key: 'producto', width: 28 },
    { header: 'Precio (Bs.)', key: 'precio', width: 14 }, { header: 'Motivo', key: 'motivo', width: 30 },
    { header: 'Tipo de reembolso', key: 'tipo_pago', width: 18 },
  ];
  hojaDev.getRow(1).eachCell(c => Object.assign(c, estiloEncabezado));
  devoluciones.forEach(d => hojaDev.addRow({
    id: d.id, fecha: fmtFecha(d.fecha), usuario: d.usuario, producto: d.producto, precio: Number(d.precio),
    motivo: d.motivo, tipo_pago: d.tipo_pago === 'transferencia' ? 'Transferencia bancaria' : 'Cobro físico',
  }));

  // ---- Hoja 4: Gastos de chofer ----
  const hojaGastos = wb.addWorksheet('Gastos de chofer');
  hojaGastos.columns = [
    { header: 'ID', key: 'id', width: 8 }, { header: 'Fecha', key: 'fecha', width: 18 },
    { header: 'Registrado por', key: 'usuario', width: 20 }, { header: 'Chofer', key: 'chofer', width: 20 },
    { header: 'Placa', key: 'placa', width: 12 }, { header: 'Gasto', key: 'gasto', width: 22 },
    { header: 'Monto (Bs.)', key: 'monto', width: 14 }, { header: 'Descripción', key: 'descripcion', width: 28 },
    { header: 'Con factura', key: 'tiene_factura', width: 12 }, { header: 'Pagado', key: 'pagado', width: 10 },
    { header: 'Tipo de pago', key: 'tipo_pago', width: 14 },
  ];
  hojaGastos.getRow(1).eachCell(c => Object.assign(c, estiloEncabezado));
  gastosChofer.forEach(g => hojaGastos.addRow({
    id: g.id, fecha: fmtFecha(g.fecha), usuario: g.usuario, chofer: g.chofer, placa: g.placa, gasto: g.gasto,
    monto: Number(g.monto), descripcion: g.descripcion || '', tiene_factura: g.tiene_factura ? 'Sí' : 'No',
    pagado: g.pagado ? 'Sí' : 'No', tipo_pago: g.tipo_pago === 'qr' ? 'QR' : g.tipo_pago === 'fisico' ? 'Físico' : '—',
  }));

  const buffer = await wb.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombreArchivo}.xlsx"`,
    },
  });
}