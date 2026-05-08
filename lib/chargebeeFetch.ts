/**
 * High-level: get all per-customer billing data.
 * Cached for 10 minutes via Next.js unstable_cache to stay well under
 * Chargebee's 150 req/min rate limit.
 */
import { unstable_cache } from 'next/cache';
import {
  listAllCustomers,
  listAllActiveSubscriptions,
  listAllUnpaidInvoices,
  type CbCustomer,
  type CbSubscription,
  type CbInvoice,
} from './chargebee';

export interface BillingForCustomer {
  customer_id: string;
  auto_collection: 'on' | 'off' | null;
  payment_method_type: string | null;
  payment_method_status: string | null;
  net_term_days: number | null;
  // From subscriptions
  subscription_status: string | null;
  cancel_scheduled_at: string | null;
  current_term_end: string | null;
  // From invoices
  unpaid_invoice_count: number;
  unpaid_total_cents: number;
  oldest_unpaid_due_date: string | null;
}

function tsToIso(ts: number | undefined): string | null {
  if (!ts) return null;
  return new Date(ts * 1000).toISOString();
}

async function fetchBillingDataUncached(): Promise<Record<string, BillingForCustomer>> {
  const [customers, subs, invoices] = await Promise.all([
    listAllCustomers().catch((e) => { console.error('[cb customers]', e); return [] as CbCustomer[]; }),
    listAllActiveSubscriptions().catch((e) => { console.error('[cb subs]', e); return [] as CbSubscription[]; }),
    listAllUnpaidInvoices().catch((e) => { console.error('[cb invoices]', e); return [] as CbInvoice[]; }),
  ]);

  // Index subs by customer_id (pick the most recent / non-cancelled)
  const subByCustomer = new Map<string, CbSubscription>();
  for (const s of subs) {
    const cur = subByCustomer.get(s.customer_id);
    if (!cur) { subByCustomer.set(s.customer_id, s); continue; }
    // Prefer 'active' over others
    if (s.status === 'active' && cur.status !== 'active') subByCustomer.set(s.customer_id, s);
  }

  // Group invoices by customer_id
  const invByCustomer = new Map<string, CbInvoice[]>();
  for (const inv of invoices) {
    if (!invByCustomer.has(inv.customer_id)) invByCustomer.set(inv.customer_id, []);
    invByCustomer.get(inv.customer_id)!.push(inv);
  }

  const out: Record<string, BillingForCustomer> = {};
  for (const c of customers) {
    const sub = subByCustomer.get(c.id);
    const invs = invByCustomer.get(c.id) || [];
    const oldest = invs.reduce<number | null>((acc, x) => {
      const d = x.due_date ?? x.date ?? null;
      if (d == null) return acc;
      if (acc == null || d < acc) return d;
      return acc;
    }, null);
    out[c.id] = {
      customer_id: c.id,
      auto_collection: c.auto_collection ?? null,
      payment_method_type: c.payment_method?.type ?? null,
      payment_method_status: c.payment_method?.status ?? null,
      net_term_days: c.net_term_days ?? null,
      subscription_status: sub?.status ?? null,
      cancel_scheduled_at: tsToIso(sub?.cancel_schedule_created_at),
      current_term_end: tsToIso(sub?.current_term_end),
      unpaid_invoice_count: invs.length,
      unpaid_total_cents: invs.reduce((s, x) => s + (x.amount_due ?? x.total ?? 0), 0),
      oldest_unpaid_due_date: tsToIso(oldest ?? undefined),
    };
  }
  return out;
}

/**
 * Cached wrapper. Revalidates every 10 minutes across all server invocations.
 * Falls back to throwing if uncached + Chargebee is down — caller should catch.
 */
export const fetchBillingData = unstable_cache(
  fetchBillingDataUncached,
  ['chargebee_billing_v1'],
  { revalidate: 600, tags: ['chargebee'] },
);
