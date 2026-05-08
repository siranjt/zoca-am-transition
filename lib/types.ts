export type Health = 'At Risk' | 'Watch' | 'Healthy' | 'Unknown';
export type EngagementTier = 'Active' | 'Light' | 'Cold' | 'Dormant';
export type Pod = 'Pod 1' | 'Pod 2' | 'Pod 3' | 'Pod 4' | 'Pod 5' | 'Floating';

export interface CustomerRow {
  entity_id: string;
  bizname: string;
  customer_id: string;
  am_name: string;
  pod: Pod;
  ae_name: string | null;
  state: string;
  locality: string;
  primary_category: string;
  mrr: number;
  app_email: string | null;
  phone_number: string | null;

  // Health
  health: Health;
  cx_composite_score: number | null;
  cx_tier_reasons: string | null;

  // Comms (90d)
  last_touch_iso: string | null;
  days_since_last_touch: number | null;
  comms_90d_total: number;
  comms_by_channel: Record<string, number>;

  // Tickets
  tickets_open_count: number;
  tickets_high_priority_count: number;
  tickets_resolved_history_count: number;
  tickets_total_history_count: number;

  // Product usage
  engagement_tier: EngagementTier;
  app_opens_90d: number;
  last_app_open: string | null;
  days_since_app_open: number | null;
  leads_marked_90d: number;
  unlock_screen_90d: number;
  total_events_90d: number;

  // Performance
  ytd_leads: number;
  ytd_booked: number;
  review_target: number | null;
  predicted_6mo_leads: number | null;        // INTERNAL marker only
  predicted_6mo_revenue: number | null;      // INTERNAL marker only
  active_keywords: number;
  click_dip_pct: number | null;
  click_peak_month: string | null;

  // AM history
  am_history_count: number;        // distinct AMs ever assigned
  am_history_names: string[];      // distinct AM names in chronological order

  // Risks
  risks: string[];
  dormant_flag: boolean;

  // Flags
  has_handover_brief: boolean;
  has_audit: boolean;

  // Chargebee billing (live)
  auto_collection: 'on' | 'off' | null;
  payment_method_type: string | null;
  payment_method_status: string | null;
  unpaid_invoice_count: number;
  unpaid_total_cents: number;
  oldest_unpaid_due_date: string | null;
  cancel_scheduled_at: string | null;
  subscription_status: string | null;
}
