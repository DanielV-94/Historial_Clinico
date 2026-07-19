-- Audit Log Immutability
-- Requirements 8.2: La tabla de auditoría no aceptará operaciones UPDATE ni DELETE
-- Requirements 8.4: Retención mínima de 5 años (NOM-004-SSA3-2012)

-- Trigger function to prevent modification
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs table is immutable: % operations are not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger before UPDATE or DELETE
CREATE TRIGGER audit_immutable_guard
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

-- Revoke UPDATE and DELETE permissions from application user
-- Note: The app_user role should be created during database setup.
-- REVOKE UPDATE, DELETE ON audit_logs FROM app_user;
-- This is commented because the specific role name depends on deployment.
-- The trigger above provides the safety net regardless of role configuration.

-- Retention policy: 5 years minimum as per NOM-004-SSA3-2012
-- No automatic purge is implemented. Backups handle long-term storage.
COMMENT ON TABLE audit_logs IS 'Immutable audit trail. 5-year minimum retention per NOM-004-SSA3-2012. No UPDATE/DELETE allowed.';
