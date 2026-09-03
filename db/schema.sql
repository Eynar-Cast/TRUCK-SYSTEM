-- ============================================================
-- GestorCompras — Esquema Postgres (IDs auto-incrementales)
-- ============================================================

-- ---- USUARIOS ----
CREATE TABLE usuarios (
  id            SERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nombre        TEXT NOT NULL,
  cargo         TEXT,
   role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin','secretaria')),
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  creado        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- COMPRAS ----
CREATE TABLE compras (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  producto       TEXT NOT NULL,
  precio         NUMERIC(10,2) NOT NULL CHECK (precio > 0),
  descripcion    TEXT,
  tiene_factura  BOOLEAN NOT NULL DEFAULT FALSE,
  foto_factura   TEXT,
  tipo_pago      TEXT NOT NULL CHECK (tipo_pago IN ('fisico','qr')),
  foto_qr        TEXT,
  devuelto       BOOLEAN NOT NULL DEFAULT FALSE,
  fecha          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_compras_user_fecha ON compras(user_id, fecha DESC);
CREATE INDEX idx_compras_fecha ON compras(fecha DESC);

-- ---- DEVOLUCIONES (relacionada 1:1 con una compra) ----
CREATE TABLE devoluciones (
  id           SERIAL PRIMARY KEY,
  compra_id    INTEGER NOT NULL UNIQUE REFERENCES compras(id) ON DELETE CASCADE,
  motivo       TEXT NOT NULL,
  tipo_pago    TEXT NOT NULL CHECK (tipo_pago IN ('fisico','transferencia')),
  comprobante  TEXT,
  fecha        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- CHOFERES / CONDUCTORES ----
CREATE TABLE choferes (
  id           SERIAL PRIMARY KEY,
  nombre       TEXT NOT NULL,
  placa        TEXT NOT NULL,
  telefono     TEXT,
  direccion    TEXT,
  -- Fase Flota/Conductores: hoja Excel "Conductores"
  documento    TEXT,
  licencia     TEXT,
  calificacion SMALLINT CHECK (calificacion IS NULL OR calificacion BETWEEN 1 AND 5),
  activo       BOOLEAN NOT NULL DEFAULT TRUE,
  creado       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- GASTOS DE CHOFER ----
CREATE TABLE gastos_chofer (
  id             SERIAL PRIMARY KEY,
  chofer_id      INTEGER NOT NULL REFERENCES choferes(id) ON DELETE RESTRICT,
  user_id        INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  nombre         TEXT NOT NULL,
  monto          NUMERIC(10,2) NOT NULL CHECK (monto > 0),
  descripcion    TEXT,
  tiene_factura  BOOLEAN NOT NULL DEFAULT FALSE,
  foto_factura   TEXT,
  pagado         BOOLEAN NOT NULL DEFAULT TRUE,
  tipo_pago      TEXT CHECK (tipo_pago IN ('fisico','qr')),
  foto_qr        TEXT,
  fecha          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_gastos_chofer_fecha ON gastos_chofer(chofer_id, fecha DESC);

-- ============================================================
-- Fase Flota / Seguros / Conductores (ver db/migraciones/)
-- ============================================================

-- ---- CATÁLOGOS (tipo_vehiculo | marca | modelo) ----
CREATE TABLE catalogos (
  id     SERIAL PRIMARY KEY,
  tipo   TEXT NOT NULL CHECK (tipo IN ('tipo_vehiculo','marca','modelo')),
  valor  TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_catalogos_tipo_valor UNIQUE (tipo, valor)
);

-- ---- FLOTA (vehículos) ----
-- Estado del vehículo y control preventivo: derivados en consulta
-- (lib/flota.js); nunca se almacenan.
CREATE TABLE flota (
  id                     SERIAL PRIMARY KEY,
  tipo                   TEXT NOT NULL,
  marca                  TEXT NOT NULL,
  modelo                 TEXT NOT NULL,
  placa                  TEXT NOT NULL UNIQUE,
  numero_serie           TEXT,
  color                  TEXT,
  anio                   INTEGER CHECK (anio IS NULL OR anio BETWEEN 1950 AND 2100),
  carga_maxima_kg        NUMERIC(10,2) CHECK (carga_maxima_kg IS NULL OR carga_maxima_kg >= 0),
  ciclo_mantenimiento_km INTEGER CHECK (ciclo_mantenimiento_km IS NULL OR ciclo_mantenimiento_km > 0),
  odometro_inicial       INTEGER CHECK (odometro_inicial IS NULL OR odometro_inicial >= 0),
  activo                 BOOLEAN NOT NULL DEFAULT TRUE,
  creado                 TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_flota_placa ON flota(placa);
CREATE INDEX idx_flota_marca ON flota(marca);
CREATE INDEX idx_flota_modelo ON flota(modelo);

-- ---- SEGUROS (relacionados al vehículo mediante PLACA) ----
-- Estado de la póliza: derivado de fecha_vencimiento vs HOY (Vigente/Vencido).
CREATE TABLE seguros (
  id                SERIAL PRIMARY KEY,
  placa             TEXT NOT NULL REFERENCES flota(placa) ON UPDATE CASCADE ON DELETE RESTRICT,
  aseguradora       TEXT NOT NULL,
  poliza            TEXT NOT NULL,
  fecha_inicio      DATE,
  fecha_vencimiento DATE,
  importe_pagado    NUMERIC(12,2) CHECK (importe_pagado IS NULL OR importe_pagado >= 0),
  fecha_pago        DATE,
  activo            BOOLEAN NOT NULL DEFAULT TRUE,
  creado            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_seguros_placa ON seguros(placa);
CREATE INDEX idx_seguros_vencimiento ON seguros(fecha_vencimiento);

-- ---- REFERENCIAS FAMILIARES del conductor ----
CREATE TABLE conductor_referencias (
  id         SERIAL PRIMARY KEY,
  chofer_id  INTEGER NOT NULL REFERENCES choferes(id) ON DELETE CASCADE,
  nombre     TEXT NOT NULL,
  parentesco TEXT,
  telefono   TEXT,
  creado     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cond_ref_chofer ON conductor_referencias(chofer_id);

-- ---- SEGURO INDIVIDUAL del conductor (historial = varios registros) ----
CREATE TABLE conductor_seguros (
  id                SERIAL PRIMARY KEY,
  chofer_id         INTEGER NOT NULL REFERENCES choferes(id) ON DELETE CASCADE,
  fecha_inicio      DATE,
  fecha_expiracion  DATE,
  creado            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cond_seg_chofer ON conductor_seguros(chofer_id);

-- ============================================================
-- Módulos Camiones (llantas, aceites, seguro de carga) y
-- Chóferes (multas, documentación) — migración 002
-- ============================================================

ALTER TABLE flota ADD COLUMN operador_logistico TEXT;
ALTER TABLE flota ADD COLUMN chofer_id INTEGER REFERENCES choferes(id) ON DELETE SET NULL;

-- Control de llantas (historial; cambio programado cada 3 meses)
CREATE TABLE llantas (
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
CREATE INDEX idx_llantas_flota ON llantas(flota_id);

-- Control de aceites (motor / caja / corona)
CREATE TABLE aceites (
  id                  SERIAL PRIMARY KEY,
  flota_id            INTEGER NOT NULL REFERENCES flota(id) ON DELETE CASCADE,
  tipo                TEXT NOT NULL CHECK (tipo IN ('motor','caja','corona')),
  marca               TEXT,
  fecha_ultimo_cambio DATE,
  proxima_fecha       DATE,
  observacion         TEXT,
  creado              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_aceites_flota ON aceites(flota_id);

-- Seguro de carga del camión (estado derivado Vigente/Vencido)
CREATE TABLE seguros_carga (
  id                SERIAL PRIMARY KEY,
  flota_id          INTEGER NOT NULL REFERENCES flota(id) ON DELETE CASCADE,
  poliza            TEXT NOT NULL,
  fecha_tramite     DATE,
  fecha_inicio      DATE,
  fecha_expiracion  DATE,
  activo            BOOLEAN NOT NULL DEFAULT TRUE,
  creado            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_seguros_carga_flota ON seguros_carga(flota_id);

-- Multas del conductor
-- Un conductor puede manejar 1 o más camiones (rotación). Para no alterar
-- historiales al reasignar, la placa y el camión (flota_id) se guardan
-- al momento de registrar la multa (snapshot histórico), no vía JOIN vivo.
CREATE TABLE multas (
  id              SERIAL PRIMARY KEY,
  chofer_id       INTEGER NOT NULL REFERENCES choferes(id) ON DELETE CASCADE,
  fecha           DATE NOT NULL,
  motivo          TEXT NOT NULL,
  monto           NUMERIC(10,2) CHECK (monto IS NULL OR monto >= 0),
  observaciones   TEXT,
  -- Campos para reporte idéntico a plantilla "Multas" C3:M3
  nro_viaje       TEXT,
  placa           TEXT, -- snapshot de la placa del camión al momento de la infracción
  flota_id        INTEGER REFERENCES flota(id) ON DELETE SET NULL,
  importe_pagado  NUMERIC(10,2) CHECK (importe_pagado IS NULL OR importe_pagado >= 0),
  fecha_pago      DATE,
  creado          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_multas_chofer ON multas(chofer_id);
CREATE INDEX idx_multas_flota ON multas(flota_id);
CREATE INDEX idx_multas_fecha ON multas(fecha);

-- Documentación del conductor (luz, agua, croquis, adjuntos con imagen en Blob)
CREATE TABLE conductor_documentos (
  id          SERIAL PRIMARY KEY,
  chofer_id   INTEGER NOT NULL REFERENCES choferes(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL CHECK (tipo IN ('luz','agua','croquis','adjunto')),
  archivo     TEXT,
  observacion TEXT,
  creado      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cond_doc_chofer ON conductor_documentos(chofer_id);

-- Viajes básicos — registro manual (placa, tipo, chofer, tramo, fechas, producto, palets, planilla, código)
-- Si el camión está en ruta (fecha_llegada NULL o futura) → No disponible, si no → Disponible (automático)
CREATE TABLE viajes (
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
  estado          TEXT CHECK (estado IN ('Programado','En ruta','Entregado','Cancelado')) DEFAULT 'En ruta',
  creado          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_viajes_placa ON viajes(placa);
CREATE INDEX idx_viajes_flota ON viajes(flota_id);
CREATE INDEX idx_viajes_chofer ON viajes(chofer_id);
CREATE INDEX idx_viajes_fecha_carga ON viajes(fecha_carga);

-- Impuestos por camión — deudas básicas (fecha registro, pagado o no)
CREATE TABLE impuestos (
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
CREATE INDEX idx_impuestos_flota ON impuestos(flota_id);
CREATE INDEX idx_impuestos_placa ON impuestos(placa);
CREATE INDEX idx_impuestos_pagado ON impuestos(pagado);