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
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
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

-- ---- CHOFERES ----
CREATE TABLE choferes (
  id         SERIAL PRIMARY KEY,
  nombre     TEXT NOT NULL,
  placa      TEXT NOT NULL,
  telefono   TEXT,
  direccion  TEXT,
  activo     BOOLEAN NOT NULL DEFAULT TRUE,
  creado     TIMESTAMPTZ NOT NULL DEFAULT now()
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