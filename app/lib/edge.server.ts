import { data } from "react-router";
import type { RpcPayload, WireResult } from "./wire";

function envValue(name: string): string | undefined {
  return process.env[name];
}

export function mediaOrigin(): string {
  return (envValue("MEDIA_ORIGIN") ?? "").replace(/\/$/, "");
}

export async function callEdge<T = any>(request: Request, op: string, params: object = {}): Promise<T> {
  const api = envValue("CLOUDFLARE_API_URL");
  const secret = envValue("API_SECRET");
  if (!api || !secret) {
    throw new Error("Set CLOUDFLARE_API_URL and API_SECRET so the site can reach the Worker.");
  }
  const method = request.method.toUpperCase();
  let body: string | null = null;
  if (method !== "GET" && method !== "HEAD") {
    const bytes = new Uint8Array(await request.arrayBuffer());
    body = Buffer.from(bytes).toString("base64");
  }
  const payload: RpcPayload = {
    op,
    url: request.url,
    method,
    cookie: request.headers.get("cookie") ?? "",
    origin: request.headers.get("origin") ?? "",
    contentType: request.headers.get("content-type") ?? "",
    ip: clientIp(request),
    params: params as Record<string, string | undefined>,
    body,
  };
  const response = await fetch(new URL("/rpc", api), {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw data("The wardrobe is unavailable right now.", { status: response.status === 401 ? 500 : 502 });
  }
  return materialize((await response.json()) as WireResult) as T;
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;
  return request.headers.get("x-real-ip") ?? "0.0.0.0";
}

function materialize(result: WireResult): unknown {
  if (result.kind === "throw") {
    throw data(result.data, { status: result.status, headers: cookieHeaders(result.cookies) });
  }
  if (result.kind === "data") {
    if (result.status !== 200 || result.cookies.length > 0) {
      return data(result.data, { status: result.status, headers: cookieHeaders(result.cookies) });
    }
    return result.data;
  }
  const headers = new Headers(result.headers);
  for (const cookie of result.cookies) headers.append("set-cookie", cookie);
  return new Response(result.body, { status: result.status, headers });
}

function cookieHeaders(cookies: string[]): Headers {
  const headers = new Headers();
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return headers;
}
