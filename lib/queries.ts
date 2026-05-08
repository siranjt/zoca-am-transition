/**
 * SQL strings used by the AM Transition Toolkit.
 * Ported from prep_metabase.py — same logic, parameterized differently.
 *
 * The {{ENTITY_LIST}} placeholder is replaced at call-time with a comma-separated
 * list of quoted entity IDs (cast as needed in the WHERE clause).
 */

const W = "{{ENTITY_LIST}}"; // placeholder

export const SQL_BASESHEET_FILTERED_BY_AM = (active_ams: readonly string[]) => `
-- BaseSheet rows for active customers under our AM list.
-- We hit the public CSV for full BaseSheet, but if we want to query directly:
-- (Reads via Metabase's public-csv endpoint are simpler; see the alternative.)
SELECT 1
`;

/* The AM Transition Toolkit reads the BaseSheet via the public CSV endpoint
   in the existing pipeline (see prep_data.py). For the Next.js app, we'll
   fetch that CSV server-side via fetchers.ts. So no SQL here. */

export const SQL_HEALTH = `
SELECT entity_id, composite_health_score, health_tier, health_tier_reason_names,
       score_product_stability, score_value_realization, score_engagement, recorded_at
FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY entity_id ORDER BY recorded_at DESC) AS rn
  FROM cx.health_score_snapshots
  WHERE entity_id = ANY(ARRAY[${W}]::uuid[])
) t WHERE rn = 1
`;

export const SQL_OPEN_ISSUES = `
SELECT entity_id, id, issue_summary, status, priority_type, channel, raised_at, am_notes
FROM cx.open_issues
WHERE entity_id = ANY(ARRAY[${W}]::uuid[])
  AND raised_at > NOW() - INTERVAL '180 days'
ORDER BY raised_at DESC
`;

export const SQL_COMMS_SUMMARY = `
SELECT entity_id, last_communication_source, last_communication_time, summary, llm_analysis, updated_at
FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY entity_id ORDER BY updated_at DESC) AS rn
  FROM cx.communication_summary
  WHERE entity_id = ANY(ARRAY[${W}]::uuid[])
) t WHERE rn = 1
`;

export const SQL_HANDOVER_BRIEF = `
SELECT entity_id, am_entity_id, brief_summary, created_at
FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY entity_id ORDER BY created_at DESC) AS rn
  FROM cx.handover_brief
  WHERE entity_id = ANY(ARRAY[${W}]::uuid[])
    AND brief_summary IS NOT NULL
) t WHERE rn = 1
`;

export const SQL_MIXPANEL_USAGE = `
SELECT
  "locationEntityId" AS entity_id,
  event,
  COUNT(*) AS n,
  MAX(time::timestamptz) AS last_seen,
  COUNT(DISTINCT (time::date)) AS distinct_days
FROM mixpanelzocaappdata.export
WHERE time::timestamptz > NOW() - INTERVAL '90 days'
  AND "locationEntityId" = ANY(ARRAY[${W}]::text[])
  AND event IN (
    'App/Site Opened', '$ae_session', 'Leads-View-Home', 'Leads-Click-Lead',
    'Leads-View-GetLeads', 'Leads-Select-LeadStatusSheet',
    'Leads-Click-LeadContact', 'Leads-Click-ChatCall', 'Leads-Click-DetailCopyNumber',
    'Reviews-Click-ReviewReplyAI', 'Reviews-Done-ReviewReply',
    'Review-Click-SendInviteSingle', 'Home-View-ReviewTracker', 'Reviews-View-AllReviews'
  )
GROUP BY "locationEntityId", event
`;

