import { env } from "cloudflare:workers";
import { getStoredUser, storeUser } from "./mfa-db";

export type DemoRole = "patient" | "staff";

export type DemoAccount = {
  email: string;
  name: string;
  role: DemoRole;
  passwordHash: string;
};

type RuntimeEnv = {
  DB: D1Database;
  BREVO_API_KEY?: string;
  BREVO_SENDER_EMAIL?: string;
  BREVO_SENDER_NAME?: string;
  MFA_SESSION_SECRET?: string;
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

const PATIENT_PASSWORD_HASH =
  "a92fbb35c06cca2dce6ea07e7b86fe2dc723d7ff1a00f3dafccc643c3b5188f2";

const accounts: DemoAccount[] = [
  {
    email: "patient.demo@testrigor-mail.com",
    name: "Maria Lopez",
    role: "patient",
    passwordHash: PATIENT_PASSWORD_HASH,
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

export async function findAccount(email: string): Promise<DemoAccount | undefined> {
  const normalized = email.trim().toLowerCase();
  const demoAccount = accounts.find((account) => account.email === normalized);
  if (demoAccount) return demoAccount;

  const stored = await getStoredUser(normalized);
  if (!stored) return undefined;
  return {
    email: stored.email,
    name: stored.name,
    role: stored.role,
    passwordHash: stored.password_hash,
  };
}

export function createPersonalAccount(email: string): DemoAccount | undefined {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return undefined;
  const localName = normalized.split("@")[0]
    .split(/[._+-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return {
    email: normalized,
    name: localName || "Demo Patient",
    role: "patient",
    passwordHash: PATIENT_PASSWORD_HASH,
  };
}

export async function persistAccount(account: DemoAccount): Promise<void> {
  if (accounts.some((item) => item.email === account.email)) return;
  await storeUser({
    email: account.email,
    name: account.name,
    role: account.role,
    password_hash: account.passwordHash,
    created_at: Date.now(),
  });
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
    const account = await findAccount(payload.email);
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
  const apiKey = requiredSecret("BREVO_API_KEY");
  const senderEmail = runtime.BREVO_SENDER_EMAIL;
  if (!senderEmail) throw new Error("BREVO_SENDER_EMAIL is not configured.");
  const senderName = runtime.BREVO_SENDER_NAME ?? "Luma Health";

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: recipient }],
      subject: `${code} is your Luma Health verification code`,
      textContent: `Your Luma Health verification code is ${code}. It expires in 10 minutes. If you did not try to sign in, you can ignore this email.`,
      htmlContent: emailHtml(code),
      headers: { "Idempotency-Key": challengeId },
      tags: ["luma-health-mfa"],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("Brevo rejected an MFA email", response.status, errorBody);
    throw new Error("The verification email could not be sent.");
  }
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  const visible = local.slice(0, Math.min(3, local.length));
  return `${visible}${"•".repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}

function requiredSecret(key: "BREVO_API_KEY" | "MFA_SESSION_SECRET"): string {
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
