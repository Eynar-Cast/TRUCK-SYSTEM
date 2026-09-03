-- Migración 007 — Rol supervisor (secretaria + historial + gastos conductores)
DO $$ BEGIN
  ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_role_check;
  ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_role_check1;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_role_check CHECK (role IN ('user','admin','secretaria','supervisor'));
