import { NextRequest, NextResponse } from "next/server";
import { readSession, SESSION_COOKIE } from "../../../lib/auth";
import { DemoState, getDemoState, saveDemoState } from "../../../lib/mfa-db";

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

export async function PUT(request: NextRequest) {
  if (!(await requireSession(request))) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }

  let body: Partial<DemoState>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid environment state." }, { status: 400 });
  }

  if (
    typeof body.appointmentBooked !== "boolean" ||
    typeof body.intakeComplete !== "boolean" ||
    !body.refillStatus ||
    !["none", "pending", "approved"].includes(body.refillStatus)
  ) {
    return NextResponse.json({ error: "Invalid environment state." }, { status: 400 });
  }

  const state: DemoState = {
    appointmentBooked: body.appointmentBooked,
    intakeComplete: body.intakeComplete,
    refillStatus: body.refillStatus,
  };
  return NextResponse.json({ state: await saveDemoState(state) });
}
