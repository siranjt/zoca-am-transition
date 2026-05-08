import { NextRequest, NextResponse } from 'next/server';
import { listTransitions, upsertTransition } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const rows = await listTransitions();
    return NextResponse.json({ transitions: rows });
  } catch (err) {
    console.error('[GET /api/transitions]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { entity_id, moving_to, handoff_status, transition_notes, actor } = body || {};
    if (!entity_id) return NextResponse.json({ error: 'entity_id required' }, { status: 400 });
    if (!actor || typeof actor !== 'string' || !actor.trim()) {
      return NextResponse.json({ error: 'actor (display name) required' }, { status: 400 });
    }
    const row = await upsertTransition({
      entity_id,
      moving_to: moving_to === undefined ? undefined : (moving_to || null),
      handoff_status,
      transition_notes: transition_notes === undefined ? undefined : (transition_notes || null),
      actor: actor.trim().slice(0, 80),
    });
    return NextResponse.json({ transition: row });
  } catch (err) {
    console.error('[POST /api/transitions]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
