import { hasAdminSession } from "../app/lib/auth.server";
import { edgeCache } from "../app/lib/cache";
import { timingSafeEqual } from "../app/lib/crypto";
import { runDaily } from "../app/lib/daily.server";
import { publishCutoff } from "../app/lib/dates";
import { dispatch } from "../app/lib/dispatch.server";
import { contentTypeFor, fitPicDate, isMediaPath } from "../app/lib/media.server";
import type { RpcPayload, WireResult } from "../app/lib/wire";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname.startsWith("/media/")) {
      return serveMedia(request, env, ctx, decodeURIComponent(url.pathname.slice("/media/".length)));
    }
    if (url.pathname === "/rpc" && request.method === "POST") {
      if (!authorized(request, env)) return new Response("Unauthorized", { status: 401 });
      return handleRpc(request, env);
    }
    return new Response("Not found", { status: 404 });
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(
      runDaily(env, { force: false, cron: controller.cron }).catch((error: unknown) => {
        console.error({
          job: "daily",
          step: "scheduled",
          error: error instanceof Error ? error.message : String(error),
        });
      }),
    );
  },
} satisfies ExportedHandler<Env>;

function authorized(request: Request, env: Env): boolean {
  const secret = env.API_SECRET;
  if (!secret) return false;
  return timingSafeEqual(request.headers.get("authorization") ?? "", `Bearer ${secret}`);
}

async function handleRpc(request: Request, env: Env): Promise<Response> {
  let payload: RpcPayload;
  try {
    payload = (await request.json()) as RpcPayload;
  } catch {
    return Response.json(thrown("Bad request", 400));
  }
  if (!payload?.op || !payload.url || !payload.method) return Response.json(thrown("Bad request", 400));
  const inner = buildRequest(payload);
  try {
    const value = await dispatch(payload.op, inner, env, payload.params ?? {});
    return Response.json(await pack(value, false));
  } catch (error) {
    if (isData(error) || error instanceof Response) return Response.json(await pack(error, true));
    console.error({
      job: "rpc",
      op: payload.op,
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json(thrown("Something went wrong", 500));
  }
}

function buildRequest(payload: RpcPayload): Request {
  const headers = new Headers();
  if (payload.cookie) headers.set("cookie", payload.cookie);
  if (payload.origin) headers.set("origin", payload.origin);
  if (payload.contentType) headers.set("content-type", payload.contentType);
  if (payload.ip) headers.set("x-visitor-ip", payload.ip);
  const method = payload.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD" && payload.body;
  return new Request(payload.url, {
    method,
    headers,
    body: hasBody ? bytesFromBase64(payload.body!) : undefined,
  });
}

async function serveMedia(request: Request, env: Env, ctx: ExecutionContext, path: string): Promise<Response> {
  if (!isMediaPath(path)) return new Response("Not found", { status: 404 });
  const fitDate = fitPicDate(path);
  let restricted = false;
  if (fitDate) {
    const { cutoff } = publishCutoff(env);
    if (fitDate > cutoff) {
      if (!(await hasAdminSession(request, env))) return new Response("Not found", { status: 404 });
      restricted = true;
    }
  }
  if (!restricted) {
    const cached = await edgeCache().match(request);
    if (cached) return cached;
  }
  const object = await env.MEDIA.get(path);
  if (!object) return new Response("Not found", { status: 404 });
  const ext = path.endsWith(".jpg") ? "jpg" : "webp";
  const headers = new Headers();
  headers.set("Content-Type", object.httpMetadata?.contentType ?? contentTypeFor(ext));
  headers.set("ETag", object.httpEtag);
  headers.set("Cache-Control", restricted ? "private, no-store" : "public, max-age=31536000, immutable");
  headers.set("X-Content-Type-Options", "nosniff");
  const response = new Response(object.body, { headers });
  if (!restricted) ctx.waitUntil(edgeCache().put(request, response.clone()));
  return response;
}

async function pack(value: unknown, thrownValue: boolean): Promise<WireResult> {
  if (isData(value)) {
    return {
      kind: thrownValue ? "throw" : "data",
      data: value.data,
      status: value.init?.status ?? 200,
      cookies: cookiesFrom(value.init?.headers),
    };
  }
  if (value instanceof Response) {
    const cookies = value.headers.getSetCookie();
    const headers: [string, string][] = [];
    value.headers.forEach((headerValue, key) => {
      if (key.toLowerCase() !== "set-cookie") headers.push([key, headerValue]);
    });
    const noBody = value.status === 204 || value.status === 205 || value.status === 304;
    return {
      kind: "response",
      status: value.status,
      headers,
      cookies,
      body: noBody ? null : await value.text(),
    };
  }
  if (thrownValue) return thrown("Something went wrong", 500);
  return { kind: "data", data: value, status: 200, cookies: [] };
}

function thrown(message: string, status: number): WireResult {
  return { kind: "throw", data: message, status, cookies: [] };
}

function isData(value: unknown): value is { type: string; data: unknown; init: ResponseInit | null } {
  return !!value && typeof value === "object" && (value as { type?: string }).type === "DataWithResponseInit";
}

function cookiesFrom(init: HeadersInit | undefined): string[] {
  if (!init) return [];
  return new Headers(init).getSetCookie();
}

function bytesFromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
