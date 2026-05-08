import { NextResponse } from 'next/server';
import { composeDataset } from '@/lib/compose';

// Always run on each request — uses live no-store fetches to BaseSheet + Metabase
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const data = await composeDataset();
    return NextResponse.json(data);
  } catch (err) {
    console.error('[/api/customers] error', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
