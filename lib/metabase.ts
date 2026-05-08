/**
 * Metabase Dataset API client.
 * Mirrors the pattern from zoca-performance-report/lib/metabase.ts.
 */

const BASE_URL = process.env.METABASE_BASE_URL || 'https://metabase.zoca.ai';
const API_KEY = process.env.METABASE_API_KEY;

if (!API_KEY) {
  console.warn('[metabase] METABASE_API_KEY is not set; queries will fail.');
}

export interface DatasetParams {
  database: number;
  query: string;
  parameters?: Array<Record<string, unknown>>;
}

export interface DatasetRow extends Record<string, unknown> {}

export async function dataset<T extends DatasetRow = DatasetRow>(
  params: DatasetParams
): Promise<T[]> {
  if (!API_KEY) throw new Error('METABASE_API_KEY is not set');

  // Hard timeout so a hung Metabase query can't pin a Vercel function for 5 min.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/dataset`, {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        database: params.database,
        type: 'native',
        native: {
          query: params.query,
          ...(params.parameters ? { 'template-tags': {} } : {}),
        },
        constraints: {
          'max-results': 1_000_000,
          'max-results-bare-rows': 1_000_000,
        },
      }),
      cache: 'no-store',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok && res.status !== 202) {
    const text = await res.text();
    throw new Error(`Metabase ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  if (data.error) throw new Error(`Metabase error: ${String(data.error).slice(0, 300)}`);

  const cols: Array<{ name: string }> = data?.data?.cols || [];
  const rows: unknown[][] = data?.data?.rows || [];
  return rows.map((row) => {
    const obj = {} as Record<string, unknown>;
    cols.forEach((c, i) => { obj[c.name] = row[i]; });
    return obj as T;
  });
}
