import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { redirect } from "react-router";
import { hmacHex, readCookie, sha256Hex, timingSafeEqual, bytesToBase64Url } from "./crypto";

const SESSION_COOKIE = "__Host-session";
const CHALLENGE_COOKIE = "__Host-challenge";
const SESSION_MAX_AGE = 2_592_000;
const CHALLENGE_MAX_AGE = 300;

type CredentialRow = {
  credential_id: string;
  public_key: ArrayBuffer | Uint8Array;
  counter: number;
  transports: string | null;
};

export async function requireAdmin(request: Request, env: Env): Promise<void> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) throw redirect("/admin/login");
  const tokenHash = await sha256Hex(token);
  const row = await env.DB.prepare("SELECT expires_at FROM sessions WHERE token_hash = ?")
    .bind(tokenHash)
    .first<{ expires_at: number }>();
  if (!row || row.expires_at < Date.now()) {
    if (row) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
    throw redirect("/admin/login");
  }
}

export function assertAdminOrigin(request: Request, env: Env): void {
  if (request.headers.get("Origin") !== env.ORIGIN) {
    throw new Response("Bad origin", { status: 403 });
  }
}

export async function guardAdmin(request: Request, env: Env): Promise<void> {
  if (request.method === "POST") assertAdminOrigin(request, env);
  await requireAdmin(request, env);
}

export async function hasAdminSession(request: Request, env: Env): Promise<boolean> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return false;
  const tokenHash = await sha256Hex(token);
  const row = await env.DB.prepare("SELECT expires_at FROM sessions WHERE token_hash = ?")
    .bind(tokenHash)
    .first<{ expires_at: number }>();
  return !!row && row.expires_at >= Date.now();
}

export async function registrationAllowed(request: Request, env: Env): Promise<boolean> {
  const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM admin_credentials").first<{ n: number }>();
  if ((count?.n ?? 0) > 0) return hasAdminSession(request, env);
  const token = new URL(request.url).searchParams.get("token") ?? "";
  return timingSafeEqual(token, env.ADMIN_SETUP_TOKEN);
}

export async function beginRegistration(env: Env): Promise<Response> {
  const existing = await listCredentials(env);
  const options = await generateRegistrationOptions({
    rpName: "Wardrobe",
    rpID: env.RP_ID,
    userName: "owner",
    userID: new TextEncoder().encode("owner"),
    userDisplayName: "Wardrobe",
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "required",
    },
    excludeCredentials: existing.map((row) => ({
      id: row.credential_id,
      transports: parseTransports(row.transports),
    })),
  });
  return json(options, await challengeCookie(options.challenge, env.IP_HASH_SALT));
}

export async function finishRegistration(
  request: Request,
  env: Env,
  response: RegistrationResponseJSON,
  label: string | null,
): Promise<Response> {
  const challenge = await readChallenge(request, env);
  if (!challenge) return json({ error: "That passkey prompt expired. Try again." }, undefined, 400);
  let verified;
  try {
    verified = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: env.ORIGIN,
      expectedRPID: env.RP_ID,
      requireUserVerification: true,
    });
  } catch (error) {
    console.error({ job: "auth", step: "register", error: errorText(error) });
    return json({ error: "Passkey was not accepted." }, clearChallengeCookie(), 400);
  }
  if (!verified.verified) return json({ error: "Passkey was not accepted." }, clearChallengeCookie(), 400);
  const credential = verified.registrationInfo.credential;
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO admin_credentials
      (credential_id, public_key, counter, transports, label, created_at, last_used_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      credential.id,
      credential.publicKey,
      credential.counter,
      credential.transports ? JSON.stringify(credential.transports) : null,
      label,
      now,
      now,
    )
    .run();
  return sessionResponse(env);
}

export async function beginLogin(env: Env): Promise<Response> {
  const existing = await listCredentials(env);
  if (existing.length === 0) {
    return json({ error: "No passkey is registered yet." }, undefined, 400);
  }
  const options = await generateAuthenticationOptions({
    rpID: env.RP_ID,
    userVerification: "required",
    allowCredentials: existing.map((row) => ({
      id: row.credential_id,
      transports: parseTransports(row.transports),
    })),
  });
  return json(options, await challengeCookie(options.challenge, env.IP_HASH_SALT));
}

