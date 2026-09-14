-- The anonymous generic plan can sort all active candidate rows before OFFSET.
-- Materialize only IDs/ranks first so descriptions never enter that large sort.
CREATE FUNCTION public.get_ranked_model_directory_page(p_offset integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  result jsonb;
BEGIN
  IF p_offset IS NULL OR p_offset < 0 OR p_offset >= 10000 OR p_offset % 500 <> 0 THEN
    RAISE EXCEPTION 'Directory offset must be a multiple of 500 between 0 and 9500'
      USING ERRCODE = '22023';
  END IF;

  WITH page_ids AS MATERIALIZED (
    SELECT id, overall_rank FROM public.models
    WHERE status = 'active'
    ORDER BY overall_rank ASC NULLS LAST, id ASC
    LIMIT 500 OFFSET p_offset
  ), candidates AS (
    SELECT m.id, m.slug, m.name, m.provider, m.category, m.status,
      m.description, m.short_description, m.architecture, m.parameter_count,
      m.context_window, m.release_date, m.hf_model_id, m.hf_downloads,
      m.hf_likes, m.hf_trending_score, m.website_url, m.license, m.license_name,
      m.is_open_weights, m.is_api_available, m.overall_rank, m.quality_score,
      m.capability_score, m.popularity_score, m.adoption_score,
      m.economic_footprint_score, m.market_cap_estimate
    FROM page_ids p JOIN public.models m ON m.id = p.id
  )
  SELECT jsonb_build_object(
    'data', coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.overall_rank ASC NULLS LAST, c.id ASC), '[]'::jsonb),
    'count', CASE WHEN p_offset = 0 THEN (SELECT count(*) FROM public.models WHERE status = 'active') END
  ) INTO result FROM candidates c;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_ranked_model_directory_page(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ranked_model_directory_page(integer) TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
