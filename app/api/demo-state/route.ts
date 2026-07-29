import { NextRequest, NextResponse } from "next/server";
import {
  isDemoAccount,
  readSession,
  SESSION_COOKIE,
} from "../../../lib/auth";
import { isDemoStateAction } from "../../../lib/demo-state";
import {
  applyDemoStateAction,
  getDemoState,
  resetDemoState,
} from "../../../lib/mfa-db";

export const dynamic = "force-dynamic";

async function requireSession(request: NextRequest) {
  return readSession(request.cookies.get(SESSION_COOKIE)?.value);
}

export async function GET(request: NextRequest) {
  if (!(await requireSession(request))) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }
  return NextResponse.json({ state: await getDemoState() });
}

export async function PATCH(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }

  let body: {
    action?: unknown;
    appointmentTime?: unknown;
    intake?: unknown;
    messageBody?: unknown;
    insurance?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Choose a valid demo action." }, { status: 400 });
  }

  if (!isDemoStateAction(body.action)) {
    return NextResponse.json({ error: "Choose a valid demo action." }, { status: 400 });
  }

  const result = await applyDemoStateAction(body.action, session.role, {
    appointmentTime: body.appointmentTime,
    intake: body.intake,
    messageBody: body.messageBody,
    insurance: body.insurance,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }
  return NextResponse.json({ state: result.state });
}

export async function DELETE(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }
  if (!isDemoAccount(session.email)) {
    return NextResponse.json(
      { error: "Only fixed demo accounts can reset the shared environment." },
      { status: 403 },
    );
  }
  return NextResponse.json({ state: await resetDemoState() });
}
