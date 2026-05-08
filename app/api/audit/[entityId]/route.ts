import { NextRequest, NextResponse } from 'next/server';
import { listAuditForEntity } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_req: NextRequest, { params }: { params: { entityId: string } }) {
  try {
    const rows = await listAuditForEntity(params.entityId);
    return NextResponse.json({ audit: rows });
  } catch (err) {
    console.error('[GET /api/audit]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