export async function finishLogin(
  request: Request,
  env: Env,
  response: AuthenticationResponseJSON,
): Promise<Response> {
  const challenge = await readChallenge(request, env);
  if (!challenge) return json({ error: "That passkey prompt expired. Try again." }, undefined, 400);
  const credential = await env.DB.prepare(
    "SELECT credential_id, public_key, counter, transports FROM admin_credentials WHERE credential_id = ?",
  )
    .bind(response.id)
    .first<CredentialRow>();
  if (!credential) return json({ error: "Passkey was not accepted." }, clearChallengeCookie(), 400);
  let verified;
  try {
    verified = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: env.ORIGIN,
      expectedRPID: env.RP_ID,
      requireUserVerification: true,
      credential: {
        id: credential.credential_id,
        publicKey: toBytes(credential.public_key),
        counter: credential.counter,
        transports: parseTransports(credential.transports),
      },
    });
  } catch (error) {
    console.error({ job: "auth", step: "login", error: errorText(error) });
    return json({ error: "Passkey was not accepted." }, clearChallengeCookie(), 400);
  }
  if (!verified.verified) return json({ error: "Passkey was not accepted." }, clearChallengeCookie(), 400);
  await env.DB.prepare(
    "UPDATE admin_credentials SET counter = ?, last_used_at = ? WHERE credential_id = ?",
  )
    .bind(verified.authenticationInfo.newCounter, Date.now(), verified.authenticationInfo.credentialID)
    .run();
  return sessionResponse(env);
}

export async function logout(request: Request, env: Env): Promise<Response> {
  const token = readCookie(request, SESSION_COOKIE);
  if (token) {
    const tokenHash = await sha256Hex(token);
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
  }
  return redirect("/admin/login", { headers: { "Set-Cookie": clearSessionCookie() } });
}

async function sessionResponse(env: Env): Promise<Response> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = bytesToBase64Url(bytes);
  const now = Date.now();
  await env.DB.prepare("INSERT INTO sessions (token_hash, created_at, expires_at) VALUES (?, ?, ?)")
    .bind(await sha256Hex(token), now, now + SESSION_MAX_AGE * 1000)
    .run();
  const headers = new Headers();
  headers.append("Set-Cookie", sessionCookie(token));
  headers.append("Set-Cookie", clearChallengeCookie());
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify({ ok: true, redirect: "/admin" }), { headers });
}

async function listCredentials(env: Env): Promise<CredentialRow[]> {
  const rows = await env.DB.prepare(
    "SELECT credential_id, public_key, counter, transports FROM admin_credentials",
  ).all<CredentialRow>();
  return rows.results;
}

function parseTransports(value: string | null): string[] | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : undefined;
  } catch {
    return undefined;
  }
}

function toBytes(value: ArrayBuffer | Uint8Array): Uint8Array<ArrayBuffer> {
  const buffer = new ArrayBuffer(value.byteLength);
  const copy = new Uint8Array(buffer);
  const source = value instanceof Uint8Array ? value : new Uint8Array(value);
  copy.set(source);
  return copy;
}

async function challengeCookie(challenge: string, salt: string): Promise<string> {
  const expires = Date.now() + CHALLENGE_MAX_AGE * 1000;
  const payload = `${challenge}.${expires}`;
  const signature = await hmacHex(salt, payload);
  return `${CHALLENGE_COOKIE}=${payload}.${signature}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${CHALLENGE_MAX_AGE}`;
}

async function readChallenge(request: Request, env: Env): Promise<string | null> {
  const raw = readCookie(request, CHALLENGE_COOKIE);
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [challenge, expires, signature] = parts;
  if (!challenge || !expires || !signature) return null;
  const expected = await hmacHex(env.IP_HASH_SALT, `${challenge}.${expires}`);
  if (!timingSafeEqual(expected, signature)) return null;
  if (Number(expires) < Date.now()) return null;
  return challenge;
}

function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE}`;
}

function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

function clearChallengeCookie(): string {
  return `${CHALLENGE_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

function json(body: unknown, setCookie?: string, status = 200): Response {
  const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store" });
  if (setCookie) headers.set("Set-Cookie", setCookie);
  return new Response(JSON.stringify(body), { status, headers });
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
