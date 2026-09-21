import { env } from "cloudflare:workers";
import { anonymousAccessResponse, requestOwner } from "../request-owner";

type PitchItEnv = { DB?: D1Database };

const createWorkspaceTable = `
  CREATE TABLE IF NOT EXISTS pitchit_workspaces (
    user_id TEXT PRIMARY KEY NOT NULL,
    state_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

async function database() {
  const db = (env as unknown as PitchItEnv).DB;
  if (!db) throw new Error("PitchIt storage is not connected");
  await db.prepare(createWorkspaceTable).run();
  return db;
}

export async function GET(request: Request) {
  const owner = requestOwner(request);
  if (!owner) return anonymousAccessResponse();
  try {
    const db = await database();
    const row = await db.prepare("SELECT state_json, updated_at FROM pitchit_workspaces WHERE user_id = ?")
      .bind(owner).first<{ state_json: string; updated_at: string }>();
    if (!row) return Response.json({ state: null, updatedAt: null });
    const state = JSON.parse(row.state_json) as { schemaVersion?: number };
    if (state.schemaVersion !== 2) {
      await db.prepare("DELETE FROM pitchit_workspaces WHERE user_id = ?").bind(owner).run();
      return Response.json({ state: null, updatedAt: null, scrubbed: true });
    }
    return Response.json({ state, updatedAt: row.updated_at });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not load workspace" }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const owner = requestOwner(request);
  if (!owner) return anonymousAccessResponse();
  try {
    const body = await request.text();
    if (body.length > 2_000_000) return Response.json({ error: "Workspace is too large" }, { status: 413 });
    JSON.parse(body);
    const db = await database();
    await db.prepare(`
      INSERT INTO pitchit_workspaces (user_id, state_json, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET state_json = excluded.state_json, updated_at = CURRENT_TIMESTAMP
    `).bind(owner, body).run();
    return Response.json({ saved: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not save workspace" }, { status: 400 });
  }
}
