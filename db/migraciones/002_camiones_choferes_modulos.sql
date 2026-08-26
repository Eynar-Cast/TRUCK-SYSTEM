-- ============================================================
-- Migración 002 — Módulos Camiones (llantas, aceites, seguro de
-- carga), designación de conductor/operador y Chóferes
-- (documentación + multas).
--
-- Idempotente.
-- ============================================================

-- ---- FLOTA: operador logístico y conductor designado ----
ALTER TABLE flota ADD COLUMN IF NOT EXISTS operador_logistico TEXT;
ALTER TABLE flota ADD COLUMN IF NOT EXISTS chofer_id INTEGER REFERENCES choferes(id) ON DELETE SET NULL;

-- ---- CONTROL DE LLANTAS (historial por vehículo; ciclo 3 meses) ----
CREATE TABLE IF NOT EXISTS llantas (
  id             SERIAL PRIMARY KEY,
  flota_id       INTEGER NOT NULL REFERENCES flota(id) ON DELETE CASCADE,
  llantas_tracto INTEGER CHECK (llantas_tracto IS NULL OR llantas_tracto >= 0),
  llantas_chata  INTEGER CHECK (llantas_chata IS NULL OR llantas_chata >= 0),
  marca          TEXT,
  fecha_cambio   DATE,
  proxima_fecha  DATE,
  observacion    TEXT,
  creado         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_llantas_flota ON llantas(flota_id);

-- ---- CONTROL DE ACEITES (motor / caja / corona; historial por vehículo) ----
CREATE TABLE IF NOT EXISTS aceites (
  id                  SERIAL PRIMARY KEY,
  flota_id            INTEGER NOT NULL REFERENCES flota(id) ON DELETE CASCADE,
  tipo                TEXT NOT NULL CHECK (tipo IN ('motor','caja','corona')),
  marca               TEXT,
  fecha_ultimo_cambio DATE,
  proxima_fecha       DATE,
  observacion         TEXT,
  creado              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aceites_flota ON aceites(flota_id);

-- ---- SEGURO DE CARGA del camión (independiente del seguro del vehículo) ----
CREATE TABLE IF NOT EXISTS seguros_carga (
  id                SERIAL PRIMARY KEY,
  flota_id          INTEGER NOT NULL REFERENCES flota(id) ON DELETE CASCADE,
  poliza            TEXT NOT NULL,
  fecha_tramite     DATE,
  fecha_inicio      DATE,
  fecha_expiracion  DATE,
  activo            BOOLEAN NOT NULL DEFAULT TRUE,
  creado            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_seguros_carga_flota ON seguros_carga(flota_id);

-- ---- MULTAS del conductor ----
CREATE TABLE IF NOT EXISTS multas (
  id            SERIAL PRIMARY KEY,
  chofer_id     INTEGER NOT NULL REFERENCES choferes(id) ON DELETE CASCADE,
  fecha         DATE NOT NULL,
  motivo        TEXT NOT NULL,
  monto         NUMERIC(10,2) CHECK (monto IS NULL OR monto >= 0),
  observaciones TEXT,
  creado        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_multas_chofer ON multas(chofer_id);

-- ---- DOCUMENTACIÓN del conductor (luz, agua, croquis, adjuntos) ----
CREATE TABLE IF NOT EXISTS conductor_documentos (
  id          SERIAL PRIMARY KEY,
  chofer_id   INTEGER NOT NULL REFERENCES choferes(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL CHECK (tipo IN ('luz','agua','croquis','adjunto')),
  archivo     TEXT,
  observacion TEXT,
  creado      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cond_doc_chofer ON conductor_documentos(chofer_id);
