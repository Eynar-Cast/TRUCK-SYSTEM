-- ============================================================
-- Migración 001 — Fase Flota / Seguros / Conductores
-- Fuente: hojas "Flota", "Seguros" y "Conductores" del Excel de
-- Control de Flota Vehicular (alcance aprobado: SOLO estas tres).
--
-- Notas:
-- - El estado del seguro NO se almacena: se deriva de la fecha de
--   vencimiento comparada con HOY (zona America/La_Paz) en cada consulta.
-- - El estado del vehículo tampoco se almacena: se deriva del seguro
--   más reciente asociado por PLACA (la relación principal es la placa,
--   igual que en Excel; flota.placa es UNIQUE para poder referenciarla).
-- - El control preventivo guarda solo los campos que introduce el
--   usuario (ciclo y odómetro inicial). Los valores derivados
--   (odómetro preventivo, odómetro actual, km restantes y estado)
--   dependen de los módulos Rutas/Mantenimiento que aún no existen,
--   por lo que se calculan en lib/flota.js y hoy quedan "pendientes".
-- - El script es idempotente: puede ejecutarse varias veces.
-- ============================================================

-- ---- CATÁLOGOS (tipos de vehículo, marcas, modelos) ----
CREATE TABLE IF NOT EXISTS catalogos (
  id     SERIAL PRIMARY KEY,
  tipo   TEXT NOT NULL CHECK (tipo IN ('tipo_vehiculo','marca','modelo')),
  valor  TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_catalogos_tipo_valor UNIQUE (tipo, valor)
);

-- ---- FLOTA (vehículos) ----
CREATE TABLE IF NOT EXISTS flota (
  id                     SERIAL PRIMARY KEY,
  tipo                   TEXT NOT NULL,
  marca                  TEXT NOT NULL,
  modelo                 TEXT NOT NULL,
  placa                  TEXT NOT NULL UNIQUE,
  numero_serie           TEXT,
  color                  TEXT,
  anio                   INTEGER CHECK (anio IS NULL OR anio BETWEEN 1950 AND 2100),
  carga_maxima_kg        NUMERIC(10,2) CHECK (carga_maxima_kg IS NULL OR carga_maxima_kg >= 0),
  -- Control preventivo: datos introducidos por el usuario
  ciclo_mantenimiento_km INTEGER CHECK (ciclo_mantenimiento_km IS NULL OR ciclo_mantenimiento_km > 0),
  odometro_inicial       INTEGER CHECK (odometro_inicial IS NULL OR odometro_inicial >= 0),
  -- Los derivados (odómetro preventivo/actual, faltante, estado) no se
  -- almacenan: se calculan automáticamente al consultar.
  activo                 BOOLEAN NOT NULL DEFAULT TRUE,
  creado                 TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_flota_placa ON flota(placa);
CREATE INDEX IF NOT EXISTS idx_flota_marca ON flota(marca);
CREATE INDEX IF NOT EXISTS idx_flota_modelo ON flota(modelo);

-- ---- SEGUROS (relacionados al vehículo mediante PLACA) ----
CREATE TABLE IF NOT EXISTS seguros (
  id                SERIAL PRIMARY KEY,
  placa             TEXT NOT NULL REFERENCES flota(placa) ON UPDATE CASCADE ON DELETE RESTRICT,
  aseguradora       TEXT NOT NULL,
  poliza            TEXT NOT NULL,
  fecha_inicio      DATE,
  fecha_vencimiento DATE,
  importe_pagado    NUMERIC(12,2) CHECK (importe_pagado IS NULL OR importe_pagado >= 0),
  fecha_pago        DATE,
  -- Estado de la póliza: derivado (Vigente/Vencido), nunca manual
  activo            BOOLEAN NOT NULL DEFAULT TRUE,
  creado            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_seguros_placa ON seguros(placa);
CREATE INDEX IF NOT EXISTS idx_seguros_vencimiento ON seguros(fecha_vencimiento);

-- ---- CONDUCTORES: ampliación de la tabla existente ----
ALTER TABLE choferes ADD COLUMN IF NOT EXISTS documento    TEXT;
ALTER TABLE choferes ADD COLUMN IF NOT EXISTS licencia     TEXT;
ALTER TABLE choferes ADD COLUMN IF NOT EXISTS calificacion SMALLINT CHECK (calificacion IS NULL OR calificacion BETWEEN 1 AND 5);

-- ---- REFERENCIAS FAMILIARES del conductor ----
CREATE TABLE IF NOT EXISTS conductor_referencias (
  id         SERIAL PRIMARY KEY,
  chofer_id  INTEGER NOT NULL REFERENCES choferes(id) ON DELETE CASCADE,
  nombre     TEXT NOT NULL,
  parentesco TEXT,
  telefono   TEXT,
  creado     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cond_ref_chofer ON conductor_referencias(chofer_id);

-- ---- SEGURO INDIVIDUAL del conductor (historial = varios registros) ----
-- El estado (Vigente/Vencido) se deriva de fecha_expiracion vs HOY.
CREATE TABLE IF NOT EXISTS conductor_seguros (
  id                SERIAL PRIMARY KEY,
  chofer_id         INTEGER NOT NULL REFERENCES choferes(id) ON DELETE CASCADE,
  fecha_inicio      DATE,
  fecha_expiracion  DATE,
  creado            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cond_seg_chofer ON conductor_seguros(chofer_id);

-- ---- Semillas de catálogos (solo listas base; editables desde /catalogos) ----
INSERT INTO catalogos (tipo, valor) VALUES
  ('tipo_vehiculo', 'Camión'),
  ('tipo_vehiculo', 'Tractocamión'),
  ('tipo_vehiculo', 'Camioneta'),
  ('tipo_vehiculo', 'Volqueta'),
  ('tipo_vehiculo', 'Furgón'),
  ('marca', 'Hino'),
  ('marca', 'Toyota'),
  ('marca', 'Mitsubishi Fuso'),
  ('marca', 'Mercedes-Benz'),
  ('marca', 'Scania'),
  ('marca', 'Volvo'),
  ('marca', 'Ford'),
  ('marca', 'Chevrolet'),
  ('marca', 'Foton'),
  ('marca', 'JAC'),
  ('marca', 'Sinotruk')
ON CONFLICT (tipo, valor) DO NOTHING;
