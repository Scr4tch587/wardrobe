export type WireResult =
  | { kind: "data"; data: unknown; status: number; cookies: string[] }
  | { kind: "throw"; data: unknown; status: number; cookies: string[] }
  | {
      kind: "response";
      status: number;
      headers: [string, string][];
      cookies: string[];
      body: string | null;
    };

export type RpcPayload = {
  op: string;
  url: string;
  method: string;
  cookie: string;
  origin: string;
  contentType: string;
  ip: string;
  params: Record<string, string | undefined>;
  body: string | null;
};
