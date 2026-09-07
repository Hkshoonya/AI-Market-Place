-- Billing remains disabled until an operator pins the merchant in this table.
-- Keep sandbox and production databases separate; the default rejects test mode.
CREATE TABLE public.data_api_billing_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  account_id TEXT CHECK (account_id ~ '^acct_[A-Za-z0-9]+$'),
  livemode BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO public.data_api_billing_settings (id) VALUES (TRUE);

CREATE TABLE public.data_api_billing_customers (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id TEXT UNIQUE CHECK (customer_id ~ '^cus_[A-Za-z0-9]+$'),
  subscription_id TEXT UNIQUE CHECK (subscription_id ~ '^sub_[A-Za-z0-9]+$'),
  customer_request_id UUID NOT NULL DEFAULT gen_random_uuid(),
  checkout_attempt_id UUID,
  checkout_attempt_at TIMESTAMPTZ,
  checkout_plan_slug TEXT REFERENCES public.data_api_plans(slug),
  checkout_session_id TEXT UNIQUE CHECK (checkout_session_id ~ '^cs_[A-Za-z0-9_]+$'),
  access_hold BOOLEAN NOT NULL DEFAULT FALSE,
  deletion_pending BOOLEAN NOT NULL DEFAULT FALSE,
  lease_token UUID,
  lease_until TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT 'epoch',
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT 'epoch',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX data_api_billing_reconcile_due
  ON public.data_api_billing_customers (last_checked_at, user_id)
  WHERE customer_id IS NOT NULL;

CREATE TABLE public.data_api_billing_events (
  event_id TEXT PRIMARY KEY CHECK (event_id ~ '^evt_[A-Za-z0-9_]+$'),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX data_api_billing_events_retention ON public.data_api_billing_events (processed_at);

ALTER TABLE public.data_api_billing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_api_billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_api_billing_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.data_api_billing_settings, public.data_api_billing_customers,
  public.data_api_billing_events FROM anon, authenticated;
GRANT ALL ON public.data_api_billing_settings, public.data_api_billing_customers,
  public.data_api_billing_events TO service_role;

CREATE FUNCTION public.claim_data_api_billing(p_user_id UUID, p_account_id TEXT, p_livemode BOOLEAN)
RETURNS SETOF public.data_api_billing_customers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::TEXT, 0));
  IF NOT EXISTS (SELECT 1 FROM public.data_api_billing_settings
    WHERE id AND account_id = p_account_id AND livemode = p_livemode) THEN
    RAISE EXCEPTION 'Billing environment is not configured';
  END IF;
  INSERT INTO public.data_api_billing_customers (user_id) VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;
  RETURN QUERY UPDATE public.data_api_billing_customers
    SET lease_token = gen_random_uuid(), lease_until = clock_timestamp() + INTERVAL '120 seconds'
    WHERE user_id = p_user_id AND NOT deletion_pending AND (lease_until IS NULL OR lease_until < clock_timestamp())
    RETURNING *;
END;
$$;

-- Every state write checks the lease. An expired worker cannot overwrite a newer
-- Stripe snapshot or persist a Checkout after another worker takes ownership.
CREATE FUNCTION public.save_data_api_billing(p_user_id UUID, p_token UUID, p_patch JSONB)
RETURNS SETOF public.data_api_billing_customers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY UPDATE public.data_api_billing_customers SET
    customer_id = CASE WHEN p_patch ? 'customer_id' THEN p_patch->>'customer_id' ELSE customer_id END,
    checkout_attempt_id = CASE WHEN p_patch ? 'checkout_attempt_id' THEN (p_patch->>'checkout_attempt_id')::UUID ELSE checkout_attempt_id END,
    checkout_attempt_at = CASE WHEN p_patch ? 'checkout_attempt_at' THEN (p_patch->>'checkout_attempt_at')::TIMESTAMPTZ ELSE checkout_attempt_at END,
    checkout_plan_slug = CASE WHEN p_patch ? 'checkout_plan_slug' THEN p_patch->>'checkout_plan_slug' ELSE checkout_plan_slug END,
    checkout_session_id = CASE WHEN p_patch ? 'checkout_session_id' THEN p_patch->>'checkout_session_id' ELSE checkout_session_id END,
    access_hold = access_hold OR COALESCE((p_patch->>'access_hold')::BOOLEAN, FALSE)
  WHERE user_id = p_user_id AND lease_token = p_token AND lease_until > clock_timestamp()
  RETURNING *;
END;
$$;

