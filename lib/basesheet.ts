/**
 * Fetch BaseSheet via the public Metabase CSV endpoint and parse to active customers.
 * No API key needed — this endpoint is public.
 */
import { ACTIVE_AMS } from './pods';

const BASESHEET_URL =
  'https://metabase.zoca.ai/public/question/87763e8c-8084-442e-891a-df1b11e81b47.csv';

export interface BaseRow {
  entity_id: string;
  bizname: string;
  customer_id: string;
  am_name: string;
  ae_name: string;
  state: string;
  locality: string;
  primary_category: string;
  total_monthly_revenue: number;
  app_email: string;
  phone_number: string;
  churn_date: string;
  churn_potential_flag: string;
  M0_missed: string;
  M1_missed: string;
  open_tickets_30d: string;
  unresolved_30d: string;
  last_comms_date: string;
  first_payment_date: string;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/);
  if (lines.length === 0) return [];
  const headers = parseRow(lines[0]);
  const out: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const cells = parseRow(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, j) => { row[h] = cells[j] ?? ''; });
    out.push(row);
  }
  return out;
}

function parseRow(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuote = false;
      else cur += ch;
    } else {
      if (ch === '"') inQuote = true;
      else if (ch === ',') { out.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export async function fetchActiveCustomers(): Promise<BaseRow[]> {
  const res = await fetch(BASESHEET_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`BaseSheet fetch failed: ${res.status}`);
  const text = await res.text();
  const all = parseCSV(text);
  const activeAms = new Set<string>(ACTIVE_AMS as readonly string[]);

  const out: BaseRow[] = [];
  for (const r of all) {
    if (r.churn_date) continue;
    if (!r.customer_id) continue;
    if (!activeAms.has((r.am_name || '').trim())) continue;
    out.push({
      entity_id: r.entity_id,
      bizname: r.bizname || '',
      customer_id: r.customer_id,
      am_name: (r.am_name || '').trim(),
      ae_name: r.ae_name || '',
      state: r.state || '',
      locality: r.locality || '',
      primary_category: r.updated_primary_category || r.primary_category || '',
      total_monthly_revenue: Number(r.total_monthly_revenue || 0),
      app_email: r.app_email || '',
      phone_number: r.phone_number || '',
      churn_date: r.churn_date || '',
      churn_potential_flag: r.churn_potential_flag || '',
      M0_missed: r['M0 Missed Payment'] || '',
      M1_missed: r['M-1 Missed Payment'] || '',
      open_tickets_30d: r.open_tickets_last_30_days || '0',
      unresolved_30d: r.unresolved_issues_last_30_days || '0',
      last_comms_date: r.last_comms_date || '',
      first_payment_date: r.first_payment_date || '',
    });
  }
  return out;
}
