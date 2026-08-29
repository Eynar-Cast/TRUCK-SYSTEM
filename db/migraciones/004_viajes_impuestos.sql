-- ============================================================
-- Migración 004 — Viajes básicos + Impuestos por camión
-- Lo más básico posible, todo manual por teclado.
-- Viajes: si fecha_llegada es NULL o futura → camión En ruta / No disponible
-- Impuestos: deudas por camión con pagado true/false
-- Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS viajes (
  id              SERIAL PRIMARY KEY,
  placa           TEXT NOT NULL,
  flota_id        INTEGER REFERENCES flota(id) ON DELETE SET NULL,
  tipo            TEXT,
  chofer_id       INTEGER REFERENCES choferes(id) ON DELETE SET NULL,
  chofer_nombre   TEXT,
  tramo           TEXT,
  fecha_carga     DATE,
  producto        TEXT,
  cantidad_palets INTEGER CHECK (cantidad_palets IS NULL OR cantidad_palets >= 0),
  fecha_entrada   DATE,
  fecha_llegada   DATE,
  planilla        TEXT,
  codigo_carga    TEXT,
  observaciones   TEXT,
  creado          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_viajes_placa ON viajes(placa);
CREATE INDEX IF NOT EXISTS idx_viajes_flota ON viajes(flota_id);
CREATE INDEX IF NOT EXISTS idx_viajes_chofer ON viajes(chofer_id);
CREATE INDEX IF NOT EXISTS idx_viajes_fecha_carga ON viajes(fecha_carga);

CREATE TABLE IF NOT EXISTS impuestos (
  id              SERIAL PRIMARY KEY,
  flota_id        INTEGER REFERENCES flota(id) ON DELETE SET NULL,
  placa           TEXT NOT NULL,
  concepto        TEXT,
  monto           NUMERIC(12,2) CHECK (monto IS NULL OR monto >= 0),
  fecha_registro  DATE NOT NULL DEFAULT CURRENT_DATE,
  pagado          BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_pago      DATE,
  observaciones   TEXT,
  creado          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_impuestos_flota ON impuestos(flota_id);
CREATE INDEX IF NOT EXISTS idx_impuestos_placa ON impuestos(placa);
CREATE INDEX IF NOT EXISTS idx_impuestos_pagado ON impuestos(pagado);
