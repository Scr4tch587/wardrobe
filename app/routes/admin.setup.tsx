import type { Route } from "./+types/admin.setup";
import { PasskeyButton } from "../components/passkey-button";
import { PageTitle } from "../components/ui";
import { callEdge } from "../lib/edge.server";
import type { SetupData } from "../lib/pages";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Set up · Wardrobe" }];
}

export function loader({ request }: Route.LoaderArgs): Promise<SetupData> {
  return callEdge(request, "adminSetup");
}

export default function Setup({ loaderData }: Route.ComponentProps) {
  return (
    <div>
      <PageTitle kicker="Admin" title="Register a passkey" />
      {loaderData.allowed ? (
        <PasskeyButton mode="register" token={loaderData.token} />
      ) : (
        <p className="max-w-md text-muted">
          This setup link is not valid. Sign in if a passkey is already registered, then open setup again to add another device.
        </p>
      )}
    </div>
  );
}
