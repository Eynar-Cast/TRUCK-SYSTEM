/**
 * sembrar-datos-demo.js — Datos de ejemplo de la empresa:
 * Flota de tractocamiones Volvo FH con unidades tipo chata y sider,
 * pólizas en distintos estados y conductores completos.
 *
 * Idempotente: si los datos ya existen, no se duplican.
 * Uso: node scripts/sembrar-datos-demo.js
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

function cargarEnvLocal() {
  if (process.env.DATABASE_URL) return;
  const ruta = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(ruta)) return;
  for (const linea of fs.readFileSync(ruta, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/);
    if (m) { process.env.DATABASE_URL = m[1].trim().replace(/^["']|["']$/g, ''); return; }
  }
}

async function main() {
  cargarEnvLocal();
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: /sslmode=require/.test(process.env.DATABASE_URL || '') ? { rejectUnauthorized: false } : false,
  });

  const q = (t, p) => pool.query(t, p);

  // ---------- CATÁLOGOS ----------
  const catalogos = [
    ['tipo_vehiculo', 'Tractocamión'],
    ['tipo_vehiculo', 'Chata'],
    ['tipo_vehiculo', 'Sider'],
    ['marca', 'Volvo'],
    ['modelo', 'FH 420'],
    ['modelo', 'FH 440'],
    ['modelo', 'FH 460'],
    ['modelo', 'FH 500'],
    ['modelo', 'FH 540'],
  ];
  for (const [tipo, valor] of catalogos) {
    await q(
      `INSERT INTO catalogos (tipo, valor) VALUES ($1,$2)
       ON CONFLICT (tipo, valor) DO UPDATE SET activo = TRUE`,
      [tipo, valor]
    );
  }
  console.log('Catálogos listos (Tractocamión/Chata/Sider, Volvo, modelos FH).');

  // ---------- FLOTA ----------
  const vehiculos = [
    // placa, tipo, modelo, serie, color, anio, carga_kg, ciclo_km, odometro_inicial
    ['1250-FRH', 'Tractocamión', 'FH 460', 'YS2R4X20005812345', 'Blanco', 2020, 38000, 15000, 0],
    ['2380-KLM', 'Tractocamión', 'FH 500', 'YS2RT40012398765', 'Rojo',   2022, 40000, 15000, 0],
    ['3415-PQR', 'Tractocamión', 'FH 540', 'YS2K7X10004567889', 'Azul',   2023, 42000, 20000, 0],
    ['4520-STU', 'Tractocamión', 'FH 440', 'YS2P5D20009876543', 'Gris',   2019, 37000, 15000, 0],
    ['5678-VWX', 'Chata',        'FH 420', 'YS2A4B30001122334', 'Blanco', 2018, 30000, 12000, 25000],
    ['6734-YZA', 'Chata',        'FH 460', 'YS2B6C40005566778', 'Plata',  2021, 32000, 12000, 0],
    ['7891-ZBC', 'Sider',        'FH 500', 'YS2C7D50009988776', 'Verde',  2022, 34000, 18000, 0],
    ['8945-DEF', 'Sider',        'FH 460', 'YS2D8E60003344556', 'Blanco', 2020, 33000, 18000, 40000],
  ];
  let nuevosVeh = 0;
  for (const [placa, tipo, modelo, serie, color, anio, carga, ciclo, odIni] of vehiculos) {
    const r = await q(
      `INSERT INTO flota (tipo, marca, modelo, placa, numero_serie, color, anio, carga_maxima_kg,
                          ciclo_mantenimiento_km, odometro_inicial)
       VALUES ($2, 'Volvo', $3, $1, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (placa) DO NOTHING`,
      [placa, tipo, modelo, serie, color, anio, carga, ciclo, odIni]
    );
    if (r.rowCount > 0) nuevosVeh++;
  }
  console.log(`Flota: ${nuevosVeh} vehículo(s) nuevo(s), ${vehiculos.length} en total.`);

  // ---------- SEGUROS ----------
  // Estados relativos a HOY para que las alertas siempre se vean:
  //  vencido = pasado · proximo = dentro de 30 días · vigente = lejos
  const seguros = [
    // placa, aseguradora, poliza, inicio(días atrás), vence(en días desde hoy), importe, pago(días atrás)
    // NOTA: el "seguro actual" de un vehículo es su ÚLTIMO registro (igual que en Excel),
    // por eso la póliza vigente se lista DESPUÉS de la anterior vencida.
    ['1250-FRH', 'Soboce',           'POL-SOB-2025-1187', 585, -178, 1380, 583], // anterior, vencida
    ['1250-FRH', 'Seguros Alianza',  'POL-ALZ-2026-0441', 210, 220, 1450, 208], // ACTUAL, vigente
    ['2380-KLM', 'Seguros Bisa',     'POL-BIS-2025-0932', 400, -25, 1520, 398],  // VENCIDO -> alerta
    ['3415-PQR', 'Bolívar Seguros',  'POL-BOL-2026-0210', 120, 365, 1680, 118],  // vigente
    ['5678-VWX', 'Soboce',           'POL-SOB-2026-0755', 300, 18,  1210, 298],  // PRÓXIMO a vencer
    ['6734-YZA', 'Seguros Alianza',  'POL-ALZ-2026-0688', 260, 27,  1290, 258],  // PRÓXIMO a vencer
    ['7891-ZBC', 'Seguros Bisa',     'POL-BIS-2026-0512', 180, 150, 1475, 178],  // vigente
    ['8945-DEF', 'Credicoop Seguros','POL-CRE-2026-0099', 95,  90,  1350, 93],   // vigente
    // 4520-STU se deja SIN seguro para mostrar el caso "Disponible sin póliza"
  ];
  let nuevosSeg = 0;
  for (const [placa, aseguradora, poliza, diasAtrasInicio, venceEn, importe, pagoAtras] of seguros) {
    const dup = await q('SELECT 1 FROM seguros WHERE poliza = $1 AND placa = $2', [poliza, placa]);
    if (dup.rowCount > 0) continue;
    await q(
      `INSERT INTO seguros (placa, aseguradora, poliza, fecha_inicio, fecha_vencimiento, importe_pagado, fecha_pago)
       VALUES ($1,$2,$3,
               (now() AT TIME ZONE 'America/La_Paz')::date - ($4 || ' days')::interval,
               (now() AT TIME ZONE 'America/La_Paz')::date + ($5 || ' days')::interval,
               $6,
               (now() AT TIME ZONE 'America/La_Paz')::date - ($7 || ' days')::interval)`,
      [placa, aseguradora, poliza, String(diasAtrasInicio), String(venceEn), importe, String(pagoAtras)]
    );
    nuevosSeg++;
  }
  console.log(`Seguros: ${nuevosSeg} póliza(s) nueva(s), ${seguros.length} en total.`);

  // ---------- CONDUCTORES ----------
  const conductores = [
    // nombre, placa_asignada, documento, licencia, telefono, direccion, calificacion
    ['Carlos Mamani Quispe',    '1250-FRH', '4872156', 'LIC-789456', '70012345', 'Av. Juan Pablo II 455, El Alto',      5],
    ['Roberto Flores Condori',  '2380-KLM', '3598741', 'LIC-654321', '70111222', 'Av. América 1200, Cochabamba',         4],
    ['Miguel Torres Vargas',    '3415-PQR', '6612453', 'LIC-998877', '70033445', 'Barrio Los Lotes, Santa Cruz',         4],
    ['Pedro Quispe Silva',      '5678-VWX', '2145879', 'LIC-554433', '70055667', 'Zona Sur, Oruro',                      3],
    ['Luis Fernando Rojas',     '7891-ZBC', '5932174', 'LIC-443322', '70077889', 'Villa Fátima, La Paz',              null],
  ];
  const idsChoferes = {};
  let nuevosCho = 0;
  for (const [nombre, placa, documento, licencia, telefono, direccion, calificacion] of conductores) {
    const existe = await q('SELECT id FROM choferes WHERE nombre = $1', [nombre]);
    if (existe.rowCount > 0) { idsChoferes[nombre] = existe.rows[0].id; continue; }
    const r = await q(
      `INSERT INTO choferes (nombre, placa, documento, licencia, telefono, direccion, calificacion)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [nombre, placa, documento, licencia, telefono, direccion, calificacion]
    );
    idsChoferes[nombre] = r.rows[0].id;
    nuevosCho++;
  }
  console.log(`Conductores: ${nuevosCho} nuevo(s), ${conductores.length} en total.`);

  // ---------- REFERENCIAS FAMILIARES ----------
  const referencias = [
    ['Carlos Mamani Quispe',   'María Mamani Rojas',  'Esposa',    '70098765'],
    ['Carlos Mamani Quispe',   'Jorge Mamani Quispe', 'Hermano',   '70087654'],
    ['Roberto Flores Condori', 'Rosa Condori',        'Madre',     '70122334'],
    ['Pedro Quispe Silva',     'Ana Silva Vásquez',   'Esposa',    '70066554'],
  ];
  let nuevasRef = 0;
  for (const [chofer, nombre, parentesco, telefono] of referencias) {
    const id = idsChoferes[chofer];
    const dup = await q(
      'SELECT 1 FROM conductor_referencias WHERE chofer_id = $1 AND nombre = $2',
      [id, nombre]
    );
    if (dup.rowCount > 0) continue;
    await q(
      'INSERT INTO conductor_referencias (chofer_id, nombre, parentesco, telefono) VALUES ($1,$2,$3,$4)',
      [id, nombre, parentesco, telefono]
    );
    nuevasRef++;
  }
  console.log(`Referencias familiares: ${nuevasRef} nueva(s).`);

  // ---------- SEGURO INDIVIDUAL ----------
  const segurosIndividuales = [
    // chofer, inicio (días atrás), expira (días desde hoy; negativo = vencido)
    ['Carlos Mamani Quispe',   200, 200],
    ['Roberto Flores Condori', 400, -30],  // anterior, vencido (historial)
    ['Roberto Flores Condori', 30,  180],
    ['Miguel Torres Vargas',   340, 20],   // próximo a vencer
  ];
  let nuevosSegInd = 0;
  for (const [chofer, atras, expiraEn] of segurosIndividuales) {
    const id = idsChoferes[chofer];
    const dup = await q(
      `SELECT 1 FROM conductor_seguros
       WHERE chofer_id = $1
         AND fecha_inicio = (now() AT TIME ZONE 'America/La_Paz')::date - ($2 || ' days')::interval
         AND fecha_expiracion = (now() AT TIME ZONE 'America/La_Paz')::date + ($3 || ' days')::interval`,
      [id, String(atras), String(expiraEn)]
    );
    if (dup.rowCount > 0) continue;
    await q(
      `INSERT INTO conductor_seguros (chofer_id, fecha_inicio, fecha_expiracion)
       VALUES ($1,
               (now() AT TIME ZONE 'America/La_Paz')::date - ($2 || ' days')::interval,
               (now() AT TIME ZONE 'America/La_Paz')::date + ($3 || ' days')::interval)`,
      [id, String(atras), String(expiraEn)]
    );
    nuevosSegInd++;
  }
  console.log(`Seguro individual: ${nuevosSegInd} registro(s) nuevo(s).`);

  // ---------- CONTROL DE LLANTAS (ciclo programado cada 3 meses) ----------
  const llantas = [
    // placa, tracto, chata, marca, cambio(días atrás), próximo(días desde hoy), observación
    ['1250-FRH', 10, 12, 'Michelin XZE',    80, 10, 'Cambio completo de juego del tracto'],
    ['1250-FRH', 6,  null, 'Michelin XZE',   20, null, 'Cambio de eje delantero'],
    ['2380-KLM', 10, 12, 'Bridgestone R249', 200, -10, 'Próximo cambio vencido'],
    ['3415-PQR', 10, 12, 'Michelin X Multi', 45, 45, null],
    ['5678-VWX', 6,  8,  'Pirelli FG85',     150, 40, null],
  ];
  let nuevasLl = 0;
  const idsFlota = Object.fromEntries((await q('SELECT id, placa FROM flota')).rows.map(r => [r.placa, r.id]));
  for (const [placa, tracto, chata, marca, atras, proxEn, obs] of llantas) {
    const dup = await q(
      `SELECT 1 FROM llantas WHERE flota_id=$1 AND marca=$2
         AND fecha_cambio = (now() AT TIME ZONE 'America/La_Paz')::date - ($3 || ' days')::interval`,
      [idsFlota[placa], marca, String(atras)]
    );
    if (dup.rowCount > 0) continue;
    await q(
      `INSERT INTO llantas (flota_id, llantas_tracto, llantas_chata, marca,
                            fecha_cambio,
                            proxima_fecha,
                            observacion)
       VALUES ($1,$2,$3,$4,
               (now() AT TIME ZONE 'America/La_Paz')::date - ($5 || ' days')::interval,
               CASE WHEN $6::text IS NULL THEN NULL
                    ELSE (now() AT TIME ZONE 'America/La_Paz')::date + ($6 || ' days')::interval END,
               $7)`,
      [idsFlota[placa], tracto, chata, marca, String(atras), proxEn === null ? null : String(proxEn), obs]
    );
    nuevasLl++;
  }
  console.log(`Llantas: ${nuevasLl} registro(s) nuevo(s).`);

  // ---------- CONTROL DE ACEITES ----------
  const aceites = [
    // placa, tipo, marca, último cambio(días atrás), próximo(días desde hoy)
    ['1250-FRH', 'motor',  'Mobil Delvac XLE', 100, 20],
    ['1250-FRH', 'caja',   'Shell Spirax',     160, 80],
    ['1250-FRH', 'corona', 'Castrol Axle',     250, -15],
    ['2380-KLM', 'motor',  'Mobil Delvac 1',   60, 60],
    ['2380-KLM', 'corona', 'Castrol Axle',     300, 30],
    ['3415-PQR', 'motor',  'Volvo VDS-4.5',    30, 90],
    ['5678-VWX', 'motor',  'Shell Rimula R4',  140, -5],
  ];
  let nuevosAce = 0;
  for (const [placa, tipo, marca, atras, proxEn] of aceites) {
    const dup = await q(
      `SELECT 1 FROM aceites WHERE flota_id=$1 AND tipo=$2
         AND fecha_ultimo_cambio = (now() AT TIME ZONE 'America/La_Paz')::date - ($3 || ' days')::interval`,
      [idsFlota[placa], tipo, String(atras)]
    );
    if (dup.rowCount > 0) continue;
    await q(
      `INSERT INTO aceites (flota_id, tipo, marca, fecha_ultimo_cambio, proxima_fecha)
       VALUES ($1,$2,$3,
               (now() AT TIME ZONE 'America/La_Paz')::date - ($4 || ' days')::interval,
               (now() AT TIME ZONE 'America/La_Paz')::date + ($5 || ' days')::interval)`,
      [idsFlota[placa], tipo, marca, String(atras), String(proxEn)]
    );
    nuevosAce++;
  }
  console.log(`Aceites: ${nuevosAce} registro(s) nuevo(s).`);

  // ---------- SEGURO DE CARGA ----------
  const segurosCarga = [
    // placa, póliza, trámite(días atrás), inicio(días atrás), expira(días desde hoy)
    ['1250-FRH', 'CARGA-ALZ-2026-0331', 205, 200, 220],
    ['2380-KLM', 'CARGA-BIS-2025-0777', 395, 390, -20],
    ['7891-ZBC', 'CARGA-BIS-2026-0512', 175, 170, 145],
  ];
  let nuevosSc = 0;
  for (const [placa, poliza, tramAtras, iniAtras, expEn] of segurosCarga) {
    const dup = await q('SELECT 1 FROM seguros_carga WHERE poliza = $1 AND flota_id = $2', [poliza, idsFlota[placa]]);
    if (dup.rowCount > 0) continue;
    await q(
      `INSERT INTO seguros_carga (flota_id, poliza, fecha_tramite, fecha_inicio, fecha_expiracion)
       VALUES ($1,$2,
               (now() AT TIME ZONE 'America/La_Paz')::date - ($3 || ' days')::interval,
               (now() AT TIME ZONE 'America/La_Paz')::date - ($4 || ' days')::interval,
               (now() AT TIME ZONE 'America/La_Paz')::date + ($5 || ' days')::interval)`,
      [idsFlota[placa], poliza, String(tramAtras), String(iniAtras), String(expEn)]
    );
    nuevosSc++;
  }
  console.log(`Seguros de carga: ${nuevosSc} póliza(s) nueva(s).`);

  // ---------- MULTAS ----------
  const multas = [
    // chofer, hace(días), motivo, monto, observaciones
    ['Roberto Flores Condori', 40, 'Exceso de velocidad en carretera', 400, 'Control policial km 42 La Paz–Oruro'],
    ['Pedro Quispe Silva',     15, 'Documentación del vehículo vencida', null, 'Sin multa económica, solo observación'],
    ['Carlos Mamani Quispe',    5, 'Estacionamiento en zona prohibida',  150, null],
  ];
  let nuevasMul = 0;
  for (const [chofer, atras, motivo, monto, obs] of multas) {
    const id = idsChoferes[chofer];
    const dup = await q(
      `SELECT 1 FROM multas WHERE chofer_id=$1 AND motivo=$2
         AND fecha = (now() AT TIME ZONE 'America/La_Paz')::date - ($3 || ' days')::interval`,
      [id, motivo, String(atras)]
    );
    if (dup.rowCount > 0) continue;
    await q(
      `INSERT INTO multas (chofer_id, fecha, motivo, monto, observaciones)
       VALUES ($1, (now() AT TIME ZONE 'America/La_Paz')::date - ($3 || ' days')::interval, $2, $4, $5)`,
      [id, motivo, String(atras), monto, obs]
    );
    nuevasMul++;
  }
  console.log(`Multas: ${nuevasMul} registro(s) nuevo(s).`);

  // ---------- DOCUMENTACIÓN DE CONDUCTORES ----------
  const docs = [
    // chofer, tipo
    ['Carlos Mamani Quispe', 'luz'],
    ['Carlos Mamani Quispe', 'agua'],
    ['Carlos Mamani Quispe', 'croquis'],
    ['Roberto Flores Condori', 'luz'],
    ['Miguel Torres Vargas', 'croquis'],
  ];
  let nuevosDocs = 0;
  for (const [chofer, tipo] of docs) {
    const id = idsChoferes[chofer];
    const dup = await q('SELECT 1 FROM conductor_documentos WHERE chofer_id = $1 AND tipo = $2', [id, tipo]);
    if (dup.rowCount > 0) continue;
    await q('INSERT INTO conductor_documentos (chofer_id, tipo) VALUES ($1,$2)', [id, tipo]);
    nuevosDocs++;
  }
  console.log(`Documentación: ${nuevosDocs} registro(s) nuevo(s).`);

  // ---------- OPERADOR LOGÍSTICO y CONDUCTOR DESIGNADO ----------
  // Solo completa valores vacíos: no sobrescribe ediciones del usuario.
  const operadores = {
    '1250-FRH': 'Transportes Andina SRL',
    '2380-KLM': 'Logística Boliviana SA',
    '3415-PQR': 'Transportes Andina SRL',
    '5678-VWX': 'Carga Pesada Ltda.',
    '6734-YZA': 'Logística Boliviana SA',
    '7891-ZBC': 'Transportes Andina SRL',
    '8945-DEF': 'Carga Pesada Ltda.',
  };
  const conductorPorPlaca = {};
  for (const [nombre, placa] of conductores.map(([n, p]) => [n, p])) {
    conductorPorPlaca[placa] = idsChoferes[nombre];
  }
  let asignados = 0;
  for (const [placa, operador] of Object.entries(operadores)) {
    const r = await q(
      `UPDATE flota SET
         operador_logistico = COALESCE(operador_logistico, $2),
         chofer_id = COALESCE(chofer_id, $3)
       WHERE placa = $1 AND id = ANY($4::int[])`,
      [placa, operador, conductorPorPlaca[placa] ?? null, [idsFlota[placa]]]
    );
    asignados += r.rowCount;
  }
  console.log(`Operadores/conductores designados: ${asignados} vehículo(s).`);

  await pool.end();
  console.log('\nDatos de demostración sembrados correctamente.');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
