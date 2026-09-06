\set ON_ERROR_STOP on
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id UUID PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql AS $$ SELECT NULL::UUID $$;
CREATE FUNCTION auth.role() RETURNS TEXT LANGUAGE sql AS $$ SELECT current_user::TEXT $$;
CREATE TABLE public.profiles (id UUID PRIMARY KEY REFERENCES auth.users(id), is_banned BOOLEAN NOT NULL DEFAULT FALSE);
CREATE TABLE public.api_keys (id UUID PRIMARY KEY);
CREATE TABLE public.api_endpoint_pricing (
  path_pattern TEXT, method TEXT, price_per_call NUMERIC, is_free_for_humans BOOLEAN,
  rate_limit_free INTEGER, rate_limit_paid INTEGER, description TEXT
);
CREATE FUNCTION public.update_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;
\i /tmp/087.sql
\i /tmp/090.sql
\i /tmp/099.sql

INSERT INTO auth.users VALUES ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222'), ('33333333-3333-4333-8333-333333333333');
INSERT INTO public.profiles SELECT id, FALSE FROM auth.users;
DO $$
DECLARE
  u UUID := '11111111-1111-4111-8111-111111111111';
  pilot UUID := '22222222-2222-4222-8222-222222222222';
  lease public.data_api_billing_customers;
  next_lease public.data_api_billing_customers;
  applied BOOLEAN;
BEGIN
  ASSERT NOT has_table_privilege('anon', 'public.data_api_billing_customers', 'SELECT');
  ASSERT NOT has_table_privilege('authenticated', 'public.data_api_billing_customers', 'UPDATE');
  ASSERT NOT has_function_privilege('authenticated', 'public.claim_data_api_billing(uuid,text,boolean)', 'EXECUTE');
  ASSERT has_function_privilege('service_role', 'public.claim_data_api_billing(uuid,text,boolean)', 'EXECUTE');
  BEGIN
    PERFORM public.claim_data_api_billing(u, 'acct_fixture', TRUE);
    RAISE EXCEPTION 'Expected unconfigured merchant rejection';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM = 'Billing environment is not configured';
  END;
  UPDATE public.data_api_billing_settings SET account_id = 'acct_fixture';
  BEGIN
    PERFORM public.claim_data_api_billing(u, 'acct_fixture', FALSE);
    RAISE EXCEPTION 'Expected test-mode rejection in production database';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM = 'Billing environment is not configured';
  END;
  SELECT * INTO lease FROM public.claim_data_api_billing(u, 'acct_fixture', TRUE);
  ASSERT lease.lease_token IS NOT NULL;
  ASSERT NOT EXISTS (SELECT 1 FROM public.claim_data_api_billing(u, 'acct_fixture', TRUE));
  PERFORM public.save_data_api_billing(u, lease.lease_token, '{"customer_id":"cus_fixture","checkout_plan_slug":"pro"}');
  SELECT public.apply_data_api_billing(u, lease.lease_token, 'sub_fixture', 'pro', 'active', NOW(), NOW() + INTERVAL '1 month', 'evt_first', 'invoice.paid') INTO applied;
  ASSERT applied;
  ASSERT (SELECT source = 'stripe' AND plan_slug = 'pro' AND status = 'active' FROM public.data_api_subscriptions WHERE user_id = u);
  ASSERT (SELECT plan_slug = 'pro' AND request_limit = 100000 FROM public.consume_data_api_quota(u, NULL, '/api/models'));
  SELECT public.apply_data_api_billing(u, lease.lease_token, 'sub_fixture', 'pro', 'past_due', NOW(), NOW() + INTERVAL '1 month', 'evt_first', 'invoice.paid') INTO applied;
  ASSERT NOT applied;
  ASSERT (SELECT status = 'active' FROM public.data_api_subscriptions WHERE user_id = u);
  BEGIN
    UPDATE public.data_api_subscriptions SET source = 'admin', plan_slug = 'free' WHERE user_id = u;
    RAISE EXCEPTION 'Expected manual grant rejection';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM = 'Manage Stripe billing before changing a manual grant';
  END;
  UPDATE public.data_api_billing_customers SET lease_until = clock_timestamp() - INTERVAL '1 second' WHERE user_id = u;
  SELECT * INTO next_lease FROM public.claim_data_api_billing(u, 'acct_fixture', TRUE);
  ASSERT next_lease.lease_token <> lease.lease_token;
  ASSERT NOT EXISTS (SELECT 1 FROM public.save_data_api_billing(u, lease.lease_token, '{"customer_id":"cus_stale"}'));
  BEGIN
    PERFORM public.apply_data_api_billing(u, lease.lease_token, 'sub_stale', 'business', 'active', NOW(), NOW() + INTERVAL '1 month');
    RAISE EXCEPTION 'Expected stale lease rejection';
  EXCEPTION WHEN OTHERS THEN ASSERT SQLERRM = 'Billing lease expired'; END;
  PERFORM public.save_data_api_billing(u, next_lease.lease_token, '{"access_hold":true}');
  PERFORM public.apply_data_api_billing(u, next_lease.lease_token, 'sub_fixture', 'pro', 'active', NOW(), NOW() + INTERVAL '1 month', 'evt_hold', 'charge.refunded');
  ASSERT (SELECT status = 'expired' FROM public.data_api_subscriptions WHERE user_id = u);
  ASSERT (SELECT plan_slug = 'free' AND request_limit = 2500 FROM public.consume_data_api_quota(u, NULL, '/api/models'));
  PERFORM public.save_data_api_billing(u, next_lease.lease_token, '{"access_hold":false}');
  ASSERT (SELECT access_hold FROM public.data_api_billing_customers WHERE user_id = u);
  PERFORM public.release_data_api_billing(u, lease.lease_token);
  ASSERT (SELECT lease_token = next_lease.lease_token FROM public.data_api_billing_customers WHERE user_id = u);
  PERFORM public.release_data_api_billing(u, next_lease.lease_token);
  ASSERT (SELECT lease_token IS NULL FROM public.data_api_billing_customers WHERE user_id = u);
  INSERT INTO public.data_api_subscriptions (user_id, plan_slug, source) VALUES (pilot, 'business', 'admin');
  SELECT * INTO lease FROM public.claim_data_api_billing(pilot, 'acct_fixture', TRUE);
  PERFORM public.save_data_api_billing(pilot, lease.lease_token, '{"customer_id":"cus_pilot"}');
  PERFORM public.apply_data_api_billing(pilot, lease.lease_token, 'sub_pilot', 'pro', 'active', NOW(), NOW() + INTERVAL '1 month');
  ASSERT (SELECT source = 'admin' AND plan_slug = 'business' FROM public.data_api_subscriptions WHERE user_id = pilot);
  ASSERT NOT public.prepare_data_api_billing_deletion(u);
  ASSERT public.prepare_data_api_billing_deletion('33333333-3333-4333-8333-333333333333');
  ASSERT NOT EXISTS (SELECT 1 FROM public.claim_data_api_billing('33333333-3333-4333-8333-333333333333', 'acct_fixture', TRUE));
END;
$$;
SELECT 'Billing SQL isolation, lease, replay, hold, pilot and quota checks passed' AS result;
