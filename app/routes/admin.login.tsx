import type { Route } from "./+types/admin.login";
import { PasskeyButton } from "../components/passkey-button";
import { PageTitle } from "../components/ui";
import { callEdge } from "../lib/edge.server";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Sign in · Wardrobe" }];
}

export function loader({ request }: Route.LoaderArgs) {
  return callEdge(request, "adminLogin");
}

export default function Login() {
  return (
    <div>
      <PageTitle kicker="Admin" title="Sign in" lede="This wardrobe has one owner." />
      <PasskeyButton mode="login" />
    </div>
  );
}
