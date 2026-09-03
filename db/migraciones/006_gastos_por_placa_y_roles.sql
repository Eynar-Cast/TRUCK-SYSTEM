-- ============================================================
-- Migración 006 — Gastos por placa, costos de mantenimiento,
-- enlaces en texto + Nº factura/comprobante y rol secretaria
-- Idempotente.
-- ============================================================

-- ---- Usuarios: nuevo rol secretaria + session_id si falta ----
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS session_id TEXT;
-- ampliar check de roles para incluir 'secretaria'
DO $$ BEGIN
  ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_role_check;
  ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_role_check1;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_role_check CHECK (role IN ('user','admin','secretaria'));

-- ---- Conductor_documentos: solo enlace texto + Nº factura/comprobante ----
ALTER TABLE conductor_documentos ADD COLUMN IF NOT EXISTS numero_factura TEXT;
ALTER TABLE conductor_documentos ADD COLUMN IF NOT EXISTS numero_comprobante TEXT;
-- 'archivo' pasa a usarse como enlace en texto (URL manual), no cambia tipo

-- ---- Compras (repuestos): asociar a placa + factura/comprobante texto ----
ALTER TABLE compras ADD COLUMN IF NOT EXISTS numero_factura TEXT;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS numero_comprobante TEXT;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS enlace TEXT;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS placa TEXT;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS flota_id INTEGER REFERENCES flota(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_compras_placa ON compras(placa);
CREATE INDEX IF NOT EXISTS idx_compras_flota ON compras(flota_id);

-- ---- Gastos chofer: asociar a placa + factura/comprobante texto ----
ALTER TABLE gastos_chofer ADD COLUMN IF NOT EXISTS numero_factura TEXT;
ALTER TABLE gastos_chofer ADD COLUMN IF NOT EXISTS numero_comprobante TEXT;
ALTER TABLE gastos_chofer ADD COLUMN IF NOT EXISTS enlace TEXT;
ALTER TABLE gastos_chofer ADD COLUMN IF NOT EXISTS placa TEXT;
ALTER TABLE gastos_chofer ADD COLUMN IF NOT EXISTS flota_id INTEGER REFERENCES flota(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_gastos_chofer_placa ON gastos_chofer(placa);
CREATE INDEX IF NOT EXISTS idx_gastos_chofer_flota ON gastos_chofer(flota_id);
-- Rellenar placa histórica donde esté vacía (snapshot del chofer al momento del gasto)
UPDATE gastos_chofer g SET placa = c.placa FROM choferes c WHERE g.chofer_id = c.id AND (g.placa IS NULL OR g.placa = '') AND c.placa IS NOT NULL AND c.placa <> '';
-- Si hay flota con esa placa, enlazar flota_id
UPDATE gastos_chofer g SET flota_id = f.id FROM flota f WHERE g.placa = f.placa AND g.flota_id IS NULL;

-- ---- Llantas: agregar costo + factura/comprobante + enlace ----
ALTER TABLE llantas ADD COLUMN IF NOT EXISTS costo NUMERIC(12,2) CHECK (costo IS NULL OR costo >= 0);
ALTER TABLE llantas ADD COLUMN IF NOT EXISTS numero_factura TEXT;
ALTER TABLE llantas ADD COLUMN IF NOT EXISTS numero_comprobante TEXT;
ALTER TABLE llantas ADD COLUMN IF NOT EXISTS enlace TEXT;

-- ---- Aceites: agregar costo + factura/comprobante + enlace ----
ALTER TABLE aceites ADD COLUMN IF NOT EXISTS costo NUMERIC(12,2) CHECK (costo IS NULL OR costo >= 0);
ALTER TABLE aceites ADD COLUMN IF NOT EXISTS numero_factura TEXT;
ALTER TABLE aceites ADD COLUMN IF NOT EXISTS numero_comprobante TEXT;
ALTER TABLE aceites ADD COLUMN IF NOT EXISTS enlace TEXT;

-- ---- Impuestos: agregar factura/comprobante + enlace para trazabilidad ----
ALTER TABLE impuestos ADD COLUMN IF NOT EXISTS numero_factura TEXT;
ALTER TABLE impuestos ADD COLUMN IF NOT EXISTS numero_comprobante TEXT;
ALTER TABLE impuestos ADD COLUMN IF NOT EXISTS enlace TEXT;
