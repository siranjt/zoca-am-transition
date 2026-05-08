'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CustomerRow } from '@/lib/types';
import { ALL_PODS, ALL_DROPDOWN_AMS, ACTIVE_AMS } from '@/lib/pods';

interface AmCapacity { am: string; current: number; capacity: number; pct: number; over: boolean }
interface DashboardData {
  generated_at: string;
  customers: CustomerRow[];
  ams: string[];
  capacities: AmCapacity[];
  capacity_max: number;
}

const STORAGE_KEY = 'zoca_am_transition_app_v1';

const HEALTH_COLORS: Record<string, string> = {
  'At Risk': 'bg-red-100 text-red-700',
  'Watch': 'bg-amber-100 text-amber-700',
  'Healthy': 'bg-green-100 text-green-700',
  'Unknown': 'bg-slate-100 text-slate-500',
};
const ENG_COLORS: Record<string, string> = {
  'Active': 'bg-green-100 text-green-700',
  'Light': 'bg-amber-100 text-amber-700',
  'Cold': 'bg-orange-100 text-orange-700',
  'Dormant': 'bg-red-100 text-red-700',
};
const POD_COLORS: Record<string, string> = {
  'Pod 1': 'bg-blue-100 text-blue-800',
  'Pod 2': 'bg-purple-100 text-purple-800',
  'Pod 3': 'bg-orange-100 text-orange-800',
  'Pod 4': 'bg-green-100 text-green-800',
  'Pod 5': 'bg-yellow-100 text-yellow-800',
  'Floating': 'bg-slate-100 text-slate-700',
};

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ pod: '', am: '', health: '', engagement: '', moving: '', autopay: '', billing: '', q: '' });
  const [sortKey, setSortKey] = useState<string>('mrr');
  const [sortDesc, setSortDesc] = useState(true);
  const [selectedEid, setSelectedEid] = useState<string | null>(null);
  const [state, setState] = useState<Record<string, { moving_to?: string; notes?: string }>>({});

  useEffect(() => {
    try { setState(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')); } catch { /* noop */ }
  }, []);

  useEffect(() => {
    fetch('/api/customers')
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else setData(d); })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  function saveState(next: typeof state) {
    setState(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* noop */ }
  }
  function getMovingTo(eid: string) { return state[eid]?.moving_to ?? ''; }
  function getNotes(eid: string) { return state[eid]?.notes ?? ''; }

  const rows = useMemo(() => {
    if (!data) return [];
    let out = data.customers.filter((c) => {
      if (filters.pod && c.pod !== filters.pod) return false;
      if (filters.am && c.am_name !== filters.am) return false;
      if (filters.health && c.health !== filters.health) return false;
      if (filters.engagement && c.engagement_tier !== filters.engagement) return false;
      const mt = getMovingTo(c.entity_id);
      if (filters.moving === '__set__' && !mt) return false;
      if (filters.moving === '__none__' && mt) return false;
      if (filters.autopay && c.auto_collection !== filters.autopay) return false;
      if (filters.billing === 'unpaid' && c.unpaid_invoice_count === 0) return false;
      if (filters.billing === 'cancel_scheduled' && !c.cancel_scheduled_at) return false;
      if (filters.q) {
        const hay = [c.bizname, c.customer_id, c.locality, c.state, c.entity_id].join(' ').toLowerCase();
        if (!hay.includes(filters.q.toLowerCase())) return false;
      }
      return true;
    });
    out = [...out].sort((a, b) => {
      const ax = sortVal(a, sortKey);
      const bx = sortVal(b, sortKey);
      if (typeof ax === 'number' && typeof bx === 'number') return sortDesc ? bx - ax : ax - bx;
      return sortDesc ? String(bx).localeCompare(String(ax)) : String(ax).localeCompare(String(bx));
    });
    return out;
  }, [data, filters, state, sortKey, sortDesc]);

  function sortVal(c: CustomerRow, k: string): number | string {
    switch (k) {
      case 'risks_count': return c.risks.length;
      case 'moving_to': return getMovingTo(c.entity_id);
      case 'engagement': return c.engagement_tier;
      case 'last_app_open': return c.last_app_open || '';
      default: return (c as any)[k] ?? '';
    }
  }

  function setSort(k: string) {
    if (k === sortKey) setSortDesc((v) => !v);
    else { setSortKey(k); setSortDesc(['mrr', 'ytd_leads', 'leads_marked_90d', 'tickets_open_count', 'risks_count'].includes(k)); }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorView msg={error} />;
  if (!data) return <Loading />;

  const totalMrr = rows.reduce((s, c) => s + c.mrr, 0);
  const atRisk = rows.filter((c) => c.health === 'At Risk').length;
  const dormant = rows.filter((c) => c.engagement_tier === 'Dormant').length;
  const active = rows.filter((c) => c.engagement_tier === 'Active').length;
  const tickets = rows.reduce((s, c) => s + c.tickets_open_count, 0);
  const moving = rows.filter((c) => getMovingTo(c.entity_id)).length;
  const selected = selectedEid ? data.customers.find((c) => c.entity_id === selectedEid) : null;

  // Projected capacity given current Moving To assignments (browser localStorage)
  const projected = useMemo(() => {
    const map = new Map<string, number>();
    const caps = data?.capacities ?? [];
    for (const cap of caps) map.set(cap.am, cap.current);
    const custs = data?.customers ?? [];
    for (const c of custs) {
      const mt = getMovingTo(c.entity_id);
      if (!mt || mt === '— Keep —' || mt === c.am_name) continue;
      map.set(c.am_name, (map.get(c.am_name) || 0) - 1);
      map.set(mt, (map.get(mt) || 0) + 1);
    }
    return map;
  }, [data, state]);

  return (
    <div className="min-h-screen">
      <header className="bg-gradient-to-br from-zoca-blue to-zoca-accent text-white p-5 shadow-md">
        <h1 className="text-xl font-bold">Zoca AM Transition Dashboard</h1>
        <div className="text-xs opacity-85 mt-1">
          Live · {data.customers.length} active customers · {data.ams.length} AMs · 5 pods · Generated {new Date(data.generated_at).toLocaleString()}
        </div>
      </header>

      <div className="p-5">
        <div className="grid grid-cols-6 gap-2 mb-4">
          <Tile label="Showing" value={rows.length.toString()} sub={`$${Math.round(totalMrr).toLocaleString()} MRR`} />
          <Tile label="At Risk" value={atRisk.toString()} variant="red" />
          <Tile label="Dormant" value={dormant.toString()} variant="red" />
          <Tile label="Active app users" value={active.toString()} variant="green" />
          <Tile label="Open tickets" value={tickets.toString()} variant="amber" />
          <Tile label="Marked for handoff" value={moving.toString()} variant="blue" />
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3 mb-3">
          <div className="text-[10px] uppercase tracking-wide font-bold text-zoca-blue mb-2">AM Capacity (max {data.capacity_max ?? 130} per AM)</div>
          <div className="flex flex-wrap gap-2">
            {(data.capacities ?? []).map((cap) => {
              const max = data.capacity_max ?? 130;
              const proj = projected.get(cap.am) ?? cap.current;
              const projPct = Math.round((proj / max) * 100);
              const projOver = proj >= max;
              const changed = proj !== cap.current;
              return (
                <div key={cap.am} className={`min-w-[150px] flex-1 bg-slate-50 rounded p-2 border ${projOver ? 'border-red-400' : 'border-slate-200'}`}>
                  <div className="text-[11px] font-semibold text-slate-700 truncate">{cap.am}</div>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-base font-bold ${projOver ? 'text-red-600' : projPct >= 90 ? 'text-amber-600' : 'text-zoca-blue'}`}>{proj}</span>
                    <span className="text-[10px] text-slate-500">/ {max}</span>
                    {changed && <span className="text-[10px] text-orange-700 ml-1">({proj > cap.current ? '+' : ''}{proj - cap.current})</span>}
                  </div>
                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1">
                    <div className={`h-full ${projOver ? 'bg-red-500' : projPct >= 90 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, projPct)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3 mb-3 flex flex-wrap gap-2 items-center text-sm">
          <Select label="Pod" value={filters.pod} onChange={(v) => setFilters({ ...filters, pod: v })} options={['', ...ALL_PODS]} />
          <Select label="Current AM" value={filters.am} onChange={(v) => setFilters({ ...filters, am: v })} options={['', ...ACTIVE_AMS]} />
          <Select label="Health" value={filters.health} onChange={(v) => setFilters({ ...filters, health: v })} options={['', 'At Risk', 'Watch', 'Healthy']} />
          <Select label="Engagement" value={filters.engagement} onChange={(v) => setFilters({ ...filters, engagement: v })} options={['', 'Active', 'Light', 'Cold', 'Dormant']} />
          <SelectKv label="Moving To" value={filters.moving} onChange={(v) => setFilters({ ...filters, moving: v })}
            options={[['', 'All'], ['__set__', 'Has assignment'], ['__none__', 'Unassigned']]} />
          <SelectKv label="Auto-pay" value={filters.autopay} onChange={(v) => setFilters({ ...filters, autopay: v })}
            options={[['', 'All'], ['on', 'On'], ['off', 'Off']]} />
          <SelectKv label="Billing" value={filters.billing} onChange={(v) => setFilters({ ...filters, billing: v })}
            options={[['', 'All'], ['unpaid', 'Has unpaid'], ['cancel_scheduled', 'Cancel scheduled']]} />
          <input type="text" placeholder="search bizname / id / locality" value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            className="border border-slate-300 rounded px-2 py-1 text-sm min-w-[220px]" />
          <button className="bg-white border border-zoca-blue text-zoca-blue px-3 py-1 rounded font-semibold"
            onClick={() => setFilters({ pod: '', am: '', health: '', engagement: '', moving: '', autopay: '', billing: '', q: '' })}>Reset</button>
        </div>

        <div className={`grid gap-3 ${selectedEid ? 'grid-cols-[1fr_460px]' : 'grid-cols-1'}`}>
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-zoca-blue text-white text-[11px] uppercase tracking-wide">
                    {[
                      ['pod', 'Pod'], ['am_name', 'Current AM'], ['moving_to', 'Moving To'], ['bizname', 'Business'],
                      ['health', 'Health'], ['engagement', 'App'], ['auto_collection', 'Auto-Pay'], ['mrr', 'MRR'],
                      ['unpaid_invoice_count', 'Unpaid'], ['ytd_leads', 'YTD Leads'],
                      ['leads_marked_90d', 'Marked 90d'], ['tickets_open_count', 'Tix'], ['risks_count', 'Risks'],
                    ].map(([k, lbl]) => (
                      <th key={k as string} onClick={() => setSort(k as string)} className="px-2 py-2 text-left cursor-pointer hover:bg-zoca-blueDeep font-semibold">{lbl}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={13} className="py-12 text-center text-slate-500">No customers match the current filters.</td></tr>
                  ) : rows.map((c) => {
                    const mt = getMovingTo(c.entity_id);
                    return (
                      <tr key={c.entity_id} onClick={() => setSelectedEid(c.entity_id)}
                        className={`border-b border-slate-100 cursor-pointer hover:bg-blue-50 ${selectedEid === c.entity_id ? 'bg-blue-100' : ''}`}>
                        <td className="px-2 py-2"><Chip className={POD_COLORS[c.pod]}>{c.pod}</Chip></td>
                        <td className="px-2 py-2 text-sm">{c.am_name}</td>
                        <td className="px-2 py-2">{mt ? <span className="bg-orange-100 text-orange-800 font-semibold px-2 py-0.5 rounded text-xs">→ {mt}</span> : <span className="text-slate-400 text-xs">—</span>}</td>
                        <td className="px-2 py-2"><div className="font-semibold text-zoca-blue">{c.bizname || '—'}</div><div className="text-xs text-slate-500">{[c.locality, c.state].filter(Boolean).join(', ')}</div></td>
                        <td className="px-2 py-2"><Chip className={HEALTH_COLORS[c.health]}>{c.health}</Chip></td>
                        <td className="px-2 py-2"><Chip className={ENG_COLORS[c.engagement_tier]}>{c.engagement_tier}</Chip></td>
                        <td className="px-2 py-2">
                          {c.auto_collection === 'on' && <Chip className="bg-green-100 text-green-700">ON</Chip>}
                          {c.auto_collection === 'off' && <Chip className="bg-red-100 text-red-700">OFF</Chip>}
                          {c.auto_collection == null && <span className="text-slate-400 text-xs">—</span>}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-sm">${Math.round(c.mrr).toLocaleString()}</td>
                        <td className="px-2 py-2 text-right text-sm">
                          {c.unpaid_invoice_count > 0
                            ? <span className="text-red-600 font-semibold">{c.unpaid_invoice_count} (${Math.round(c.unpaid_total_cents / 100).toLocaleString()})</span>
                            : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-2 py-2 text-right text-sm">{c.ytd_leads}</td>
                        <td className="px-2 py-2 text-right text-sm">{c.leads_marked_90d}</td>
                        <td className="px-2 py-2 text-right text-sm">{c.tickets_open_count}{c.tickets_high_priority_count ? <span className="text-red-600 font-bold"> ({c.tickets_high_priority_count}H)</span> : ''}</td>
                        <td className="px-2 py-2 text-sm">{c.risks.length || <span className="text-slate-400">none</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {selected && (
            <DetailPanel
              c={selected}
              movingTo={getMovingTo(selected.entity_id)}
              notes={getNotes(selected.entity_id)}
              projected={projected}
              capacityMax={data.capacity_max ?? 130}
              onMovingChange={(v) => saveState({ ...state, [selected.entity_id]: { ...state[selected.entity_id], moving_to: v } })}
              onNotesChange={(v) => saveState({ ...state, [selected.entity_id]: { ...state[selected.entity_id], notes: v } })}
              onClose={() => setSelectedEid(null)}
            />
          )}
        </div>

        <div className="text-xs text-slate-500 mt-4">Phase 1 MVP · Moving To assignments are stored in your browser only. Phase 2 wires Vercel Postgres for shared state.</div>
      </div>
    </div>
  );
}

function Tile({ label, value, sub, variant }: { label: string; value: string; sub?: string; variant?: 'red' | 'green' | 'amber' | 'blue' }) {
  const cls = variant === 'red' ? 'text-red-600' : variant === 'green' ? 'text-green-600' : variant === 'amber' ? 'text-amber-600' : variant === 'blue' ? 'text-zoca-accent' : 'text-zoca-blue';
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3">
      <div className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">{label}</div>
      <div className={`text-2xl font-bold ${cls}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

function Chip({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={`inline-block px-2 py-0.5 text-[10px] uppercase tracking-wide font-semibold rounded-full ${className || ''}`}>{children}</span>;
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="flex items-center gap-1 text-xs text-slate-600 font-semibold">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-sm font-normal min-w-[120px]">
        {options.map((o, i) => <option key={i} value={o}>{o || 'All'}</option>)}
      </select>
    </label>
  );
}
function SelectKv({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="flex items-center gap-1 text-xs text-slate-600 font-semibold">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-sm font-normal min-w-[140px]">
        {options.map(([v, l], i) => <option key={i} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

function DetailPanel({ c, movingTo, notes, projected, capacityMax, onMovingChange, onNotesChange, onClose }: {
  c: CustomerRow; movingTo: string; notes: string;
  projected: Map<string, number>; capacityMax: number;
  onMovingChange: (v: string) => void; onNotesChange: (v: string) => void; onClose: () => void;
}) {
  const targetLoad = movingTo && movingTo !== '— Keep —' ? projected.get(movingTo) ?? 0 : null;
  const targetWillExceed = targetLoad != null && targetLoad > capacityMax;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 sticky top-3 max-h-[calc(100vh-24px)] overflow-y-auto relative">
      <button onClick={onClose} className="absolute top-3 right-3 text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
      <h2 className="text-lg font-bold text-zoca-blue">{c.bizname}</h2>
      <div className="text-xs text-slate-500 mb-2">{[c.locality, c.state].filter(Boolean).join(', ')} · {c.primary_category} · {c.customer_id}</div>
      <div className="flex gap-1 mb-2">
        <Chip className={POD_COLORS[c.pod]}>{c.pod}</Chip>
        <Chip className={HEALTH_COLORS[c.health]}>{c.health}</Chip>
        <Chip className={ENG_COLORS[c.engagement_tier]}>App: {c.engagement_tier}</Chip>
      </div>
      <div className="text-2xl font-bold text-zoca-blue mb-2">${Math.round(c.mrr).toLocaleString()}/mo</div>

      <Section title="Handoff assignment">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600">Move to →</span>
          <select value={movingTo} onChange={(e) => onMovingChange(e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-xs">
            <option value="">— not assigned —</option>
            {ALL_DROPDOWN_AMS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        {targetLoad != null && (
          <div className={`mt-2 text-xs px-2 py-1 rounded ${targetWillExceed ? 'bg-red-100 text-red-700 font-semibold' : 'bg-slate-100 text-slate-700'}`}>
            {targetWillExceed && '⚠ '}
            {movingTo}'s projected load: {targetLoad} / {capacityMax}
            {targetWillExceed && ` — exceeds capacity by ${targetLoad - capacityMax}`}
          </div>
        )}
      </Section>

      <Section title="Risks & signals">
        {c.risks.length === 0 ? <div className="text-xs text-slate-400">No active risk signals.</div>
          : c.risks.map((r, i) => <div key={i} className="bg-red-100 text-red-700 px-2 py-1 rounded mb-1 text-xs font-medium">{r}</div>)}
      </Section>

      <Section title="Billing (Chargebee)">
        <div className="grid grid-cols-2 gap-2">
          <Cell label="Auto-debit" value={c.auto_collection ? c.auto_collection.toUpperCase() : '—'} red={c.auto_collection === 'off'} />
          <Cell label="Subscription" value={c.subscription_status || '—'} />
          <Cell label="Payment method" value={c.payment_method_type || '—'} />
          <Cell label="PM status" value={c.payment_method_status || '—'} red={c.payment_method_status === 'invalid'} />
          <Cell label="Unpaid invoices" value={c.unpaid_invoice_count > 0 ? `${c.unpaid_invoice_count} ($${Math.round(c.unpaid_total_cents / 100).toLocaleString()})` : '—'} red={c.unpaid_invoice_count > 0} />
          <Cell label="Cancel scheduled" value={c.cancel_scheduled_at ? new Date(c.cancel_scheduled_at).toLocaleDateString() : '—'} red={!!c.cancel_scheduled_at} />
        </div>
        {c.oldest_unpaid_due_date && (
          <div className="mt-2 text-xs text-red-700 bg-red-50 px-2 py-1 rounded">
            Oldest unpaid invoice due: {new Date(c.oldest_unpaid_due_date).toLocaleDateString()}
          </div>
        )}
      </Section>

      <Section title="Performance">
        <div className="grid grid-cols-2 gap-2">
          <Cell label="YTD Leads" value={String(c.ytd_leads)} />
          <Cell label="YTD Booked" value={String(c.ytd_booked)} />
          <Cell label="Weekly review target" value={c.review_target == null ? '—' : String(c.review_target)} />
          <Cell label="Active keywords" value={String(c.active_keywords)} />
          <Cell label="GBP click dip" value={c.click_dip_pct == null ? '—' : `${c.click_dip_pct.toFixed(0)}%`} red={c.click_dip_pct != null && c.click_dip_pct >= 30} />
          <Cell label="Click peak" value={c.click_peak_month || '—'} />
          <Cell label="6mo Lead Prediction" value={c.predicted_6mo_leads == null ? '—' : String(c.predicted_6mo_leads)} />
          <Cell label="6mo Revenue Prediction" value={c.predicted_6mo_revenue == null ? '—' : `$${Math.round(c.predicted_6mo_revenue).toLocaleString()}`} />
        </div>
        <div className="mt-1 text-[10px] text-slate-400 italic">Predictions are internal-only. Do not surface to customers.</div>
      </Section>

      <Section title="AM history">
        <div className="text-xs">
          <strong>{c.am_history_count ?? 0}</strong> distinct AM{(c.am_history_count ?? 0) === 1 ? '' : 's'} ever assigned
          {(c.am_history_count ?? 0) >= 3 && <span className="text-red-600 font-bold ml-1">⚠ AM churn</span>}
        </div>
        {(c.am_history_names?.length ?? 0) > 0 && (
          <div className="text-xs text-slate-700 mt-1">
            {(c.am_history_names ?? []).map((n, i) => (
              <span key={i}>{i > 0 && <span className="text-slate-400"> → </span>}<span className={n === c.am_name ? 'font-semibold text-zoca-blue' : ''}>{n}</span></span>
            ))}
          </div>
        )}
      </Section>

      <Section title="Product usage (Zoca app, 90d)">
        <div className="grid grid-cols-2 gap-2">
          <Cell label="App opens 90d" value={String(c.app_opens_90d)} />
          <Cell label="Last app open" value={c.last_app_open ? new Date(c.last_app_open).toLocaleDateString() : 'never'} red={!c.last_app_open} />
          <Cell label="Leads marked" value={String(c.leads_marked_90d)} />
          <Cell label="Unlock-leads visits" value={String(c.unlock_screen_90d)} />
          <Cell label="Total events 90d" value={String(c.total_events_90d)} />
          <Cell label="Days since open" value={c.days_since_app_open == null ? '—' : `${c.days_since_app_open}d`} />
        </div>
      </Section>

      <Section title="Tickets (full history)">
        <div className="text-xs flex gap-3">
          <span>Open: <strong className={c.tickets_open_count > 0 ? 'text-red-600' : 'text-slate-700'}>{c.tickets_open_count}</strong>{c.tickets_high_priority_count ? <span className="text-red-600 font-bold"> · {c.tickets_high_priority_count} HIGH</span> : ''}</span>
          <span>Resolved (history): <strong className="text-slate-700">{c.tickets_resolved_history_count ?? 0}</strong></span>
          <span>Total ever: <strong className="text-slate-700">{c.tickets_total_history_count ?? 0}</strong></span>
        </div>
        {(c.tickets_total_history_count ?? 0) >= 5 && (
          <div className="text-[11px] text-amber-700 bg-amber-50 px-2 py-1 rounded mt-1">
            ⚠ This account has had {c.tickets_total_history_count} total tickets — high-history accounts churn at 2-3× the rate.
          </div>
        )}
      </Section>

      <Section title="Other signals">
        <div className="text-xs flex flex-col gap-1">
          {c.has_handover_brief && <div className="bg-blue-50 text-blue-800 px-2 py-1 rounded">Has prior AE→AM handover brief on file</div>}
          {c.has_audit && <div className="bg-purple-50 text-purple-800 px-2 py-1 rounded">Has GBP audit data</div>}
          {!c.has_handover_brief && !c.has_audit && <div className="text-slate-400">—</div>}
        </div>
      </Section>

      <Section title="Notes (saved locally)">
        <textarea className="w-full min-h-[80px] p-2 border border-slate-300 rounded text-xs" value={notes} onChange={(e) => onNotesChange(e.target.value)} placeholder="Add transition notes..." />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <div className="text-[10px] uppercase tracking-wide font-bold text-zoca-blue border-b border-slate-200 pb-1 mb-2">{title}</div>
      {children}
    </div>
  );
}

function Cell({ label, value, red }: { label: string; value: string; red?: boolean }) {
  return (
    <div className="bg-slate-50 rounded p-2">
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className={`text-base font-bold ${red ? 'text-red-600' : 'text-zoca-blue'}`}>{value}</div>
    </div>
  );
}

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-zoca-blue font-semibold">Loading customers from Metabase…</div>
    </div>
  );
}

function ErrorView({ msg }: { msg: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="bg-red-50 border border-red-300 rounded-lg p-6 max-w-2xl">
        <div className="text-red-700 font-bold mb-2">Failed to load data</div>
        <pre className="text-xs text-red-800 whitespace-pre-wrap">{msg}</pre>
        <div className="text-xs text-red-600 mt-3">Check that <code>METABASE_API_KEY</code> is set in your environment.</div>
      </div>
    </div>
  );
}
