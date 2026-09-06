BEGIN;

ALTER TABLE provider_connections DROP CONSTRAINT provider_connections_provider_check;
ALTER TABLE provider_connections ADD CONSTRAINT provider_connections_provider_check
  CHECK (provider IN ('openrouter', 'replicate', 'huggingface', 'runpod'));

-- Service-only control plane. Neither credentials nor resource IDs can be
-- changed directly by a browser, even if it has a valid Supabase session.
CREATE TABLE runpod_pods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_connection_id UUID REFERENCES provider_connections(id) ON DELETE SET NULL,
  external_account_id TEXT NOT NULL,
  model_key TEXT NOT NULL,
  gpu_type_id TEXT NOT NULL,
  gpu_name TEXT NOT NULL,
  gpu_memory_gb INTEGER NOT NULL CHECK (gpu_memory_gb >= 24),
  volume_gb INTEGER NOT NULL CHECK (volume_gb IN (30, 50, 100)),
  gpu_price_per_hr NUMERIC NOT NULL CHECK (gpu_price_per_hr > 0),
  observed_price_per_hr NUMERIC,
  image_name TEXT NOT NULL,
  encrypted_api_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'quoted' CHECK (status IN
    ('quoted', 'creating', 'unknown', 'starting', 'running', 'stopping', 'stopped', 'terminating', 'terminated', 'failed')),
  external_pod_id TEXT UNIQUE,
  quote_expires_at TIMESTAMPTZ NOT NULL,
  consented_at TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ,
  api_ready BOOLEAN NOT NULL DEFAULT FALSE,
  last_error TEXT,
  operation_id UUID,
  operation_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX runpod_pods_user_created ON runpod_pods (user_id, created_at DESC);
CREATE INDEX runpod_pods_connection ON runpod_pods (provider_connection_id);
ALTER TABLE runpod_pods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages Runpod Pods" ON runpod_pods FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE TRIGGER runpod_pods_updated_at BEFORE UPDATE ON runpod_pods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Lock the connection before claiming a quote so concurrent launches and key
-- replacement cannot race. A consumed quote can never launch a second Pod.
CREATE FUNCTION claim_runpod_quote(p_id UUID, p_user_id UUID) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE q runpod_pods; c provider_connections;
BEGIN
  SELECT * INTO q FROM runpod_pods WHERE id = p_id AND user_id = p_user_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  SELECT * INTO c FROM provider_connections WHERE id = q.provider_connection_id FOR UPDATE;
  IF NOT FOUND OR c.user_id <> p_user_id OR c.provider <> 'runpod' OR c.status <> 'active'
      OR c.external_account_id IS DISTINCT FROM q.external_account_id THEN
    RETURN FALSE;
  END IF;
  IF (SELECT COUNT(*) FROM runpod_pods WHERE provider_connection_id = c.id
      AND status NOT IN ('quoted', 'terminated', 'failed')) >= 3 THEN RETURN FALSE; END IF;
  UPDATE runpod_pods SET status = 'creating', consented_at = NOW()
    WHERE id = p_id AND user_id = p_user_id AND status = 'quoted' AND quote_expires_at > NOW();
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION claim_runpod_quote(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_runpod_quote(UUID, UUID) TO service_role;

-- Do not strand billable resources by disconnecting or switching accounts.
CREATE FUNCTION guard_runpod_connection() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.external_account_id IS NOT DISTINCT FROM OLD.external_account_id
      AND NEW.status = 'active' THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM runpod_pods WHERE provider_connection_id = OLD.id
      AND status NOT IN ('quoted', 'terminated', 'failed')) THEN
    RAISE EXCEPTION 'Terminate Runpod Pods before disconnecting or switching accounts';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_runpod_connection BEFORE DELETE OR UPDATE OF external_account_id, status
  ON provider_connections FOR EACH ROW EXECUTE FUNCTION guard_runpod_connection();

-- Check before any auth-user cascades can remove the resource/credential rows.
-- Expired quotes and terminated history must not prevent account deletion.
CREATE FUNCTION guard_runpod_user_delete() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM runpod_pods WHERE user_id = OLD.id
      AND status NOT IN ('quoted', 'terminated', 'failed')) THEN
    RAISE EXCEPTION 'Terminate Runpod Pods before deleting this account';
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER guard_runpod_user_delete BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION guard_runpod_user_delete();

COMMIT;
