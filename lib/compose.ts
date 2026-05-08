/**
 * Compose the per-customer rows used by the dashboard.
 * Mirrors prep_combined.py.
 */
import { fetchActiveCustomers } from './basesheet';
import {
  fetchHealth, fetchOpenIssues, fetchCommsSummary, fetchHandoverBrief,
  fetchMixpanelUsage, fetchLocationInsights, fetchGbpAudit,
  fetchGbpMetricsTrend, fetchRankings, fetchReviews12w,
  fetchGbpLocations, fetchPlaceDetails, fetchLeadsYTD, fetchAmHistory,
} from './fetchers';
import { fetchBillingData, type BillingForCustomer } from './chargebeeFetch';
import { podForAm, ALL_DROPDOWN_AMS } from './pods';
import type { CustomerRow, EngagementTier, Health } from './types';

function asString(v: unknown): string | null {
  if (v == null) return null;
  return String(v);
}
function asNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function daysBetween(iso: string | null | undefined, now: Date = new Date()): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.valueOf())) return null;
  return Math.floor((now.valueOf() - d.valueOf()) / 86400000);
}

function tierFromCx(tier: string | null): Health {
  if (!tier) return 'Unknown';
  const t = tier.toLowerCase();
  if (t.includes('red')) return 'At Risk';
  if (t.includes('amber') || t.includes('yellow')) return 'Watch';
  if (t.includes('green')) return 'Healthy';
  return 'Unknown';
}

const MIXPANEL_EVENTS = {
  appOpens: 'App/Site Opened',
  session: '$ae_session',
  leadViewHome: 'Leads-View-Home',
  leadClick: 'Leads-Click-Lead',
  unlockScreen: 'Leads-View-GetLeads',
  leadMark: 'Leads-Select-LeadStatusSheet',
  leadContact1: 'Leads-Click-LeadContact',
  leadContact2: 'Leads-Click-ChatCall',
  leadContact3: 'Leads-Click-DetailCopyNumber',
  reviewReply: 'Reviews-Done-ReviewReply',
  reviewReplyAI: 'Reviews-Click-ReviewReplyAI',
  reviewInvite: 'Review-Click-SendInviteSingle',
} as const;

export interface AmCapacity {
  am: string;
  current: number;        // current customers assigned
  capacity: number;       // hard cap (130 default)
  pct: number;            // current / capacity * 100
  over: boolean;          // true if at or over capacity
}

export interface ComposedDataset {
  generated_at: string;
  customers: CustomerRow[];
  ams: string[];
  capacities: AmCapacity[];
  capacity_max: number;
}

export const AM_CAPACITY_MAX = 130;

