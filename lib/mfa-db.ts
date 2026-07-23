import { getRuntimeEnv } from "./auth";

let initialized = false;

export type ChallengeRecord = {
  id: string;
  email: string;
  role: "patient" | "staff";
  code_hash: string;
  attempts: number;
  created_at: number;
  expires_at: number;
  consumed_at: number | null;
};

export async function getMfaDb(): Promise<D1Database> {
  const db = getRuntimeEnv().DB;
  if (!db) throw new Error("The authentication database is not configured.");

  if (!initialized) {
    await db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS mfa_challenges (
        id text PRIMARY KEY NOT NULL,
        email text NOT NULL,
        role text NOT NULL,
        code_hash text NOT NULL,
        attempts integer DEFAULT 0 NOT NULL,
        created_at integer NOT NULL,
        expires_at integer NOT NULL,
        consumed_at integer
      )`),
      db.prepare(
        "CREATE INDEX IF NOT EXISTS mfa_challenges_email_created_idx ON mfa_challenges (email, created_at)",
      ),
    ]);
    initialized = true;
  }

  return db;
}
