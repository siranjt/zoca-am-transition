/**
 * Vercel Postgres client + idempotent schema migration.
 * Tables:
 *  - transitions       — one row per entity_id, stores Moving To / Handoff Status / Notes
 *  - transition_audit  — append-only log of every change with actor + timestamp
 *
 * Connection comes from POSTGRES_URL injected by Vercel when the project is
 * linked to a Vercel Postgres database.
 */
import { sql } from '@vercel/postgres';

let schemaReady: Promise<void> | null = null;

export async function ensureSchema(): Promise<void> {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS transitions (
        entity_id        UUID PRIMARY KEY,
        moving_to        TEXT,
        handoff_status   TEXT NOT NULL DEFAULT 'Not Started',
        transition_notes TEXT,
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by       TEXT
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS transition_audit (
        id          BIGSERIAL PRIMARY KEY,
        entity_id   UUID NOT NULL,
        field       TEXT NOT NULL,
        old_value   TEXT,
        new_value   TEXT,
        changed_by  TEXT,
        changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS transition_audit_entity_idx ON transition_audit(entity_id, changed_at DESC)`;
  })().catch((err) => {
    schemaReady = null;
    throw err;
  });
  return schemaReady;
}

export interface TransitionRow {
  entity_id: string;
  moving_to: string | null;
  handoff_status: string;
  transition_notes: string | null;
  updated_at: string;
  updated_by: string | null;
}

export async function listTransitions(): Promise<TransitionRow[]> {
  await ensureSchema();
  const { rows } = await sql<TransitionRow>`SELECT entity_id, moving_to, handoff_status, transition_notes, updated_at, updated_by FROM transitions`;
  return rows;
}

export interface UpsertTransitionInput {
  entity_id: string;
  moving_to?: string | null;
  handoff_status?: string;
  transition_notes?: string | null;
  actor: string;
}

/**
 * Upsert a transition row; auto-record audit entries for every changed field.
 */
export async function upsertTransition(input: UpsertTransitionInput): Promise<TransitionRow> {
  await ensureSchema();
  const { entity_id, moving_to, handoff_status, transition_notes, actor } = input;

  // Fetch current state to diff against, for the audit log
  const { rows: existing } = await sql<TransitionRow>`SELECT entity_id, moving_to, handoff_status, transition_notes, updated_at, updated_by FROM transitions WHERE entity_id = ${entity_id}`;
  const prev = existing[0];

  // Upsert
  const { rows } = await sql<TransitionRow>`
    INSERT INTO transitions (entity_id, moving_to, handoff_status, transition_notes, updated_at, updated_by)
    VALUES (
      ${entity_id},
      ${moving_to ?? null},
      ${handoff_status ?? 'Not Started'},
      ${transition_notes ?? null},
      NOW(),
      ${actor}
    )
    ON CONFLICT (entity_id) DO UPDATE SET
      moving_to        = COALESCE(EXCLUDED.moving_to, transitions.moving_to),
      handoff_status   = COALESCE(EXCLUDED.handoff_status, transitions.handoff_status),
      transition_notes = COALESCE(EXCLUDED.transition_notes, transitions.transition_notes),
      updated_at       = NOW(),
      updated_by       = EXCLUDED.updated_by
    RETURNING entity_id, moving_to, handoff_status, transition_notes, updated_at, updated_by
  `;
  const next = rows[0];

  // Write audit entries for changed fields
  const audits: Array<{ field: string; oldVal: string | null; newVal: string | null }> = [];
  if (moving_to !== undefined && (prev?.moving_to ?? null) !== (moving_to ?? null)) {
    audits.push({ field: 'moving_to', oldVal: prev?.moving_to ?? null, newVal: moving_to ?? null });
  }
  if (handoff_status !== undefined && (prev?.handoff_status ?? null) !== handoff_status) {
    audits.push({ field: 'handoff_status', oldVal: prev?.handoff_status ?? null, newVal: handoff_status });
  }
  if (transition_notes !== undefined && (prev?.transition_notes ?? null) !== (transition_notes ?? null)) {
    audits.push({ field: 'transition_notes', oldVal: prev?.transition_notes ?? null, newVal: transition_notes ?? null });
  }
  for (const a of audits) {
    await sql`INSERT INTO transition_audit (entity_id, field, old_value, new_value, changed_by) VALUES (${entity_id}, ${a.field}, ${a.oldVal}, ${a.newVal}, ${actor})`;
  }
  return next;
}

export async function listAuditForEntity(entity_id: string, limit = 50): Promise<Array<{ field: string; old_value: string | null; new_value: string | null; changed_by: string | null; changed_at: string }>> {
  await ensureSchema();
  const { rows } = await sql<{ field: string; old_value: string | null; new_value: string | null; changed_by: string | null; changed_at: string }>`
    SELECT field, old_value, new_value, changed_by, changed_at
    FROM transition_audit
    WHERE entity_id = ${entity_id}
    ORDER BY changed_at DESC
    LIMIT ${limit}
  `;
  return rows;
}
