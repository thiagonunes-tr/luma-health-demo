import { env } from "cloudflare:workers";

export type DemoRole = "patient" | "staff";

type DemoAccount = {
  email: string;
  name: string;
  role: DemoRole;
  passwordHash: string;
};

type RuntimeEnv = {
  DB: D1Database;
  RESEND_API_KEY?: string;
  MFA_SESSION_SECRET?: string;
  MFA_FROM_EMAIL?: string;
};

type SessionPayload = {
  email: string;
  name: string;
  role: DemoRole;
  expiresAt: number;
};

export const SESSION_COOKIE = "luma_session";
export const SESSION_TTL_SECONDS = 8 * 60 * 60;
export const MFA_TTL_MS = 10 * 60 * 1000;
export const MAX_MFA_ATTEMPTS = 5;
export const RESEND_COOLDOWN_MS = 60 * 1000;
export const HOURLY_EMAIL_LIMIT = 5;

const accounts: DemoAccount[] = [
  {
    email: "patient.demo@testrigor-mail.com",
    name: "Maria Lopez",
    role: "patient",
    passwordHash:
      "a92fbb35c06cca2dce6ea07e7b86fe2dc723d7ff1a00f3dafccc643c3b5188f2",
  },
  {
    email: "employee.demo@testrigor-mail.com",
    name: "Thiago Nunes",
    role: "staff",
    passwordHash:
      "d9e28261b705c539ea1678e9cd14d76d476a680ce6245a49e272ac8c0fd84f76",
  },
];

export function getRuntimeEnv(): RuntimeEnv {
  return env as unknown as RuntimeEnv;
}

export function findAccount(email: string): DemoAccount | undefined {
  const normalized = email.trim().toLowerCase();
  return accounts.find((account) => account.email === normalized);
}

export async function verifyPassword(
  account: DemoAccount,
  password: string,
): Promise<boolean> {
  const candidate = await sha256Hex(password);
  return constantTimeEqual(candidate, account.passwordHash);
}

export function createMfaCode(): string {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(values[0] % 1_000_000).padStart(6, "0");
}

export async function hashMfaCode(
  challengeId: string,
  code: string,
): Promise<string> {
  const secret = requiredSecret("MFA_SESSION_SECRET");
  return sha256Hex(`${challengeId}:${code}:${secret}`);
}

export async function signSession(
  account: Pick<DemoAccount, "email" | "name" | "role">,
): Promise<string> {
  const payload: SessionPayload = {
    email: account.email,
    name: account.name,
    role: account.role,
    expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000,
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = await hmac(encoded, requiredSecret("MFA_SESSION_SECRET"));
  return `${encoded}.${signature}`;
}

export async function readSession(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  const [encoded, providedSignature, extra] = token.split(".");
  if (!encoded || !providedSignature || extra) return null;

  const expectedSignature = await hmac(
    encoded,
    requiredSecret("MFA_SESSION_SECRET"),
  );
  if (!constantTimeEqual(providedSignature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encoded)) as SessionPayload;
    const account = findAccount(payload.email);
    if (
      !account ||
      payload.role !== account.role ||
      payload.name !== account.name ||
      payload.expiresAt <= Date.now()
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function sendMfaEmail(
  recipient: string,
  code: string,
  challengeId: string,
): Promise<void> {
  const runtime = getRuntimeEnv();
  const apiKey = requiredSecret("RESEND_API_KEY");
  const from = runtime.MFA_FROM_EMAIL ?? "Luma Health <mfa@lumahealth.com>";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": challengeId,
    },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject: `${code} is your Luma Health verification code`,
      text: `Your Luma Health verification code is ${code}. It expires in 10 minutes. If you did not try to sign in, you can ignore this email.`,
      html: emailHtml(code),
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("Resend rejected an MFA email", response.status, errorBody);
    throw new Error("The verification email could not be sent.");
  }
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  const visible = local.slice(0, Math.min(3, local.length));
  return `${visible}${"•".repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}

function requiredSecret(key: "RESEND_API_KEY" | "MFA_SESSION_SECRET"): string {
  const value = getRuntimeEnv()[key];
  if (!value) throw new Error(`${key} is not configured.`);
  return value;
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return bytesToHex(new Uint8Array(digest));
}

async function hmac(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return base64UrlEncodeBytes(new Uint8Array(signature));
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function base64UrlEncode(value: string): string {
  return base64UrlEncodeBytes(new TextEncoder().encode(value));
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return new TextDecoder().decode(
    Uint8Array.from(binary, (character) => character.charCodeAt(0)),
  );
}

function emailHtml(code: string): string {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f4f8f7;font-family:Arial,Helvetica,sans-serif;color:#182b32">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;background:#f4f8f7">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border:1px solid #e1eae7;border-radius:18px;overflow:hidden">
          <tr><td style="padding:28px 32px;background:#116f68;color:#ffffff;font-size:20px;font-weight:700">Luma Health</td></tr>
          <tr><td style="padding:34px 32px">
            <p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:1.2px;color:#117b72">SECURE SIGN-IN</p>
            <h1 style="margin:0 0 12px;font-size:25px">Verify your identity</h1>
            <p style="margin:0 0 26px;color:#63757b;font-size:15px;line-height:1.55">Enter this code to finish signing in to your Luma Health account.</p>
            <div style="padding:19px;text-align:center;background:#edf7f4;border-radius:12px;color:#0b5f59;font-size:34px;font-weight:800;letter-spacing:9px">${code}</div>
            <p style="margin:22px 0 0;color:#63757b;font-size:13px;line-height:1.5">This code expires in 10 minutes and can only be used once. If you did not try to sign in, you can safely ignore this email.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}
