-- Migración 008 — Mantenimiento progresivo y token
CREATE TABLE IF NOT EXISTS config (
  clave TEXT PRIMARY KEY,
  valor TEXT,
  actualizado TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mantenimientos (
  id SERIAL PRIMARY KEY,
  hash TEXT UNIQUE NOT NULL,
  creado TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira TIMESTAMPTZ NOT NULL,
  usado BOOLEAN NOT NULL DEFAULT FALSE,
  usado_por TEXT,
  usado_en TIMESTAMPTZ
);
-- Fecha de entrega del sistema
INSERT INTO config (clave, valor) VALUES ('ultimo_mantenimiento', '2026-11-03')
ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, actualizado = now();
INSERT INTO config (clave, valor) VALUES ('entrega', '2026-11-03')
ON CONFLICT (clave) DO NOTHING;
