import { env } from "cloudflare:workers";

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

export type UserRecord = {
  email: string;
  name: string;
  role: "patient" | "staff";
  password_hash: string;
  created_at: number;
};

export type PendingUserRecord = {
  challenge_id: string;
  email: string;
  name: string;
  role: "patient" | "staff";
  password_hash: string;
  created_at: number;
};

export type DemoState = {
  appointmentBooked: boolean;
  intakeComplete: boolean;
  refillStatus: "none" | "pending" | "approved";
};

export const DEFAULT_DEMO_STATE: DemoState = {
  appointmentBooked: false,
  intakeComplete: false,
  refillStatus: "none",
};

const RESET_INTERVAL_MS = 24 * 60 * 60 * 1000;

export async function getMfaDb(): Promise<D1Database> {
  const db = (env as unknown as { DB?: D1Database }).DB;
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
      db.prepare(`CREATE TABLE IF NOT EXISTS users (
        email text PRIMARY KEY NOT NULL,
        name text NOT NULL,
        role text NOT NULL,
        password_hash text NOT NULL,
        created_at integer NOT NULL
      )`),
      db.prepare(`CREATE TABLE IF NOT EXISTS pending_users (
        challenge_id text PRIMARY KEY NOT NULL,
        email text NOT NULL,
        name text NOT NULL,
        role text NOT NULL,
        password_hash text NOT NULL,
        created_at integer NOT NULL
      )`),
      db.prepare(
        "CREATE INDEX IF NOT EXISTS pending_users_email_idx ON pending_users (email)",
      ),
      db.prepare(`CREATE TABLE IF NOT EXISTS demo_state (
        id text PRIMARY KEY NOT NULL,
        state_json text NOT NULL,
        updated_at integer NOT NULL
      )`),
      db.prepare(`CREATE TABLE IF NOT EXISTS environment_meta (
        id text PRIMARY KEY NOT NULL,
        last_reset_at integer NOT NULL
      )`),
    ]);
    initialized = true;
  }

  return db;
}

export async function getStoredUser(email: string): Promise<UserRecord | null> {
  const db = await getMfaDb();
  return db
    .prepare("SELECT email, name, role, password_hash, created_at FROM users WHERE email = ?")
    .bind(email)
    .first<UserRecord>();
}

export async function storeUser(user: UserRecord): Promise<void> {
  const db = await getMfaDb();
  await db
    .prepare(
      `INSERT OR IGNORE INTO users (email, name, role, password_hash, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(user.email, user.name, user.role, user.password_hash, user.created_at)
    .run();
}

export async function getPendingUser(
  challengeId: string,
): Promise<PendingUserRecord | null> {
  const db = await getMfaDb();
  return db
    .prepare(
      `SELECT challenge_id, email, name, role, password_hash, created_at
       FROM pending_users WHERE challenge_id = ?`,
    )
    .bind(challengeId)
    .first<PendingUserRecord>();
}

export async function deletePendingUser(challengeId: string): Promise<void> {
  const db = await getMfaDb();
  await db
    .prepare("DELETE FROM pending_users WHERE challenge_id = ?")
    .bind(challengeId)
    .run();
}

async function resetEnvironmentIfDue(db: D1Database): Promise<void> {
  const now = Date.now();
  const meta = await db
    .prepare("SELECT last_reset_at FROM environment_meta WHERE id = 'global'")
    .first<{ last_reset_at: number }>();

  if (!meta) {
    await db
      .prepare("INSERT INTO environment_meta (id, last_reset_at) VALUES ('global', ?)")
      .bind(now)
      .run();
    return;
  }

  if (now - meta.last_reset_at < RESET_INTERVAL_MS) return;

  await db.batch([
    db.prepare("DELETE FROM demo_state"),
    db
      .prepare("UPDATE environment_meta SET last_reset_at = ? WHERE id = 'global'")
      .bind(now),
    db.prepare("DELETE FROM mfa_challenges WHERE expires_at < ?").bind(now),
    db
      .prepare("DELETE FROM pending_users WHERE created_at < ?")
      .bind(now - RESET_INTERVAL_MS),
  ]);
}

export async function getDemoState(): Promise<DemoState> {
  const db = await getMfaDb();
  await resetEnvironmentIfDue(db);
  const record = await db
    .prepare("SELECT state_json FROM demo_state WHERE id = 'global'")
    .first<{ state_json: string }>();
  if (!record) return DEFAULT_DEMO_STATE;

  try {
    const state = JSON.parse(record.state_json) as DemoState;
    return {
      appointmentBooked: Boolean(state.appointmentBooked),
      intakeComplete: Boolean(state.intakeComplete),
      refillStatus: ["none", "pending", "approved"].includes(state.refillStatus)
        ? state.refillStatus
        : "none",
    };
  } catch {
    return DEFAULT_DEMO_STATE;
  }
}

export async function saveDemoState(state: DemoState): Promise<DemoState> {
  const db = await getMfaDb();
  await resetEnvironmentIfDue(db);
  await db
    .prepare(
      `INSERT INTO demo_state (id, state_json, updated_at)
       VALUES ('global', ?, ?)
       ON CONFLICT(id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at`,
    )
    .bind(JSON.stringify(state), Date.now())
    .run();
  return state;
}
