import { useRef, useState } from "react";

export function PasskeyButton({
  mode,
  token,
}: {
  mode: "login" | "register";
  token?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const labelRef = useRef<HTMLInputElement>(null);
  const endpoint =
    mode === "login"
      ? "/admin/login/passkey"
      : `/admin/setup/passkey${token ? `?token=${encodeURIComponent(token)}` : ""}`;

  async function start() {
    setPending(true);
    setError(null);
    try {
      const optionsResponse = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ intent: "options" }),
      });
      const optionsJSON = (await optionsResponse.json()) as { error?: string };
      if (!optionsResponse.ok) throw new Error(optionsJSON.error ?? "Could not start the passkey prompt.");
      const webauthn = await import("@simplewebauthn/browser");
      const credential =
        mode === "login"
          ? await webauthn.startAuthentication({ optionsJSON: optionsJSON as never })
          : await webauthn.startRegistration({ optionsJSON: optionsJSON as never });
      const verify = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: "verify",
          response: credential,
          label: labelRef.current?.value ?? "",
        }),
      });
      const body = (await verify.json()) as { error?: string; redirect?: string };
      if (!verify.ok) throw new Error(body.error ?? "Passkey was not accepted.");
      window.location.href = body.redirect ?? "/admin";
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Passkey failed.");
      setPending(false);
    }
  }

  return (
    <div className="max-w-md space-y-4">
      {mode === "register" ? (
        <label className="block">
          <span className="text-xs uppercase tracking-[0.14em] text-muted">Device label</span>
          <input ref={labelRef} className="mt-1.5 w-full rounded-xl border border-line bg-card px-3 py-2" placeholder="Laptop" />
        </label>
      ) : null}
      <button
        type="button"
        onClick={() => void start()}
        disabled={pending}
        className="rounded-full bg-ink px-4 py-2 text-sm text-paper disabled:opacity-60"
      >
        {pending ? "Waiting for the passkey…" : mode === "login" ? "Sign in with passkey" : "Register this device"}
      </button>
      {error ? <p className="text-sm text-rust">{error}</p> : null}
    </div>
  );
}
