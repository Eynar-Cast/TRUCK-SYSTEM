-- ============================================================
-- Migración 003 — Multas: placa histórica + pago + nro viaje
-- Permite que un conductor maneje 1 o más camiones (rotación)
-- sin alterar historiales: la placa/flota se guarda al momento
-- de la multa (snapshot), no vía JOIN a choferes.placa.
-- También añade importe pagado/fecha para Debe/Estado reales.
-- Idempotente.
-- ============================================================

ALTER TABLE multas ADD COLUMN IF NOT EXISTS nro_viaje      TEXT;
ALTER TABLE multas ADD COLUMN IF NOT EXISTS placa          TEXT;
ALTER TABLE multas ADD COLUMN IF NOT EXISTS flota_id       INTEGER REFERENCES flota(id) ON DELETE SET NULL;
ALTER TABLE multas ADD COLUMN IF NOT EXISTS importe_pagado NUMERIC(10,2) CHECK (importe_pagado IS NULL OR importe_pagado >= 0);
ALTER TABLE multas ADD COLUMN IF NOT EXISTS fecha_pago     DATE;

-- Rellenar placa histórica donde aún esté vacía con la del chofer (mejor que dejar null)
UPDATE multas m
SET placa = c.placa
FROM choferes c
WHERE m.chofer_id = c.id AND (m.placa IS NULL OR m.placa = '') AND c.placa IS NOT NULL AND c.placa <> '';

CREATE INDEX IF NOT EXISTS idx_multas_flota ON multas(flota_id);
CREATE INDEX IF NOT EXISTS idx_multas_fecha ON multas(fecha);
