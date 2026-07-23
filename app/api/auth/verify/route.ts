import { NextRequest, NextResponse } from "next/server";
import {
  MAX_MFA_ATTEMPTS,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createPersonalAccount,
  findAccount,
  hashMfaCode,
  persistAccount,
  signSession,
} from "../../../../lib/auth";
import { ChallengeRecord, getMfaDb } from "../../../../lib/mfa-db";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: { challengeId?: unknown; code?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Enter the six-digit code." }, { status: 400 });
  }

  const challengeId = typeof body.challengeId === "string" ? body.challengeId : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!challengeId || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Enter the six-digit code." }, { status: 400 });
  }

  try {
    const db = await getMfaDb();
    const challenge = await db
      .prepare("SELECT * FROM mfa_challenges WHERE id = ?")
      .bind(challengeId)
      .first<ChallengeRecord>();

    if (!challenge || challenge.consumed_at !== null || challenge.expires_at <= Date.now()) {
      return NextResponse.json(
        { error: "This verification code has expired. Request a new code." },
        { status: 410 },
      );
    }
    if (challenge.attempts >= MAX_MFA_ATTEMPTS) {
      return NextResponse.json(
        { error: "Too many incorrect attempts. Request a new code." },
        { status: 429 },
      );
    }

    const expectedHash = await hashMfaCode(challengeId, code);
    if (expectedHash !== challenge.code_hash) {
      await db
        .prepare(
          `UPDATE mfa_challenges
           SET attempts = attempts + 1
           WHERE id = ? AND consumed_at IS NULL AND attempts < ?`,
        )
        .bind(challengeId, MAX_MFA_ATTEMPTS)
        .run();
      const remaining = MAX_MFA_ATTEMPTS - challenge.attempts - 1;
      return NextResponse.json(
        {
          error:
            remaining > 0
              ? `That code is incorrect. ${remaining} ${remaining === 1 ? "attempt" : "attempts"} remaining.`
              : "Too many incorrect attempts. Request a new code.",
        },
        { status: remaining > 0 ? 401 : 429 },
      );
    }

    const consumed = await db
      .prepare(
        `UPDATE mfa_challenges
         SET consumed_at = ?
         WHERE id = ? AND consumed_at IS NULL AND expires_at > ?`,
      )
      .bind(Date.now(), challengeId, Date.now())
      .run();
    if (!consumed.meta.changes) {
      return NextResponse.json(
        { error: "This verification code has already been used." },
        { status: 409 },
      );
    }

    const account = (await findAccount(challenge.email)) ?? createPersonalAccount(challenge.email);
    if (!account || account.role !== challenge.role) {
      return NextResponse.json({ error: "This account is unavailable." }, { status: 401 });
    }

    await persistAccount(account);

    const token = await signSession(account);
    const response = NextResponse.json({
      user: { email: account.email, name: account.name, role: account.role },
    });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });
    return response;
  } catch (error) {
    console.error("Could not verify an MFA challenge", error);
    return NextResponse.json(
      { error: "We could not verify the code. Please try again." },
      { status: 500 },
    );
  }
}
