/**
 * Chargebee REST API client.
 * Auth: HTTP Basic with API key as username, empty password.
 * Site: <CHARGEBEE_SITE>.chargebee.com (e.g. "zoca").
 * Rate limit: ~150 req/min per site — we paginate list endpoints to stay well under.
 */

const SITE = process.env.CHARGEBEE_SITE || 'zoca';
const API_KEY = process.env.CHARGEBEE_API_KEY;

if (!API_KEY) {
  console.warn('[chargebee] CHARGEBEE_API_KEY is not set; calls will fail.');
}

const BASE = `https://${SITE}.chargebee.com/api/v2`;

function authHeader(): string {
  const token = Buffer.from(`${API_KEY}:`).toString('base64');
  return `Basic ${token}`;
}

interface PaginatedResponse<T> {
  list: T[];
  next_offset?: string;
}

/**
 * Generic GET that follows next_offset pagination until exhausted.
 * Returns the flattened list of items (extracted from each row's wrapper key).
 */
export async function listAll<T>(
  path: string,
  params: Record<string, string> = {},
  itemKey: string,
): Promise<T[]> {
  if (!API_KEY) throw new Error('CHARGEBEE_API_KEY is not set');

  const all: T[] = [];
  let offset: string | undefined;
  let safety = 0;
  do {
    const qs = new URLSearchParams({ ...params, limit: '100' });
    if (offset) qs.set('offset', offset);
    const url = `${BASE}${path}?${qs.toString()}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: authHeader(), Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Chargebee ${res.status} ${path}: ${text.slice(0, 300)}`);
    }
    const json = (await res.json()) as PaginatedResponse<{ [key: string]: T }>;
    for (const row of json.list || []) {
      const item = row[itemKey];
      if (item) all.push(item);
    }
    offset = json.next_offset;
    safety += 1;
    if (safety > 200) throw new Error('Chargebee pagination safety limit exceeded');
  } while (offset);
  return all;
}

// Typed shapes (only the fields we use)
export interface CbCustomer {
  id: string;
  auto_collection?: 'on' | 'off';
  email?: string;
  payment_method?: { type?: string; status?: string };
  net_term_days?: number;
}

export interface CbSubscription {
  id: string;
  customer_id: string;
  status: string;
  cancelled_at?: number;
  cancel_schedule_created_at?: number;
  current_term_end?: number;
  plan_amount?: number;
  mrr?: number;
}

export interface CbInvoice {
  id: string;
  customer_id: string;
  status: string;
  amount_due?: number;
  total?: number;
  date?: number;
  due_date?: number;
}

export async function listAllCustomers(): Promise<CbCustomer[]> {
  return listAll<CbCustomer>('/customers', {}, 'customer');
}

export async function listAllActiveSubscriptions(): Promise<CbSubscription[]> {
  // Status not in cancelled — covers active, in_trial, non_renewing, paused
  return listAll<CbSubscription>(
    '/subscriptions',
    { 'status[not_in]': '["cancelled"]' },
    'subscription',
  );
}

export async function listAllUnpaidInvoices(): Promise<CbInvoice[]> {
  // payment_due or not_paid
  return listAll<CbInvoice>(
    '/invoices',
    { 'status[in]': '["payment_due","not_paid"]' },
    'invoice',
  );
}
