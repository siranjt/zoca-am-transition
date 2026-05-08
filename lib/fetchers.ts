/**
 * Per-section fetchers. Each one is a single batched query for all entity_ids.
 */
import { dataset } from './metabase';
import {
  bind,
  SQL_HEALTH, SQL_OPEN_ISSUES, SQL_COMMS_SUMMARY, SQL_HANDOVER_BRIEF,
  SQL_MIXPANEL_USAGE, SQL_LOCATION_INSIGHTS, SQL_GBP_AUDIT,
  SQL_GBP_METRICS_TREND, SQL_RANKINGS, SQL_REVIEWS_12W,
  SQL_GBP_LOCATIONS, SQL_PLACE_DETAILS, SQL_LEADS_YTD,
} from './queries';

const AURORA = 7;
const POSTGRES = 2;

export const fetchHealth = (eids: string[]) => dataset({ database: AURORA, query: bind(SQL_HEALTH, eids) });
export const fetchOpenIssues = (eids: string[]) => dataset({ database: AURORA, query: bind(SQL_OPEN_ISSUES, eids) });
export const fetchCommsSummary = (eids: string[]) => dataset({ database: AURORA, query: bind(SQL_COMMS_SUMMARY, eids) });
export const fetchHandoverBrief = (eids: string[]) => dataset({ database: AURORA, query: bind(SQL_HANDOVER_BRIEF, eids) });
export const fetchMixpanelUsage = (eids: string[]) => dataset({ database: AURORA, query: bind(SQL_MIXPANEL_USAGE, eids) });
export const fetchLocationInsights = (eids: string[]) => dataset({ database: AURORA, query: bind(SQL_LOCATION_INSIGHTS, eids) });
export const fetchGbpAudit = (eids: string[]) => dataset({ database: AURORA, query: bind(SQL_GBP_AUDIT, eids) });
export const fetchGbpMetricsTrend = (eids: string[]) => dataset({ database: AURORA, query: bind(SQL_GBP_METRICS_TREND, eids) });
export const fetchRankings = (eids: string[]) => dataset({ database: AURORA, query: bind(SQL_RANKINGS, eids) });
export const fetchReviews12w = (eids: string[]) => dataset({ database: AURORA, query: bind(SQL_REVIEWS_12W, eids) });
export const fetchGbpLocations = (eids: string[]) => dataset({ database: AURORA, query: bind(SQL_GBP_LOCATIONS, eids) });
export const fetchPlaceDetails = (eids: string[]) => dataset({ database: AURORA, query: bind(SQL_PLACE_DETAILS, eids) });
export const fetchLeadsYTD = (eids: string[]) => dataset({ database: POSTGRES, query: bind(SQL_LEADS_YTD, eids) });