CREATE FUNCTION public.apply_data_api_billing(
  p_user_id UUID, p_token UUID, p_subscription_id TEXT, p_plan_slug TEXT,
  p_status TEXT, p_period_start TIMESTAMPTZ, p_period_end TIMESTAMPTZ,
  p_event_id TEXT DEFAULT NULL, p_event_type TEXT DEFAULT NULL
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_customer public.data_api_billing_customers;
BEGIN
  SELECT * INTO v_customer FROM public.data_api_billing_customers
    WHERE user_id = p_user_id AND lease_token = p_token AND lease_until > clock_timestamp() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Billing lease expired'; END IF;
  IF p_subscription_id IS NULL OR p_subscription_id !~ '^sub_[A-Za-z0-9]+$' OR v_customer.customer_id IS NULL
    OR p_plan_slug IS NULL OR p_plan_slug NOT IN ('pro', 'business') OR p_status IS NULL OR p_status NOT IN ('active', 'past_due', 'canceled', 'expired')
    OR p_period_start IS NULL OR p_period_end IS NULL OR p_period_end <= p_period_start THEN
    RAISE EXCEPTION 'Invalid billing snapshot';
  END IF;
  IF p_event_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.data_api_billing_events WHERE event_id = p_event_id
  ) THEN RETURN FALSE; END IF;

  INSERT INTO public.data_api_subscriptions (
    user_id, plan_slug, status, source, current_period_start, current_period_end,
    external_customer_id, external_subscription_id
  ) VALUES (
    p_user_id, p_plan_slug,
    CASE WHEN v_customer.access_hold OR NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE id = p_user_id AND is_banned = FALSE
    ) THEN 'expired' ELSE p_status END,
    'stripe', p_period_start, p_period_end, v_customer.customer_id, p_subscription_id
  ) ON CONFLICT (user_id) DO UPDATE SET
    plan_slug = EXCLUDED.plan_slug, status = EXCLUDED.status, source = 'stripe',
    current_period_start = EXCLUDED.current_period_start, current_period_end = EXCLUDED.current_period_end,
    external_customer_id = EXCLUDED.external_customer_id, external_subscription_id = EXCLUDED.external_subscription_id,
    granted_by = NULL, notes = NULL
  -- Do not silently replace an active administrator/promotion grant.
  WHERE data_api_subscriptions.source = 'stripe'
    OR data_api_subscriptions.status NOT IN ('active', 'trialing')
    OR data_api_subscriptions.current_period_end <= NOW();

  UPDATE public.data_api_billing_customers SET subscription_id = p_subscription_id,
    last_synced_at = clock_timestamp() WHERE user_id = p_user_id;
  IF p_event_id IS NOT NULL THEN
    INSERT INTO public.data_api_billing_events (event_id, user_id, event_type)
      VALUES (p_event_id, p_user_id, LEFT(p_event_type, 100));
  END IF;
  RETURN TRUE;
END;
$$;

CREATE FUNCTION public.release_data_api_billing(p_user_id UUID, p_token UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  UPDATE public.data_api_billing_customers SET lease_token = NULL, lease_until = NULL, last_checked_at = clock_timestamp()
    WHERE user_id = p_user_id AND lease_token = p_token;
$$;

-- An admin grant must not erase a paid contract or race a billing worker.
CREATE FUNCTION public.guard_data_api_subscription_grant()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_billing public.data_api_billing_customers;
BEGIN
  IF NEW.source <> 'stripe' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::TEXT, 0));
    SELECT * INTO v_billing FROM public.data_api_billing_customers WHERE user_id = NEW.user_id FOR UPDATE;
    IF FOUND AND (v_billing.subscription_id IS NOT NULL OR v_billing.checkout_attempt_id IS NOT NULL
      OR v_billing.lease_until > clock_timestamp()) THEN
      RAISE EXCEPTION 'Manage Stripe billing before changing a manual grant';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_data_api_subscription_grant BEFORE INSERT OR UPDATE ON public.data_api_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.guard_data_api_subscription_grant();

CREATE FUNCTION public.prepare_data_api_billing_deletion(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_billing public.data_api_billing_customers;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::TEXT, 0));
  INSERT INTO public.data_api_billing_customers (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO v_billing FROM public.data_api_billing_customers WHERE user_id = p_user_id FOR UPDATE;
  IF v_billing.customer_id IS NOT NULL OR v_billing.checkout_attempt_id IS NOT NULL
    OR v_billing.lease_until > clock_timestamp() THEN RETURN FALSE; END IF;
  UPDATE public.data_api_billing_customers SET deletion_pending = TRUE WHERE user_id = p_user_id;
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.prepare_data_api_billing_deletion(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_data_api_billing_deletion(UUID) TO service_role;

REVOKE ALL ON FUNCTION public.claim_data_api_billing(UUID,TEXT,BOOLEAN),
  public.save_data_api_billing(UUID,UUID,JSONB),
  public.apply_data_api_billing(UUID,UUID,TEXT,TEXT,TEXT,TIMESTAMPTZ,TIMESTAMPTZ,TEXT,TEXT),
  public.release_data_api_billing(UUID,UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_data_api_billing(UUID,TEXT,BOOLEAN),
  public.save_data_api_billing(UUID,UUID,JSONB),
  public.apply_data_api_billing(UUID,UUID,TEXT,TEXT,TEXT,TIMESTAMPTZ,TIMESTAMPTZ,TEXT,TEXT),
  public.release_data_api_billing(UUID,UUID) TO service_role;