export const SQL_LOCATION_INSIGHTS = `
SELECT entity_id, review_target, with_zoca_6_month_profile_clicks, gbp_score, website_score, created_at
FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY entity_id ORDER BY created_at DESC) AS rn
  FROM entities.location_insights
  WHERE entity_id = ANY(ARRAY[${W}]::uuid[])
    AND predicted_6_month_leads IS NOT NULL
    AND with_zoca_6_month_profile_clicks IS NOT NULL
    AND (monthly_predictions->>'nonIcpReason') IS NULL
) t WHERE rn = 1
`;

export const SQL_GBP_AUDIT = `
SELECT entity_id, gbp_audit, gbp_score, website_audit, website_score
FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY entity_id ORDER BY created_at DESC) AS rn
  FROM entities.location_insights
  WHERE entity_id = ANY(ARRAY[${W}]::uuid[])
    AND gbp_audit IS NOT NULL
    AND (gbp_audit_failed = FALSE OR gbp_audit_failed IS NULL)
) t WHERE rn = 1
`;

export const SQL_GBP_METRICS_TREND = `
SELECT
  l.entity_id AS entity_id,
  date_trunc('month', m.metrics_timestamp)::date AS month,
  SUM(COALESCE(m.desktop_search_clicks,0) + COALESCE(m.mobile_search_clicks,0)
      + COALESCE(m.desktop_map_clicks,0) + COALESCE(m.mobile_map_clicks,0)
      + COALESCE(m.website_clicks,0) + COALESCE(m.call_clicks,0)) AS total_clicks
FROM gbp.metrics m
JOIN gbp.locations l ON m.location_name = l.name
WHERE l.entity_id = ANY(ARRAY[${W}]::uuid[])
  AND m.metrics_timestamp >= NOW() - INTERVAL '395 days'
GROUP BY l.entity_id, month
`;

export const SQL_RANKINGS = `
SELECT entity_id, keyword, rank_current, rank_when_joined, rank_best
FROM (
  SELECT
    entity_id,
    keyword,
    avg_rank AS rank_current,
    FIRST_VALUE(avg_rank) OVER (PARTITION BY entity_id, keyword ORDER BY dateval) AS rank_when_joined,
    MIN(avg_rank) OVER (PARTITION BY entity_id, keyword) AS rank_best,
    ROW_NUMBER() OVER (PARTITION BY entity_id, keyword ORDER BY dateval DESC) AS rn
  FROM local_seo.rank
  WHERE entity_id = ANY(ARRAY[${W}]::uuid[])
    AND is_active = true
) t WHERE rn = 1
`;

export const SQL_REVIEWS_12W = `
SELECT entity_id, date_trunc('week', created_at) AS week, COUNT(*) AS n
FROM reviews.reviews
WHERE entity_id = ANY(ARRAY[${W}]::uuid[])
  AND created_at > NOW() - INTERVAL '12 weeks'
GROUP BY entity_id, week
`;

export const SQL_GBP_LOCATIONS = `
SELECT entity_id, title, phone_numbers, website_uri, regular_hours, service_items
FROM gbp.locations
WHERE entity_id = ANY(ARRAY[${W}]::uuid[])
`;

export const SQL_PLACE_DETAILS = `
SELECT r.entity_id, pd.rating, pd.user_ratings_total AS review_count
FROM (
  SELECT DISTINCT entity_id, place_id FROM local_seo.rank
  WHERE entity_id = ANY(ARRAY[${W}]::uuid[]) AND place_id IS NOT NULL
) r
JOIN local_seo.place_details pd ON pd.place_id = r.place_id
`;

export const SQL_LEADS_YTD = `
SELECT entity_id, utm_source, status, created_at
FROM website.booking_enquiries
WHERE entity_id::text = ANY(ARRAY[${W}]::text[])
  AND created_at >= date_trunc('year', NOW())
`;

export function buildEntityList(eids: string[]): string {
  return eids.map((e) => `'${e.replace(/'/g, "''")}'`).join(',');
}

export function bind(sql: string, eids: string[]): string {
  return sql.replace(/\{\{ENTITY_LIST\}\}/g, buildEntityList(eids));
}
