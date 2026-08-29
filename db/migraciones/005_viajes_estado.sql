-- Migración 005 — Viajes: estado seleccionable (En ruta, Entregado, Cancelado, Programado)
ALTER TABLE viajes ADD COLUMN IF NOT EXISTS estado TEXT CHECK (estado IN ('Programado','En ruta','Entregado','Cancelado')) DEFAULT 'En ruta';
UPDATE viajes SET estado = CASE WHEN fecha_llegada IS NULL OR fecha_llegada >= (now() AT TIME ZONE 'America/La_Paz')::date THEN 'En ruta' ELSE 'Entregado' END WHERE estado IS NULL;