export async function composeDataset(): Promise<ComposedDataset> {
  // Step 1: BaseSheet (active customers)
  const base = await fetchActiveCustomers();
  const eids = base.map((c) => c.entity_id);
  if (eids.length === 0) return { generated_at: new Date().toISOString(), customers: [], ams: [], capacities: [], capacity_max: AM_CAPACITY_MAX };

  // Step 2: parallel Metabase + Chargebee pulls (Chargebee is cached for 10 min)
  const [
    health, issues, commsSummary, handover, mixpanel,
    insights, audits, metrics, rankings, reviews,
    locs, pds, leads, billing, amHistory,
  ] = await Promise.all([
    fetchHealth(eids).catch(() => []),
    fetchOpenIssues(eids).catch(() => []),
    fetchCommsSummary(eids).catch(() => []),
    fetchHandoverBrief(eids).catch(() => []),
    fetchMixpanelUsage(eids).catch(() => []),
    fetchLocationInsights(eids).catch(() => []),
    fetchGbpAudit(eids).catch(() => []),
    fetchGbpMetricsTrend(eids).catch(() => []),
    fetchRankings(eids).catch(() => []),
    fetchReviews12w(eids).catch(() => []),
    fetchGbpLocations(eids).catch(() => []),
    fetchPlaceDetails(eids).catch(() => []),
    fetchLeadsYTD(eids).catch(() => []),
    fetchBillingData().catch((e) => { console.error('[chargebee]', e); return {} as Record<string, BillingForCustomer>; }),
    fetchAmHistory(eids).catch(() => []),
  ]);

  // Index helpers
  function indexBy<T extends { entity_id?: string }>(rows: T[]): Map<string, T> {
    const m = new Map<string, T>();
    for (const r of rows) if (r.entity_id) m.set(String(r.entity_id), r);
    return m;
  }
  function groupBy<T extends { entity_id?: string }>(rows: T[]): Map<string, T[]> {
    const m = new Map<string, T[]>();
    for (const r of rows) {
      const eid = r.entity_id ? String(r.entity_id) : '';
      if (!eid) continue;
      if (!m.has(eid)) m.set(eid, []);
      m.get(eid)!.push(r);
    }
    return m;
  }

  const idxHealth = indexBy(health as any);
  const idxIssues = groupBy(issues as any);
  const idxComms = indexBy(commsSummary as any);
  const idxHand = indexBy(handover as any);
  const idxMix = groupBy(mixpanel as any);
  const idxIns = indexBy(insights as any);
  const idxAudit = indexBy(audits as any);
  const idxMetrics = groupBy(metrics as any);
  const idxRank = groupBy(rankings as any);
  const idxRev = groupBy(reviews as any);
  const idxLocs = indexBy(locs as any);
  const idxPd = indexBy(pds as any);
  const idxLeads = groupBy(leads as any);
  const idxAmHist = groupBy(amHistory as any);

  const today = new Date();
  const currentMonthStr = today.toISOString().slice(0, 7);

  const customers: CustomerRow[] = base.map((b) => {
    const eid = b.entity_id;
    const h = idxHealth.get(eid) as any;
    const tickets = (idxIssues.get(eid) || []) as any[];
    const open = tickets.filter((t) => String(t.status || '').toUpperCase() === 'UNRESOLVED');
    const high = open.filter((t) => String(t.priority_type || '').toUpperCase() === 'HIGH');
    const resolvedHistory = tickets.filter((t) => String(t.status || '').toUpperCase() !== 'UNRESOLVED');

    // AM history (distinct AMs ever assigned, in chronological order)
    const amHistRows = (idxAmHist.get(eid) || []) as any[];
    const sortedAm = [...amHistRows].sort((a, b) => String(a.first_assigned).localeCompare(String(b.first_assigned)));
    const amHistoryNames = Array.from(new Set(sortedAm.map((r) => String(r.am_name || '').trim()).filter(Boolean)));

    const mp = (idxMix.get(eid) || []) as any[];
    const eventCount = (name: string) => {
      const r = mp.find((x) => x.event === name);
      return r ? Number(r.n || 0) : 0;
    };
    const lastSeen = (names: string[]): string | null => {
      let best: string | null = null;
      for (const n of names) {
        const r = mp.find((x) => x.event === n);
        if (r?.last_seen && (!best || String(r.last_seen) > best)) best = String(r.last_seen);
      }
      return best;
    };
    const sessionDays = mp.find((x) => x.event === MIXPANEL_EVENTS.session)?.distinct_days || 0;
    const totalEvents = mp.reduce((s, r) => s + Number(r.n || 0), 0);
    const lastApp = lastSeen([MIXPANEL_EVENTS.appOpens, MIXPANEL_EVENTS.session]);
    const daysSinceApp = daysBetween(lastApp);

    let engTier: EngagementTier;
    if (totalEvents === 0) engTier = 'Dormant';
    else if (daysSinceApp != null && daysSinceApp <= 14 && totalEvents > 50) engTier = 'Active';
    else if ((daysSinceApp != null && daysSinceApp <= 30) || totalEvents > 10) engTier = 'Light';
    else engTier = 'Cold';

    // GBP click trend (peak/current/dip on complete months)
    const monthly = (idxMetrics.get(eid) || []) as any[];
    const byMonth: Record<string, number> = {};
    for (const m of monthly) {
      const mk = String(m.month || '').slice(0, 7);
      if (!mk) continue;
      byMonth[mk] = (byMonth[mk] || 0) + Number(m.total_clicks || 0);
    }
    const sortedMonths = Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b));
    const completeMonths = sortedMonths.filter(([m]) => m !== currentMonthStr);
    let peakMonth: string | null = null, peakClicks = 0, currentClicks = 0;
    if (completeMonths.length > 0) {
      const [pm, pc] = completeMonths.reduce((acc, x) => x[1] > acc[1] ? x : acc, completeMonths[0]);
      peakMonth = pm; peakClicks = pc;
      currentClicks = completeMonths[completeMonths.length - 1][1];
    }
    const dipPct = peakClicks > 0 ? Math.round(((peakClicks - currentClicks) / peakClicks) * 1000) / 10 : null;

    // Rankings
    const ranks = (idxRank.get(eid) || []) as any[];
    const activeKw = ranks.length;

    // Leads YTD
    const ydleads = (idxLeads.get(eid) || []) as any[];
    const ytdTotal = ydleads.length;
    const ytdBooked = ydleads.filter((l) => ['booked', 'won', 'confirmed'].includes(String(l.status || '').toLowerCase())).length;

    // Comms by channel
    const commsByCh: Record<string, number> = {};
    // (We don't have comms aggregates from the public CSVs in this server-side build;
    // for MVP, use BaseSheet last_comms_date and skip channel breakdown.)
    const lastTouch = b.last_comms_date || null;

    // Chargebee billing for this customer
    const bill = billing[b.customer_id] as BillingForCustomer | undefined;

    // Risks
    const risks: string[] = [];
    if (h && tierFromCx(h.health_tier) === 'At Risk') risks.push(`CX health: ${h.health_tier} (${Math.round(Number(h.composite_health_score || 0))})`);
    if (open.length) risks.push(`${open.length} open ticket(s)`);
    if (high.length) risks.push(`${high.length} HIGH priority ticket(s)`);
    if (engTier === 'Dormant') risks.push('Dormant — no Zoca app activity in 90 days');
    if (dipPct != null && dipPct >= 30) risks.push(`GBP clicks down ${dipPct.toFixed(0)}% from peak`);
    if (bill?.auto_collection === 'off') risks.push('Auto-debit OFF (manual pay)');
    if (bill && bill.unpaid_invoice_count > 0) risks.push(`${bill.unpaid_invoice_count} unpaid invoice(s) · $${(bill.unpaid_total_cents / 100).toFixed(0)}`);
    if (bill?.cancel_scheduled_at) risks.push('Cancellation scheduled');
    if (amHistoryNames.length >= 3) risks.push(`AM churn: ${amHistoryNames.length} AMs assigned previously`);
    if (resolvedHistory.length >= 5) risks.push(`History: ${resolvedHistory.length} resolved tickets`);

    return {
      entity_id: eid,
      bizname: b.bizname,
      customer_id: b.customer_id,
      am_name: b.am_name,
      pod: podForAm(b.am_name),
      ae_name: b.ae_name || null,
      state: b.state,
      locality: b.locality,
      primary_category: b.primary_category,
      mrr: b.total_monthly_revenue,
      app_email: b.app_email || null,
      phone_number: b.phone_number || null,

      health: tierFromCx(h?.health_tier ?? null),
      cx_composite_score: h ? Number(h.composite_health_score || 0) : null,
      cx_tier_reasons: h ? asString(h.health_tier_reason_names) : null,

      last_touch_iso: lastTouch,
      days_since_last_touch: daysBetween(lastTouch),
      comms_90d_total: 0,
      comms_by_channel: commsByCh,

      tickets_open_count: open.length,
      tickets_high_priority_count: high.length,
      tickets_resolved_history_count: resolvedHistory.length,
      tickets_total_history_count: tickets.length,

      engagement_tier: engTier,
      app_opens_90d: eventCount(MIXPANEL_EVENTS.appOpens),
      last_app_open: lastApp,
      days_since_app_open: daysSinceApp,
      leads_marked_90d: eventCount(MIXPANEL_EVENTS.leadMark),
      unlock_screen_90d: eventCount(MIXPANEL_EVENTS.unlockScreen),
      total_events_90d: totalEvents,

      ytd_leads: ytdTotal,
      ytd_booked: ytdBooked,
      review_target: idxIns.get(eid) ? Number((idxIns.get(eid) as any).review_target || 0) : null,
      predicted_6mo_leads: idxIns.get(eid) ? Number((idxIns.get(eid) as any).predicted_6_month_leads || 0) || null : null,
      predicted_6mo_revenue: idxIns.get(eid) ? Number((idxIns.get(eid) as any).predicted_6_month_revenue || 0) || null : null,
      active_keywords: activeKw,
      click_dip_pct: dipPct,
      click_peak_month: peakMonth,

      am_history_count: amHistoryNames.length,
      am_history_names: amHistoryNames,

      risks,
      dormant_flag: engTier === 'Dormant',

      has_handover_brief: !!idxHand.get(eid),
      has_audit: !!idxAudit.get(eid),

      // Chargebee
      auto_collection: bill?.auto_collection ?? null,
      payment_method_type: bill?.payment_method_type ?? null,
      payment_method_status: bill?.payment_method_status ?? null,
      unpaid_invoice_count: bill?.unpaid_invoice_count ?? 0,
      unpaid_total_cents: bill?.unpaid_total_cents ?? 0,
      oldest_unpaid_due_date: bill?.oldest_unpaid_due_date ?? null,
      cancel_scheduled_at: bill?.cancel_scheduled_at ?? null,
      subscription_status: bill?.subscription_status ?? null,
    };
  });

  const ams = Array.from(new Set(customers.map((c) => c.am_name))).sort();

  // AM capacity (counts include incoming AMs like Taanya — show 0 / 130)
  const capCounts = new Map<string, number>();
  for (const c of customers) {
    capCounts.set(c.am_name, (capCounts.get(c.am_name) || 0) + 1);
  }
  // Ensure incoming AMs are listed too (Taanya etc.)
  for (const a of ALL_DROPDOWN_AMS) if (!capCounts.has(a)) capCounts.set(a, 0);
  const capacities: AmCapacity[] = Array.from(capCounts.entries())
    .map(([am, current]) => ({
      am,
      current,
      capacity: AM_CAPACITY_MAX,
      pct: Math.round((current / AM_CAPACITY_MAX) * 100),
      over: current >= AM_CAPACITY_MAX,
    }))
    .sort((a, b) => b.current - a.current);

  return {
    generated_at: new Date().toISOString(),
    customers, ams, capacities,
    capacity_max: AM_CAPACITY_MAX,
  };
}
