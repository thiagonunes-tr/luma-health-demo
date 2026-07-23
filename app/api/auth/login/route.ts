import { NextRequest, NextResponse } from "next/server";
import {
  HOURLY_EMAIL_LIMIT,
  MFA_TTL_MS,
  RESEND_COOLDOWN_MS,
  createPersonalAccount,
  createMfaCode,
  findAccount,
  hashMfaCode,
  maskEmail,
  sendMfaEmail,
  verifyPassword,
} from "../../../../lib/auth";
import { getMfaDb } from "../../../../lib/mfa-db";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";
  const account = (await findAccount(email)) ?? createPersonalAccount(email);

  if (!account || !(await verifyPassword(account, password))) {
    return NextResponse.json(
      { error: "The email or password is incorrect." },
      { status: 401 },
    );
  }

  try {
    const db = await getMfaDb();
    const now = Date.now();
    const recent = await db
      .prepare(
        `SELECT created_at FROM mfa_challenges
         WHERE email = ? AND created_at > ?
         ORDER BY created_at DESC`,
      )
      .bind(account.email, now - 60 * 60 * 1000)
      .all<{ created_at: number }>();

    const latest = recent.results[0]?.created_at;
    if (latest && now - latest < RESEND_COOLDOWN_MS) {
      const retryAfter = Math.ceil((RESEND_COOLDOWN_MS - (now - latest)) / 1000);
      return NextResponse.json(
        { error: `Please wait ${retryAfter} seconds before requesting another code.` },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }
    if (recent.results.length >= HOURLY_EMAIL_LIMIT) {
      return NextResponse.json(
        { error: "Too many codes were requested. Please try again later." },
        { status: 429 },
      );
    }

    const challengeId = crypto.randomUUID();
    const code = createMfaCode();
    const codeHash = await hashMfaCode(challengeId, code);

    await db.batch([
      db
        .prepare(
          "UPDATE mfa_challenges SET consumed_at = ? WHERE email = ? AND consumed_at IS NULL",
        )
        .bind(now, account.email),
      db
        .prepare(
          `INSERT INTO mfa_challenges
           (id, email, role, code_hash, attempts, created_at, expires_at, consumed_at)
           VALUES (?, ?, ?, ?, 0, ?, ?, NULL)`,
        )
        .bind(
          challengeId,
          account.email,
          account.role,
          codeHash,
          now,
          now + MFA_TTL_MS,
        ),
    ]);

    try {
      await sendMfaEmail(account.email, code, challengeId);
    } catch (error) {
      await db.prepare("DELETE FROM mfa_challenges WHERE id = ?").bind(challengeId).run();
      throw error;
    }

    return NextResponse.json({
      challengeId,
      destination: maskEmail(account.email),
      expiresInSeconds: MFA_TTL_MS / 1000,
    });
  } catch (error) {
    console.error("Could not create an MFA challenge", error);
    return NextResponse.json(
      { error: "We could not send your verification code. Please try again." },
      { status: 502 },
    );
  }
}
